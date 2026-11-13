"""The offline pack: a lesson that works on a cheap phone with no internet.

offline_page() builds ONE self-contained HTML file: audio (24 kbps Opus),
transcripts in English and Amharic with read-along highlighting, chapters,
description text and the Ethiopic font are all inside it. One file is what
works best on Android: a page that points to a separate audio file next to it
cannot load it when opened from the phone's Downloads.

pack_zip() puts that page in a .zip together with the caption, description
and plain-text transcript files.

Both are built when requested, so they always contain the latest corrections.
"""

import base64
import html
import io
import json
import re
import zipfile
from pathlib import Path

from .captions import read_vtt
from .config import settings
from .pipeline.steps import lesson_folder

TEMPLATE = Path(__file__).parent / "templates" / "pack.html"
ETHIOPIC = re.compile(r"[ሀ-᎟ⶀ-⷟꬀-꬯]")
LANGS = ("en", "am")


def _data_uri(path: Path, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def _cues(folder: Path, name: str) -> list[dict]:
    path = folder / name
    if not path.is_file():
        return []
    return [{"start": c.start, "end": c.end, "text": c.text} for c in read_vtt(path)]


def lesson_data(lesson: dict, caption_status: dict[str, str]) -> dict:
    folder = lesson_folder(lesson["id"])
    captions = {lang: cues for lang in LANGS if (cues := _cues(folder, f"captions-{lang}.vtt"))}
    return {
        "defaultLang": "am" if "am" in captions else "en",
        "status": caption_status,
        "captions": captions,
        "chapters": {lang: cues for lang in LANGS if (cues := _cues(folder, f"chapters-{lang}.vtt"))},
        "descriptions": {lang: cues for lang in LANGS if (cues := _cues(folder, f"descriptions-{lang}.vtt"))},
    }


def offline_page(lesson: dict, caption_status: dict[str, str], with_video: bool = False) -> str:
    folder = lesson_folder(lesson["id"])
    data = lesson_data(lesson, caption_status)

    if with_video and (folder / "video-small.mp4").is_file():
        media = f'<video id="media" controls preload="metadata" src="{_data_uri(folder / "video-small.mp4", "video/mp4")}"></video>'
    elif (folder / "audio.opus").is_file():
        media = f'<audio id="media" controls preload="metadata" src="{_data_uri(folder / "audio.opus", "audio/ogg; codecs=opus")}"></audio>'
    else:
        raise FileNotFoundError("This lesson has no audio yet.")

    font = settings.embed_dir / "fonts" / "noto-sans-ethiopic-400.woff2"
    title = lesson["title"]
    # JSON inside <script>: no "<" at all, so caption text can never end the
    # script or start a new tag. JSON reads "<" back as "<".
    data_json = json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")
    page = TEMPLATE.read_text(encoding="utf-8")
    replacements = {
        "{{TITLE}}": f'<span lang="{"am" if ETHIOPIC.search(title) else "en"}">{html.escape(title)}</span>',
        "{{PAGE_LANG}}": data["defaultLang"],
        "{{FONT}}": _data_uri(font, "font/woff2") if font.is_file() else "",
        "{{MEDIA}}": media,
        "{{DATA}}": data_json,
    }
    # <title> cannot contain markup: plain escaped text there.
    page = page.replace("<title>{{TITLE}}</title>", f"<title>{html.escape(title)}</title>")
    # One pass, so text inserted for one marker is never searched for another.
    return re.sub(r"\{\{[A-Z_]+\}\}", lambda m: replacements.get(m.group(0), m.group(0)), page)


def transcript_text(data: dict, lang: str) -> str:
    lines = []
    for cue in data["captions"].get(lang, []):
        lines.append(cue["text"].replace("\n", " "))
    return "\n".join(lines) + "\n"


def pack_zip(lesson: dict, caption_status: dict[str, str]) -> bytes:
    folder = lesson_folder(lesson["id"])
    data = lesson_data(lesson, caption_status)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("index.html", offline_page(lesson, caption_status))
        for kind in ("captions", "descriptions", "chapters"):
            for lang in LANGS:
                if (folder / f"{kind}-{lang}.vtt").is_file():
                    z.write(folder / f"{kind}-{lang}.vtt", f"{kind}-{lang}.vtt")
        for lang in data["captions"]:
            z.writestr(f"transcript-{lang}.txt", transcript_text(data, lang))
        z.writestr("README.txt", (
            f"{lesson['title']}\n\n"
            "Open index.html in a web browser. It works with no internet.\n"
            "index.html ን በድር አሳሽ ይክፈቱ። ያለ ኢንተርኔት ይሠራል።\n\n"
            "Also inside: captions (.vtt), descriptions (.vtt) and plain-text transcripts (.txt).\n"
        ))
    return buffer.getvalue()
