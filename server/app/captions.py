"""Caption cues and WebVTT files.

A Cue is one caption on screen: start and end time (seconds) and text.
"""

import re
from dataclasses import dataclass
from pathlib import Path

MAX_CHARS = 84  # two lines of 42 characters: a common caption limit
MAX_SECONDS = 7.0  # long cues are hard to read along with
MIN_SECONDS = 1.2  # shorter cues flash by too fast to read
MAX_LINE = 42


@dataclass
class Cue:
    start: float
    end: float
    text: str


@dataclass
class Word:
    start: float
    end: float
    text: str  # includes its leading space, as speech-to-text engines give it


def format_time(seconds: float) -> str:
    seconds = max(seconds, 0.0)
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{int(hours):02d}:{int(minutes):02d}:{secs:06.3f}"


def parse_time(text: str) -> float:
    total = 0.0
    for part in text.split(":"):
        total = total * 60 + float(part)
    return total


def wrap_two_lines(text: str) -> str:
    """Break a caption into at most two balanced lines."""
    if len(text) <= MAX_LINE:
        return text
    middle = len(text) // 2
    # Break at the space closest to the middle.
    spaces = [i for i, ch in enumerate(text) if ch == " "]
    if not spaces:
        return text
    split = min(spaces, key=lambda i: abs(i - middle))
    return text[:split] + "\n" + text[split + 1 :]


def cues_from_words(words: list[Word]) -> list[Cue]:
    """Group timed words into readable cues.

    A cue ends at the end of a sentence, or before it gets longer than
    MAX_CHARS characters or MAX_SECONDS seconds. Timings come from the words,
    so they match the speech.
    """
    cues: list[Cue] = []
    current: list[Word] = []

    def flush():
        if current:
            text = "".join(w.text for w in current).strip()
            start, end = current[0].start, current[-1].end
            previous = cues[-1] if cues else None
            # A cue shorter than MIN_SECONDS flashes by too fast to read: join it
            # to the previous cue if the result still fits on two lines.
            if (previous and end - start < MIN_SECONDS
                    and len(previous.text.replace("\n", " ") + " " + text) <= MAX_CHARS
                    and start - previous.end < 1.0):
                cues[-1] = Cue(previous.start, end, wrap_two_lines(previous.text.replace("\n", " ") + " " + text))
            elif text:
                cues.append(Cue(start, end, wrap_two_lines(text)))
            current.clear()

    for word in words:
        if current:
            text = "".join(w.text for w in current + [word]).strip()
            too_long = len(text) > MAX_CHARS or word.end - current[0].start > MAX_SECONDS
            if too_long:
                flush()
        current.append(word)
        if word.text.strip().endswith((".", "?", "!", "።", "፧")):
            flush()
    flush()
    return cues


def to_vtt(cues: list[Cue], note: str | None = None) -> str:
    out = ["WEBVTT", ""]
    if note:
        out += ["NOTE", note, ""]
    for cue in cues:
        out += [f"{format_time(cue.start)} --> {format_time(cue.end)}", cue.text, ""]
    return "\n".join(out)


TIMING = re.compile(r"^(\S+)\s+-->\s+(\S+)")


def from_vtt(text: str) -> list[Cue]:
    cues = []
    for block in text.replace("\r\n", "\n").split("\n\n"):
        lines = [line for line in block.strip().split("\n") if line.strip()]
        if not lines or lines[0].startswith(("NOTE", "STYLE", "REGION")):
            continue
        for i, line in enumerate(lines):
            match = TIMING.match(line)
            if match:
                body = "\n".join(lines[i + 1 :]).strip()
                if body:
                    cues.append(Cue(parse_time(match[1]), parse_time(match[2]), body))
                break
    return cues


def write_vtt(path: Path, cues: list[Cue], note: str | None = None) -> None:
    path.write_text(to_vtt(cues, note), encoding="utf-8")


def read_vtt(path: Path) -> list[Cue]:
    return from_vtt(path.read_text(encoding="utf-8"))
