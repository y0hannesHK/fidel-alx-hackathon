"""Learner questions (Package E, E2): a learner asks about a moment in
writing, with a voice note or in sign language; staff list them, play the
recording (never public) and mark them answered or dismissed."""

import json

import pytest

from app.api import questions
from tests.conftest import STAFF, TEST_DATA
from tests.test_editing_api import lesson  # noqa: F401  (fixture)
from tests.test_webhooks import sent, wait_for  # noqa: F401  (fixture)

VOICE = b"\x1aE\xdf\xa3fake-webm-audio" * 10


@pytest.fixture(autouse=True)
def fresh_limit():
    questions._recent.clear()
    yield
    questions._recent.clear()


def published(lesson):  # noqa: F811
    client, lesson_id = lesson
    client.post(f"/api/v1/lessons/{lesson_id}/publish", headers=STAFF, json={"published": True})
    return client, lesson_id, f"/api/v1/lessons/{lesson_id}/questions"


def test_written_and_voice_questions_and_staff_answer(lesson, sent):  # noqa: F811
    client, lesson_id, url = published(lesson)
    hook = client.post("/api/v1/webhooks", headers=STAFF,
                       json={"url": "https://host.example/hook", "events": ["question.asked"]})
    assert hook.status_code == 201

    written = client.post(url, data={"time": "1.2", "kind": "text", "text": "ይህ ምን ማለት ነው?", "caption": "[am] Hello"})
    assert written.status_code == 201, written.text
    voice = client.post(url, data={"time": "2", "kind": "voice"},
                        files={"media": ("q.webm", VOICE, "audio/webm;codecs=opus")})
    assert voice.status_code == 201, voice.text
    voice_id = voice.json()["id"]

    # The host's server is told (ids only, never the question or the recording).
    messages = [json.loads(body) for _, body, _ in wait_for(sent, 2)]
    assert {m["event"] for m in messages} == {"question.asked"}
    assert {m["data"]["kind"] for m in messages} == {"text", "voice"}
    assert all(set(m["data"]) == {"lesson_id", "question_id", "kind", "time"} for m in messages)

    # Staff only; the recording is not under /files (never public).
    assert client.get(url).status_code == 401
    listed = client.get(url + "?status=open", headers=STAFF).json()
    assert [q["kind"] for q in listed] == ["text", "voice"]
    assert listed[0]["text"] == "ይህ ምን ማለት ነው?" and listed[0]["media_url"] is None
    assert listed[1]["media_type"] == "audio/webm"
    media_url = listed[1]["media_url"]
    assert media_url == f"/api/v1/questions/{voice_id}/media"
    assert client.get(media_url).status_code == 401
    played = client.get(media_url, headers=STAFF)
    assert played.status_code == 200 and played.content == VOICE
    assert played.headers["content-type"].startswith("audio/webm")
    assert not list((TEST_DATA / "lessons" / lesson_id).rglob(f"{voice_id}.*"))

    assert client.patch(f"/api/v1/questions/{voice_id}", json={"status": "answered"}).status_code == 401
    changed = client.patch(f"/api/v1/questions/{voice_id}", headers=STAFF, json={"status": "answered"})
    assert changed.status_code == 200 and changed.json()["status"] == "answered"
    assert len(client.get(url + "?status=open", headers=STAFF).json()) == 1
    assert client.patch("/api/v1/questions/000000000000", headers=STAFF, json={"status": "dismissed"}).status_code == 404

    # Deleting the lesson deletes the recordings too.
    assert (TEST_DATA / "questions" / lesson_id / f"{voice_id}.webm").is_file()
    assert client.delete(f"/api/v1/lessons/{lesson_id}", headers=STAFF).status_code == 204
    assert not (TEST_DATA / "questions" / lesson_id).exists()


def test_bad_questions_are_400_in_words(lesson):  # noqa: F811
    client, lesson_id, url = published(lesson)
    cases = [
        ({"time": "1", "kind": "text"}, None, "Write the question"),
        ({"time": "1", "kind": "text", "text": "x" * 2001}, None, "too long"),
        ({"time": "-1", "kind": "text", "text": "Why?"}, None, "time:"),
        ({"time": "1", "kind": "song", "text": "Why?"}, None, "kind:"),
        ({"time": "1", "kind": "voice"}, None, "voice note"),
        ({"time": "1", "kind": "sign"}, ("a.webm", b"x", "audio/webm"), "video file"),
        ({"time": "1", "kind": "voice"}, ("a.exe", b"x", "application/x-msdownload"), "audio file"),
        ({"time": "1", "kind": "voice"}, ("a.webm", b"", "audio/webm"), "empty"),
        ({"time": "1", "kind": "text", "text": "Why?"}, ("a.webm", b"x", "audio/webm"), "no recording"),
    ]
    for data, upload, words in cases:
        response = client.post(url, data=data, files={"media": upload} if upload else None)
        assert response.status_code == 400, (data, response.text)
        assert words in response.json()["detail"], response.json()["detail"]
    sign = client.post(url, data={"time": "1", "kind": "sign"}, files={"media": ("s.mp4", b"video", "video/mp4")})
    assert sign.status_code == 201, sign.text

    # Unpublished or unknown lessons take no questions.
    client.post(f"/api/v1/lessons/{lesson_id}/publish", headers=STAFF, json={"published": False})
    assert client.post(url, data={"time": "1", "kind": "text", "text": "Why?"}).status_code == 404
    assert client.post("/api/v1/lessons/000000000000/questions",
                       data={"time": "1", "kind": "text", "text": "Why?"}).status_code == 404


def test_rate_limit_per_address(lesson, monkeypatch):  # noqa: F811
    client, lesson_id, url = published(lesson)
    monkeypatch.setattr(questions, "LIMIT_PER_HOUR", 2)
    for _ in range(2):
        assert client.post(url, data={"time": "1", "kind": "text", "text": "Why?"}).status_code == 201
    refused = client.post(url, data={"time": "1", "kind": "text", "text": "Why?"})
    assert refused.status_code == 429 and "try again in an hour" in refused.json()["detail"]


def test_recording_size_limit(lesson, monkeypatch):  # noqa: F811
    client, lesson_id, url = published(lesson)
    monkeypatch.setattr(questions, "MAX_MEDIA_MB", 1)
    big = client.post(url, data={"time": "1", "kind": "voice"},
                      files={"media": ("q.webm", b"x" * (1024 * 1024 + 10), "audio/webm")})
    assert big.status_code == 413 and "larger than 1 MB" in big.json()["detail"]
    assert not list((TEST_DATA / "questions" / lesson_id).glob("*"))
