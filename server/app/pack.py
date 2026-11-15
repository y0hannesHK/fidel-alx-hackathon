"""The offline pack: a lesson that works on a cheap phone with no internet.

offline_page() builds ONE self-contained HTML file: audio (24 kbps Opus),
transcripts in English and Amharic with read-along highlighting, chapters,
description text and fonts are all inside it. One file is what works best on
Android: a page that points to a separate audio file next to it cannot load it
when opened from the phone's Downloads.

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
    poppins_fonts = {
        weight: settings.embed_dir / "fonts" / f"poppins-{weight}.woff2"
        for weight in (400, 600, 700)
    }
    font_licenses = []
    for label, license_file in (
        ("Poppins", settings.embed_dir / "fonts" / "Poppins-OFL.txt"),
        ("Noto Sans Ethiopic", settings.embed_dir / "fonts" / "OFL.txt"),
    ):
        font_file = settings.embed_dir / "fonts" / (
            "poppins-400.woff2" if label == "Poppins" else "noto-sans-ethiopic-400.woff2"
        )
        if font_file.is_file():
            license_text = license_file.read_text(encoding="utf-8")
            font_licenses.append(f"<h3>{label}</h3><pre>{html.escape(license_text)}</pre>")
    font_licenses_html = (
        f"<details><summary>Font licences</summary>{''.join(font_licenses)}</details>"
        if font_licenses else ""
    )

    title = lesson["title"]
    # JSON inside <script>: no "<" at all, so caption text can never end the
    # script or start a new tag. JSON reads "<" back as "<".
    data_json = json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")
    page = TEMPLATE.read_text(encoding="utf-8")
    replacements = {
        "{{TITLE}}": f'<span lang="{"am" if ETHIOPIC.search(title) else "en"}">{html.escape(title)}</span>',
        "{{PAGE_LANG}}": data["defaultLang"],
        "{{FONT}}": _data_uri(font, "font/woff2") if font.is_file() else "",
        "{{POPPINS_400}}": _data_uri(poppins_fonts[400], "font/woff2") if poppins_fonts[400].is_file() else "",
        "{{POPPINS_600}}": _data_uri(poppins_fonts[600], "font/woff2") if poppins_fonts[600].is_file() else "",
        "{{POPPINS_700}}": _data_uri(poppins_fonts[700], "font/woff2") if poppins_fonts[700].is_file() else "",
        "{{FONT_LICENSES}}": font_licenses_html,
        "{{MEDIA}}": media,
        "{{DATA}}": data_json,
    }
    # <title> cannot contain markup: plain escaped text there.
    page = page.replace("<title>{{TITLE}}</title>", f"<title>{html.escape(title)}</title>")
    # One pass, so text inserted for one marker is never searched for another.
    return re.sub(r"\{\{[A-Z0-9_]+\}\}", lambda m: replacements.get(m.group(0), m.group(0)), page)


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
            "Bundled font licence texts, when present, are included in index.html.\n"
        ))
    return buffer.getvalue()
