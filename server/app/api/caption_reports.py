"""Caption reports: learners tell staff that a caption is wrong or missing
(Package D, item D2). Staff see the reports in Fidel Studio and fix the
caption there.

  POST  /api/v1/lessons/{id}/caption-reports   anyone (no name, no account)
  GET   /api/v1/lessons/{id}/caption-reports   staff token (?status=open)
  PATCH /api/v1/caption-reports/{id}           staff token: resolved | dismissed

No personal data is stored: no name, no account, no IP address. Abuse limit:
at most 20 reports per IP address per hour, counted in this server's memory
only (it resets when the server restarts, and is per server process).
"""

import os
import secrets
import threading
import time
from collections import defaultdict, deque
from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path as PathParam, Query, Request, status
from pydantic import BaseModel, Field, field_validator

from ..db import now
from ..pipeline import media
from ..pipeline.steps import lesson_folder
from .auth import require_staff
from .lessons import LessonId, db
from .webhooks import notify

router = APIRouter(tags=["caption reports"])
staff = [Depends(require_staff)]

Kind = Literal["wrong_words", "wrong_time", "missing_caption", "missing_sound", "other"]
Status = Literal["open", "resolved", "dismissed"]
KIND_WORDS = {
    "wrong_words": "Wrong words", "wrong_time": "Wrong time", "missing_caption": "Missing caption",
    "missing_sound": "Missing sound description", "other": "Other",
}
LIMIT_PER_HOUR = int(os.environ.get("FIDEL_CAPTION_REPORTS_PER_HOUR", "20"))


# --- Shapes ----------------------------------------------------------------------------


class ReportIn(BaseModel):
    time: float = Field(ge=0, description="Seconds into the video where the problem is")
    lang: str = Field(min_length=2, max_length=5, description="Caption language shown (en, am, om)")
    kind: Kind = Field(description="What is wrong: " + ", ".join(f"{k} ({v})" for k, v in KIND_WORDS.items()))
    correction: str | None = Field(default=None, max_length=500, description="The learner's correction (optional)")
    caption: str | None = Field(default=None, max_length=500, description="The caption shown at that moment (optional)")

    @field_validator("correction", "caption")
    @classmethod
    def blank_is_none(cls, text: str | None) -> str | None:
        return text.strip() or None if text else None


class ReportCreated(BaseModel):
    id: str


class Report(BaseModel):
    id: str
    lesson_id: str
    time: float
    lang: str
    kind: Kind
    correction: str | None
    caption: str | None
    status: Status
    created_at: str
    updated_at: str


class ReportStatus(BaseModel):
    status: Literal["resolved", "dismissed", "open"]


# --- Abuse limit (in memory) -------------------------------------------------------------

_recent: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def _within_limit(ip: str) -> bool:
    """True and counted if this address sent fewer than LIMIT_PER_HOUR reports in the last hour."""
    cutoff = time.monotonic() - 3600
    with _lock:
        sent = _recent[ip]
        while sent and sent[0] < cutoff:
            sent.popleft()
        if len(sent) >= LIMIT_PER_HOUR:
            return False
        sent.append(time.monotonic())
        return True


@lru_cache(maxsize=256)
def _duration(lesson_id: str, source_file: str) -> float:
    """Length of the lesson video in seconds (0 if it cannot be read)."""
    try:
        return media.probe(lesson_folder(lesson_id) / source_file)["duration"]
    except (media.MediaError, OSError):
        return 0.0


# --- Endpoints ---------------------------------------------------------------------------


@router.post("/api/v1/lessons/{lesson_id}/caption-reports", status_code=status.HTTP_201_CREATED,
             response_model=ReportCreated)
def report_caption_problem(body: ReportIn, request: Request, lesson_id: str = LessonId):
    """A learner reports a caption problem. No name or account is needed or
    stored. 400 with a message in words if something is not right; 429 after
    20 reports from one address in an hour."""
    lesson = db.get_lesson(lesson_id)
    if lesson is None or not lesson["published"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No published lesson with this id.")
    folder = lesson_folder(lesson_id)
    languages = sorted(lang for lang in db.get_captions(lesson_id) if (folder / f"captions-{lang}.vtt").is_file())
    if body.lang not in languages:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"This lesson has no '{body.lang}' captions. Its caption languages are: "
                            f"{', '.join(languages) or 'none yet'}.")
    duration = _duration(lesson_id, lesson["source_file"])
    if duration and body.time > duration + 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"The time is after the end of the video (the video is {round(duration)} seconds long).")
    if not _within_limit(request.client.host if request.client else "unknown"):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Too many reports from this connection. Please try again in an hour.")
    report_id = secrets.token_hex(6)
    stamp = now()
    with db.connect() as conn:
        conn.execute(
            "INSERT INTO caption_reports (id, lesson_id, time, lang, kind, correction, caption, status, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)",
            (report_id, lesson_id, round(body.time, 1), body.lang, body.kind, body.correction, body.caption, stamp, stamp),
        )
    notify("caption.reported", {"lesson_id": lesson_id, "report_id": report_id, "lang": body.lang,
                                "kind": body.kind, "time": round(body.time, 1)})
    return ReportCreated(id=report_id)


@router.get("/api/v1/lessons/{lesson_id}/caption-reports", response_model=list[Report], dependencies=staff)
def list_caption_reports(lesson_id: str = LessonId,
                         status_filter: Status | None = Query(default=None, alias="status",
                                                              description="Only reports with this status")):
    """Reports for one lesson, in video-time order (staff)."""
    if db.get_lesson(lesson_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No lesson with this id.")
    query = "SELECT * FROM caption_reports WHERE lesson_id = ?"
    params: list = [lesson_id]
    if status_filter:
        query += " AND status = ?"
        params.append(status_filter)
    with db.connect() as conn:
        rows = conn.execute(query + " ORDER BY time, created_at", params).fetchall()
    return [Report(**dict(r)) for r in rows]


@router.patch("/api/v1/caption-reports/{report_id}", response_model=Report, dependencies=staff)
def set_caption_report_status(body: ReportStatus, report_id: str = PathParam(pattern=r"^[a-f0-9]{12}$")):
    """Mark a report resolved (the caption was fixed) or dismissed (nothing to fix), or open again (staff)."""
    with db.connect() as conn:
        changed = conn.execute("UPDATE caption_reports SET status = ?, updated_at = ? WHERE id = ?",
                               (body.status, now(), report_id)).rowcount
        row = conn.execute("SELECT * FROM caption_reports WHERE id = ?", (report_id,)).fetchone()
    if not changed or row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No caption report with this id.")
    return Report(**dict(row))
