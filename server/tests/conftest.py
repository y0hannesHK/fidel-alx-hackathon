"""Test setup: a throw-away data folder and a known staff token.

These environment variables must be set before the app is imported,
because settings are read once at import time.
"""

import os
import subprocess
import tempfile
from pathlib import Path

import pytest

TEST_DATA = Path(tempfile.mkdtemp(prefix="fidel-test-"))
os.environ["FIDEL_DATA_DIR"] = str(TEST_DATA)
os.environ["FIDEL_STAFF_TOKEN"] = "test-token"

STAFF = {"Authorization": "Bearer test-token"}


@pytest.fixture(scope="session")
def tiny_video(tmp_path_factory) -> Path:
    """A 3-second test video with a tone, made with ffmpeg."""
    path = tmp_path_factory.mktemp("media") / "tiny.mp4"
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y",
         "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=10:duration=3",
         "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(path)],
        check=True,
    )
    return path
