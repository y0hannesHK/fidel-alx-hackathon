"""LTI Assignment and Grade Services (AGS): send "completed" to the course's gradebook.

Two steps, both from the Fidel server to the platform:

  1. A gradebook token: Fidel signs a short message with its own key (a
     "client assertion", RFC 7523) and sends it to the platform's access token
     address. The platform checks it with Fidel's public key (/lti/jwks) and
     answers with a token for the score scope. Tokens are reused until shortly
     before they expire.
  2. The score: POSTed to the gradebook column's address + /scores:
     100 out of 100, activity "Completed", grading "FullyGraded".

Only the platform's id for the learner is sent, nothing else about them.
"""

import secrets
import threading
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit

import httpx
import jwt

from . import keys

AGS_CLAIM = "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint"
SCORE_SCOPE = "https://purl.imsglobal.org/spec/lti-ags/scope/score"
SCORE_TYPE = "application/vnd.ims.lis.v1.score+json"


class GradeError(Exception):
    def __init__(self, reason: str, detail: str = ""):
        super().__init__(f"{reason}: {detail}" if detail else reason)
        self.reason = reason


def http_post(url: str, **kwargs) -> httpx.Response:
    """Tests replace this with a fake platform."""
    return httpx.post(url, timeout=10, **kwargs)


_tokens: dict[tuple[str, str], tuple[float, str]] = {}
_lock = threading.Lock()


def forget_tokens() -> None:
    with _lock:
        _tokens.clear()


def client_assertion(platform: dict) -> str:
    """Fidel's signed "this is me" for the platform's token address."""
    now = int(time.time())
    pair = keys.key_pair()
    return jwt.encode({"iss": platform["client_id"], "sub": platform["client_id"], "aud": platform["auth_token_url"],
                       "iat": now, "exp": now + 300, "jti": secrets.token_urlsafe(16)},
                      pair.private_key, algorithm="RS256", headers={"kid": pair.kid})


def access_token(platform: dict, scope: str = SCORE_SCOPE, fresh: bool = False) -> str:
    key = (platform["id"], scope)
    with _lock:
        expires, token = _tokens.get(key, (0.0, ""))
        if token and not fresh and expires > time.time():
            return token
    try:
        response = http_post(platform["auth_token_url"], data={
            "grant_type": "client_credentials",
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "client_assertion": client_assertion(platform),
            "scope": scope,
        })
    except httpx.HTTPError as problem:
        raise GradeError("gradebook_unreachable", str(problem)) from problem
    if response.status_code != 200:
        raise GradeError("token_refused", f"{response.status_code} {response.text[:200]}")
    try:
        body = response.json()
        token = body["access_token"]
        lifetime = int(body.get("expires_in", 3600))
    except (ValueError, KeyError, TypeError) as problem:
        raise GradeError("token_refused", "no access_token in the answer") from problem
    with _lock:
        _tokens[key] = (time.time() + max(lifetime - 60, 0), token)  # renewed a minute early
    return token


def scores_url(lineitem: str) -> str:
    """The column's address + /scores, before any ?query (LTI AGS 3.4)."""
    parts = urlsplit(lineitem)
    return urlunsplit(parts._replace(path=parts.path.rstrip("/") + "/scores"))


def send_completed(platform: dict, lineitem: str, user_id: str) -> None:
    score = {
        "userId": user_id,
        "scoreGiven": 100,
        "scoreMaximum": 100,
        "activityProgress": "Completed",
        "gradingProgress": "FullyGraded",
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
    }
    for attempt in range(2):
        token = access_token(platform, fresh=attempt > 0)
        try:
            response = http_post(scores_url(lineitem), json=score,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": SCORE_TYPE})
        except httpx.HTTPError as problem:
            raise GradeError("gradebook_unreachable", str(problem)) from problem
        if response.status_code == 401 and attempt == 0:
            continue  # the platform dropped the token early: get a new one once
        if response.status_code not in (200, 201, 202, 204):
            raise GradeError("score_refused", f"{response.status_code} {response.text[:200]}")
        return
