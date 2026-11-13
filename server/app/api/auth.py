"""Staff token check for write endpoints.

Staff send:  Authorization: Bearer <FIDEL_STAFF_TOKEN>
Read endpoints (lessons, captions, files) need no token.
"""

import secrets

from fastapi import Header, HTTPException, status

from ..config import settings


def require_staff(authorization: str = Header(default="", description="Bearer <staff token>")) -> None:
    if not settings.staff_token:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Staff actions are switched off: set FIDEL_STAFF_TOKEN in the .env file and restart.",
        )
    scheme, _, token = authorization.partition(" ")
    # compare_digest takes the same time for any wrong token (no timing leaks).
    if scheme.lower() != "bearer" or not secrets.compare_digest(token.strip(), settings.staff_token):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Missing or wrong staff token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def is_staff(authorization: str) -> bool:
    """True if the header carries the right staff token (no error if not)."""
    if not settings.staff_token:
        return False
    scheme, _, token = authorization.partition(" ")
    return scheme.lower() == "bearer" and secrets.compare_digest(token.strip(), settings.staff_token)


# Lets Fidel Studio check a token at sign-in.
from fastapi import APIRouter, Depends  # noqa: E402

router = APIRouter(prefix="/api/v1/staff", tags=["editing (staff)"])


@router.get("/check", dependencies=[Depends(require_staff)])
def check_token() -> dict:
    """Returns ok if the staff token is right (401 if not)."""
    return {"ok": True}
