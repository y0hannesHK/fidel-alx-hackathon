"""LTI 1.3: learning platforms (Moodle, Canvas) open Fidel lessons.

Phase 1: Fidel's identity and the list of platforms. Phase 2: signing in.

  GET|POST /lti/login               the platform starts a sign-in; Fidel sends the browser back with a state and nonce
  POST /lti/launch                  the platform's signed message; every check in lti/launch.py, or nothing opens
  GET  /lti/jwks                    Fidel's public key set; the platform reads it to check Fidel's signatures
  GET  /api/v1/lti/tool             (staff) on or off, and Fidel's addresses to paste into the platform
  GET  /api/v1/lti/platforms        (staff) registered platforms
  POST /api/v1/lti/platforms        (staff) register one, with the details the platform shows
  DELETE /api/v1/lti/platforms/ID   (staff) remove one

Off unless FIDEL_LTI_ENABLED is true. When off, all of these except
/api/v1/lti/tool answer 404, so nothing about LTI is reachable.
Nothing about learners is stored here.
"""

import logging
import re
import secrets
import time
from urllib.parse import parse_qs, urlencode, urlsplit

from fastapi import APIRouter, Depends, HTTPException, Path as PathParam, Request, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator

from ..config import settings
from ..db import Database
from ..lti import keys, launch as checks, pages
from .auth import require_staff

log = logging.getLogger("fidel.lti")
db = Database(settings.data_dir / "fidel.db")

LOGIN_SECONDS = 600  # the platform must send the launch within 10 minutes of the login
COOKIE = "fidel_lti_state_"  # + the state; binds the launch to the browser that started the sign-in

# Test platforms often run on this computer or in Docker, without HTTPS.
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "host.docker.internal"}


def require_lti() -> None:
    if not settings.lti_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            "LTI is switched off. Set FIDEL_LTI_ENABLED=true in the .env file and restart.")


public = APIRouter(prefix="/lti", tags=["LTI 1.3"], dependencies=[Depends(require_lti)])
staff = APIRouter(prefix="/api/v1/lti", tags=["LTI 1.3 (staff)"], dependencies=[Depends(require_staff)])


# --- Fidel's identity ----------------------------------------------------------------

@public.get("/jwks")
def jwks() -> JSONResponse:
    """Fidel's public key set (JWKS). Paste this address into the platform
    ("Public keyset URL" in Moodle)."""
    return JSONResponse(keys.jwks(), headers={"Cache-Control": "public, max-age=300"})


def base_url(request: Request) -> str:
    return settings.public_url or str(request.base_url).rstrip("/")


@staff.get("/tool")
def tool(request: Request) -> dict:
    """Whether LTI is on, and Fidel's addresses to copy into the platform when
    registering Fidel as an external tool."""
    base = base_url(request)
    return {
        "enabled": settings.lti_enabled,
        "public_url_set": bool(settings.public_url),
        "addresses": {
            "tool_url": f"{base}/lti/launch",
            "login_url": f"{base}/lti/login",
            "redirect_urls": [f"{base}/lti/launch", f"{base}/lti/deep-link"],
            "key_set_url": f"{base}/lti/jwks",
            "deep_link_url": f"{base}/lti/deep-link",
        },
    }


# --- Platforms -----------------------------------------------------------------------

def _is_local(host: str) -> bool:
    return host in LOCAL_HOSTS or "." not in host or host.endswith((".localhost", ".local", ".test"))


def checked_url(value: str, *, query_allowed: bool = True) -> str:
    """An https address (http only for a test platform on this computer or in Docker)."""
    value = value.strip()
    parts = urlsplit(value)
    host = (parts.hostname or "").lower()
    if parts.scheme not in ("https", "http") or not host:
        raise ValueError("must be a full address starting with https://")
    if parts.scheme == "http" and not _is_local(host):
        raise ValueError("must start with https:// (http:// only for a test platform on this computer)")
    if parts.fragment or (parts.query and not query_allowed):
        raise ValueError("must not have " + ("a # part" if parts.fragment else "a ? part"))
    return value


