"""Amharic speech-to-text through the optional Omnilingual ASR engine
(engines/omniasr, its own container). Fidel sends the lesson's 16 kHz WAV and
gets back timed words, then builds caption cues from them exactly as for
Whisper.

The engine writes no punctuation, so cues also end where the speaker pauses.
The result is always a DRAFT for a person to check in Studio.
"""

import httpx

from ..captions import Cue, Word, cues_from_words
from . import ProviderUnavailable

PAUSE_BREAK = 0.6  # seconds of silence that end a cue
HOLD = 0.4  # CTC marks a word where it is heard most clearly; keep it on screen a little longer


class OmniASRSpeechToText:
    def __init__(self, url: str, languages: list[str]):
        self.url = url
        self.languages = set(languages)

    def transcribe(self, audio_path: str, language: str) -> list[Cue]:
        if language not in self.languages:
            raise ProviderUnavailable(f"The Omnilingual ASR engine is not set up for '{language}' (FIDEL_OMNIASR_LANGUAGES).")
        with open(audio_path, "rb") as audio:
            data = audio.read()
        try:
            # About 0.25 s of work per second of audio on a laptop CPU; allow plenty.
            seconds = max(len(data) / 32000, 1)
            response = httpx.post(f"{self.url}/transcribe", content=data, headers={"Content-Type": "audio/wav"},
                                  timeout=httpx.Timeout(120 + seconds * 3, connect=5))
        except httpx.HTTPError as problem:
            raise ProviderUnavailable(
                f"The Amharic speech-to-text engine is not reachable at {self.url}. "
                "Start it with: docker compose --profile amharic-speech up -d"
            ) from problem
        if response.status_code != 200:
            raise ProviderUnavailable(_detail(response))
        return cues_from_words(timed_words(response.json()["words"]), pause_break=PAUSE_BREAK)


def timed_words(raw: list[dict]) -> list[Word]:
    """Engine words -> Word objects (with the leading space Fidel expects),
    each kept on screen until shortly before the next word."""
    words = []
    for index, w in enumerate(raw):
        following = raw[index + 1]["start"] if index + 1 < len(raw) else w["end"] + HOLD
        end = max(w["end"], min(following, w["end"] + HOLD))
        words.append(Word(start=w["start"], end=end, text=" " + w["text"]))
    return words


def _detail(response: httpx.Response) -> str:
    try:
        return response.json().get("detail") or response.text
    except ValueError:
        return f"The speech-to-text engine answered {response.status_code}."
