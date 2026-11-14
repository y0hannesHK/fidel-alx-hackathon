"""Staff editing endpoints used by Fidel Studio:
captions (with per-cue review), chapters, audio description text,
sign-language video upload, and publishing.
"""

import shutil
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel, Field, field_validator, model_validator

from .. import document
from ..captions import Cue, from_vtt, read_vtt, write_vtt
from ..config import settings
from ..providers import ProviderUnavailable, get_text_to_speech
from ..pipeline import media
from ..pipeline.runner import queue_steps, run_steps
from ..pipeline.steps import lesson_folder
from .auth import require_staff
from .webhooks import notify
from .lessons import VIDEO_EXTENSIONS, Language, LessonId, Manifest, build_manifest, db, get_lesson_or_404, save_upload

router = APIRouter(prefix="/api/v1/lessons", tags=["editing (staff)"])
staff = [Depends(require_staff)]


# --- Shapes ----------------------------------------------------------------------------


class EditCue(BaseModel):
    start: float = Field(ge=0, description="Seconds")
    end: float = Field(gt=0, description="Seconds")
    text: str = Field(max_length=500)
    reviewed: bool = Field(default=False, description="Checked by a person")

    @field_validator("text")
    @classmethod
    def not_blank(cls, text: str) -> str:
        text = text.strip()
        if not text:
            raise ValueError("Caption text cannot be empty.")
        return text

    @model_validator(mode="after")
    def ends_after_start(self):
        if self.end <= self.start:
            raise ValueError("A caption must end after it starts.")
        return self


class CaptionsEdit(BaseModel):
    cues: list[EditCue] = Field(max_length=5000)


class CaptionsWithReviews(BaseModel):
    lang: Language
    status: str
    cues: list[EditCue]
    drafts_left: int = Field(description="Cues not yet reviewed by a person")


class Chapter(BaseModel):
    start: float = Field(ge=0)
    title_en: str = Field(min_length=1, max_length=120)
    title_am: str | None = Field(default=None, max_length=120)
    image_alt_en: str | None = Field(default=None, max_length=600,
                                     description="Description of the chapter's slide image (for the lesson document)")
    image_alt_am: str | None = Field(default=None, max_length=600)
    image_url: str | None = Field(default=None, description="The slide image (read-only)")


class ChaptersEdit(BaseModel):
    chapters: list[Chapter] = Field(max_length=200)


