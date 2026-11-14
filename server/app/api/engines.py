"""Which AI engines this server has, so Studio only shows buttons that work.

    GET /api/v1/engines   (staff)

The optional engines run in their own containers; each is asked for its
/health (1-second timeout), so a stopped engine shows as not running.
"""

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..config import settings
from ..providers.toucan import LANGUAGES as VOICE_LANGUAGES
from .auth import require_staff

router = APIRouter(prefix="/api/v1/engines", tags=["engines (staff)"], dependencies=[Depends(require_staff)])


class Engine(BaseModel):
    name: str
    languages: list[str] = Field(description="Language codes it handles")
    running: bool = Field(description="It answered just now (always true for engines inside this server)")
    model_downloaded: bool | None = Field(default=None, description="Optional engines: is its model downloaded?")


class Engines(BaseModel):
    speech_to_text: list[Engine]
    translation: list[Engine]
    text_to_speech: list[Engine] = Field(description="Machine-read recordings (optional engine)")


def health(url: str) -> tuple[bool, bool | None]:
    try:
        answer = httpx.get(f"{url}/health", timeout=1).json()
        return True, bool(answer.get("model_downloaded"))
    except (httpx.HTTPError, ValueError):
        return False, None


@router.get("", response_model=Engines)
def list_engines() -> Engines:
    stt, voice = [], []
    if settings.stt_provider == "local_whisper":
        stt.append(Engine(name=f"Whisper {settings.whisper_model}", languages=["en"], running=True))
        if settings.omniasr_url:
            running, downloaded = health(settings.omniasr_url)
            stt.append(Engine(name="Omnilingual ASR (CTC 300M v2)", languages=settings.omniasr_languages,
                              running=running, model_downloaded=downloaded))
    if settings.tts_url:
        running, downloaded = health(settings.tts_url)
        voice.append(Engine(name="ToucanTTS", languages=sorted(VOICE_LANGUAGES), running=running,
                            model_downloaded=downloaded))
    translation = ([Engine(name="MADLAD-400 3B", languages=settings.translate_to, running=True)]
                   if settings.translator == "local_madlad" else [])
    return Engines(speech_to_text=stt, translation=translation, text_to_speech=voice)
