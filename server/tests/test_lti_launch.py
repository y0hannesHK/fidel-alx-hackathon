"""LTI 1.3, phase 2: signing in. A fake learning platform with its own keys sends
good launches and bad ones; every bad one must be refused, and nothing opens."""

import json
import re
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from jwt.algorithms import RSAAlgorithm

from app.api import lti
from app.lti import launch as checks
from app.main import app
from tests.conftest import STAFF

ISSUER = "https://lms.example.org"
CLIENT_ID = "fidel-client"
LESSON_ID = "a1b2c3d4e5f6"


class FakePlatform:
    """A learning platform: its keys, and launches signed like Moodle's."""

    def __init__(self):
        self.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.kid = "lms-key-1"

    def key_set(self) -> dict:
        jwk = RSAAlgorithm.to_jwk(self.key.public_key(), as_dict=True)
        return {"keys": [{**jwk, "kid": self.kid, "alg": "RS256", "use": "sig"}]}

    def claims(self, fidel_nonce: str, **changes) -> dict:
        now = int(time.time())
        claims = {
            "iss": ISSUER, "aud": CLIENT_ID, "sub": "learner-42", "iat": now, "exp": now + 60, "nonce": fidel_nonce,
            checks.MESSAGE_TYPE: "LtiResourceLinkRequest", checks.VERSION: "1.3.0", checks.DEPLOYMENT_ID: "1",
            checks.RESOURCE_LINK: {"id": "activity-7"},
            checks.TARGET_LINK_URI: "http://testserver/lti/launch",
            checks.CUSTOM: {"lesson_id": LESSON_ID},
        }
        claims.update(changes)
        return {k: v for k, v in claims.items() if v is not None}

    def sign(self, claims: dict, key=None, kid=None, algorithm="RS256") -> str:
        return jwt.encode(claims, key or self.key, algorithm=algorithm, headers={"kid": kid or self.kid})


@pytest.fixture
def lms(monkeypatch):
    platform = FakePlatform()
    monkeypatch.setattr(checks, "download_key_set", lambda url: platform.key_set())
    checks.forget_key_sets()
    with TestClient(app) as client:
        registered = client.post("/api/v1/lti/platforms", headers=STAFF, json={
            "name": "Fake LMS", "issuer": ISSUER, "client_id": CLIENT_ID, "deployment_ids": ["1"],
            "auth_login_url": f"{ISSUER}/auth", "auth_token_url": f"{ISSUER}/token", "key_set_url": f"{ISSUER}/jwks",
        }).json()
        if not lti.db.get_lesson(LESSON_ID):
            lti.db.add_lesson(LESSON_ID, "Fake lesson for LTI", "en", "source.mp4")
        lti.db.set_published(LESSON_ID, True)
        yield client, platform
        client.delete(f"/api/v1/lti/platforms/{registered['id']}", headers=STAFF)


def start_login(client, **changes) -> tuple:
    """Step 1, as the platform does it. Returns (response, state, nonce)."""
    params = {"iss": ISSUER, "login_hint": "learner-42", "target_link_uri": "http://testserver/lti/launch",
              "client_id": CLIENT_ID, "lti_deployment_id": "1", "lti_message_hint": "hint-9", **changes}
    response = client.get("/lti/login", params={k: v for k, v in params.items() if v is not None})
    match = re.search(r'<script type="application/json" id="lti-data">(.*?)</script>', response.text)
    if not match:
        return response, None, None
    data = json.loads(match.group(1))
    query = dict(p.split("=", 1) for p in data["authUrl"].split("?", 1)[1].split("&"))
    return response, data["state"], query["nonce"]


def problem_reason(response) -> str:
    match = re.search(r"<code>([a-z_]+)", response.text)
    return match.group(1) if match else ""


def test_good_launch_opens_the_lesson(lms):
    client, platform = lms
    response, state, nonce = start_login(client)
    assert response.status_code == 200
    data = json.loads(re.search(r'id="lti-data">(.*?)</script>', response.text).group(1))
    assert data["authUrl"].startswith(f"{ISSUER}/auth?")
    for part in ("response_type=id_token", "response_mode=form_post", "prompt=none", "scope=openid",
                 f"client_id={CLIENT_ID}", "login_hint=learner-42", "lti_message_hint=hint-9"):
        assert part in data["authUrl"]
    assert f"fidel_lti_state_{state}" in response.headers["set-cookie"]

    launched = client.post("/lti/launch", data={"id_token": platform.sign(platform.claims(nonce)), "state": state})
    assert launched.status_code == 200, launched.text
    assert "Opened from Fake LMS" in launched.text and "<h1>Fake lesson for LTI</h1>" in launched.text
    assert f'lesson="/api/v1/lessons/{LESSON_ID}"' in launched.text  # the normal player
    assert launched.headers["cache-control"] == "no-store"