class DescriptionCue(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(gt=0)
    text: str = Field(min_length=1, max_length=1000)
    has_recording: bool = Field(default=False, description="A recording of it being read aloud exists (read-only)")
    machine_read: bool = Field(default=False, description="The recording was made by the voice engine, not a person (read-only)")


class DescriptionsEdit(BaseModel):
    cues: list[DescriptionCue] = Field(max_length=2000)


class PublishEdit(BaseModel):
    published: bool


# --- Captions ---------------------------------------------------------------------------


@router.get("/{lesson_id}/captions/{lang}/cues", response_model=CaptionsWithReviews, dependencies=staff)
def get_caption_cues(lang: Language, lesson_id: str = LessonId):
    """Caption cues with their review state, for the Studio editor."""
    get_lesson_or_404(lesson_id)
    path = lesson_folder(lesson_id) / f"captions-{lang}.vtt"
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No {lang} captions for this lesson yet.")
    cues = read_vtt(path)
    reviews = db.get_cue_reviews(lesson_id, lang)
    edit = [
        EditCue(start=c.start, end=c.end, text=c.text, reviewed=reviews[i] if i < len(reviews) else False)
        for i, c in enumerate(cues)
    ]
    return CaptionsWithReviews(
        lang=lang,
        status=db.get_captions(lesson_id).get(lang, "draft"),
        cues=edit,
        drafts_left=sum(not c.reviewed for c in edit),
    )


@router.put("/{lesson_id}/captions/{lang}", response_model=CaptionsWithReviews, dependencies=staff)
def save_captions(body: CaptionsEdit, lang: Language, lesson_id: str = LessonId):
    """Save corrected captions. The file becomes 'reviewed' only when every
    cue is marked reviewed; otherwise it stays 'draft'."""
    get_lesson_or_404(lesson_id)
    cues = sorted(body.cues, key=lambda c: c.start)
    reviews = [c.reviewed for c in cues]
    file_status = "reviewed" if cues and all(reviews) else "draft"
    write_vtt(
        lesson_folder(lesson_id) / f"captions-{lang}.vtt",
        [Cue(c.start, c.end, c.text) for c in cues],
        note=f"Edited in Fidel Studio. Status: {file_status}.",
    )
    db.set_caption_status(lesson_id, lang, file_status, reviews)
    if file_status == "reviewed":
        notify("captions.reviewed", {"lesson_id": lesson_id, "lang": lang})
    return CaptionsWithReviews(lang=lang, status=file_status, cues=cues, drafts_left=reviews.count(False))


@router.post("/{lesson_id}/captions", response_model=CaptionsWithReviews, dependencies=staff)
async def upload_captions(lang: Language = Form(), file: UploadFile = File(description="WebVTT caption file (.vtt)"),
                          lesson_id: str = LessonId):
    """Upload a caption file (for lessons that already have captions, or when
    the speech-to-text model is not installed). It replaces this language's
    captions and is marked draft until a person checks it in Studio."""
    get_lesson_or_404(lesson_id)
    raw = await file.read(5 * 1024 * 1024 + 1)
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Caption file is larger than 5 MB.")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as problem:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The caption file must be UTF-8 text.") from problem
    if not text.lstrip().startswith("WEBVTT"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This is not a WebVTT file (it must start with WEBVTT).")
    cues = from_vtt(text)
    if not cues:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No captions found in the file.")
    cues.sort(key=lambda c: c.start)
    write_vtt(lesson_folder(lesson_id) / f"captions-{lang}.vtt", cues, note="Uploaded in Fidel Studio. Status: draft.")
    db.set_caption_status(lesson_id, lang, "draft", [False] * len(cues))
    return get_caption_cues(lang, lesson_id)


# --- Chapters ---------------------------------------------------------------------------


@router.get("/{lesson_id}/chapters", response_model=ChaptersEdit, dependencies=staff)
def get_chapters(lesson_id: str = LessonId):
    get_lesson_or_404(lesson_id)
    folder = lesson_folder(lesson_id)
    english = read_vtt(folder / "chapters-en.vtt") if (folder / "chapters-en.vtt").is_file() else []
    amharic = read_vtt(folder / "chapters-am.vtt") if (folder / "chapters-am.vtt").is_file() else []
    texts = document.image_texts(lesson_id)
    files = f"/files/lessons/{lesson_id}"
    return ChaptersEdit(chapters=[
        Chapter(start=c.start, title_en=c.text, title_am=amharic[i].text if i < len(amharic) else None,
                image_alt_en=texts.get(str(round(c.start * 1000)), {}).get("en"),
                image_alt_am=texts.get(str(round(c.start * 1000)), {}).get("am"),
                image_url=f"{files}/{document.keyframe_name(c.start)}"
                if (folder / document.keyframe_name(c.start)).is_file() else None)
        for i, c in enumerate(english)
    ])


@router.put("/{lesson_id}/chapters", response_model=ChaptersEdit, dependencies=staff)
def save_chapters(body: ChaptersEdit, lesson_id: str = LessonId):
    """Save chapters. The Amharic chapter file is written only when every
    chapter has an Amharic title (no half-English 'Amharic' file)."""
    lesson = get_lesson_or_404(lesson_id)
    folder = lesson_folder(lesson_id)
    chapters = sorted(body.chapters, key=lambda c: c.start)
    duration = media.probe(folder / lesson["source_file"])["duration"]
    ends = [c.start for c in chapters[1:]] + [max(duration, chapters[-1].start + 1)] if chapters else []

    english = [Cue(c.start, end, c.title_en.strip()) for c, end in zip(chapters, ends)]
    write_vtt(folder / "chapters-en.vtt", english)
    amharic_file = folder / "chapters-am.vtt"
    if chapters and all(c.title_am and c.title_am.strip() for c in chapters):
        write_vtt(amharic_file, [Cue(c.start, end, c.title_am.strip()) for c, end in zip(chapters, ends)])
    else:
        amharic_file.unlink(missing_ok=True)
    if not chapters:
        (folder / "chapters-en.vtt").unlink(missing_ok=True)
    # Slide image for each chapter, and the descriptions staff wrote for them.
    texts = {}
    for c in chapters:
        document.ensure_keyframe(lesson, c.start)
        alt = {lang: text.strip() for lang, text in (("en", c.image_alt_en), ("am", c.image_alt_am)) if text and text.strip()}
        if alt:
            texts[str(round(c.start * 1000))] = alt
    document.save_image_texts(lesson_id, texts)
    return get_chapters(lesson_id)


# --- Audio description text ----------------------------------------------------------------


def recording_name(lang: str, start: float) -> str:
    # Recordings are keyed by the description's start time (in milliseconds),
    # so they stay with the right description when the list is reordered.
    return f"desc-{lang}-{round(start * 1000)}.opus"


def machine_marker(recording: Path) -> Path:
    # An empty file next to a recording made by the voice engine, so staff can
    # always tell it from a person's recording.
    return recording.with_suffix(".machine")


@router.get("/{lesson_id}/descriptions/{lang}", response_model=DescriptionsEdit, dependencies=staff)
def get_descriptions(lang: Language, lesson_id: str = LessonId):
    get_lesson_or_404(lesson_id)
    folder = lesson_folder(lesson_id)
    path = folder / f"descriptions-{lang}.vtt"
    cues = read_vtt(path) if path.is_file() else []
    return DescriptionsEdit(cues=[
        DescriptionCue(start=c.start, end=c.end, text=c.text,
                       has_recording=(folder / recording_name(lang, c.start)).is_file(),
                       machine_read=machine_marker(folder / recording_name(lang, c.start)).is_file())
        for c in cues
    ])


@router.put("/{lesson_id}/descriptions/{lang}", response_model=DescriptionsEdit, dependencies=staff)
def save_descriptions(body: DescriptionsEdit, lang: Language, lesson_id: str = LessonId):
    """Save audio description text: what is shown on screen and not said aloud."""
    get_lesson_or_404(lesson_id)
    path = lesson_folder(lesson_id) / f"descriptions-{lang}.vtt"
    cues = sorted(body.cues, key=lambda c: c.start)
    for cue in cues:
        if cue.end <= cue.start:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A description must end after it starts.")
    if cues:
        write_vtt(path, [Cue(c.start, c.end, c.text.strip()) for c in cues])
    else:
        path.unlink(missing_ok=True)
    # Remove recordings whose description no longer exists.
    keep = {recording_name(lang, c.start) for c in cues}
    for recording in lesson_folder(lesson_id).glob(f"desc-{lang}-*.opus"):
        if recording.name not in keep:
            recording.unlink()
            machine_marker(recording).unlink(missing_ok=True)
    return get_descriptions(lang, lesson_id)


@router.post("/{lesson_id}/descriptions/{lang}/recording", response_model=DescriptionsEdit, dependencies=staff)
async def upload_description_recording(
    lang: Language,
    start: float = Query(ge=0, description="Start time of the description (seconds)"),
    audio: UploadFile = File(description="Recording of the description being read aloud"),
    lesson_id: str = LessonId,
):
    """Attach a recording to one description. Needed for Amharic: most phones
    have no Amharic voice to read description text aloud."""
    get_lesson_or_404(lesson_id)
    folder = lesson_folder(lesson_id)
    path = folder / f"descriptions-{lang}.vtt"
    cues = read_vtt(path) if path.is_file() else []
    match = next((c for c in cues if abs(c.start - start) < 0.05), None)
    if match is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No saved description starts at that time. Save the descriptions first.")
    upload = folder / "desc-upload.tmp"
    try:
        await save_upload(audio, upload)
        info = media.probe(upload)
        if not info["has_audio"]:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file has no sound in it.")
        media.make_description_audio(upload, folder / recording_name(lang, match.start))
        machine_marker(folder / recording_name(lang, match.start)).unlink(missing_ok=True)
    except media.MediaError as problem:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This file could not be read as audio.") from problem
    finally:
        upload.unlink(missing_ok=True)
    return get_descriptions(lang, lesson_id)


@router.post("/{lesson_id}/descriptions/{lang}/recording/machine", response_model=DescriptionsEdit, dependencies=staff)
def make_machine_description_recording(
    lang: Language,
    start: float = Query(ge=0, description="Start time of the description (seconds)"),
    lesson_id: str = LessonId,
):
    """Make a MACHINE-READ recording of one description with the optional
    voice engine (Amharic only). Use it when no person has recorded it yet;
    Studio marks it as machine-read. 409 if no voice engine is set up."""
    get_lesson_or_404(lesson_id)
    folder = lesson_folder(lesson_id)
    path = folder / f"descriptions-{lang}.vtt"
    cues = read_vtt(path) if path.is_file() else []
    match = next((c for c in cues if abs(c.start - start) < 0.05), None)
    if match is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No saved description starts at that time. Save the descriptions first.")
    machine_read_recording(" ".join(match.text.split()), lang, folder / recording_name(lang, match.start))
    return get_descriptions(lang, lesson_id)


def machine_read_recording(text: str, lang: str, out: Path) -> None:
    """Voice engine -> WAV -> the same small Opus file a person's recording becomes."""
    engine = get_text_to_speech(settings)
    if engine is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "No voice engine is set up (FIDEL_TTS_URL).")
    if lang not in engine.languages:
        raise HTTPException(status.HTTP_409_CONFLICT, f"The voice engine cannot read '{lang}'.")
    wav = out.with_suffix(".machine.wav")
    try:
        engine.speak(text, lang, wav)
        media.make_description_audio(wav, out)
    except ProviderUnavailable as problem:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(problem)) from problem
    except media.MediaError as problem:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The voice engine sent audio that could not be read.") from problem
    finally:
        wav.unlink(missing_ok=True)
    machine_marker(out).touch()


