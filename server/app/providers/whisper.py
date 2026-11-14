"""English speech-to-text with faster-whisper (Whisper, MIT licence), on CPU."""

from pathlib import Path

from ..captions import Cue, Word, cues_from_words
from . import ProviderUnavailable
from .models import DOWNLOAD_HINT, WHISPER_REPOS, is_downloaded, model_dir

SUPPORTED_LANGUAGES = {"en"}  # Amharic: the optional Omnilingual ASR engine (providers/omniasr.py)


class WhisperSpeechToText:
    def __init__(self, models_dir: Path, size: str):
        if size not in WHISPER_REPOS:
            raise ProviderUnavailable(f"Unknown Whisper size '{size}'. Use one of: {', '.join(WHISPER_REPOS)}.")
        self.path = model_dir(models_dir, WHISPER_REPOS[size])
        self.size = size

    def transcribe(self, audio_path: str, language: str) -> list[Cue]:
        if language not in SUPPORTED_LANGUAGES:
            raise ProviderUnavailable(
                f"Speech-to-text for '{language}' is not installed. "
                "Whisper only transcribes English here. For Amharic, start the optional engine: "
                "docker compose --profile amharic-speech up -d, and set FIDEL_OMNIASR_URL."
            )
        if not is_downloaded(self.path):
            raise ProviderUnavailable(f"The Whisper '{self.size}' model is not downloaded. {DOWNLOAD_HINT}")

        from faster_whisper import WhisperModel  # imported here: slow to load

        model = WhisperModel(str(self.path), device="cpu", compute_type="int8")
        segments, _info = model.transcribe(
            audio_path,
            language=language,
            word_timestamps=True,  # lets us cut captions exactly where words end
            vad_filter=True,  # skip silence
        )
        words = [
            Word(start=w.start, end=w.end, text=w.word)
            for segment in segments
            for w in (segment.words or [])
        ]
        return cues_from_words(words)
