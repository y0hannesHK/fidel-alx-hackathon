"""Machine-read recordings through the optional ToucanTTS engine
(engines/toucan, its own container): text in, WAV audio out.

Used where a person's recording is missing (description recordings, job
summaries), because most phones have no Amharic voice. A person's recording
is always better; Studio says the result is machine-read.
"""

from pathlib import Path

import httpx

from . import ProviderUnavailable

LANGUAGES = {"am"}  # what the engine was tested with (Amharic was trained on real recordings)


class ToucanTextToSpeech:
    languages = LANGUAGES

    def __init__(self, url: str):
        self.url = url

    def speak(self, text: str, language: str, out: Path) -> None:
        if language not in LANGUAGES:
            raise ProviderUnavailable(f"Machine-read recordings are only available in Amharic, not '{language}'.")
        try:
            # About 1 s of work per 10 characters on a laptop CPU, plus loading.
            response = httpx.post(f"{self.url}/speak", json={"text": text, "language": language},
                                  timeout=httpx.Timeout(60 + len(text), connect=5))
        except httpx.HTTPError as problem:
            raise ProviderUnavailable(
                f"The Amharic voice engine is not reachable at {self.url}. "
                "Start it with: docker compose --profile amharic-voice up -d"
            ) from problem
        if response.status_code != 200:
            try:
                detail = response.json().get("detail")
            except ValueError:
                detail = None
            raise ProviderUnavailable(detail or f"The voice engine answered {response.status_code}.")
        out.write_bytes(response.content)
