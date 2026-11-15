"""Read a short text aloud with the optional voice engine ("Listen" in Fidel form fields).

    GET  /api/v1/speak   languages the voice engine reads ([] when none is set up)
    POST /api/v1/speak   {"text": "...", "lang": "am"} -> WAV audio; 409 in words when it cannot
"""

import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field

from ..config import settings
from ..providers import ProviderUnavailable, get_text_to_speech

router = APIRouter(prefix="/api/v1/speak", tags=["voice"])


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500, description="What to read (at most 500 characters)")
    lang: str = Field(min_length=2, max_length=8, description="Language code, e.g. am")


class Voices(BaseModel):
    languages: list[str] = Field(description="Languages the voice engine reads; empty when there is none")


@router.get("", response_model=Voices)
def voices() -> Voices:
    engine = get_text_to_speech(settings)
    return Voices(languages=sorted(engine.languages) if engine else [])


@router.post("", response_class=Response, responses={200: {"content": {"audio/wav": {}}}, 409: {"description": "No voice for this language"}})
def speak(request: SpeakRequest) -> Response:
    engine = get_text_to_speech(settings)
    if engine is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "No voice engine is set up on this server (FIDEL_TTS_URL).")
    if request.lang not in engine.languages:
        raise HTTPException(status.HTTP_409_CONFLICT, f"The voice engine cannot read '{request.lang}'.")
    with tempfile.TemporaryDirectory() as folder:
        out = Path(folder) / "speech.wav"
        try:
            engine.speak(request.text, request.lang, out)
        except ProviderUnavailable as problem:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(problem)) from problem
        return Response(out.read_bytes(), media_type="audio/wav")
