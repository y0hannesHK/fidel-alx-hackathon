"""Braille Ready File (.brf) of a lesson, made with liblouis (lou_translate).

English uses Unified English Braille grade 2 (contracted), the standard in
Ethiopia's English-medium teaching. BRF pages are 40 cells wide and 25 lines
long, with a form feed between pages, which embossers and refreshable Braille
displays expect. Amharic is offered only if liblouis has an Ethiopic table
installed (checked at run time); otherwise only English is available.
"""

import shutil
import subprocess
from pathlib import Path

from .captions import read_vtt
from .pipeline.steps import lesson_folder

CELLS_PER_LINE = 40
LINES_PER_PAGE = 25
# Output in North American Braille ASCII (the .brf convention).
TABLES = {
    "en": "en-us-brf.dis,en-ueb-g2.ctb",
    "am": "en-us-brf.dis,ethio-g1.ctb",
}
TABLE_DIRS = [Path("/usr/share/liblouis/tables"), Path("/usr/local/share/liblouis/tables")]


class BrailleUnavailable(Exception):
    pass


def available_languages() -> list[str]:
    if not shutil.which("lou_translate"):
        return []
    langs = []
    for lang, tables in TABLES.items():
        if all(any((d / t).is_file() for d in TABLE_DIRS) for t in tables.split(",")):
            langs.append(lang)
    return langs


def translate(lines: list[str], lang: str) -> list[str]:
    """Translate each line of print text to Braille ASCII with liblouis."""
    if lang not in available_languages():
        raise BrailleUnavailable(f"Braille in '{lang}' is not available on this server.")
    result = subprocess.run(
        ["lou_translate", "--forward", TABLES[lang]],
        input="\n".join(lines) + "\n", capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        raise BrailleUnavailable(f"liblouis could not translate: {result.stderr.strip()[:200]}")
    return result.stdout.rstrip("\n").split("\n")


def wrap(line: str, width: int = CELLS_PER_LINE) -> list[str]:
    """Break a Braille line on spaces so no line is longer than `width` cells."""
    words, out, current = line.split(" "), [], ""
    for word in words:
        while len(word) > width:  # a single very long word: hard break
            if current:
                out.append(current)
                current = ""
            out.append(word[:width])
            word = word[width:]
        if not current:
            current = word
        elif len(current) + 1 + len(word) <= width:
            current += " " + word
        else:
            out.append(current)
            current = word
    if current:
        out.append(current)
    return out or [""]


def paginate(lines: list[str]) -> str:
    """Lines -> BRF text: pages of 25 lines separated by form feeds, CRLF line ends."""
    pages, page = [], []
    for line in lines:
        page.append(line)
        if len(page) == LINES_PER_PAGE:
            pages.append(page)
            page = []
    if page:
        pages.append(page)
    return "\f".join("\r\n".join(p) + "\r\n" for p in pages)


def lesson_brf(lesson: dict, lang: str) -> str:
    """The lesson's title, chapter titles and transcript as a .brf file."""
    folder = lesson_folder(lesson["id"])
    caption_file = folder / f"captions-{lang}.vtt"
    if not caption_file.is_file():
        raise FileNotFoundError(f"This lesson has no {lang} captions yet.")
    cues = read_vtt(caption_file)
    chapter_file = folder / f"chapters-{lang}.vtt"
    chapters = read_vtt(chapter_file) if chapter_file.is_file() else []

    # Print text: title, then each chapter title followed by its transcript paragraph.
    print_lines = [lesson["title"], ""]
    starts = [c.start for c in chapters] or [0.0]
    titles = [c.text for c in chapters] or [""]
    for i, start in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) else float("inf")
        if titles[i]:
            print_lines += [titles[i]]
        text = " ".join(c.text.replace("\n", " ") for c in cues if start <= c.start < end)
        if text:
            print_lines += [text, ""]

    braille_lines = translate(print_lines, lang)
    wrapped = [w for line in braille_lines for w in wrap(line)]
    return paginate(wrapped)
