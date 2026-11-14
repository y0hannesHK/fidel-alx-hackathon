"""Offline downloads for learners: one-page lesson and the full .zip pack."""

import re

from typing import Literal

from fastapi import APIRouter, Header, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, Response

from .. import braille, document, pack
from .auth import is_staff
from ..captions import read_vtt
from ..pipeline.steps import lesson_folder
from .lessons import LessonId, base_url, db, get_lesson_or_404

router = APIRouter(prefix="/api/v1/lessons", tags=["offline"])


def visible_lesson(lesson_id: str, authorization: str) -> dict:
    lesson = get_lesson_or_404(lesson_id)
    if not lesson["published"] and not is_staff(authorization):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No lesson with this id.")
    return lesson


def file_name(lesson: dict, extension: str) -> str:
    # ASCII-only, safe file name from the title (falls back to the id).
    slug = re.sub(r"[^a-z0-9]+", "-", lesson["title"].lower()).strip("-")[:60]
    return f"{slug or 'lesson-' + lesson['id']}.{extension}"


@router.get("/{lesson_id}/offline.html", response_class=HTMLResponse)
def offline_page(
    lesson_id: str = LessonId,
    video: bool = Query(default=False, description="Include the small video (bigger download)"),
    inline: bool = Query(default=False, description="Show in the browser instead of downloading"),
    authorization: str = Header(default=""),
):
    """The whole lesson in ONE web page (audio, transcripts, font inside).
    Save it on a phone and open it with no internet."""
    lesson = visible_lesson(lesson_id, authorization)
    try:
        page = pack.offline_page(lesson, db.get_captions(lesson_id), with_video=video)
    except FileNotFoundError as missing:
        raise HTTPException(status.HTTP_409_CONFLICT, str(missing)) from missing
    disposition = "inline" if inline else "attachment"
    return HTMLResponse(page, headers={
        "Content-Disposition": f'{disposition}; filename="{file_name(lesson, "html")}"',
    })


@router.get("/{lesson_id}/pack", response_class=Response,
            responses={200: {"content": {"application/zip": {}}}})
def offline_pack(lesson_id: str = LessonId, authorization: str = Header(default="")):
    """Offline pack (.zip): the one-page lesson plus caption, description and
    plain-text transcript files."""
    lesson = visible_lesson(lesson_id, authorization)
    try:
        data = pack.pack_zip(lesson, db.get_captions(lesson_id))
    except FileNotFoundError as missing:
        raise HTTPException(status.HTTP_409_CONFLICT, str(missing)) from missing
    return Response(data, media_type="application/zip", headers={
        "Content-Disposition": f'attachment; filename="{file_name(lesson, "zip")}"',
    })


@router.get("/{lesson_id}/document.html", response_class=HTMLResponse)
def lesson_document(request: Request, lesson_id: str = LessonId, lang: Literal["en", "am"] = "en",
                    authorization: str = Header(default="")):
    """The lesson as an accessible document: chapters as headings, transcript,
    audio descriptions, and slide images with descriptions written by staff."""
    lesson = visible_lesson(lesson_id, authorization)
    try:
        page = document.build_html(lesson, lang, db.get_captions(lesson_id),
                                   image_base=f"{base_url(request)}/files/lessons/{lesson_id}/")
    except FileNotFoundError as missing:
        raise HTTPException(status.HTTP_409_CONFLICT, str(missing)) from missing
    return HTMLResponse(page)


@router.get("/{lesson_id}/document.pdf", response_class=Response,
            responses={200: {"content": {"application/pdf": {}}}})
def lesson_document_pdf(lesson_id: str = LessonId, lang: Literal["en", "am"] = "en",
                        authorization: str = Header(default="")):
    """The same document as a tagged PDF (PDF/UA-1) with Ethiopic font embedded."""
    lesson = visible_lesson(lesson_id, authorization)
    try:
        pdf = document.build_pdf(lesson, lang, db.get_captions(lesson_id))
    except FileNotFoundError as missing:
        raise HTTPException(status.HTTP_409_CONFLICT, str(missing)) from missing
    return Response(pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{file_name(lesson, "pdf").replace(".pdf", f"-{lang}.pdf")}"',
    })


@router.get("/{lesson_id}/braille.brf", response_class=Response,
            responses={200: {"content": {"text/plain": {}}}})
def lesson_braille(lesson_id: str = LessonId, lang: Literal["en", "am"] = "en",
                   authorization: str = Header(default="")):
    """The lesson's title, chapters and transcript as a Braille Ready File
    (.brf: Unified English Braille grade 2, 40 cells by 25 lines), for
    embossers and refreshable Braille displays."""
    lesson = visible_lesson(lesson_id, authorization)
    try:
        brf = braille.lesson_brf(lesson, lang)
    except FileNotFoundError as missing:
        raise HTTPException(status.HTTP_409_CONFLICT, str(missing)) from missing
    except braille.BrailleUnavailable as problem:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, str(problem)) from problem
    return Response(brf.encode("ascii", errors="replace"), media_type="text/plain; charset=us-ascii", headers={
        "Content-Disposition": f'attachment; filename="{file_name(lesson, "brf").replace(".brf", f"-{lang}.brf")}"',
    })


@router.get("/{lesson_id}/offline-pack", response_class=Response, include_in_schema=False)
def offline_pack_alias(lesson_id: str = LessonId, authorization: str = Header(default="")):
    """Same as /pack (the name used in the hackathon's data contract)."""
    return offline_pack(lesson_id, authorization)


@router.get("/{lesson_id}/transcript", response_class=Response,
            responses={200: {"content": {"text/plain": {}}}})
def transcript(lesson_id: str = LessonId, lang: Literal["en", "am", "om"] = "en",
               authorization: str = Header(default="")):
    """The transcript as plain text (UTF-8), one caption per line."""
    lesson = visible_lesson(lesson_id, authorization)
    path = lesson_folder(lesson_id) / f"captions-{lang}.vtt"
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No {lang} captions for this lesson yet.")
    text = "\n".join(c.text.replace("\n", " ") for c in read_vtt(path)) + "\n"
    return Response(text.encode("utf-8"), media_type="text/plain; charset=utf-8", headers={
        "Content-Disposition": f'attachment; filename="{file_name(lesson, "txt").replace(".txt", f"-transcript-{lang}.txt")}"',
    })
