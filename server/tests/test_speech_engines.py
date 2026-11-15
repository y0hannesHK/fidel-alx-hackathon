"""Optional Amharic speech engines (Omnilingual ASR, ToucanTTS).

The real engines run in their own containers; here they are replaced by
fakes, so these tests check Fidel's side: choosing the engine by language,
turning timed words into captions, machine-read recordings and their markers.
"""

import subprocess
from dataclasses import replace
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api import editing, engines
from app.captions import Word, cues_from_words
from app.main import app
from app.providers import ByLanguage, ProviderUnavailable
from app.providers import omniasr
from app.providers.omniasr import OmniASRSpeechToText, timed_words
from tests.conftest import STAFF
from tests.test_editing_api import lesson  # noqa: F401  (fixture)
from tests.test_jobs_certificates import JOB


class Recorder:
    def __init__(self, name):
        self.name, self.calls = name, []

    def transcribe(self, audio_path, language):
        self.calls.append(language)
        return []


def test_amharic_goes_to_omniasr_and_english_to_whisper():
    whisper, omni = Recorder("whisper"), Recorder("omni")
    engine = ByLanguage(whisper, omni, ["am"])
    engine.transcribe("x.wav", "am")
    engine.transcribe("x.wav", "en")
    assert omni.calls == ["am"] and whisper.calls == ["en"]


def test_pause_ends_a_cue_only_when_asked():
    words = [Word(0.0, 0.4, " ሰላም"), Word(0.5, 0.9, " ለሁሉም"), Word(2.0, 2.4, " እንጀምር")]
    assert len(cues_from_words(words)) == 1  # Whisper's behaviour is unchanged
    cues = cues_from_words(words, pause_break=0.6)
    assert [c.text for c in cues] == ["ሰላም ለሁሉም", "እንጀምር"]


def test_words_stay_on_screen_until_the_next_word():
    words = timed_words([{"start": 1.0, "end": 1.1, "text": "ሰላም"}, {"start": 1.3, "end": 1.4, "text": "ለሁሉም"}])
    assert words[0].end == pytest.approx(1.3)  # held until the next word, not past it
    assert words[1].end == pytest.approx(1.8)  # the last word: held 0.4 s
    assert words[0].text == " ሰላም"  # leading space, as cues_from_words expects


def test_omniasr_builds_captions_from_engine_words(monkeypatch, tmp_path):
    audio = tmp_path / "audio.wav"
    audio.write_bytes(b"RIFF....WAVE")

    def fake_post(url, content, headers, timeout):
        assert url == "http://omniasr:8001/transcribe" and content == b"RIFF....WAVE"
        words = [{"start": 0.5, "end": 0.9, "text": "ሰላም"}, {"start": 1.0, "end": 1.4, "text": "ተማሪዎች"}]
        return httpx.Response(200, json={"words": words})

    monkeypatch.setattr(omniasr.httpx, "post", fake_post)
    cues = OmniASRSpeechToText("http://omniasr:8001", ["am"]).transcribe(str(audio), "am")
    assert len(cues) == 1 and cues[0].text == "ሰላም ተማሪዎች" and cues[0].start == 0.5


def test_omniasr_not_running_says_how_to_start_it(monkeypatch, tmp_path):
    audio = tmp_path / "audio.wav"
    audio.write_bytes(b"x")

    def refuse(*args, **kwargs):
        raise httpx.ConnectError("refused")

    monkeypatch.setattr(omniasr.httpx, "post", refuse)
    with pytest.raises(ProviderUnavailable, match="--profile amharic-speech"):
        OmniASRSpeechToText("http://omniasr:8001", ["am"]).transcribe(str(audio), "am")


class FakeVoice:
    languages = {"am", "om"}

    def __init__(self):
        self.texts = []

    def speak(self, text, language, out: Path):
        self.texts.append((text, language))
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=300:duration=1",
                        str(out)], check=True)


def test_machine_read_description_is_marked(lesson, monkeypatch):  # noqa: F811
    client, lesson_id = lesson
    voice = FakeVoice()
    monkeypatch.setattr(editing, "get_text_to_speech", lambda settings: voice)
    url = f"/api/v1/lessons/{lesson_id}/descriptions/am"
    client.put(url, headers=STAFF, json={"cues": [{"start": 0.5, "end": 2.5, "text": "የALX  አርማ ይታያል።"}]})

    made = client.post(f"{url}/recording/machine?start=0.5", headers=STAFF)
    assert made.status_code == 200, made.text
    row = made.json()["cues"][0]
    assert row["has_recording"] and row["machine_read"]
    assert voice.texts[-1] == ("የALX አርማ ይታያል።", "am")  # spaces tidied

    # Removing it removes the marker too.
    after = client.delete(f"{url}/recording?start=0.5", headers=STAFF).json()["cues"][0]
    assert not after["has_recording"] and not after["machine_read"]


