"""Accessible lesson documents: HTML and tagged PDF (PDF/UA).

The document is the lesson in reading form: chapters as headings, the
transcript of each chapter, audio descriptions marked as such, and a slide
image for each chapter. A slide image is included ONLY when a person has
written its description (alt text) in Studio: no image goes out without a
real text alternative, and no machine-written alt text is used.

The PDF is made with WeasyPrint in PDF/UA mode (tagged: headings, paragraphs,
figures with alt text, document language and title), with Noto Sans
Ethiopic embedded for Amharic.
"""

import html
import json
import re
from pathlib import Path

from .captions import Cue, read_vtt
from .config import settings
from .pipeline import media
from .pipeline.steps import lesson_folder

ETHIOPIC = re.compile(r"[ሀ-᎟ⶀ-⷟꬀-꬯]")
TEXT = {
    "en": {"document": "Lesson document", "transcript": "Transcript", "description": "Description:",
           "draft": "These captions are machine-made and not yet checked by a person.",
           "image": "Slide at {time}"},
    "am": {"document": "የትምህርት ሰነድ", "transcript": "ግልባጭ", "description": "መግለጫ፦",
           "draft": "እነዚህ የግርጌ ጽሑፎች በማሽን የተዘጋጁ ሲሆኑ ገና በሰው አልተገመገሙም።",
           "image": "ስላይድ በ{time}"},
}


def _time(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 60}:{s % 60:02d}"


def _lang_of(text: str) -> str:
    return "am" if ETHIOPIC.search(text) else "en"


# --- Slide images and their descriptions -------------------------------------------


def keyframe_name(start: float) -> str:
    return f"keyframe-{round(start * 1000)}.jpg"


def ensure_keyframe(lesson: dict, start: float) -> Path | None:
    """A still image from the video one second into the chapter (made once)."""
    folder = lesson_folder(lesson["id"])
    path = folder / keyframe_name(start)
    if not path.is_file():
        try:
            media.ffmpeg("-ss", f"{start + 1.0:.3f}", "-i", str(folder / lesson["source_file"]),
                         "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", "-q:v", "4", str(path))
        except media.MediaError:
            return None
    return path if path.is_file() else None


def image_texts(lesson_id: str) -> dict[str, dict[str, str]]:
    """{ "60000": {"en": "...", "am": "..."} } keyed by chapter start in ms."""
    path = lesson_folder(lesson_id) / "images.json"
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    except json.JSONDecodeError:
        return {}


def save_image_texts(lesson_id: str, texts: dict[str, dict[str, str]]) -> None:
    (lesson_folder(lesson_id) / "images.json").write_text(json.dumps(texts, ensure_ascii=False, indent=1), encoding="utf-8")


# --- The document ---------------------------------------------------------------------


