#!/usr/bin/env sh
# Run the English -> Amharic translation test in Docker.
# Model cache:  data/models/   (git-ignored, ~3 GB, downloaded on first run)
# Results:      tools/translation-eval/results/
set -e
cd "$(dirname "$0")"
docker compose run --rm --build eval
