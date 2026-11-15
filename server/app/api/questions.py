"""Learner questions about a moment in a lesson (Package E, item E2:
<fidel-question>). A learner asks in writing, with a voice note or in sign
language; staff see the questions in Fidel Studio.

  POST  /api/v1/lessons/{id}/questions        anyone (no name, no account); multipart
  GET   /api/v1/lessons/{id}/questions        staff token (?status=open)
  GET   /api/v1/questions/{id}/media          staff token: the voice note or sign video
  PATCH /api/v1/questions/{id}                staff token: answered | dismissed | open

No personal data is stored: no name, no account, no IP address. Voice notes
and sign videos are kept in data/questions/<lesson id>/ (NOT under /files, so
they are never public) and are deleted with the lesson. Nothing is sent to a
speech-to-text service. Abuse limit: at most 20 questions per address per hour
(FIDEL_QUESTIONS_PER_HOUR), counted in this server's memory only.
"""

import os
import secrets
import threading
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Path as PathParam, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..config import settings
from ..db import now
from .auth import require_staff
from .lessons import LessonId, db
from .webhooks import notify

router = APIRouter(tags=["questions"])
staff = [Depends(require_staff)]

Kind = Literal["text", "voice", "sign"]
Status = Literal["open", "answered", "dismissed"]
LIMIT_PER_HOUR = int(os.environ.get("FIDEL_QUESTIONS_PER_HOUR", "20"))
MAX_MEDIA_MB = int(os.environ.get("FIDEL_QUESTION_MEDIA_MB", "25"))
MAX_TEXT = 2000
# What each kind may upload, and the file name extension kept.
MEDIA_TYPES = {
    "voice": {"audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/x-m4a": "m4a",
              "audio/aac": "aac", "audio/wav": "wav", "audio/x-wav": "wav", "audio/3gpp": "3gp", "audio/amr": "amr"},
    "sign": {"video/webm": "webm", "video/mp4": "mp4", "video/quicktime": "mov", "video/3gpp": "3gp"},
}


def question_folder(lesson_id: str) -> Path:
    return settings.data_dir / "questions" / lesson_id


# --- Shapes ----------------------------------------------------------------------------


class QuestionCreated(BaseModel):
    id: str


class Question(BaseModel):
    id: str
    lesson_id: str
    time: float = Field(description="Seconds into the video the question is about")
    kind: Kind = Field(description="text, voice (a voice note) or sign (a sign-language video)")
    text: str | None
    caption: str | None = Field(description="The caption shown at that moment, if any")
    media_type: str | None = Field(description="MIME type of the voice note or sign video")
    media_url: str | None = Field(description="Staff-only address of the voice note or sign video")
    status: Status
    created_at: str
    updated_at: str


class QuestionStatus(BaseModel):
    status: Status


# --- Abuse limit (in memory) -------------------------------------------------------------

_recent: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def _within_limit(ip: str) -> bool:
    """True and counted if this address sent fewer than LIMIT_PER_HOUR questions in the last hour."""
    cutoff = time.monotonic() - 3600
    with _lock:
        sent = _recent[ip]
        while sent and sent[0] < cutoff:
            sent.popleft()
        if len(sent) >= LIMIT_PER_HOUR:
            return False
        sent.append(time.monotonic())
        return True


def _bad(message: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, message)


def _row_to_question(row) -> Question:
    data = dict(row)
    media = data.pop("media_file")
    return Question(**data, media_url=f"/api/v1/questions/{data['id']}/media" if media else None)


# --- Endpoints ---------------------------------------------------------------------------


