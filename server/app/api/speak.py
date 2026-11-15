"""Read a short text aloud with the optional voice engine ("Listen" in Fidel form fields).

    GET  /api/v1/speak   languages the voice engine reads ([] when none is set up)
    POST /api/v1/speak   {"text": "...", "lang": "am"} -> WAV audio; 409 in words when it cannot

Public (learners use it), so each address may ask at most FIDEL_SPEAK_PER_HOUR
times an hour (default 60), counted in memory: the voice engine is slow on a
CPU and must not be kept busy by one visitor.
"""

import os
import tempfile
import threading
import time
from collections import defaultdict, deque
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from ..config import settings
from ..providers import ProviderUnavailable, get_text_to_speech

router = APIRouter(prefix="/api/v1/speak", tags=["voice"])
LIMIT_PER_HOUR = int(os.environ.get("FIDEL_SPEAK_PER_HOUR", "60"))
_recent: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500, description="What to read (at most 500 characters)")
    lang: str = Field(min_length=2, max_length=8, description="Language code, e.g. am")


class Voices(BaseModel):
    languages: list[str] = Field(description="Languages the voice engine reads; empty when there is none")


def _within_limit(ip: str) -> bool:
    """True and counted if this address asked fewer than LIMIT_PER_HOUR times in the last hour."""
    cutoff = time.monotonic() - 3600
    with _lock:
        asked = _recent[ip]
        while asked and asked[0] < cutoff:
            asked.popleft()
        if len(asked) >= LIMIT_PER_HOUR:
            return False
        asked.append(time.monotonic())
        return True


@router.get("", response_model=Voices)
def voices() -> Voices:
    engine = get_text_to_speech(settings)
    return Voices(languages=sorted(engine.languages) if engine else [])


@router.post("", response_class=Response, responses={
    200: {"content": {"audio/wav": {}}}, 409: {"description": "No voice for this language"},
    429: {"description": "Too many requests from this address this hour"}})
def speak(body: SpeakRequest, request: Request) -> Response:
    engine = get_text_to_speech(settings)
    if engine is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "No voice engine is set up on this server (FIDEL_TTS_URL).")
    if body.lang not in engine.languages:
        raise HTTPException(status.HTTP_409_CONFLICT, f"The voice engine cannot read '{body.lang}'.")
    if not _within_limit(request.client.host if request.client else "unknown"):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Too many readings from this address in the last hour. Please try again later.")
    with tempfile.TemporaryDirectory() as folder:
        out = Path(folder) / "speech.wav"
        try:
            engine.speak(body.text, body.lang, out)
        except ProviderUnavailable as problem:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(problem)) from problem
        return Response(out.read_bytes(), media_type="audio/wav")
