"""Studio editing: captions review, chapters, descriptions, sign video."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.pipeline import steps
from tests.conftest import STAFF
from tests.test_lessons_api import FakeSpeechToText, FakeTranslator, upload, wait_for_steps


@pytest.fixture
def lesson(monkeypatch, tiny_video):
    monkeypatch.setattr(steps, "get_speech_to_text", lambda settings: FakeSpeechToText())
    monkeypatch.setattr(steps, "get_translator", lambda settings: FakeTranslator())
    with TestClient(app) as client:
        lesson_id = upload(client, tiny_video).json()["id"]
        wait_for_steps(client, lesson_id)
        yield client, lesson_id


def test_amharic_review_flow(lesson):
    client, lesson_id = lesson
    url = f"/api/v1/lessons/{lesson_id}/captions/am"
    data = client.get(url + "/cues", headers=STAFF).json()
    assert data["status"] == "draft" and data["drafts_left"] == 2

    # Fix the first cue and mark it reviewed: still a draft overall.
    cues = data["cues"]
    cues[0].update(text="ሰላም ተማሪዎች።", reviewed=True)
    saved = client.put(url, headers=STAFF, json={"cues": cues}).json()
    assert saved["status"] == "draft" and saved["drafts_left"] == 1

    # Review the rest: the file becomes 'reviewed' and the manifest says so.
    cues[1]["reviewed"] = True
    saved = client.put(url, headers=STAFF, json={"cues": cues}).json()
    assert saved["status"] == "reviewed" and saved["drafts_left"] == 0
    manifest = client.get(f"/api/v1/lessons/{lesson_id}", headers=STAFF).json()
    assert {c["lang"]: c["status"] for c in manifest["captions"]}["am"] == "reviewed"
    assert "ሰላም ተማሪዎች።" in client.get(url).text

    # Running the translation again must not overwrite the reviewed work.
    client.post(f"/api/v1/lessons/{lesson_id}/rebuild", headers=STAFF, json={"steps": ["translate"]})
    result = wait_for_steps(client, lesson_id)["translate"]
    # The checked Amharic is kept; the other languages (Afaan Oromo) are still translated.
    assert result["status"] == "done", result
    assert "am captions have been reviewed by a person" in result["message"]
    assert "Afaan Oromo:" in result["message"]
    assert "ሰላም ተማሪዎች።" in client.get(url).text


def test_bad_caption_edits_are_rejected(lesson):
    client, lesson_id = lesson
    url = f"/api/v1/lessons/{lesson_id}/captions/am"
    for bad in ({"start": 2, "end": 1, "text": "x"}, {"start": 0, "end": 1, "text": "   "}):
        assert client.put(url, headers=STAFF, json={"cues": [bad]}).status_code == 400
    assert client.put(url, json={"cues": []}).status_code == 401  # no token


def test_chapters_in_both_languages(lesson):
    client, lesson_id = lesson
    url = f"/api/v1/lessons/{lesson_id}/chapters"
    body = {"chapters": [
        {"start": 1.5, "title_en": "Part two", "title_am": "ክፍል ሁለት"},
        {"start": 0, "title_en": "Part one", "title_am": "ክፍል አንድ"},
    ]}
    assert client.put(url, headers=STAFF, json=body).status_code == 200
    chapters = client.get(url, headers=STAFF).json()["chapters"]
    assert [c["title_en"] for c in chapters] == ["Part one", "Part two"]  # sorted by time
    manifest = client.get(f"/api/v1/lessons/{lesson_id}", headers=STAFF).json()
    assert set(manifest["chapters"]) == {"en", "am"}

    # A missing Amharic title: no half-English Amharic file is written.
    body["chapters"][0]["title_am"] = None
    client.put(url, headers=STAFF, json=body)
    manifest = client.get(f"/api/v1/lessons/{lesson_id}", headers=STAFF).json()
    assert set(manifest["chapters"]) == {"en"}


def test_descriptions_saved_as_vtt(lesson):
    client, lesson_id = lesson
    url = f"/api/v1/lessons/{lesson_id}/descriptions/en"
    cues = [{"start": 0.5, "end": 2.5, "text": "A slide shows the ALX logo."}]
    assert client.put(url, headers=STAFF, json={"cues": cues}).status_code == 200
    manifest = client.get(f"/api/v1/lessons/{lesson_id}", headers=STAFF).json()
    file_url = manifest["descriptions"]["en"].split("testserver", 1)[1]
    assert "ALX logo" in client.get(file_url).text


def test_sign_video_upload_is_processed(lesson, tiny_video):
    client, lesson_id = lesson
    with open(tiny_video, "rb") as f:
        response = client.post(f"/api/v1/lessons/{lesson_id}/sign", headers=STAFF,
                               files={"video": ("interpreter.mp4", f, "video/mp4")})
    assert response.status_code == 202
    assert wait_for_steps(client, lesson_id)["sign_video"]["status"] == "done"
    manifest = client.get(f"/api/v1/lessons/{lesson_id}", headers=STAFF).json()
    assert manifest["sign"].endswith("/sign.webm")


def test_delete_removes_lesson_and_files(lesson):
    client, lesson_id = lesson
    from app.pipeline.steps import lesson_folder
    assert lesson_folder(lesson_id).is_dir()
    assert client.delete(f"/api/v1/lessons/{lesson_id}").status_code == 401
    assert client.delete(f"/api/v1/lessons/{lesson_id}", headers=STAFF).status_code == 204
    assert client.get(f"/api/v1/lessons/{lesson_id}", headers=STAFF).status_code == 404
    assert not lesson_folder(lesson_id).exists()


def test_description_recordings(lesson, tiny_video):
    client, lesson_id = lesson
    url = f"/api/v1/lessons/{lesson_id}/descriptions/am"
    client.put(url, headers=STAFF, json={"cues": [{"start": 1.0, "end": 2.5, "text": "ስላይዱ ንድፍ ያሳያል።"}]})

    # No description at that time: refused.
    with open(tiny_video, "rb") as f:
        bad = client.post(url + "/recording?start=9", headers=STAFF, files={"audio": ("r.mp4", f, "video/mp4")})
    assert bad.status_code == 404

    with open(tiny_video, "rb") as f:  # any file with sound works (e.g. a phone recording)
        ok = client.post(url + "/recording?start=1", headers=STAFF, files={"audio": ("r.m4a", f, "audio/mp4")})
    assert ok.status_code == 200, ok.text
    assert ok.json()["cues"][0]["has_recording"] is True

    manifest = client.get(f"/api/v1/lessons/{lesson_id}", headers=STAFF).json()
    recording = manifest["description_recordings"]["am"][0]
    assert recording["start"] == 1.0
    assert client.get(recording["url"].split("testserver", 1)[1]).status_code == 200

    # Deleting the description also removes its recording.
    client.put(url, headers=STAFF, json={"cues": []})
    manifest = client.get(f"/api/v1/lessons/{lesson_id}", headers=STAFF).json()
    assert "am" not in manifest["description_recordings"]


def test_upload_a_caption_file(lesson):
    client, lesson_id = lesson
    url = f"/api/v1/lessons/{lesson_id}/captions"
    vtt = "\ufeffWEBVTT\n\n00:00:02.000 --> 00:00:03.000\nSecond.\n\n00:00:00.500 --> 00:00:01.500\nFirst.\n"
    response = client.post(url, headers=STAFF, data={"lang": "om"},
                           files={"file": ("captions.vtt", vtt.encode("utf-8"), "text/vtt")})
    assert response.status_code == 200, response.text
    data = response.json()
    assert [c["text"] for c in data["cues"]] == ["First.", "Second."]  # sorted by time
    assert data["status"] == "draft" and data["drafts_left"] == 2

    for bad in (b"not a caption file", "WEBVTT\n\nno cues here\n".encode(), b"\xff\xfe\x00bad"):
        r = client.post(url, headers=STAFF, data={"lang": "om"}, files={"file": ("x.vtt", bad, "text/vtt")})
        assert r.status_code == 400, bad
    assert client.post(url, data={"lang": "om"}, files={"file": ("x.vtt", vtt.encode(), "text/vtt")}).status_code == 401
