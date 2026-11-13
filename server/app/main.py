"""Fidel server.

  /api/v1/lessons...  lesson API (see /api/docs)
  /files/lessons/     processed lesson files (video, audio)
  /embed/             the built player (fidel.js, fidel.css, fonts)
  /studio/            Fidel Studio, the staff page
  /demo/              demo pages, e.g. the mock Savanna lesson page
  /media/             demo media from data/demo (git-ignored)
  /api/docs           interactive API documentation
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from .api import auth, editing, lessons
from .config import settings

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Jobs that were running when the server stopped will never finish.
    lessons.db.fail_interrupted_steps()
    yield


app = FastAPI(
    title="Fidel API",
    version="0.3.0",
    description=(
        "Accessible learning media for Ethiopian learning platforms. "
        "Read endpoints are public. Write endpoints need the staff token: "
        "`Authorization: Bearer <FIDEL_STAFF_TOKEN>`."
    ),
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
    lifespan=lifespan,
)

# Lets websites on other addresses (e.g. Savanna) embed the player and load
# lesson files. Only reading is allowed from other sites.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET"],
    allow_headers=["Range"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
)

app.include_router(lessons.router)
app.include_router(editing.router)
app.include_router(auth.router)


@app.get("/health", tags=["system"])
def health() -> dict:
    """Simple liveness check used by Docker and by tests."""
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def home() -> RedirectResponse:
    return RedirectResponse(url="/demo/savanna-mock/")


def mount_if_present(url_path: str, folder: Path, name: str) -> None:
    """Serve a folder as static files, if it exists (e.g. the player is not
    built when running unit tests, but the API should still start)."""
    if folder.is_dir():
        app.mount(url_path, StaticFiles(directory=folder, html=True), name=name)


for folder in (settings.data_dir / "demo", settings.data_dir / "lessons"):
    folder.mkdir(parents=True, exist_ok=True)
mount_if_present("/files/lessons", settings.data_dir / "lessons", "lesson-files")
mount_if_present("/embed", settings.embed_dir, "embed")
mount_if_present("/studio", settings.studio_dir, "studio")
mount_if_present("/demo", settings.demo_dir, "demo")
mount_if_present("/media", settings.data_dir / "demo", "media")
