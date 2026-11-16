"""LTI 1.3 launch checks: is this signed message really from the platform, for
Fidel, recent, and not a replay?

The platform sends the learner's browser to /lti/launch with an "id_token": a
JSON Web Token signed with the platform's private key. Before anything opens,
check_id_token() checks, in this order:

  - the signature, with the platform's public keys (read from its key-set
    address, kept for 10 minutes, read again if a new key id appears)
  - iss (the platform), aud (Fidel's client id), azp, exp and iat (with one
    minute of leeway for clocks), and that the claims LTI needs are there
  - the nonce: the one Fidel made at /lti/login for this sign-in
  - the deployment id is one registered for this platform
  - the message type and the LTI version (1.3.0)

Any failure raises LaunchError; nothing opens.
"""

import threading
import time
from dataclasses import dataclass

import httpx
import jwt

LTI = "https://purl.imsglobal.org/spec/lti/claim/"
MESSAGE_TYPE = LTI + "message_type"
VERSION = LTI + "version"
DEPLOYMENT_ID = LTI + "deployment_id"
RESOURCE_LINK = LTI + "resource_link"
TARGET_LINK_URI = LTI + "target_link_uri"
CUSTOM = LTI + "custom"
LAUNCH_PRESENTATION = LTI + "launch_presentation"

DEEP_LINKING_SETTINGS = "https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings"

# Each Fidel address takes one kind of message: /lti/launch a lesson opened from a
# course, /lti/deep-link a teacher choosing a lesson (Deep Linking).
LESSON = "LtiResourceLinkRequest"
DEEP_LINKING = "LtiDeepLinkingRequest"
MESSAGE_TYPES = {LESSON}
LEEWAY = 60  # seconds: platform and Fidel clocks may differ a little
KEY_SET_MAX_AGE = 600  # seconds: read the platform's keys again after this
KEY_SET_MIN_AGE = 30  # but at most this often when an unknown key id appears


@dataclass
class LaunchError(Exception):
    """reason: a short code shown to administrators and used by tests."""
    reason: str
    detail: str = ""

    def __str__(self) -> str:
        return f"{self.reason}: {self.detail}" if self.detail else self.reason


# --- The platform's public keys ---------------------------------------------------------

def download_key_set(url: str) -> dict:
    """The platform's key set (JWKS). Tests replace this with a fake platform."""
    response = httpx.get(url, timeout=5, follow_redirects=True)
    response.raise_for_status()
    return response.json()


_key_sets: dict[str, tuple[float, dict]] = {}
_key_lock = threading.Lock()


def forget_key_sets() -> None:
    with _key_lock:
        _key_sets.clear()


def _cached_key_set(url: str, refresh: bool) -> dict:
    with _key_lock:
        fetched_at, key_set = _key_sets.get(url, (0.0, {}))
        age = time.time() - fetched_at
        if not key_set or age > KEY_SET_MAX_AGE or (refresh and age > KEY_SET_MIN_AGE):
            try:
                key_set = download_key_set(url)
            except (httpx.HTTPError, ValueError) as problem:
                raise LaunchError("platform_keys_unreachable", f"{url}: {problem}") from problem
            _key_sets[url] = (time.time(), key_set)
        return key_set


def platform_key(url: str, kid: str | None):
    """The platform's public key with this key id. If the id is new, the key set
    is read again once (the platform may have made a new key)."""
    for refresh in (False, True):
        keys = [k for k in _cached_key_set(url, refresh).get("keys", []) if k.get("kty") == "RSA"]
        match = [k for k in keys if k.get("kid") == kid] if kid else keys[:1] if len(keys) == 1 else []
        if match:
            try:
                return jwt.PyJWK(match[0], algorithm="RS256").key
            except jwt.PyJWTError as problem:
                raise LaunchError("platform_key_unusable", str(problem)) from problem
    raise LaunchError("unknown_key", f"no key with id {kid!r} at {url}")


# --- The checks --------------------------------------------------------------------------

def check_id_token(token: str, platform: dict, nonce: str, message_types=frozenset(MESSAGE_TYPES)) -> dict:
    """The verified claims, or LaunchError."""
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as problem:
        raise LaunchError("not_a_token", str(problem)) from problem
    if header.get("alg") != "RS256":  # never "none", never a shared secret
        raise LaunchError("bad_signature", f"algorithm {header.get('alg')!r}; RS256 required")

    key = platform_key(platform["key_set_url"], header.get("kid"))
    try:
        claims = jwt.decode(
            token, key, algorithms=["RS256"], audience=platform["client_id"],
            issuer=[platform["issuer"], platform["issuer"] + "/"],  # stored without the trailing slash
            leeway=LEEWAY, options={"require": ["iss", "aud", "exp", "iat", "nonce"]})
    except jwt.InvalidSignatureError as problem:
        raise LaunchError("bad_signature", str(problem)) from problem
    except jwt.ExpiredSignatureError as problem:
        raise LaunchError("expired", str(problem)) from problem
    except jwt.ImmatureSignatureError as problem:
        raise LaunchError("issued_in_the_future", str(problem)) from problem
    except jwt.InvalidAudienceError as problem:
        raise LaunchError("wrong_audience", str(problem)) from problem
    except jwt.InvalidIssuerError as problem:
        raise LaunchError("wrong_issuer", str(problem)) from problem
    except jwt.MissingRequiredClaimError as problem:
        raise LaunchError("missing_claim", str(problem)) from problem
    except jwt.PyJWTError as problem:
        raise LaunchError("bad_token", str(problem)) from problem

    # azp: needed when the token names more than one audience; if present, it must be Fidel.
    audiences = claims["aud"] if isinstance(claims["aud"], list) else [claims["aud"]]
    if ("azp" in claims or len(audiences) > 1) and claims.get("azp") != platform["client_id"]:
        raise LaunchError("wrong_audience", "azp is not Fidel's client id")
    if claims["nonce"] != nonce:
        raise LaunchError("wrong_nonce", "the nonce is not the one made for this sign-in")
    if claims.get(DEPLOYMENT_ID) not in platform["deployment_ids"]:
        raise LaunchError("unknown_deployment", f"deployment {claims.get(DEPLOYMENT_ID)!r} is not registered")
    if claims.get(VERSION) != "1.3.0":
        raise LaunchError("wrong_version", f"LTI version {claims.get(VERSION)!r}; 1.3.0 required")
    if claims.get(MESSAGE_TYPE) not in message_types:
        raise LaunchError("wrong_message_type", f"{claims.get(MESSAGE_TYPE)!r} is not handled at this address")
    if claims[MESSAGE_TYPE] == LESSON:
        if not isinstance(claims.get(RESOURCE_LINK), dict) or not claims[RESOURCE_LINK].get("id"):
            raise LaunchError("missing_claim", "resource_link.id")
    if claims[MESSAGE_TYPE] == DEEP_LINKING:
        settings = claims.get(DEEP_LINKING_SETTINGS)
        if not isinstance(settings, dict) or not isinstance(settings.get("deep_link_return_url"), str):
            raise LaunchError("missing_claim", "deep_linking_settings.deep_link_return_url")
        if not settings["deep_link_return_url"].startswith(("https://", "http://")):
            raise LaunchError("bad_claim", "deep_link_return_url is not a web address")
    return claims
