"""LTI 1.3, phase 4: a teacher picks a lesson (Deep Linking), and the lesson page's
"Mark as complete". Uses the fake platform from test_lti_launch.py."""

import html
import json
import re

import jwt
import pytest

from app.api import lti
from app.lti import launch as checks
from tests.test_lti_launch import CLIENT_ID, ISSUER, LESSON_ID, lms, start_login  # noqa: F401  (fixture)

RETURN_URL = f"{ISSUER}/mod/lti/contentitem_return.php?course=2&id=5"
SETTINGS = {
    "deep_link_return_url": RETURN_URL,
    "accept_types": ["ltiResourceLink"],
    "accept_presentation_document_targets": ["iframe", "window"],
    "data": "opaque-moodle-data-123",
}
UNPUBLISHED_ID = "f0f0f0f0f0f0"


def picker(lms, target="/lti/deep-link", **claims):  # noqa: F811
    """The teacher opens the picker: login and a signed LtiDeepLinkingRequest."""
    client, platform = lms
    _, state, nonce = start_login(client, target_link_uri=f"http://testserver{target}")
    message = platform.claims(nonce, **{checks.MESSAGE_TYPE: "LtiDeepLinkingRequest", checks.RESOURCE_LINK: None,
                                        checks.CUSTOM: None, checks.DEEP_LINKING_SETTINGS: SETTINGS, **claims})
    return client.post(target, data={"id_token": platform.sign(message), "state": state})


def context_of(page) -> str:
    return html.unescape(re.search(r'name="context" value="([^"]+)"', page.text).group(1))


def returned(page) -> tuple[str, dict, dict]:
    """The return page: where it posts, and Fidel's signed answer (checked with Fidel's key)."""
    action = html.unescape(re.search(r'<form id="lti-return" method="post" action="([^"]+)"', page.text).group(1))
    token = html.unescape(re.search(r'name="JWT" value="([^"]+)"', page.text).group(1))
    return action, jwt.get_unverified_header(token), token


@pytest.fixture
def lessons(lms):  # noqa: F811
    if not lti.db.get_lesson(UNPUBLISHED_ID):
        lti.db.add_lesson(UNPUBLISHED_ID, "Draft lesson nobody may pick", "en", "source.mp4")
    return lms


def test_picker_lists_published_lessons_accessibly(lessons):
    page = picker(lessons)
    assert page.status_code == 200, page.text
    assert "Choose a Fidel lesson" in page.text
    assert "Fake lesson for LTI" in page.text
    assert "Draft lesson nobody may pick" not in page.text  # only published lessons
    assert '<label for="lesson-search">' in page.text and 'type="search"' in page.text
    assert f'<input type="radio" name="lesson" id="lesson-{LESSON_ID}"' in page.text
    assert f'<label for="lesson-{LESSON_ID}">' in page.text
    assert "<fieldset><legend>Published lessons</legend>" in page.text
    assert '<button class="button" name="action" value="add">Add to course</button>' in page.text
    assert 'value="cancel" formnovalidate>Cancel' in page.text


def test_picker_in_amharic(lessons):
    page = picker(lessons, **{checks.LAUNCH_PRESENTATION: {"locale": "am"}})
    assert '<form method="post" action="/lti/deep-link/choose" lang="am">' in page.text
    assert "ወደ ኮርሱ ጨምር" in page.text


def test_choosing_a_lesson_sends_a_signed_link_back(lessons):
    client, _ = lessons
    page = picker(lessons)
    back = client.post("/lti/deep-link/choose", data={"context": context_of(page), "lesson": LESSON_ID, "action": "add"})
    assert back.status_code == 200
    assert "Adding “Fake lesson for LTI” to your course" in back.text
    action, header, token = returned(back)
    assert action == RETURN_URL

    # The platform checks it with Fidel's published key.
    key = jwt.PyJWK(client.get("/lti/jwks").json()["keys"][0]).key
    assert header["kid"] == client.get("/lti/jwks").json()["keys"][0]["kid"]
    answer = jwt.decode(token, key, algorithms=["RS256"], audience=ISSUER)
    assert answer["iss"] == CLIENT_ID and answer["nonce"] and answer["exp"] - answer["iat"] == 300
    assert answer[checks.MESSAGE_TYPE] == "LtiDeepLinkingResponse"
    assert answer[checks.VERSION] == "1.3.0"
    assert answer[checks.DEPLOYMENT_ID] == "1"
    assert answer[lti.DL + "data"] == "opaque-moodle-data-123"  # sent back unchanged
    (item,) = answer[lti.DL + "content_items"]
    assert item["type"] == "ltiResourceLink" and item["title"] == "Fake lesson for LTI"
    assert item["url"] == "http://testserver/lti/launch"
    assert item["custom"] == {"lesson_id": LESSON_ID}  # what the launch reads
    assert item["lineItem"] == {"scoreMaximum": 100, "label": "Fake lesson for LTI", "resourceId": LESSON_ID}


