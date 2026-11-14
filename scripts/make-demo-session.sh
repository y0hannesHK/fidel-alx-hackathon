#!/usr/bin/env sh
# Demo content for <fidel-session-viewer>: the 11 Nov 2026 training session.
#
# Needs: Docker and, in ./assets/, the Zoom recording, its captions (.cc.vtt)
# and its chat (.txt). Output goes to data/demo/session/ (git-ignored: the
# chat contains participants' names; the demo page hides them with "anonymize").
#
# Usage:  sh scripts/make-demo-session.sh
set -e
export MSYS_NO_PATHCONV=1   # stop Git Bash on Windows from rewriting /paths
cd "$(dirname "$0")/.."

NAME="GMT20261111-161407_Recording"
mkdir -p data/demo/session
cp "assets/${NAME}.cc.vtt" data/demo/session/captions-en.vtt
cp "assets/${NAME}newChat.txt" data/demo/session/chat.txt

run_ffmpeg() {
  docker compose run --rm --no-deps -T -v ./assets:/assets:ro \
    server ffmpeg -hide_banner -loglevel warning -y -i "/assets/${NAME}_1920x1080.mp4" -vf "scale=-2:720" "$@"
}
echo "Encoding MP4 (H.264/AAC)..."
run_ffmpeg -c:v libx264 -preset veryfast -crf 28 -pix_fmt yuv420p -c:a aac -b:a 64k -movflags +faststart \
  /app/data/demo/session/session.mp4
echo "Encoding WebM (VP9/Opus)..."
run_ffmpeg -c:v libvpx-vp9 -b:v 0 -crf 40 -deadline realtime -cpu-used 8 -row-mt 1 -c:a libopus -b:a 48k \
  /app/data/demo/session/session.webm
ls -l data/demo/session