def build_html(lesson: dict, lang: str, caption_status: dict[str, str], image_base: str) -> str:
    """The lesson as an accessible HTML document in one language.
    image_base: where the slide images are (a URL for the web, a folder for the PDF)."""
    folder = lesson_folder(lesson["id"])
    caption_file = folder / f"captions-{lang}.vtt"
    if not caption_file.is_file():
        raise FileNotFoundError(f"This lesson has no {lang} captions yet.")
    t = TEXT[lang]
    e = html.escape
    cues = read_vtt(caption_file)
    descriptions = read_vtt(folder / f"descriptions-{lang}.vtt") if (folder / f"descriptions-{lang}.vtt").is_file() else []
    chapter_lang = lang if (folder / f"chapters-{lang}.vtt").is_file() else "en"
    chapters = read_vtt(folder / f"chapters-{chapter_lang}.vtt") if (folder / f"chapters-{chapter_lang}.vtt").is_file() else []
    if not chapters:
        chapters = [Cue(0, cues[-1].end if cues else 0, t["transcript"])]
        chapter_lang = lang
    images = image_texts(lesson["id"])

    sections = []
    for index, chapter in enumerate(chapters):
        end = chapters[index + 1].start if index + 1 < len(chapters) else float("inf")
        parts = [f'<h2 lang="{chapter_lang}">{e(chapter.text)}</h2>']

        alt = images.get(str(round(chapter.start * 1000)), {})
        alt_text, alt_lang = (alt.get(lang), lang) if alt.get(lang) else (alt.get("en"), "en")
        if alt_text and ensure_keyframe(lesson, chapter.start):
            parts.append(
                f'<figure><img src="{e(image_base)}{keyframe_name(chapter.start)}" alt="{e(alt_text)}" lang="{alt_lang}">'
                f'<figcaption>{e(t["image"].format(time=_time(chapter.start)))}</figcaption></figure>'
            )

        items = [(c.start, "cue", c.text) for c in cues if chapter.start <= c.start < end]
        items += [(d.start, "desc", d.text) for d in descriptions if chapter.start <= d.start < end]
        paragraph: list[str] = []
        for _, kind, text in sorted(items, key=lambda i: i[0]):
            if kind == "desc":
                if paragraph:
                    parts.append(f"<p>{' '.join(paragraph)}</p>")
                    paragraph = []
                parts.append(f'<p class="description"><strong>{e(t["description"])}</strong> {e(text)}</p>')
            else:
                paragraph.append(e(text.replace("\n", " ")))
        if paragraph:
            parts.append(f"<p>{' '.join(paragraph)}</p>")
        sections.append(f'<section aria-labelledby="ch{index}">' + "\n".join(parts).replace("<h2 ", f'<h2 id="ch{index}" ', 1) + "</section>")

    title = lesson["title"]
    notice = f'<p class="notice">{e(t["draft"])}</p>' if caption_status.get(lang) == "draft" else ""
    font = settings.embed_dir / "fonts" / "noto-sans-ethiopic-400.woff2"
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} – {e(t["document"])}</title>
<meta name="author" content="Fidel">
<meta name="description" content="{e(t["document"])}: {e(title)}">
<style>
@font-face {{ font-family: "Fidel Ethiopic"; src: url("{font.as_uri() if font.is_file() else ''}") format("woff2"); }}
@page {{ size: A4; margin: 2cm; }}
body {{ font-family: "Fidel Ethiopic", "Noto Sans Ethiopic", "DejaVu Sans", sans-serif; font-size: 12pt; line-height: 1.6; color: #000; max-width: 42rem; margin: 0 auto; padding: 1rem; }}
:lang(am) {{ font-family: "Fidel Ethiopic", "Noto Sans Ethiopic", sans-serif; line-height: 1.8; }}
h1 {{ font-size: 1.8em; line-height: 1.25; }}
h2 {{ font-size: 1.35em; margin-top: 1.6em; break-after: avoid; }}
figure {{ margin: 1em 0; break-inside: avoid; }}
img {{ max-width: 100%; height: auto; border: 1px solid #777; }}
figcaption {{ font-size: 0.9em; color: #333; }}
.description {{ border-left: 4px solid #555; padding-left: 0.6em; font-style: italic; }}
.notice {{ border: 2px solid #8a5a00; padding: 0.5em; }}
</style>
</head>
<body>
<main>
<h1 lang="{_lang_of(title)}">{e(title)}</h1>
<p>{e(t["document"])}</p>
{notice}
{chr(10).join(sections)}
</main>
</body>
</html>
"""


def build_pdf(lesson: dict, lang: str, caption_status: dict[str, str]) -> bytes:
    """Tagged PDF (PDF/UA-1) of the document."""
    from weasyprint import HTML  # imported here: only needed for PDFs

    folder = lesson_folder(lesson["id"])
    page = build_html(lesson, lang, caption_status, image_base=folder.as_uri() + "/")
    return HTML(string=page, base_url=str(folder)).write_pdf(pdf_variant="pdf/ua-1")