def launch_with(lms, **claim_changes):
    client, platform = lms
    _, state, nonce = start_login(client)
    return client.post("/lti/launch", data={"id_token": platform.sign(platform.claims(nonce, **claim_changes)),
                                            "state": state})


@pytest.mark.parametrize("changes, reason, code", [
    ({"exp": int(time.time()) - 120}, "expired", 401),
    ({"aud": "someone-else"}, "wrong_audience", 401),
    ({"aud": [CLIENT_ID, "other"]}, "wrong_audience", 401),  # several audiences and no azp
    ({"iss": "https://evil.example.org"}, "wrong_issuer", 401),
    ({"nonce": "not-the-one-fidel-made"}, "wrong_nonce", 401),
    ({checks.DEPLOYMENT_ID: "99"}, "unknown_deployment", 400),
    ({checks.MESSAGE_TYPE: "LtiSubmissionReviewRequest"}, "wrong_message_type", 400),
    ({checks.VERSION: "1.1"}, "wrong_version", 401),
    ({"iat": int(time.time()) + 3600, "exp": int(time.time()) + 7200}, "issued_in_the_future", 401),
    ({checks.RESOURCE_LINK: None}, "missing_claim", 401),
    ({checks.CUSTOM: {"lesson_id": "000000000000"}}, "no_lesson", 404),
])
def test_bad_launches_are_refused(lms, changes, reason, code):
    response = launch_with(lms, **changes)
    assert response.status_code == code, response.text
    assert problem_reason(response) == reason
    assert 'role="alert"' in response.text and "<fidel-player" not in response.text
    assert 'lang="am"' in response.text  # the message is in Amharic too


def test_several_audiences_with_the_right_azp_is_fine(lms):
    assert launch_with(lms, aud=[CLIENT_ID, "other"], azp=CLIENT_ID).status_code == 200


def test_wrong_signature_is_refused(lms):
    client, platform = lms
    _, state, nonce = start_login(client)
    stranger = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    response = client.post("/lti/launch", data={"id_token": platform.sign(platform.claims(nonce), key=stranger),
                                                 "state": state})
    assert response.status_code == 401 and problem_reason(response) == "bad_signature"


def test_unsigned_or_shared_secret_tokens_are_refused(lms):
    client, platform = lms
    for algorithm, key in (("HS256", "a-shared-secret-that-is-long-enough!"), ("none", None)):
        _, state, nonce = start_login(client)
        token = jwt.encode(platform.claims(nonce), key, algorithm=algorithm, headers={"kid": platform.kid})
        response = client.post("/lti/launch", data={"id_token": token, "state": state})
        assert response.status_code == 401 and problem_reason(response) == "bad_signature", algorithm


def test_unknown_key_id_reads_the_key_set_again_then_refuses(lms, monkeypatch):
    client, platform = lms
    reads = []
    monkeypatch.setattr(checks, "download_key_set", lambda url: reads.append(url) or platform.key_set())
    monkeypatch.setattr(checks, "KEY_SET_MIN_AGE", 0)
    _, state, nonce = start_login(client)
    response = client.post("/lti/launch", data={"id_token": platform.sign(platform.claims(nonce), kid="new-key"),
                                                "state": state})
    assert problem_reason(response) == "unknown_key"
    assert len(reads) == 2  # read once, then once more for the new key id


def test_reused_state_and_nonce_are_refused(lms):
    client, platform = lms
    _, state, nonce = start_login(client)
    token = platform.sign(platform.claims(nonce))
    assert client.post("/lti/launch", data={"id_token": token, "state": state}).status_code == 200
    again = client.post("/lti/launch", data={"id_token": token, "state": state})
    assert again.status_code == 400 and problem_reason(again) == "sign_in_used"


def test_a_failed_check_uses_up_the_sign_in(lms):
    client, platform = lms
    _, state, nonce = start_login(client)
    client.post("/lti/launch", data={"id_token": platform.sign(platform.claims(nonce, aud="x")), "state": state})
    retry = client.post("/lti/launch", data={"id_token": platform.sign(platform.claims(nonce)), "state": state})
    assert problem_reason(retry) == "sign_in_used"


def test_expired_sign_in_is_refused(lms, monkeypatch):
    client, platform = lms
    monkeypatch.setattr(lti, "LOGIN_SECONDS", -1)
    _, state, nonce = start_login(client)
    response = client.post("/lti/launch", data={"id_token": platform.sign(platform.claims(nonce)), "state": state})
    assert problem_reason(response) == "sign_in_used"


