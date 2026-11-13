"""Cut a time range out of a WebVTT file and shift it to start at 0.

Used to make the demo clip's captions from the Zoom caption file.
Zoom cues are often 15 seconds long, which is too much text on screen at
once, so long cues are split into shorter ones. Split timings are estimated
from word counts, so a person should check them by watching the clip.

Usage:
    python scripts/cut_vtt.py INPUT.vtt OUTPUT.vtt --start 00:03:12 --end 00:06:01
"""

import argparse
import re
from pathlib import Path

TIME_LINE = re.compile(r"^(\S+)\s+-->\s+(\S+)")
MAX_CHARS = 84  # about two lines of 42 characters, a common caption limit


def parse_time(text: str) -> float:
    """'00:03:12.000' or '03:12' or '00:03:12' -> seconds."""
    parts = [float(p) for p in text.split(":")]
    seconds = 0.0
    for part in parts:
        seconds = seconds * 60 + part
    return seconds


def format_time(seconds: float) -> str:
    seconds = max(seconds, 0.0)
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{int(hours):02d}:{int(minutes):02d}:{secs:06.3f}"


def read_cues(path: Path) -> list[tuple[float, float, str]]:
    cues = []
    blocks = path.read_text(encoding="utf-8").replace("\r\n", "\n").split("\n\n")
    for block in blocks:
        lines = [line for line in block.strip().split("\n") if line.strip()]
        for i, line in enumerate(lines):
            match = TIME_LINE.match(line)
            if match:
                text = " ".join(lines[i + 1:]).strip()
                if text:
                    cues.append((parse_time(match[1]), parse_time(match[2]), text))
                break
    return cues


def split_cue(start: float, end: float, text: str) -> list[tuple[float, float, str]]:
    """Split a long cue into chunks of at most MAX_CHARS, sharing time by word count."""
    words = text.split()
    chunks, current = [], []
    for word in words:
        if current and len(" ".join(current + [word])) > MAX_CHARS:
            chunks.append(current)
            current = []
        current.append(word)
    if current:
        chunks.append(current)

    total_words = len(words)
    result, t = [], start
    for chunk in chunks:
        duration = (end - start) * len(chunk) / total_words
        result.append((t, t + duration, " ".join(chunk)))
        t += duration
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--start", required=True, help="clip start, e.g. 00:03:12")
    parser.add_argument("--end", required=True, help="clip end, e.g. 00:06:01")
    args = parser.parse_args()

    clip_start, clip_end = parse_time(args.start), parse_time(args.end)
    out = ["WEBVTT", ""]
    for start, end, text in read_cues(args.input):
        if end <= clip_start or start >= clip_end:
            continue
        start, end = max(start, clip_start), min(end, clip_end)
        for s, e, chunk in split_cue(start, end, text):
            out += [f"{format_time(s - clip_start)} --> {format_time(e - clip_start)}", chunk, ""]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(out), encoding="utf-8")
    print(f"Wrote {args.output} ({(len(out) - 2) // 3} cues)")


if __name__ == "__main__":
    main()
