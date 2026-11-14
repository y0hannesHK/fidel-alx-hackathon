"""Lesson endpoints: upload, list, manifest, progress, captions, rebuild."""

import secrets
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Header, HTTPException, Path as PathParam, Request, UploadFile, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from ..config import settings
from ..db import Database
from ..pipeline import media
from ..pipeline.runner import queue_steps, run_steps
from .. import braille
from ..pipeline.steps import STEPS, lesson_folder
from .auth import is_staff, require_staff

router = APIRouter(prefix="/api/v1/lessons", tags=["lessons"])
db = Database(settings.data_dir / "fidel.db")

VIDEO_EXTENSIONS = {".mp4", ".m4v", ".mov", ".mkv", ".webm"}
LessonId = PathParam(pattern=r"^[a-f0-9]{12}$", description="Lesson id")
Language = Literal["en", "am", "om"]  # English, Amharic, Afaan Oromo
StepName = Literal[tuple(STEPS)]  # type: ignore[valid-type]


# --- Response shapes (these appear in the OpenAPI spec) ---------------------------


class StepStatus(BaseModel):
    status: Literal["pending", "running", "done", "failed", "skipped"]
    message: str | None = None
    updated_at: str


class CaptionTrack(BaseModel):
    lang: Language
    status: Literal["draft", "reviewed"] = Field(description="draft = machine-made, not yet checked by a person")
    url: str


class Manifest(BaseModel):
    id: str
    title: str
    spoken_language: Language
    created_at: str
    video: dict[str, str] = Field(description="Video files: mp4, webm, small_mp4 (low-data)")
    audio: dict[str, str] = Field(description="Audio-only files: opus")
    captions: list[CaptionTrack]
    chapters: dict[str, str] = Field(description="Chapter lists (WebVTT) by language")
    descriptions: dict[str, str] = Field(description="Audio description text (WebVTT) by language")
    description_recordings: dict[str, list[dict]] = Field(
        description="Recorded audio descriptions by language: [{start, url}]")
    sign: str | None = Field(description="Sign-language video (WebM)")
    offline: dict[str, str] = Field(description="Offline downloads: page (one HTML file), page_with_video, pack (.zip)")
    offline_sizes: dict[str, int] = Field(description="About how many bytes each offline download is, to show before downloading")
    documents: dict[str, str] = Field(description="Accessible lesson documents: html_en, pdf_en, brf_en (Braille), html_am, pdf_am, brf_am")
    published: bool
    steps: dict[str, StepStatus]


class LessonSummary(BaseModel):
    id: str
    title: str
    spoken_language: Language
    created_at: str
    published: bool
    manifest_url: str


class Created(BaseModel):
    id: str
    manifest_url: str
    status_url: str


class RebuildRequest(BaseModel):
    steps: list[StepName] = Field(default_factory=lambda: list(STEPS), description="Steps to run again")


# --- Helpers ------------------------------------------------------------------------


def base_url(request: Request) -> str:
    return settings.public_url or str(request.base_url).rstrip("/")


def get_lesson_or_404(lesson_id: str) -> dict:
    lesson = db.get_lesson(lesson_id)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No lesson with this id.")
    return lesson


def offline_sizes(folder) -> dict[str, int]:
    """Estimated download sizes. The offline page embeds the audio (and video)
    as base64, which adds a third; the font adds about 100 KB."""
    def size(name: str) -> int:
        return (folder / name).stat().st_size if (folder / name).is_file() else 0
    if not size("audio.opus"):
        return {}
    text = sum(size(f"{kind}-{lang}.vtt") for kind in ("captions", "chapters", "descriptions") for lang in ("en", "am", "om"))
    page = size("audio.opus") * 4 // 3 + 100_000 + text * 2
    return {
        "page": page,
        "page_with_video": page - size("audio.opus") * 4 // 3 + size("video-small.mp4") * 4 // 3,
        "pack": page * 3 // 4 + text,  # the zip compresses part of the base64
    }


def build_manifest(lesson: dict, request: Request) -> Manifest:
    folder = lesson_folder(lesson["id"])
    files = f"{base_url(request)}/files/lessons/{lesson['id']}"
    api = f"{base_url(request)}/api/v1/lessons/{lesson['id']}"

    def if_exists(name: str) -> str | None:
        return f"{files}/{name}" if (folder / name).is_file() else None

    video = {k: v for k, v in {
        "mp4": if_exists("video.mp4"),
        "webm": if_exists("video.webm"),
        "small_mp4": if_exists("video-small.mp4"),
    }.items() if v}
    audio = {"opus": url} if (url := if_exists("audio.opus")) else {}
    captions = [
        CaptionTrack(lang=lang, status=state, url=f"{api}/captions/{lang}")
        for lang, state in sorted(db.get_captions(lesson["id"]).items())
        if (folder / f"captions-{lang}.vtt").is_file()
    ]
    by_language = lambda kind: {  # noqa: E731
        lang: url for lang in ("en", "am") if (url := if_exists(f"{kind}-{lang}.vtt"))
    }
    return Manifest(
        id=lesson["id"],
        title=lesson["title"],
        spoken_language=lesson["spoken_language"],
        created_at=lesson["created_at"],
        video=video,
        audio=audio,
        captions=captions,
        chapters=by_language("chapters"),
        descriptions=by_language("descriptions"),
        description_recordings={
            lang: [{"start": int(p.stem.rsplit("-", 1)[1]) / 1000, "url": f"{files}/{p.name}"}
                   for p in sorted(folder.glob(f"desc-{lang}-*.opus"))]
            for lang in ("en", "am") if any(folder.glob(f"desc-{lang}-*.opus"))
        },
        sign=if_exists("sign.webm"),
        offline={
            "page": f"{api}/offline.html",
            "page_with_video": f"{api}/offline.html?video=true",
            "pack": f"{api}/pack",
        } if (folder / "audio.opus").is_file() else {},
        offline_sizes=offline_sizes(folder),
        documents={
            **{f"{kind}_{lang}": f"{api}/document.{kind}?lang={lang}"
               for lang in ("en", "am") if (folder / f"captions-{lang}.vtt").is_file() for kind in ("html", "pdf")},
            **{f"brf_{lang}": f"{api}/braille.brf?lang={lang}"
               for lang in braille.available_languages() if (folder / f"captions-{lang}.vtt").is_file()},
        },
        published=bool(lesson["published"]),
        steps=db.get_steps(lesson["id"]),
    )