class PlatformIn(BaseModel):
    name: str = Field(min_length=1, max_length=100, description='For staff, e.g. "ALX Moodle"')
    issuer: str = Field(min_length=1, max_length=500,
                        description='The platform\'s id (Moodle: "Platform ID"), e.g. https://moodle.example.org')
    client_id: str = Field(min_length=1, max_length=255, description='The id the platform gave Fidel (Moodle: "Client ID")')
    deployment_ids: list[str] = Field(min_length=1, max_length=50, description='Moodle: "Deployment ID"')
    auth_login_url: str = Field(min_length=1, max_length=500, description='Moodle: "Authentication request URL"')
    auth_token_url: str = Field(min_length=1, max_length=500, description='Moodle: "Access token URL"')
    key_set_url: str = Field(min_length=1, max_length=500, description='Moodle: "Public keyset URL"')

    @field_validator("name", "client_id")
    @classmethod
    def _trimmed(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be empty")
        return value.strip()

    @field_validator("issuer")
    @classmethod
    def _issuer(cls, value: str) -> str:
        # Compared exactly with the "iss" in every launch, so no trailing slash games.
        return checked_url(value, query_allowed=False).rstrip("/")

    @field_validator("auth_login_url", "auth_token_url", "key_set_url")
    @classmethod
    def _url(cls, value: str) -> str:
        return checked_url(value)

    @field_validator("deployment_ids")
    @classmethod
    def _deployments(cls, values: list[str]) -> list[str]:
        cleaned = list(dict.fromkeys(v.strip() for v in values if v.strip()))
        if not cleaned:
            raise ValueError("give at least one deployment id")
        if any(len(v) > 255 for v in cleaned):
            raise ValueError("each deployment id must be at most 255 characters")
        return cleaned


class Platform(PlatformIn):
    id: str
    created_at: str


@staff.get("/platforms", response_model=list[Platform], dependencies=[Depends(require_lti)])
def list_platforms():
    return db.list_lti_platforms()


@staff.post("/platforms", status_code=status.HTTP_201_CREATED, response_model=Platform,
            dependencies=[Depends(require_lti)])
def add_platform(body: PlatformIn):
    platform = {"id": secrets.token_hex(6), **body.model_dump()}
    if not db.add_lti_platform(platform):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "This platform and client id are registered already. Remove the old one first.")
    return db.find_lti_platform(body.issuer, body.client_id)[0]


@staff.delete("/platforms/{platform_id}", status_code=status.HTTP_204_NO_CONTENT,
              dependencies=[Depends(require_lti)])
