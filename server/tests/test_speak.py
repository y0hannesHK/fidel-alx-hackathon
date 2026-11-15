"""POST /api/v1/speak: "Listen" in form fields through the optional voice engine.

The real engine runs in its own container; here it is a fake.
"""

from fastapi.testclient import TestClient

from app.api import speak
from app.main import app

client = TestClient(app)


class FakeVoice:
    languages = {"am", "om"}

    def __init__(self):
        self.calls = []

    def speak(self, text, language, out):
        self.calls.append((text, language))
        out.write_bytes(b"RIFF....WAVEfake")


def test_no_engine_lists_no_languages_and_says_why(monkeypatch):
    monkeypatch.setattr(speak, "get_text_to_speech", lambda settings: None)
    assert client.get("/api/v1/speak").json() == {"languages": []}
    answer = client.post("/api/v1/speak", json={"text": "ሰላም", "lang": "am"})
    assert answer.status_code == 409
    assert "No voice engine" in answer.json()["detail"]


def test_engine_reads_its_languages_only(monkeypatch):
    voice = FakeVoice()
    monkeypatch.setattr(speak, "get_text_to_speech", lambda settings: voice)
    assert client.get("/api/v1/speak").json() == {"languages": ["am", "om"]}
    answer = client.post("/api/v1/speak", json={"text": "ሰላም ለሁሉም", "lang": "am"})
    assert answer.status_code == 200
    assert answer.headers["content-type"] == "audio/wav"
    assert answer.content.startswith(b"RIFF")
    assert voice.calls == [("ሰላም ለሁሉም", "am")]
    refused = client.post("/api/v1/speak", json={"text": "hello", "lang": "en"})
    assert refused.status_code == 409 and "'en'" in refused.json()["detail"]


def test_text_is_limited(monkeypatch):
    monkeypatch.setattr(speak, "get_text_to_speech", lambda settings: FakeVoice())
    assert client.post("/api/v1/speak", json={"text": "", "lang": "am"}).status_code == 400
    assert client.post("/api/v1/speak", json={"text": "ሀ" * 501, "lang": "am"}).status_code == 400