@router.post("/api/v1/lessons/{lesson_id}/questions", status_code=status.HTTP_201_CREATED, response_model=QuestionCreated)
async def ask_question(
    request: Request,
    lesson_id: str = LessonId,
    time_seconds: float = Form(alias="time", ge=0, description="Seconds into the video"),
    kind: Kind = Form(description="text, voice or sign"),
    text: str | None = Form(default=None, description=f"The question in writing (needed for kind=text; up to {MAX_TEXT} letters)"),
    caption: str | None = Form(default=None, description="The caption shown at that moment (optional, up to 500 letters)"),
    media: UploadFile | None = File(default=None, description="Voice note (audio/*) for kind=voice, sign video (video/*) for kind=sign"),
):
    """A learner asks about a moment in a lesson. No name or account is needed
    or stored. 400 with a message in words if something is not right; 413 if
    the recording is too big; 429 after 20 questions from one address in an hour."""
    lesson = db.get_lesson(lesson_id)
    if lesson is None or not lesson["published"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No published lesson with this id.")
    text = (text or "").strip() or None
    caption = (caption or "").strip()[:500] or None
    if text and len(text) > MAX_TEXT:
        raise _bad(f"The question is too long: at most {MAX_TEXT} letters.")
    has_media = media is not None and bool(media.filename or media.size)
    extension = content_type = None
    if kind == "text":
        if not text:
            raise _bad("Write the question in 'text', or send a voice note or sign video with kind=voice or kind=sign.")
        if has_media:
            raise _bad("A written question (kind=text) has no recording. Use kind=voice or kind=sign.")
    else:
        if not has_media:
            raise _bad(f"Add the {'voice note' if kind == 'voice' else 'sign-language video'} as the 'media' file.")
        content_type = (media.content_type or "").split(";")[0].strip().lower()
        extension = MEDIA_TYPES[kind].get(content_type)
        if extension is None:
            wanted = "an audio file (audio/webm, audio/ogg, audio/mp4…)" if kind == "voice" else "a video file (video/webm, video/mp4…)"
            raise _bad(f"The recording must be {wanted}, not '{content_type or 'unknown'}'.")
    if not _within_limit(request.client.host if request.client else "unknown"):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Too many questions from this connection. Please try again in an hour.")

    question_id = secrets.token_hex(6)
    media_file = None
    if extension:
        folder = question_folder(lesson_id)
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / f"{question_id}.{extension}"
        limit = MAX_MEDIA_MB * 1024 * 1024
        written = 0
        with target.open("wb") as out:
            while chunk := await media.read(1024 * 1024):
                written += len(chunk)
                if written > limit:
                    out.close()
                    target.unlink(missing_ok=True)
                    raise HTTPException(413,
                                        f"The recording is larger than {MAX_MEDIA_MB} MB. Please record a shorter question.")
                out.write(chunk)
        if written == 0:
            target.unlink(missing_ok=True)
            raise _bad("The recording is empty. Please record again.")
        media_file = target.name

    stamp = now()
    with db.connect() as conn:
        conn.execute(
            "INSERT INTO questions (id, lesson_id, time, kind, text, caption, media_file, media_type, status, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)",
            (question_id, lesson_id, round(time_seconds, 1), kind, text, caption, media_file,
             content_type if extension else None, stamp, stamp),
        )
    notify("question.asked", {"lesson_id": lesson_id, "question_id": question_id, "kind": kind,
                              "time": round(time_seconds, 1)})
    return QuestionCreated(id=question_id)


@router.get("/api/v1/lessons/{lesson_id}/questions", response_model=list[Question], dependencies=staff)
def list_questions(lesson_id: str = LessonId,
                   status_filter: Status | None = Query(default=None, alias="status", description="Only questions with this status")):
    """Questions for one lesson, in video-time order (staff)."""
    if db.get_lesson(lesson_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No lesson with this id.")
    query = "SELECT * FROM questions WHERE lesson_id = ?"
    params: list = [lesson_id]
    if status_filter:
        query += " AND status = ?"
        params.append(status_filter)
    with db.connect() as conn:
        rows = conn.execute(query + " ORDER BY time, created_at", params).fetchall()
    return [_row_to_question(r) for r in rows]


@router.get("/api/v1/questions/{question_id}/media", dependencies=staff,
            responses={200: {"content": {"audio/webm": {}, "video/webm": {}}, "description": "The recording"}})
def question_media(question_id: str = PathParam(pattern=r"^[a-f0-9]{12}$")):
    """The voice note or sign-language video of a question (staff only: never public)."""
    with db.connect() as conn:
        row = conn.execute("SELECT lesson_id, media_file, media_type FROM questions WHERE id = ?", (question_id,)).fetchone()
    path = question_folder(row["lesson_id"]) / row["media_file"] if row and row["media_file"] else None
    if path is None or not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This question has no recording.")
    return FileResponse(path, media_type=row["media_type"] or "application/octet-stream",
                        headers={"Cache-Control": "private, no-store"})


@router.patch("/api/v1/questions/{question_id}", response_model=Question, dependencies=staff)
def set_question_status(body: QuestionStatus, question_id: str = PathParam(pattern=r"^[a-f0-9]{12}$")):
    """Mark a question answered or dismissed, or open again (staff)."""
    with db.connect() as conn:
        changed = conn.execute("UPDATE questions SET status = ?, updated_at = ? WHERE id = ?",
                               (body.status, now(), question_id)).rowcount
        row = conn.execute("SELECT * FROM questions WHERE id = ?", (question_id,)).fetchone()
    if not changed or row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No question with this id.")
    return _row_to_question(row)