def remove_platform(platform_id: str = PathParam(pattern=r"^[a-f0-9]{12}$")):
    if not db.delete_lti_platform(platform_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No platform with this id.")


# --- Signing in (phase 2) ----------------------------------------------------------------

def origin(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}"


async def _fields(request: Request) -> dict[str, str]:
    """Query and form fields (platforms may use GET or POST)."""
    fields = dict(request.query_params)
    if request.method == "POST":
        fields.update({k: v for k, v in (await request.form()).items() if isinstance(v, str)})
    return fields


@public.get("/login", response_class=HTMLResponse, operation_id="lti_login_get")
@public.post("/login", response_class=HTMLResponse, operation_id="lti_login_post")
async def login(request: Request):
    """Step 1 of a launch (OpenID Connect third-party login): the platform names
    itself; Fidel makes a one-time state and nonce, keeps them on the server, and
    sends the browser back to the platform's sign-in address."""
    fields = await _fields(request)
    issuer, login_hint, target = fields.get("iss", ""), fields.get("login_hint", ""), fields.get("target_link_uri", "")
    if not (issuer and login_hint and target):
        return pages.problem("bad_request", "iss, login_hint and target_link_uri are required")
    client_id = fields.get("client_id") or None
    found = db.find_lti_platform(issuer.rstrip("/"), client_id)
    if not found:
        return pages.problem("unknown_platform", f"{issuer} {client_id or ''}".strip())
    if len(found) > 1:
        return pages.problem("bad_request", "client_id is needed: this platform is registered more than once")
    platform = found[0]
    deployment = fields.get("lti_deployment_id")
    if deployment and deployment not in platform["deployment_ids"]:
        return pages.problem("unknown_deployment", f"deployment {deployment!r} is not registered")
    base = base_url(request)
    if not target.startswith(base + "/lti/"):
        return pages.problem("bad_request", "target_link_uri is not a Fidel address")

    now = int(time.time())
    state, nonce = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    storage_target = fields.get("lti_storage_target") or None
    db.add_lti_login({"state": state, "nonce": nonce, "platform_id": platform["id"], "storage_target": storage_target,
                      "created_at": now, "expires_at": now + LOGIN_SECONDS})
    query = {"scope": "openid", "response_type": "id_token", "response_mode": "form_post", "prompt": "none",
             "client_id": platform["client_id"], "redirect_uri": target, "login_hint": login_hint,
             "state": state, "nonce": nonce}
    if fields.get("lti_message_hint"):
        query["lti_message_hint"] = fields["lti_message_hint"]
    auth_url = platform["auth_login_url"] + ("&" if "?" in platform["auth_login_url"] else "?") + urlencode(query)
    # "Open in a new window" starts the same sign-in again, at the top level where cookies work.
    again = {k: v for k, v in fields.items() if k != "lti_storage_target"}
    response = pages.login_page({"state": state, "authUrl": auth_url, "storageTarget": storage_target,
                                 "platformOrigin": origin(platform["auth_login_url"])},
                                f"{base}/lti/login?{urlencode(again)}")
    secure = base.startswith("https://")
    # Inside a course page's frame the cookie is "third-party": SameSite=None and
    # Partitioned (Chrome keeps partitioned cookies when it blocks the rest).
    response.set_cookie(COOKIE + state, state, max_age=LOGIN_SECONDS, path="/lti/", httponly=True, secure=secure,
                        samesite="none" if secure else "lax", partitioned=secure)
    return response


def lesson_id_from(claims: dict) -> str | None:
    """The lesson: the activity's custom parameter lesson_id (set by Deep Linking or
    by hand), or ?lesson= in the launch address."""
    custom = claims.get(checks.CUSTOM) if isinstance(claims.get(checks.CUSTOM), dict) else {}
    target = claims.get(checks.TARGET_LINK_URI) or ""
    candidate = str(custom.get("lesson_id") or (parse_qs(urlsplit(target).query).get("lesson") or [""])[0])
    return candidate if re.fullmatch(r"[a-f0-9]{12}", candidate) else None


@public.post("/launch", response_class=HTMLResponse)
async def launch(request: Request):
    """Step 2: the platform's signed message (id_token) arrives with the state.
    Every check passes, or nothing opens."""
    form = await _fields(request)
    if form.get("error"):
        return pages.problem("platform_error", f"{form['error']}: {form.get('error_description', '')}".strip(": "))
    state, token = form.get("state", ""), form.get("id_token", "")
    if not (state and token):
        return pages.problem("bad_request", "id_token and state are required")
    now = int(time.time())
    started = db.get_lti_login(state)
    if not started or started["used"] or started["expires_at"] <= now:
        return pages.problem("sign_in_used", "unknown, used or expired state")

    # The browser that sends the launch must be the one that started the sign-in.
    if not secrets.compare_digest(request.cookies.get(COOKIE + state, ""), state):
        if not started["storage_target"]:
            return pages.problem("cookie_blocked", "no state cookie and no platform storage")
        if form.get("platform_storage") != "checked":
            # Read the state back from the platform's storage first, in the browser.
            platform = db.get_lti_platform(started["platform_id"])
            return pages.launch_check_page({"state": state, "storageTarget": started["storage_target"],
                                            "platformOrigin": origin(platform["auth_login_url"]) if platform else ""},
                                           {"id_token": token, "state": state})

    if not db.claim_lti_login(state, now):  # used once, even if two requests race
        return pages.problem("sign_in_used", "state already used")
    platform = db.get_lti_platform(started["platform_id"])
    if platform is None:
        return pages.problem("unknown_platform", "the platform was removed")
    try:
        # In a worker thread: it may download the platform's keys, which must not hold up other requests.
        claims = await run_in_threadpool(checks.check_id_token, token, platform, started["nonce"])
    except checks.LaunchError as error:
        log.warning("LTI launch refused (%s): %s", platform["name"], error)
        return pages.problem(error.reason, error.detail)

    lesson_id = lesson_id_from(claims)
    lesson = db.get_lesson(lesson_id) if lesson_id else None
    if not lesson or not lesson["published"]:
        return pages.problem("no_lesson", f"lesson {lesson_id!r}")
    response = pages.signed_in_page(platform["name"], lesson, f"/demo/savanna-mock/lesson.html?id={lesson_id}")
    response.delete_cookie(COOKIE + state, path="/lti/")
    return response
