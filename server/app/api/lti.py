"""LTI 1.3: learning platforms (Moodle, Canvas) open Fidel lessons.

Phase 1 (this file so far): Fidel's identity and the list of platforms.

  GET  /lti/jwks                    Fidel's public key set; the platform reads it to check Fidel's signatures
  GET  /api/v1/lti/tool             (staff) on or off, and Fidel's addresses to paste into the platform
  GET  /api/v1/lti/platforms        (staff) registered platforms
  POST /api/v1/lti/platforms        (staff) register one, with the details the platform shows
  DELETE /api/v1/lti/platforms/ID   (staff) remove one

Off unless FIDEL_LTI_ENABLED is true. When off, all of these except
/api/v1/lti/tool answer 404, so nothing about LTI is reachable.
Nothing about learners is stored here.
"""

import secrets
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Path as PathParam, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from ..config import settings
from ..db import Database
from ..lti import keys
from .auth import require_staff

db = Database(settings.data_dir / "fidel.db")

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
