"""The pipeline steps, in the order they run.

Each step reads and writes files in the lesson's folder (data/lessons/<id>/).
A step either returns a short note, raises Skip (nothing to do), or raises
any other exception (failed: the message is shown to staff).
"""

from pathlib import Path

from ..captions import read_vtt, write_vtt
from ..config import settings
from ..db import Database
from ..providers import get_speech_to_text, get_translator
from . import media

TARGET_LANGUAGE = "am"


class Skip(Exception):
    """The step has nothing to do. Not an error."""


def protect_human_work(db: Database, lesson_id: str, lang: str) -> None:
    """Never overwrite captions a person has already reviewed (even partly)."""
    if any(db.get_cue_reviews(lesson_id, lang)):
        raise Skip(f"The {lang} captions have been reviewed by a person, so they were not replaced.")


def lesson_folder(lesson_id: str) -> Path:
    return settings.data_dir / "lessons" / lesson_id


def extract_audio(db: Database, lesson: dict) -> str:
    folder = lesson_folder(lesson["id"])
    if not media.probe(folder / lesson["source_file"])["has_audio"]:
        raise Skip("The video has no sound.")
    media.extract_audio(folder / lesson["source_file"], folder / "audio.wav")
    return "Audio extracted."


def renditions(db: Database, lesson: dict) -> str:
    folder = lesson_folder(lesson["id"])
    made = media.make_renditions(folder / lesson["source_file"], folder)
    return f"Made {', '.join(made)}."


def transcribe(db: Database, lesson: dict) -> str:
    folder = lesson_folder(lesson["id"])
    language = lesson["spoken_language"]
    engine = get_speech_to_text(settings)
    if engine is None:
        raise Skip("Speech-to-text is switched off (FIDEL_STT_PROVIDER=none).")
    audio = folder / "audio.wav"
    if not audio.is_file():
        raise Skip("No audio yet: run 'extract_audio' first.")
    protect_human_work(db, lesson["id"], language)
    cues = engine.transcribe(str(audio), language)
    write_vtt(folder / f"captions-{language}.vtt", cues, note="Machine-generated captions. Status: draft.")
    db.set_caption_status(lesson["id"], language, "draft")
    return f"{len(cues)} captions."


def translate(db: Database, lesson: dict) -> str:
    folder = lesson_folder(lesson["id"])
    source = lesson["spoken_language"]
    if source == TARGET_LANGUAGE:
        raise Skip("The lesson is spoken in Amharic: nothing to translate.")
    engine = get_translator(settings)
    if engine is None:
        raise Skip("Translation is switched off (FIDEL_TRANSLATOR=none).")
    source_file = folder / f"captions-{source}.vtt"
    if not source_file.is_file():
        raise Skip(f"No {source} captions yet: run 'transcribe' first.")
    protect_human_work(db, lesson["id"], TARGET_LANGUAGE)
    cues = engine.translate(read_vtt(source_file), source, TARGET_LANGUAGE)
    write_vtt(
        folder / f"captions-{TARGET_LANGUAGE}.vtt",
        cues,
        note="Machine translation. Status: draft. Must be reviewed by a person.",
    )
    # Machine Amharic is never final: always 'draft' until a person reviews it.
    db.set_caption_status(lesson["id"], TARGET_LANGUAGE, "draft")
    return f"{len(cues)} captions translated (draft)."


def sign_video(db: Database, lesson: dict) -> str:
    folder = lesson_folder(lesson["id"])
    sources = sorted(folder.glob("sign-source.*"))
    if not sources:
        raise Skip("No sign-language video uploaded yet.")
    media.make_sign_video(sources[0], folder / "sign.webm")
    return "Sign-language video ready."


# name -> function, in running order. Renditions run before speech-to-text so
# the video can be watched while captions are still being made.
STEPS = {
    "extract_audio": extract_audio,
    "renditions": renditions,
    "transcribe": transcribe,
    "translate": translate,
    "sign_video": sign_video,
}
