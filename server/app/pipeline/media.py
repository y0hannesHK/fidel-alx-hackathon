"""ffmpeg and ffprobe helpers. ffmpeg runs as a separate program."""

import json
import subprocess
from pathlib import Path


class MediaError(Exception):
    pass


def _run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        # The last lines of ffmpeg's output say what went wrong.
        tail = "\n".join(result.stderr.strip().splitlines()[-5:])
        raise MediaError(f"{cmd[0]} failed: {tail}")
    return result.stdout


def probe(path: Path) -> dict:
    """Duration and whether the file has video/audio. Raises MediaError if unreadable."""
    out = _run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", str(path)])
    info = json.loads(out)
    kinds = {s.get("codec_type") for s in info.get("streams", [])}
    return {
        "duration": float(info.get("format", {}).get("duration") or 0),
        "has_video": "video" in kinds,
        "has_audio": "audio" in kinds,
    }


def ffmpeg(*args: str) -> None:
    _run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args])


def extract_audio(source: Path, out: Path) -> None:
    """16 kHz mono WAV: the format speech-to-text models expect."""
    ffmpeg("-i", str(source), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(out))


def scale(height: int) -> str:
    # Never upscale; -2 keeps the width even (required by the encoders).
    return f"scale=-2:'min({height},ih)'"


def make_renditions(source: Path, folder: Path) -> list[str]:
    """Web versions of the lesson. Returns the file names made."""
    ffmpeg("-i", str(source), "-vf", scale(720), "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(folder / "video.mp4"))
    ffmpeg("-i", str(source), "-vf", scale(720), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36",
           "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", "-c:a", "libopus", "-b:a", "64k",
           str(folder / "video.webm"))
    # Low-data version for slow connections (used by the low-data mode).
    ffmpeg("-i", str(source), "-vf", scale(360), "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "48k", "-ac", "1", "-movflags", "+faststart",
           str(folder / "video-small.mp4"))
    made = ["video.mp4", "video.webm", "video-small.mp4"]
    # Audio only, about 24 kbps, for the offline pack (silent videos have none).
    if probe(source)["has_audio"]:
        ffmpeg("-i", str(source), "-vn", "-ac", "1", "-c:a", "libopus", "-b:a", "24k", "-application", "voip",
               str(folder / "audio.opus"))
        made.append("audio.opus")
    return made


def make_sign_video(source: Path, out: Path) -> None:
    """Sign-language video for the small window: at most 480x360, low bitrate
    WebM, no sound (the interpreter's room sound is not needed)."""
    ffmpeg("-i", str(source), "-vf", "scale='min(480,iw)':'min(360,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
           "-c:v", "libvpx-vp9", "-b:v", "250k", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1",
           "-an", str(out))


def make_description_audio(source: Path, out: Path) -> None:
    """A recorded audio description: mono Opus, small, loudness-normalised."""
    ffmpeg("-i", str(source), "-vn", "-ac", "1", "-af", "loudnorm", "-c:a", "libopus", "-b:a", "32k", str(out))
