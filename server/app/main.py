"""Fidel server.

  /api/v1/lessons...  lesson API (see /api/docs)
  /api/v1/jobs...     jobs as schema.org/JobPosting JSON-LD
  /api/v1/certificates, /verify/ID   certificates and their public check page
  /files/lessons/     processed lesson files (video, audio)
  /embed/v1/          the built player (fidel.js, fidel.css, fonts); stable for partners
  /embed/             same, latest (for testing)
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
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .api import auth, certificates, editing, jobs, lessons, offline
from .config import settings

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Jobs that were running when the server stopped will never finish.
    lessons.db.fail_interrupted_steps()
    yield


app = FastAPI(
    title="Fidel API",
    version="0.8.0",
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
app.include_router(offline.router)
app.include_router(jobs.router)
app.include_router(certificates.router)


@app.get("/health", tags=["system"])
def health() -> dict:
    """Simple liveness check used by Docker and by tests."""
    return {"status": "ok"}


@app.get("/fidel-sw.js", include_in_schema=False)
def service_worker() -> FileResponse:
    """Service worker for "Save for offline" (must be served from the site root)."""
    return FileResponse(Path(__file__).parent / "static" / "fidel-sw.js", media_type="text/javascript",
                        headers={"Cache-Control": "no-cache"})


@app.get("/", include_in_schema=False)
def home() -> RedirectResponse:
    return RedirectResponse(url="/demo/savanna-mock/")


def mount_if_present(url_path: str, folder: Path, name: str) -> None:
    """Serve a folder as static files, if it exists (e.g. the player is not
    built when running unit tests, but the API should still start)."""
    if folder.is_dir():
        app.mount(url_path, StaticFiles(directory=folder, html=True), name=name)


for folder in (settings.data_dir / "demo", settings.data_dir / "lessons", settings.data_dir / "jobs"):
    folder.mkdir(parents=True, exist_ok=True)
mount_if_present("/files/lessons", settings.data_dir / "lessons", "lesson-files")
mount_if_present("/files/jobs", settings.data_dir / "jobs", "job-files")
# Versioned address for partners: /embed/v1/ never gets breaking changes
# (those would go to /embed/v2/). /embed/ is the latest, for testing.
mount_if_present("/embed/v1", settings.embed_dir, "embed-v1")
mount_if_present("/embed", settings.embed_dir, "embed")
mount_if_present("/studio", settings.studio_dir, "studio")
mount_if_present("/demo", settings.demo_dir, "demo")
mount_if_present("/media", settings.data_dir / "demo", "media")
