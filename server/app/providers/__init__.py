"""Pluggable AI engines.

Each job (speech-to-text, translation) has a small interface. Which engine is
used comes from settings (environment variables), never from code changes:

    FIDEL_STT_PROVIDER = local_whisper | none
    FIDEL_TRANSLATOR   = local_madlad  | none
    FIDEL_OMNIASR_URL  = address of the optional Amharic speech-to-text engine (empty = off)
    FIDEL_TTS_URL      = address of the optional Amharic voice engine (empty = off)

All engines here run on this server (the optional ones in their own
containers next to it). Nothing is sent anywhere.
To add an engine (e.g. a cloud one, off by default), write a class with the
same method and add it to the matching registry below.
"""

from pathlib import Path
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


class TextToSpeech(Protocol):
    languages: set[str]

    def speak(self, text: str, language: str, out: Path) -> None: ...


class ByLanguage:
    """Speech-to-text that picks the engine from the spoken language: the
    Omnilingual ASR engine for its languages (e.g. Amharic), Whisper otherwise."""

    def __init__(self, default: SpeechToText, special: SpeechToText, languages: list[str]):
        self.default, self.special, self.languages = default, special, set(languages)

    def transcribe(self, audio_path: str, language: str) -> list[Cue]:
        engine = self.special if language in self.languages else self.default
        return engine.transcribe(audio_path, language)


def get_speech_to_text(settings: Settings) -> SpeechToText | None:
    """Returns None when speech-to-text is switched off ('none')."""
    name = settings.stt_provider
    if name == "none":
        return None
    if name == "local_whisper":
        from .whisper import WhisperSpeechToText

        whisper = WhisperSpeechToText(settings.models_dir, settings.whisper_model)
        if not settings.omniasr_url:
            return whisper
        from .omniasr import OmniASRSpeechToText

        return ByLanguage(whisper, OmniASRSpeechToText(settings.omniasr_url, settings.omniasr_languages),
                          settings.omniasr_languages)
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


def get_text_to_speech(settings: Settings) -> TextToSpeech | None:
    """Returns None when no voice engine is set up (FIDEL_TTS_URL empty)."""
    if not settings.tts_url:
        return None
    from .toucan import ToucanTextToSpeech

    return ToucanTextToSpeech(settings.tts_url)
