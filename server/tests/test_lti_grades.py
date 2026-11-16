"""LTI 1.3, phase 3: the lesson opens in the course, and "completed" reaches its
gradebook. The fake platform from test_lti_launch.py also plays the token
address and the gradebook."""

import json
import re
import sqlite3
import time

import httpx
import jwt
import pytest

from app.api import lti
from app.lti import ags
from tests.test_lti_launch import CLIENT_ID, ISSUER, LESSON_ID, lms, start_login  # noqa: F401  (fixture)

LINEITEM = f"{ISSUER}/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1"
AGS = {ags.AGS_CLAIM: {"scope": [ags.SCORE_SCOPE, "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly"],
                       "lineitem": LINEITEM}}


@pytest.fixture
def gradebook(monkeypatch):
    """The platform's token address and gradebook: records what Fidel sends."""
    calls = []
    answers = {"token": [], "score": []}  # queued status codes; default 200

    def post(url, **kwargs):
        calls.append((url, kwargs))
        if url == f"{ISSUER}/token":
            code = answers["token"].pop(0) if answers["token"] else 200
            return httpx.Response(code, json={"access_token": f"token-{len(calls)}", "token_type": "Bearer",
                                              "expires_in": 3600} if code == 200 else {"error": "invalid_client"})
        code = answers["score"].pop(0) if answers["score"] else 200
        if code == "down":
            raise httpx.ConnectError("refused")
        return httpx.Response(code, json={})

    monkeypatch.setattr(ags, "http_post", post)
    ags.forget_tokens()
    return calls, answers


def open_lesson(lms, **claims):  # noqa: F811
    client, platform = lms
    _, state, nonce = start_login(client)
    response = client.post("/lti/launch", data={"id_token": platform.sign(platform.claims(nonce, **claims)),
                                                "state": state})
    assert response.status_code == 200, response.text
    token = json.loads(re.search(r'id="lti-data">(.*?)</script>', response.text).group(1))["launch"]
    return client, response, token


def test_lesson_opens_with_the_normal_player_in_the_course_language(lms):  # noqa: F811
    _, page, _ = open_lesson(lms, **AGS, **{"https://purl.imsglobal.org/spec/lti/claim/launch_presentation":
                                             {"locale": "am-ET"}})
    assert '<html lang="am">' in page.text
    assert f'<fidel-player id="lesson-player" lesson="/api/v1/lessons/{LESSON_ID}" lang="am">' in page.text
    assert "Fidel tells your course" in page.text  # says that finishing is recorded
    assert 'role="status"' in page.text
    _, english, _ = open_lesson(lms, **AGS)
    assert '<html lang="en">' in english.text


def test_completed_reaches_the_gradebook(lms, gradebook):  # noqa: F811
    calls, _ = gradebook
    client, _, token = open_lesson(lms, **AGS)
    response = client.post("/lti/complete", json={"launch": token})
    assert response.status_code == 200 and response.json() == {"saved": True}

    (token_url, token_request), (score_url, score_request) = calls
    assert token_url == f"{ISSUER}/token"
    form = token_request["data"]
    assert form["grant_type"] == "client_credentials" and form["scope"] == ags.SCORE_SCOPE
    assert form["client_assertion_type"] == "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
    # The platform can check Fidel's signed assertion with Fidel's published key.
    published = jwt.PyJWK(client.get("/lti/jwks").json()["keys"][0]).key
    assertion = jwt.decode(form["client_assertion"], published, algorithms=["RS256"], audience=f"{ISSUER}/token")
    assert assertion["iss"] == assertion["sub"] == CLIENT_ID and assertion["jti"]

    # The score goes to the column's address + /scores, before the ?query.
    assert score_url == f"{ISSUER}/mod/lti/services.php/2/lineitems/7/lineitem/scores?type_id=1"
    assert score_request["headers"]["Content-Type"] == "application/vnd.ims.lis.v1.score+json"
    assert score_request["headers"]["Authorization"] == "Bearer token-1"
    score = score_request["json"]
    assert score["userId"] == "learner-42"
    assert (score["scoreGiven"], score["scoreMaximum"]) == (100, 100)
    assert (score["activityProgress"], score["gradingProgress"]) == ("Completed", "FullyGraded")
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}\+00:00", score["timestamp"])
    assert set(score) == {"userId", "scoreGiven", "scoreMaximum", "activityProgress", "gradingProgress", "timestamp"}

    # A second completion (watched again) reuses the gradebook token.
    assert client.post("/lti/complete", json={"launch": token}).json() == {"saved": True}
    assert [url for url, _ in calls].count(f"{ISSUER}/token") == 1


