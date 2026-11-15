"""Caption reports (Package D, D2): learners report a caption problem; staff
list them and mark them resolved or dismissed."""

import json

import pytest

from app.api import caption_reports, webhooks
from tests.conftest import STAFF
from tests.test_editing_api import lesson  # noqa: F401  (fixture)
from tests.test_webhooks import sent, wait_for  # noqa: F401  (fixture)


@pytest.fixture(autouse=True)
def fresh_limit():
    caption_reports._recent.clear()
    yield
    caption_reports._recent.clear()


def published(lesson):  # noqa: F811
    client, lesson_id = lesson
    client.post(f"/api/v1/lessons/{lesson_id}/publish", headers=STAFF, json={"published": True})
    return client, lesson_id, f"/api/v1/lessons/{lesson_id}/caption-reports"


def test_learner_reports_and_staff_resolve(lesson, sent):  # noqa: F811
    client, lesson_id, url = published(lesson)
    hook = client.post("/api/v1/webhooks", headers=STAFF,
                       json={"url": "https://host.example/hook", "events": ["caption.reported"]})
    assert hook.status_code == 201

    created = client.post(url, json={"time": 1.2, "lang": "am", "kind": "wrong_words",
                                     "correction": "ሰላም ተማሪዎች።", "caption": "[am] Hello learners."})
    assert created.status_code == 201, created.text
    report_id = created.json()["id"]

    # The host's server is told (ids only, no text from the learner).
    _, body, _ = wait_for(sent, 1)[0]
    message = json.loads(body)
    assert message["event"] == "caption.reported"
    assert message["data"] == {"lesson_id": lesson_id, "report_id": report_id, "lang": "am",
                               "kind": "wrong_words", "time": 1.2}

    # Staff only.
    assert client.get(url).status_code == 401
    reports = client.get(url + "?status=open", headers=STAFF).json()
    assert [r["id"] for r in reports] == [report_id]
    assert reports[0]["correction"] == "ሰላም ተማሪዎች።" and reports[0]["status"] == "open"

    assert client.patch(f"/api/v1/caption-reports/{report_id}", json={"status": "resolved"}).status_code == 401
    changed = client.patch(f"/api/v1/caption-reports/{report_id}", headers=STAFF, json={"status": "resolved"})
    assert changed.status_code == 200 and changed.json()["status"] == "resolved"
    assert client.get(url + "?status=open", headers=STAFF).json() == []
    assert len(client.get(url, headers=STAFF).json()) == 1
    assert client.patch("/api/v1/caption-reports/000000000000", headers=STAFF,
                        json={"status": "dismissed"}).status_code == 404


def test_bad_reports_are_400_in_words(lesson):  # noqa: F811
    client, lesson_id, url = published(lesson)
    good = {"time": 1, "lang": "en", "kind": "wrong_time"}
    cases = [
        ({**good, "lang": "xx"}, "no 'xx' captions"),
        ({**good, "time": 99}, "after the end of the video"),
        ({**good, "time": -1}, "time:"),
        ({**good, "kind": "rude"}, "kind:"),
        ({**good, "correction": "x" * 501}, "correction:"),
    ]
    for body, words in cases:
        response = client.post(url, json=body)
        assert response.status_code == 400, (body, response.text)
        assert words in response.json()["detail"], response.json()["detail"]
    assert client.post(url, json=good).status_code == 201

    # Unpublished or unknown lessons take no reports.
    client.post(f"/api/v1/lessons/{lesson_id}/publish", headers=STAFF, json={"published": False})
    assert client.post(url, json=good).status_code == 404
    assert client.post("/api/v1/lessons/000000000000/caption-reports", json=good).status_code == 404


def test_rate_limit(lesson, monkeypatch):  # noqa: F811
    client, _, url = published(lesson)
    monkeypatch.setattr(caption_reports, "LIMIT_PER_HOUR", 3)
    body = {"time": 0.5, "lang": "en", "kind": "missing_sound"}
    assert [client.post(url, json=body).status_code for _ in range(4)] == [201, 201, 201, 429]
    assert "try again in an hour" in client.post(url, json=body).json()["detail"]


def test_webhook_event_can_be_registered():
    assert "caption.reported" in webhooks.Event.__args__
