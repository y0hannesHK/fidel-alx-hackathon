"""Lesson endpoints: upload, list, manifest, progress, captions, rebuild."""

import secrets
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Path as PathParam, Request, UploadFile, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from ..config import settings
from ..db import Database
from ..pipeline import media
from ..pipeline.runner import queue_steps, run_steps
from ..pipeline.steps import STEPS, lesson_folder
from .auth import require_staff

router = APIRouter(prefix="/api/v1/lessons", tags=["lessons"])
db = Database(settings.data_dir / "fidel.db")

VIDEO_EXTENSIONS = {".mp4", ".m4v", ".mov", ".mkv", ".webm"}
LessonId = PathParam(pattern=r"^[a-f0-9]{12}$", description="Lesson id")
Language = Literal["en", "am"]
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
    steps: dict[str, StepStatus]


class LessonSummary(BaseModel):
    id: str
    title: str
    spoken_language: Language
    created_at: str
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
    return Manifest(
        id=lesson["id"],
        title=lesson["title"],
        spoken_language=lesson["spoken_language"],
        created_at=lesson["created_at"],
        video=video,
        audio=audio,
        captions=captions,
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
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The file has no video in it.")
    except (HTTPException, media.MediaError) as problem:
        for file in folder.iterdir():
            file.unlink()
        folder.rmdir()
        if isinstance(problem, media.MediaError):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "This file could not be read as a video.") from problem
        raise

    db.add_lesson(lesson_id, title.strip(), spoken_language, source.name)
    queue_steps(db, lesson_id, list(STEPS))
    background.add_task(run_steps, db, lesson_id, list(STEPS))
    api = f"{base_url(request)}/api/v1/lessons/{lesson_id}"
    return Created(id=lesson_id, manifest_url=api, status_url=f"{api}/status")


@router.get("", response_model=list[LessonSummary])
def list_lessons(request: Request):
    return [
        LessonSummary(**{k: lesson[k] for k in ("id", "title", "spoken_language", "created_at")},
                      manifest_url=f"{base_url(request)}/api/v1/lessons/{lesson['id']}")
        for lesson in db.list_lessons()
    ]


@router.get("/{lesson_id}", response_model=Manifest)
def get_manifest(request: Request, lesson_id: str = LessonId):
    """Everything a player needs: file URLs and caption statuses."""
    return build_manifest(get_lesson_or_404(lesson_id), request)


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
