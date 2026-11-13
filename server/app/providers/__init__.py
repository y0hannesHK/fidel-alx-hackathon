"""Pluggable AI engines.

Each job (speech-to-text, translation) has a small interface. Which engine is
used comes from settings (environment variables), never from code changes:

    FIDEL_STT_PROVIDER = local_whisper | none
    FIDEL_TRANSLATOR   = local_madlad  | none

All engines here run on this server. Nothing is sent anywhere.
To add an engine (e.g. a cloud one, off by default), write a class with the
same method and add it to the matching registry below.
"""

from typing import Protocol

from ..captions import Cue
from ..config import Settings


class ProviderUnavailable(Exception):
    """The engine cannot run (model not downloaded, language not supported...).

    The message is shown to staff in Studio, so make it say what to do.
    """


class SpeechToText(Protocol):
    def transcribe(self, audio_path: str, language: str) -> list[Cue]: ...


class Translator(Protocol):
    def translate(self, cues: list[Cue], source: str, target: str) -> list[Cue]: ...


def get_speech_to_text(settings: Settings) -> SpeechToText | None:
    """Returns None when speech-to-text is switched off ('none')."""
    name = settings.stt_provider
    if name == "none":
        return None
    if name == "local_whisper":
        from .whisper import WhisperSpeechToText

        return WhisperSpeechToText(settings.models_dir, settings.whisper_model)
    raise ProviderUnavailable(f"Unknown speech-to-text engine '{name}'. Use local_whisper or none.")


def get_translator(settings: Settings) -> Translator | None:
    """Returns None when translation is switched off ('none')."""
    name = settings.translator
    if name == "none":
        return None
    if name == "local_madlad":
        from .madlad import MadladTranslator

        return MadladTranslator(settings.models_dir)
    raise ProviderUnavailable(f"Unknown translator '{name}'. Use local_madlad or none.")
