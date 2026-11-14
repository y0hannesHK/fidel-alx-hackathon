import time

import pytest
from fastapi.testclient import TestClient

from app.captions import Cue
from app.main import app
from app.pipeline import steps
from tests.conftest import STAFF


class FakeSpeechToText:
    def transcribe(self, audio_path, language):
        return [Cue(0.0, 1.5, "Hello learners."), Cue(1.5, 3.0, "Welcome to Fidel.")]


class FakeTranslator:
    def translate(self, cues, source, target):
        return [Cue(c.start, c.end, f"[{target}] {c.text}") for c in cues]


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(steps, "get_speech_to_text", lambda settings: FakeSpeechToText())
    monkeypatch.setattr(steps, "get_translator", lambda settings: FakeTranslator())
    with TestClient(app) as c:
        yield c


def upload(client, path, **form):
    with open(path, "rb") as f:
        return client.post(
            "/api/v1/lessons",
            headers=STAFF,
            files={"video": ("my lesson.mp4", f, "video/mp4")},
            data={"title": "Test lesson", "spoken_language": "en", **form},
        )


def wait_for_steps(client, lesson_id, timeout=120):
    deadline = time.time() + timeout
    while time.time() < deadline:
        steps_now = client.get(f"/api/v1/lessons/{lesson_id}/status").json()
        if steps_now and all(s["status"] in ("done", "failed", "skipped") for s in steps_now.values()):
            return steps_now
        time.sleep(0.5)
    raise AssertionError(f"Pipeline did not finish: {steps_now}")


def test_upload_runs_the_whole_pipeline(client, tiny_video):
    response = upload(client, tiny_video)
    assert response.status_code == 201, response.text
    lesson_id = response.json()["id"]

    steps_done = wait_for_steps(client, lesson_id)
    assert {name: s["status"] for name, s in steps_done.items()} == {
        "extract_audio": "done", "renditions": "done", "transcribe": "done", "translate": "done",
        "sign_video": "skipped",
    }

    # Unpublished: hidden from the public, visible to staff.
    assert client.get(f"/api/v1/lessons/{lesson_id}").status_code == 404
    assert all(l["id"] != lesson_id for l in client.get("/api/v1/lessons").json())
    manifest = client.get(f"/api/v1/lessons/{lesson_id}", headers=STAFF).json()
    assert manifest["published"] is False
    assert manifest["title"] == "Test lesson"
    assert set(manifest["video"]) == {"mp4", "webm", "small_mp4"}
    assert "opus" in manifest["audio"]
    assert {c["lang"]: c["status"] for c in manifest["captions"]} == {"en": "draft", "am": "draft", "om": "draft"}

    english = client.get(f"/api/v1/lessons/{lesson_id}/captions/en")
    assert english.headers["content-type"].startswith("text/vtt")
    assert "Hello learners." in english.text
    amharic = client.get(f"/api/v1/lessons/{lesson_id}/captions/am").text
    assert "[am] Hello learners." in amharic
    assert "00:00:00.000 --> 00:00:01.500" in amharic  # same timings as English
    oromo = client.get(f"/api/v1/lessons/{lesson_id}/captions/om").text
    assert "[om] Hello learners." in oromo

    # Files listed in the manifest can be downloaded.
    video_path = manifest["video"]["mp4"].split("testserver", 1)[1]
    assert client.get(video_path).status_code == 200

    assert any(l["id"] == lesson_id for l in client.get("/api/v1/lessons", headers=STAFF).json())

    # Published: visible to everyone.
    assert client.post(f"/api/v1/lessons/{lesson_id}/publish", headers=STAFF, json={"published": True}).status_code == 200
    assert client.get(f"/api/v1/lessons/{lesson_id}").json()["published"] is True
    assert any(l["id"] == lesson_id for l in client.get("/api/v1/lessons").json())


def test_write_endpoints_need_the_staff_token(client, tiny_video):
    with open(tiny_video, "rb") as f:
        response = client.post("/api/v1/lessons", files={"video": ("a.mp4", f, "video/mp4")}, data={"title": "x"})
    assert response.status_code == 401
    with open(tiny_video, "rb") as f:
        response = client.post("/api/v1/lessons", headers={"Authorization": "Bearer wrong"},
                               files={"video": ("a.mp4", f, "video/mp4")}, data={"title": "x"})
    assert response.status_code == 401


def test_rejects_files_that_are_not_video(client, tmp_path):
    text_file = tmp_path / "notes.mp4"
    text_file.write_text("this is not a video")
    assert upload(client, text_file).status_code == 422
    other = tmp_path / "virus.exe"
    other.write_bytes(b"MZ")
    with open(other, "rb") as f:
        response = client.post("/api/v1/lessons", headers=STAFF,
                               files={"video": ("virus.exe", f, "application/octet-stream")}, data={"title": "x"})
    assert response.status_code == 415


def test_unknown_or_malformed_lesson_ids(client):
    assert client.get("/api/v1/lessons/000000000000").status_code == 404
    assert client.get("/api/v1/lessons/..%2F..%2Fetc").status_code in (404, 422)


def test_missing_model_gives_a_clear_message(monkeypatch, tiny_video):
    """With the real engines but no models downloaded, steps fail politely."""
    with TestClient(app) as client:
        lesson_id = upload(client, tiny_video).json()["id"]
        result = wait_for_steps(client, lesson_id)
    assert result["renditions"]["status"] == "done"  # video still playable
    assert result["transcribe"]["status"] == "failed"
    assert "not downloaded" in result["transcribe"]["message"]
    assert "download_models" in result["transcribe"]["message"]
    assert result["translate"]["status"] == "skipped"


def test_rebuild_reruns_selected_steps(client, tiny_video):
    lesson_id = upload(client, tiny_video).json()["id"]
    wait_for_steps(client, lesson_id)
    response = client.post(f"/api/v1/lessons/{lesson_id}/rebuild", headers=STAFF, json={"steps": ["translate"]})
    assert response.status_code == 202
    assert wait_for_steps(client, lesson_id)["translate"]["status"] == "done"