async def save_upload(upload: UploadFile, target: Path) -> None:
    """Copy the upload to disk in chunks, stopping at the size limit."""
    limit = settings.max_upload_mb * 1024 * 1024
    written = 0
    with target.open("wb") as out:
        while chunk := await upload.read(1024 * 1024):
            written += len(chunk)
            if written > limit:
                raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Video is larger than {settings.max_upload_mb} MB.")
            out.write(chunk)


# --- Endpoints ------------------------------------------------------------------------


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Created, dependencies=[Depends(require_staff)])
async def upload_lesson(
    request: Request,
    background: BackgroundTasks,
    video: UploadFile = File(description="Lesson video (mp4, mov, mkv, webm)"),
    title: str = Form(min_length=1, max_length=200),
    spoken_language: Language = Form(default="en", description="Language spoken in the video"),
):
    """Upload a lesson video. Processing starts in the background; follow it at status_url."""
    extension = Path(video.filename or "").suffix.lower()
    if extension not in VIDEO_EXTENSIONS:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"Unsupported file type. Use one of: {', '.join(sorted(VIDEO_EXTENSIONS))}.")

    lesson_id = secrets.token_hex(6)  # random, unguessable
    folder = lesson_folder(lesson_id)
    folder.mkdir(parents=True)
    # We never use the uploaded file name on disk (no path tricks possible).
    source = folder / f"source{extension}"
    try:
        await save_upload(video, source)
        info = media.probe(source)
        if not info["has_video"]:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file has no video in it.")
    except (HTTPException, media.MediaError) as problem:
        for file in folder.iterdir():
            file.unlink()
        folder.rmdir()
        if isinstance(problem, media.MediaError):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This file could not be read as a video.") from problem
        raise

    db.add_lesson(lesson_id, title.strip(), spoken_language, source.name)
    queue_steps(db, lesson_id, list(STEPS))
    background.add_task(run_steps, db, lesson_id, list(STEPS))
    api = f"{base_url(request)}/api/v1/lessons/{lesson_id}"
    return Created(id=lesson_id, manifest_url=api, status_url=f"{api}/status")


@router.get("", response_model=list[LessonSummary])
def list_lessons(request: Request, authorization: str = Header(default="")):
    """Published lessons. Staff (with the token) also see unpublished ones."""
    return [
        LessonSummary(**{k: lesson[k] for k in ("id", "title", "spoken_language", "created_at", "published")},
                      manifest_url=f"{base_url(request)}/api/v1/lessons/{lesson['id']}")
        for lesson in db.list_lessons(include_unpublished=is_staff(authorization))
    ]


@router.get("/{lesson_id}", response_model=Manifest)
def get_manifest(request: Request, lesson_id: str = LessonId, authorization: str = Header(default="")):
    """Everything a player needs: file URLs and caption statuses.
    Unpublished lessons are only shown to staff."""
    lesson = get_lesson_or_404(lesson_id)
    if not lesson["published"] and not is_staff(authorization):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No lesson with this id.")
    return build_manifest(lesson, request)


@router.get("/{lesson_id}/status", response_model=dict[str, StepStatus])
def get_status(lesson_id: str = LessonId):
    """Progress of each pipeline step."""
    get_lesson_or_404(lesson_id)
    return db.get_steps(lesson_id)


@router.get("/{lesson_id}/captions/{lang}", response_class=PlainTextResponse,
            responses={200: {"content": {"text/vtt": {}}}})
def get_captions(lang: Language, lesson_id: str = LessonId):
    """Captions as a WebVTT file."""
    get_lesson_or_404(lesson_id)
    path = lesson_folder(lesson_id) / f"captions-{lang}.vtt"
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No {lang} captions for this lesson yet.")
    return PlainTextResponse(path.read_text(encoding="utf-8"), media_type="text/vtt; charset=utf-8")


@router.post("/{lesson_id}/rebuild", status_code=status.HTTP_202_ACCEPTED,
             response_model=dict[str, StepStatus], dependencies=[Depends(require_staff)])
def rebuild(background: BackgroundTasks, body: RebuildRequest | None = None, lesson_id: str = LessonId):
    """Run some pipeline steps again (e.g. after downloading a model)."""
    get_lesson_or_404(lesson_id)
    names = (body or RebuildRequest()).steps
    queue_steps(db, lesson_id, names)
    background.add_task(run_steps, db, lesson_id, names)
    return db.get_steps(lesson_id)