def test_unknown_platform_and_deployment_are_refused_at_login(lms):
    client, _ = lms
    response, state, _ = start_login(client, iss="https://unknown.example.org")
    assert response.status_code == 400 and problem_reason(response) == "unknown_platform" and state is None
    response, _, _ = start_login(client, client_id="not-registered")
    assert problem_reason(response) == "unknown_platform"
    response, _, _ = start_login(client, lti_deployment_id="99")
    assert problem_reason(response) == "unknown_deployment"
    response, _, _ = start_login(client, target_link_uri="https://evil.example.org/lti/launch")
    assert problem_reason(response) == "bad_request"  # never sends the learner somewhere else
    response, _, _ = start_login(client, login_hint=None)
    assert problem_reason(response) == "bad_request"


def test_another_browser_cannot_finish_the_sign_in(lms):
    """Login CSRF: someone forwards their own launch to a learner's browser."""
    client, platform = lms
    _, state, nonce = start_login(client)
    token = platform.sign(platform.claims(nonce))
    with TestClient(app) as other_browser:  # no state cookie
        response = other_browser.post("/lti/launch", data={"id_token": token, "state": state})
    assert response.status_code == 400 and problem_reason(response) == "cookie_blocked"


def test_platform_storage_is_used_when_the_cookie_is_blocked(lms):
    client, platform = lms
    _, state, nonce = start_login(client, lti_storage_target="post_message_forwarding")
    token = platform.sign(platform.claims(nonce))
    client.cookies.clear()  # as in a frame that blocks cookies
    check = client.post("/lti/launch", data={"id_token": token, "state": state})
    assert check.status_code == 200 and "Checking your sign-in" in check.text
    data = json.loads(re.search(r'id="lti-data">(.*?)</script>', check.text).group(1))
    assert data == {"state": state, "storageTarget": "post_message_forwarding", "platformOrigin": ISSUER,
                    "page": "launch-check"}
    # The page's script read the state back from the platform and sends the launch on.
    launched = client.post("/lti/launch", data={"id_token": token, "state": state, "platform_storage": "checked"})
    assert launched.status_code == 200 and "Opened from Fake LMS" in launched.text


def test_platform_reports_an_error(lms):
    client, _ = lms
    response = client.post("/lti/launch", data={"error": "login_required", "error_description": "Not signed in"})
    assert response.status_code == 400 and "login_required" in response.text


def test_platform_keys_unreachable(lms, monkeypatch):
    client, platform = lms

    def down(url):
        raise checks.httpx.ConnectError("refused")
    monkeypatch.setattr(checks, "download_key_set", down)
    checks.forget_key_sets()
    _, state, nonce = start_login(client)
    response = client.post("/lti/launch", data={"id_token": platform.sign(platform.claims(nonce)), "state": state})
    assert response.status_code == 502 and problem_reason(response) == "platform_keys_unreachable"


def test_login_by_post_works_too(lms):
    client, _ = lms
    response = client.post("/lti/login", data={"iss": ISSUER, "login_hint": "x", "client_id": CLIENT_ID,
                                                "target_link_uri": "http://testserver/lti/launch"})
    assert response.status_code == 200 and "Signing in" in response.text


def test_page_data_cannot_break_out_of_the_script(lms):
    client, _ = lms
    response, _, _ = start_login(client, login_hint="</script><script>alert(1)</script>")
    assert "</script><script>alert(1)" not in response.text


def test_https_sign_in_sets_a_partitioned_cookie_and_works(lms):
    """On https the state cookie is SameSite=None; Secure; Partitioned. (Starlette's
    own partitioned=True needs Python 3.14 and broke every https sign-in on 3.11.)"""
    from fastapi.testclient import TestClient as Client
    from app.main import app as fidel
    _, platform = lms
    with Client(fidel, base_url="https://testserver") as client:
        response, state, nonce = start_login(client, target_link_uri="https://testserver/lti/launch")
        assert response.status_code == 200, response.text
        cookie = response.headers["set-cookie"]
        assert f"fidel_lti_state_{state}={state}" in cookie
        for part in ("Secure", "SameSite=None", "Partitioned", "HttpOnly", "Path=/lti/", "Max-Age=600"):
            assert part in cookie, part
        launched = client.post("/lti/launch", data={"id_token": platform.sign(platform.claims(
            nonce, **{"https://purl.imsglobal.org/spec/lti/claim/target_link_uri": "https://testserver/lti/launch"})),
            "state": state})
        assert launched.status_code == 200, launched.text
        assert "Max-Age=0" in launched.headers["set-cookie"]  # removed again
