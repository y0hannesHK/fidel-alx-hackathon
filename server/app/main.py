"""Fidel server.

  /api/v1/lessons...  lesson API (see /api/docs)
  /api/v1/jobs...     jobs as schema.org/JobPosting JSON-LD
  /api/v1/certificates, /verify/ID   certificates and their public check page
  /files/lessons/     processed lesson files (video, audio)
  /embed/v1/          the built player (fidel.js, fidel.css, fonts); stable for partners
  /embed/             same, latest (for testing)
  /studio/            Fidel Studio, the staff page
  /demo/              demo pages: mock lesson page, blank.html (no host styles)
  /savanna/           ALX's Savanna starter pages with Fidel added, if set up
  /media/             demo media from data/demo (git-ignored)
  /api/docs, /docs    interactive API documentation (Swagger UI)
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .api import auth, caption_reports, certificates, editing, engines, glossary, jobs, lessons, offline, speak, webhooks
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
# lesson files. From other sites: reading, plus the learner's public JSON POSTs
# (e.g. "Report a caption problem"). The Authorization header is NOT allowed,
# so staff actions can never be made from another site's page.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Range", "Content-Type"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
)


@app.exception_handler(RequestValidationError)
async def bad_input(request: Request, error: RequestValidationError) -> JSONResponse:
    """Bad input: 400 with a message in words (the guide's Level 2 rule), plus
    the details for developers."""
    def field(loc) -> str:
        parts = [str(p) for p in loc if p not in ("body", "query", "path", "header", "form")]
        return ".".join(parts) or "request"
    messages = [f"{field(e['loc'])}: {e['msg'].removeprefix('Value error, ').lower()}" for e in error.errors()]
    return JSONResponse(status_code=400, content={"detail": "Please check: " + "; ".join(messages) + ".",
                                                  "errors": jsonable_encoder(error.errors())})


class CompressText:
    """Compress text (scripts, styles, pages, JSON) for slow connections:
    fidel.js goes from about 550 KB to about 160 KB. Media, zip, PDF and
    Braille files are left alone: they are compressed already, and compressing
    video would break seeking (range requests)."""

    SKIP = (".mp4", ".webm", ".opus", ".jpg", ".png", ".woff2", ".zip", ".pdf", "/pack", "/offline-pack", ".brf")

    def __init__(self, app):
        self.app = app
        self.gzip = GZipMiddleware(app, minimum_size=1000)

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "") if scope["type"] == "http" else ""
        if path and not path.endswith(self.SKIP):
            await self.gzip(scope, receive, send)
        else:
            await self.app(scope, receive, send)


app.add_middleware(CompressText)
app.include_router(lessons.router)
app.include_router(editing.router)
app.include_router(auth.router)
app.include_router(offline.router)
app.include_router(jobs.router)
app.include_router(certificates.router)
app.include_router(glossary.router)
app.include_router(webhooks.router)
app.include_router(engines.router)
app.include_router(caption_reports.router)  # Package D: learners report caption problems
app.include_router(speak.router)  # Forms: "Listen" through the optional voice engine


@app.get("/health", tags=["system"])
def health() -> dict:
    """Simple liveness check used by Docker and by tests."""
    return {"status": "ok"}


@app.get("/fidel-sw.js", include_in_schema=False)
def service_worker() -> FileResponse:
    """Service worker for "Save for offline" (must be served from the site root)."""
    return FileResponse(Path(__file__).parent / "static" / "fidel-sw.js", media_type="text/javascript",
                        headers={"Cache-Control": "no-cache"})


@app.get("/docs", include_in_schema=False)
def docs_shortcut() -> RedirectResponse:
    """The interactive API documentation (Swagger UI) is at /api/docs."""
    return RedirectResponse(url="/api/docs")


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
# ALX's Savanna starter pages with Fidel added (scripts/setup-savanna.sh).
mount_if_present("/savanna", settings.savanna_dir, "savanna")
mount_if_present("/media", settings.data_dir / "demo", "media")
