"""Create draft English WebVTT captions from local audio using local Whisper."""

import argparse
from pathlib import Path

from faster_whisper import WhisperModel

from .captions import Word, cues_from_words, write_vtt
from .config import settings
from .providers.models import WHISPER_REPOS, is_downloaded, model_dir


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", type=Path, help="audio file available inside the server container")
    parser.add_argument("output", type=Path, help="destination WebVTT path")
    args = parser.parse_args()

    model_path = model_dir(settings.models_dir, WHISPER_REPOS[settings.whisper_model])
    if not is_downloaded(model_path):
        parser.error(f"Whisper {settings.whisper_model} is not downloaded; run the model download command first.")

    model = WhisperModel(str(model_path), device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        str(args.audio),
        language=None,
        word_timestamps=True,
        vad_filter=True,
    )
    words = [
        Word(start=word.start, end=word.end, text=word.word)
        for segment in segments
        for word in (segment.words or [])
    ]

    if info.language != "en":
        raise SystemExit(
            f"Whisper detected '{info.language}' (confidence {info.language_probability:.2f}); "
            "this test page supports English captions and BSL only. No English captions were written."
        )
    cues = cues_from_words(words)
    if not cues:
        raise SystemExit("Whisper found no English speech to caption.")

    write_vtt(
        args.output,
        cues,
        note="Machine-generated English draft. Check every cue against the original audio before use.",
    )
    print(
        f"Detected English (confidence {info.language_probability:.2f}); "
        f"wrote {len(cues)} draft cues to {args.output}."
    )


if __name__ == "__main__":
    main()
