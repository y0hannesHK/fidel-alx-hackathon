#!/usr/bin/env sh
# Make the BSL avatar videos for the demo lesson: data/demo/sign-bsl.webm (signs only)
# and sign-bsl-all.webm + .json (every word, "Wait for the signer")
#
# Needs: Docker, Node (for Playwright, already used by e2e/), and the optional
# avatar service running:  docker compose --profile bsl-avatar up -d --build
#
# The CWASA avatar needs XSLT, which Chrome 158+ no longer has. For this local
# recording only, the script loads a pinned XSLT polyfill (BSD-3-Clause,
# github.com/mfreed7/xslt_polyfill) into Playwright's browser. Learners never
# download it: they get the finished video.
#
# Usage:  sh scripts/bsl-video/make.sh
set -e
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/../.."
# Git Bash on Windows: give Node a C:/ path, not /c/.
ROOT=$(pwd -W 2>/dev/null || pwd)

POLY_COMMIT=ba5175c41412b7193b4f40e5175fd9e5cc18b379
POLY_SHA256=f7cc1b375904185f6acba722008b19a8b0e63ca8695b75013f769f0d267a1aac
WORK=data/bsl-video
mkdir -p "$WORK/vendor" "$WORK/out"

POLY="$WORK/vendor/xslt-polyfill.min.js"
if [ ! -f "$POLY" ]; then
  curl -sSfL -o "$POLY" "https://raw.githubusercontent.com/mfreed7/xslt_polyfill/$POLY_COMMIT/xslt-polyfill.min.js"
fi
echo "$POLY_SHA256  $POLY" | sha256sum -c -

# 1. Signs only, keeping pace with the lesson.  2. Every word (the rest
#    fingerspelled), with a timing file: the lesson waits for the signer.
node scripts/bsl-video/record.mjs "$ROOT/e2e" demo/media/en.vtt "$WORK/out" "$POLY" true signs
node scripts/bsl-video/record.mjs "$ROOT/e2e" demo/media/en.vtt "$WORK/out-all" "$POLY" true all
DURATION=$(docker compose run --rm --no-deps -T server ffprobe -v error -show_entries format=duration -of csv=p=0 /app/data/demo/lesson.mp4)
docker compose run --rm --no-deps -T -v "$ROOT/scripts/bsl-video:/s:ro" server \
  python /s/assemble.py /app/data/bsl-video/out/timeline.json /app/data/bsl-video/out/clips /app/data/demo/sign-bsl.webm "$DURATION" keep
docker compose run --rm --no-deps -T -v "$ROOT/scripts/bsl-video:/s:ro" server \
  python /s/assemble.py /app/data/bsl-video/out-all/timeline.json /app/data/bsl-video/out-all/clips /app/data/demo/sign-bsl-all.webm "$DURATION" wait
echo "Done: data/demo/sign-bsl.webm, sign-bsl-all.webm, sign-bsl-all.json  (open /demo/savanna-mock/?sign=bsl)"
