#!/usr/bin/env sh
# Cut the demo lesson clip from the full 10 Nov recording.
#
# Needs: Docker, and the source recording in ./assets/ (not in git).
# ffmpeg runs inside the Fidel server image, so you don't need it installed.
#
# Output (in ./data/demo/, git-ignored, served at /media/):
#   lesson.webm  VP9 + Opus, 720p  (used by browsers that support WebM)
#   lesson.mp4   H.264 + AAC, 720p (fallback, e.g. Safari/iPhone)
# A genuine sign-language recording is provided separately by the lesson team;
# this script never creates a substitute signer or test-pattern video.
#
# Usage:  sh scripts/make-demo-clip.sh
set -e

# Git Bash on Windows rewrites paths like /assets into C:/Program Files/Git/...
# Turn that off. (No effect on Linux or macOS.)
export MSYS_NO_PATHCONV=1

SOURCE="GMT20261110-160253_Recording_2426x1516.mp4"
START="00:03:12"
DURATION="159"   # 2 min 39 s, ends at 00:05:51 in the recording

cd "$(dirname "$0")/.."
mkdir -p data/demo

if [ ! -f "assets/$SOURCE" ]; then
  echo "Missing assets/$SOURCE. Put the 10 Nov recording there first." >&2
  exit 1
fi

docker compose build server

# Shared ffmpeg options: cut, scale to 720 px tall (width auto, even number).
run_ffmpeg() {
  docker compose run --rm --no-deps -T \
    -v ./assets:/assets:ro \
    server ffmpeg -hide_banner -loglevel warning -y \
    -ss "$START" -t "$DURATION" -i "/assets/$SOURCE" \
    -vf "scale=-2:720" "$@"
}

echo "Encoding WebM (VP9/Opus)..."
run_ffmpeg -c:v libvpx-vp9 -b:v 0 -crf 36 -deadline good -cpu-used 4 -row-mt 1 \
  -c:a libopus -b:a 64k /app/data/demo/lesson.webm

echo "Encoding MP4 (H.264/AAC)..."
run_ffmpeg -c:v libx264 -preset medium -crf 26 -pix_fmt yuv420p \
  -c:a aac -b:a 96k -movflags +faststart /app/data/demo/lesson.mp4

ls -l data/demo
if [ ! -f data/demo/sign.webm ]; then
  echo "No EthSL video was created. Add an authorized, synchronized sign recording separately."
fi
echo "Done."
