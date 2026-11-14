# Built from the repo root:  docker compose build
# (the build context is the repo root, so paths below start there)

# ---- Stage 1: build the player bundle (fidel.js + fidel.css) ----
FROM node:22-alpine AS player
WORKDIR /build/player
COPY player/package.json player/package-lock.json ./
RUN npm ci
COPY player/ ./
RUN npm run build

# ---- Stage 2: the Python server ----
FROM python:3.11-slim
# ffmpeg: media processing (pipeline, demo clip script)
# pango, harfbuzz-subset, fonts-dejavu-core: WeasyPrint, for tagged PDF lesson documents
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
       libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
# liblouis: Braille (.brf) export. A separate step so changing it does not
# re-download ffmpeg.
RUN apt-get update \
    && apt-get install -y --no-install-recommends liblouis-bin liblouis-data \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY server/app ./app
COPY server/tests ./tests
COPY demo ./demo
COPY studio ./studio
COPY --from=player /build/player/dist ./embed

ENV FIDEL_EMBED_DIR=/app/embed \
    FIDEL_DEMO_DIR=/app/demo \
    FIDEL_STUDIO_DIR=/app/studio \
    FIDEL_DATA_DIR=/app/data \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