def test_no_voice_engine_means_409(lesson, monkeypatch):  # noqa: F811
    client, lesson_id = lesson
    monkeypatch.setattr(editing, "get_text_to_speech", lambda settings: None)
    url = f"/api/v1/lessons/{lesson_id}/descriptions/am"
    client.put(url, headers=STAFF, json={"cues": [{"start": 0.5, "end": 2.5, "text": "ጽሑፍ"}]})
    assert client.post(f"{url}/recording/machine?start=0.5", headers=STAFF).status_code == 409
    assert client.post(f"{url}/recording/machine?start=9", headers=STAFF).status_code == 404


def test_machine_read_job_summary_is_announced(monkeypatch, tiny_video):
    monkeypatch.setattr(editing, "get_text_to_speech", lambda settings: FakeVoice())
    with TestClient(app) as client:
        job_id = client.post("/api/v1/jobs", headers=STAFF, json={**JOB, "summary_am": "የድር ገንቢ ሥራ።"}).json()["identifier"]["value"]
        made = client.post(f"/api/v1/jobs/{job_id}/summary-recording/am/machine", headers=STAFF)
        assert made.status_code == 200, made.text
        assert made.json()["fidel:summaryAudioMachineRead"] == ["am"]
        assert "am" in made.json()["fidel:summaryAudio"]
        # A person's recording replaces it: no longer machine-read.
        with open(tiny_video, "rb") as f:
            human = client.post(f"/api/v1/jobs/{job_id}/summary-recording/am", headers=STAFF,
                                files={"audio": ("summary.m4a", f, "audio/mp4")})
        assert human.json()["fidel:summaryAudioMachineRead"] == []


def test_engines_list_shows_stopped_engines(monkeypatch):
    # Port 9 on this machine: nothing listens, so the voice engine is "not running".
    monkeypatch.setattr(engines, "settings", replace(engines.settings, tts_url="http://127.0.0.1:9"))
    with TestClient(app) as client:
        assert client.get("/api/v1/engines").status_code == 401
        listed = client.get("/api/v1/engines", headers=STAFF).json()
    assert listed["speech_to_text"][0]["languages"] == ["en"]
    assert listed["text_to_speech"] == [{"name": "ToucanTTS", "languages": ["am", "om"], "running": False,
                                         "model_downloaded": None}]


def test_saved_descriptions_are_machine_read_automatically(lesson, monkeypatch, tiny_video):  # noqa: F811
    """Like English (read by the browser), Amharic and Afaan Oromo descriptions
    are read aloud without staff pressing anything. Edited text is read again;
    a person's recording is never replaced."""
    client, lesson_id = lesson
    voice = FakeVoice()
    monkeypatch.setattr(editing, "get_text_to_speech", lambda settings: voice)
    url = f"/api/v1/lessons/{lesson_id}/descriptions/om"
    first = [{"start": 0.5, "end": 2.0, "text": "Fakkiin ALX ni mul'ata."}, {"start": 2.2, "end": 2.9, "text": "Koodii."}]
    client.put(url, headers=STAFF, json={"cues": first})  # background tasks run before put() returns
    rows = client.get(url, headers=STAFF).json()["cues"]
    assert all(r["has_recording"] and r["machine_read"] for r in rows) and len(voice.texts) == 2

    client.put(url, headers=STAFF, json={"cues": first})  # same text: nothing is read again
    assert len(voice.texts) == 2

    with open(tiny_video, "rb") as f:  # a person records the first one
        client.post(f"{url}/recording?start=0.5", headers=STAFF, files={"audio": ("me.m4a", f, "audio/mp4")})
    changed = [{**first[0], "text": "Fakkiin haaraan."}, {**first[1], "text": "Koodii Python."}]
    client.put(url, headers=STAFF, json={"cues": changed})
    assert voice.texts[-1] == ("Koodii Python.", "om") and len(voice.texts) == 3  # only the machine one
    rows = client.get(url, headers=STAFF).json()["cues"]
    assert not rows[0]["machine_read"] and rows[1]["machine_read"]

    manifest = client.get(f"/api/v1/lessons/{lesson_id}", headers=STAFF).json()
    assert "om" in manifest["descriptions"]
    assert [r["machine_read"] for r in manifest["description_recordings"]["om"]] == [False, True]


def test_new_job_gets_a_machine_read_amharic_summary(monkeypatch):
    voice = FakeVoice()
    monkeypatch.setattr(editing, "get_text_to_speech", lambda settings: voice)
    with TestClient(app) as client:
        created = client.post("/api/v1/jobs", headers=STAFF, json={**JOB, "summary_am": "የድር ገንቢ ሥራ።"})
        job_id = created.json()["identifier"]["value"]
        job = client.get(f"/api/v1/jobs/{job_id}").json()
    assert job["fidel:summaryAudioMachineRead"] == ["am"] and voice.texts == [("የድር ገንቢ ሥራ።", "am")]


def test_nothing_is_read_without_a_voice_engine(lesson, monkeypatch):  # noqa: F811
    client, lesson_id = lesson
    monkeypatch.setattr(editing, "get_text_to_speech", lambda settings: None)
    url = f"/api/v1/lessons/{lesson_id}/descriptions/am"
    client.put(url, headers=STAFF, json={"cues": [{"start": 0.5, "end": 2.0, "text": "ጽሑፍ"}]})
    assert not client.get(url, headers=STAFF).json()["cues"][0]["has_recording"]
