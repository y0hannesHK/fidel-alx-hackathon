"""Webhooks (Level 2) and readable bad-input errors."""

import hashlib
import hmac
import json
import time

import pytest
from fastapi.testclient import TestClient

from app.api import webhooks
from app.main import app
from tests.conftest import STAFF
from tests.test_editing_api import lesson  # noqa: F401  (fixture)


@pytest.fixture
def sent(monkeypatch):
    deliveries = []
    monkeypatch.setattr(webhooks, "_send", lambda url, body, headers: deliveries.append((url, body, headers)))
    return deliveries


def wait_for(deliveries, count, timeout=5):
    deadline = time.time() + timeout
    while len(deliveries) < count and time.time() < deadline:
        time.sleep(0.05)
    return deliveries


def test_register_and_receive_signed_events(lesson, sent):  # noqa: F811
    client, lesson_id = lesson
    assert client.post("/api/v1/webhooks", json={"url": "https://host.example/hook", "events": ["lesson.published"]}).status_code == 401
    created = client.post("/api/v1/webhooks", headers=STAFF,
                          json={"url": "https://host.example/hook", "events": ["lesson.published", "certificate.issued"]}).json()
    assert created["secret"]  # shown once
    assert all(h.get("secret") is None for h in client.get("/api/v1/webhooks", headers=STAFF).json())

    client.post(f"/api/v1/lessons/{lesson_id}/publish", headers=STAFF, json={"published": True})
    client.post("/api/v1/certificates", headers=STAFF, json={"learner_name": "Hook Test", "course": "Webhooks"})
    url, body, headers = wait_for(sent, 2)[0]
    message = json.loads(body)
    assert url == "https://host.example/hook"
    assert message["event"] == "lesson.published" and message["data"]["lesson_id"] == lesson_id
    expected = "sha256=" + hmac.new(created["secret"].encode(), body, hashlib.sha256).hexdigest()
    assert headers["X-Fidel-Signature"] == expected  # the host can check it came from Fidel
    assert "Hook Test" not in sent[1][1].decode()  # no personal data, only ids and links

    # Events nobody asked for are not sent; a removed webhook gets nothing.
    client.post(f"/api/v1/lessons/{lesson_id}/publish", headers=STAFF, json={"published": False})
    time.sleep(0.3)
    assert len(sent) == 2
    assert client.delete(f"/api/v1/webhooks/{created['id']}", headers=STAFF).status_code == 204


def test_bad_input_is_400_with_words():
    with TestClient(app) as client:
        response = client.post("/api/v1/webhooks", headers=STAFF, json={"url": "not a url", "events": []})
    assert response.status_code == 400
    assert response.json()["detail"].startswith("Please check: url:")
    assert "events:" in response.json()["detail"]