def test_a_course_without_a_gradebook_column(lms, gradebook):  # noqa: F811
    calls, _ = gradebook
    client, page, token = open_lesson(lms)  # no AGS claim
    assert "Fidel tells your course" not in page.text
    assert client.post("/lti/complete", json={"launch": token}).json() == {"saved": False, "reason": "no_gradebook"}
    assert calls == []
    # A column without the score permission is the same.
    client, _, token = open_lesson(lms, **{ags.AGS_CLAIM: {"scope": [], "lineitem": LINEITEM}})
    assert client.post("/lti/complete", json={"launch": token}).json()["reason"] == "no_gradebook"


def test_unknown_or_expired_launches_are_refused(lms, gradebook, monkeypatch):  # noqa: F811
    client, _ = lms
    response = client.post("/lti/complete", json={"launch": "x" * 43})
    assert response.status_code == 404 and response.json()["reason"] == "launch_expired"
    assert client.post("/lti/complete", json={"launch": "short"}).status_code == 400

    monkeypatch.setattr(lti, "LAUNCH_SECONDS", 0)  # opened "more than a day ago"
    client, _, token = open_lesson(lms, **AGS)
    response = client.post("/lti/complete", json={"launch": token})
    assert response.status_code == 404 and response.json()["reason"] == "launch_expired"
    assert gradebook[0] == []


def test_gradebook_problems_can_be_retried(lms, gradebook):  # noqa: F811
    calls, answers = gradebook
    client, _, token = open_lesson(lms, **AGS)

    answers["score"].append("down")
    response = client.post("/lti/complete", json={"launch": token})
    assert response.status_code == 502 and response.json()["reason"] == "gradebook_unreachable"

    answers["token"].append(401)
    ags.forget_tokens()
    assert client.post("/lti/complete", json={"launch": token}).json()["reason"] == "token_refused"

    answers["score"].append(500)
    assert client.post("/lti/complete", json={"launch": token}).json()["reason"] == "score_refused"

    # The platform dropped the token early: Fidel gets a new one once, and it works.
    answers["score"].append(401)
    assert client.post("/lti/complete", json={"launch": token}).json() == {"saved": True}


def test_only_the_platform_id_for_the_learner_is_kept_and_only_for_a_day(lms):  # noqa: F811
    _, _, token = open_lesson(lms, **AGS, name="Selam Tesfaye", email="selam@example.org",
                              given_name="Selam", family_name="Tesfaye")
    with sqlite3.connect(lti.db.path) as db:
        row = db.execute("SELECT * FROM lti_launches WHERE token = ?", (token,)).fetchone()
        stored = " ".join(str(v) for v in row)
        columns = [c[1] for c in db.execute("PRAGMA table_info(lti_launches)")]
    assert "learner-42" in stored
    assert "Selam" not in stored and "Tesfaye" not in stored and "example.org/" not in stored.replace(ISSUER, "")
    assert not {"name", "email"} & set(columns)
    created, expires = row[columns.index("created_at")], row[columns.index("expires_at")]
    assert expires - created == 24 * 3600


def test_old_launches_are_deleted(lms):  # noqa: F811
    _, _, token = open_lesson(lms, **AGS)
    later = int(time.time()) + 24 * 3600 + 1
    lti.db.delete_expired_lti_records(later)
    with sqlite3.connect(lti.db.path) as db:
        assert db.execute("SELECT COUNT(*) FROM lti_launches WHERE token = ?", (token,)).fetchone()[0] == 0
    # A new launch also clears out old ones.
    old = {"token": "old" * 15, "platform_id": lti.db.list_lti_platforms()[0]["id"], "lesson_id": LESSON_ID,
           "user_id": "u", "lineitem": None, "scopes": [], "created_at": 1, "expires_at": 2}
    lti.db.add_lti_launch(old)
    open_lesson(lms, **AGS)
    assert lti.db.get_lti_launch(old["token"], 0) is None