@router.delete("/{lesson_id}/descriptions/{lang}/recording", response_model=DescriptionsEdit, dependencies=staff)
def delete_description_recording(lang: Language, start: float = Query(ge=0), lesson_id: str = LessonId):
    get_lesson_or_404(lesson_id)
    recording = lesson_folder(lesson_id) / recording_name(lang, start)
    recording.unlink(missing_ok=True)
    machine_marker(recording).unlink(missing_ok=True)
    return get_descriptions(lang, lesson_id)


# --- Sign language video ----------------------------------------------------------------------


@router.post("/{lesson_id}/sign", status_code=status.HTTP_202_ACCEPTED, dependencies=staff)
async def upload_sign_video(background: BackgroundTasks, video: UploadFile = File(), lesson_id: str = LessonId):
    """Upload the Ethiopian Sign Language video. It must start at the same
    moment as the lesson video. It is resized for the sign window in the background."""
    get_lesson_or_404(lesson_id)
    extension = "." + (video.filename or "").rsplit(".", 1)[-1].lower()
    if extension not in VIDEO_EXTENSIONS:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Unsupported file type.")
    folder = lesson_folder(lesson_id)
    for old in folder.glob("sign-source.*"):
        old.unlink()
    target = folder / f"sign-source{extension}"
    try:
        await save_upload(video, target)
        if not media.probe(target)["has_video"]:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file has no video in it.")
    except media.MediaError as problem:
        target.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This file could not be read as a video.") from problem
    except HTTPException:
        target.unlink(missing_ok=True)
        raise
    queue_steps(db, lesson_id, ["sign_video"])
    background.add_task(run_steps, db, lesson_id, ["sign_video"])
    return {"status": "processing"}


# --- Publish ----------------------------------------------------------------------------------


@router.post("/{lesson_id}/publish", response_model=Manifest, dependencies=staff)
def publish(body: PublishEdit, request: Request, lesson_id: str = LessonId):
    """Make the lesson visible to learners (or hide it again)."""
    get_lesson_or_404(lesson_id)
    db.set_published(lesson_id, body.published)
    manifest = build_manifest(db.get_lesson(lesson_id), request)
    notify("lesson.published" if body.published else "lesson.unpublished",
           {"lesson_id": lesson_id, "manifest_url": str(request.url_for("get_manifest", lesson_id=lesson_id))})
    return manifest


# --- Delete -----------------------------------------------------------------------------------


@router.delete("/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=staff)
def delete_lesson(lesson_id: str = LessonId):
    """Delete a lesson and all its files. This cannot be undone."""
    get_lesson_or_404(lesson_id)
    db.delete_lesson(lesson_id)
    shutil.rmtree(lesson_folder(lesson_id), ignore_errors=True)