def test_cancel_sends_an_empty_answer(lessons):
    client, _ = lessons
    back = client.post("/lti/deep-link/choose", data={"context": context_of(picker(lessons)), "action": "cancel"})
    _, _, token = returned(back)
    answer = jwt.decode(token, options={"verify_signature": False})
    assert answer[lti.DL + "content_items"] == [] and "No Fidel lesson" in answer[lti.DL + "msg"]


def test_no_lesson_or_an_unpublished_one_asks_again(lessons):
    client, _ = lessons
    context = context_of(picker(lessons))
    for lesson in ("", UNPUBLISHED_ID, "../../etc"):
        page = client.post("/lti/deep-link/choose", data={"context": context, "lesson": lesson, "action": "add"})
        assert page.status_code == 400 and "Choose a lesson first." in page.text and 'role="alert"' in page.text
        assert 'id="lti-return"' not in page.text


def test_a_changed_or_old_picker_is_refused(lessons, monkeypatch):
    client, _ = lessons
    context = context_of(picker(lessons))
    head, body, signature = context.split(".")
    claims = json.loads(jwt.utils.base64url_decode(body))
    claims["return_url"] = "https://evil.example.org/steal"
    forged = f"{head}.{jwt.utils.base64url_encode(json.dumps(claims).encode()).decode()}.{signature}"
    refused = client.post("/lti/deep-link/choose", data={"context": forged, "lesson": LESSON_ID, "action": "add"})
    assert refused.status_code == 400 and "evil.example.org" not in refused.text.split("<code>")[0]

    monkeypatch.setattr(lti, "PICKER_SECONDS", -120)
    old = context_of(picker(lessons))
    page = client.post("/lti/deep-link/choose", data={"context": old, "lesson": LESSON_ID, "action": "add"})
    assert "expired or was already used" in page.text


def test_each_address_takes_only_its_own_kind_of_message(lessons):
    client, platform = lessons
    # A picker request sent to the lesson address, and a lesson launch sent to the picker address.
    assert "wrong_message_type" in picker(lessons, target="/lti/launch").text
    _, state, nonce = start_login(client, target_link_uri="http://testserver/lti/deep-link")
    page = client.post("/lti/deep-link", data={"id_token": platform.sign(platform.claims(nonce)), "state": state})
    assert "wrong_message_type" in page.text and "Choose a Fidel lesson" not in page.text


def test_bad_deep_linking_settings_are_refused(lessons):
    page = picker(lessons, **{checks.DEEP_LINKING_SETTINGS: {"accept_types": ["ltiResourceLink"]}})
    assert "missing_claim" in page.text
    page = picker(lessons, **{checks.DEEP_LINKING_SETTINGS: {**SETTINGS, "deep_link_return_url": "javascript:alert(1)"}})
    assert "bad_claim" in page.text
    page = picker(lessons, **{checks.DEEP_LINKING_SETTINGS: {**SETTINGS, "accept_types": ["file", "html"]}})
    assert page.status_code == 400 and "cannot open this kind of activity" in page.text


def test_lesson_page_has_mark_as_complete(lms):  # noqa: F811
    client, platform = lms
    _, state, nonce = start_login(client)
    page = client.post("/lti/launch", data={"id_token": platform.sign(platform.claims(nonce)), "state": state})
    assert (f'<fidel-mark-complete id="mark-complete" for="lesson-player" lesson-id="lti-{LESSON_ID}" manual '
            'ui-lang="en">') in page.text
    assert "fidel-mark-complete" in page.text.split("<script>")[-1]  # the page listens for it
