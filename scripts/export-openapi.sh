#!/usr/bin/env sh
# Write the API description (OpenAPI) to openapi.json at the repo root.
# Run after changing the API:  sh scripts/export-openapi.sh
set -e
cd "$(dirname "$0")/.."
docker compose run --rm --no-deps -T server python -c \
  "import json; from app.main import app; print(json.dumps(app.openapi(), indent=2, ensure_ascii=False))" > openapi.json
echo "Wrote openapi.json"
