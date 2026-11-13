"""Staff editing endpoints used by Fidel Studio:
captions (with per-cue review), chapters, audio description text,
sign-language video upload, and publishing.
"""

import shutil

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field, field_validator, model_validator

from ..captions import Cue, read_vtt, write_vtt
from ..pipeline import media
from ..pipeline.runner import queue_steps, run_steps
from ..pipeline.steps import lesson_folder
from .auth import require_staff
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


class ChaptersEdit(BaseModel):
    chapters: list[Chapter] = Field(max_length=200)


class DescriptionCue(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(gt=0)
    text: str = Field(min_length=1, max_length=1000)


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
    return CaptionsWithReviews(lang=lang, status=file_status, cues=cues, drafts_left=reviews.count(False))


# --- Chapters ---------------------------------------------------------------------------


@router.get("/{lesson_id}/chapters", response_model=ChaptersEdit, dependencies=staff)
def get_chapters(lesson_id: str = LessonId):
    get_lesson_or_404(lesson_id)
    folder = lesson_folder(lesson_id)
    english = read_vtt(folder / "chapters-en.vtt") if (folder / "chapters-en.vtt").is_file() else []
    amharic = read_vtt(folder / "chapters-am.vtt") if (folder / "chapters-am.vtt").is_file() else []
    return ChaptersEdit(chapters=[
        Chapter(start=c.start, title_en=c.text, title_am=amharic[i].text if i < len(amharic) else None)
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
    return ChaptersEdit(chapters=chapters)


# --- Audio description text ----------------------------------------------------------------


@router.get("/{lesson_id}/descriptions/{lang}", response_model=DescriptionsEdit, dependencies=staff)
def get_descriptions(lang: Language, lesson_id: str = LessonId):
    get_lesson_or_404(lesson_id)
    path = lesson_folder(lesson_id) / f"descriptions-{lang}.vtt"
    cues = read_vtt(path) if path.is_file() else []
    return DescriptionsEdit(cues=[DescriptionCue(start=c.start, end=c.end, text=c.text) for c in cues])


@router.put("/{lesson_id}/descriptions/{lang}", response_model=DescriptionsEdit, dependencies=staff)
def save_descriptions(body: DescriptionsEdit, lang: Language, lesson_id: str = LessonId):
    """Save audio description text: what is shown on screen and not said aloud."""
    get_lesson_or_404(lesson_id)
    path = lesson_folder(lesson_id) / f"descriptions-{lang}.vtt"
    cues = sorted(body.cues, key=lambda c: c.start)
    for cue in cues:
        if cue.end <= cue.start:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "A description must end after it starts.")
    if cues:
        write_vtt(path, [Cue(c.start, c.end, c.text.strip()) for c in cues])
    else:
        path.unlink(missing_ok=True)
    return DescriptionsEdit(cues=cues)


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
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The file has no video in it.")
    except media.MediaError as problem:
        target.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "This file could not be read as a video.") from problem
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
    return build_manifest(db.get_lesson(lesson_id), request)


# --- Delete -----------------------------------------------------------------------------------


@router.delete("/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=staff)
def delete_lesson(lesson_id: str = LessonId):
    """Delete a lesson and all its files. This cannot be undone."""
    get_lesson_or_404(lesson_id)
    db.delete_lesson(lesson_id)
    shutil.rmtree(lesson_folder(lesson_id), ignore_errors=True)
