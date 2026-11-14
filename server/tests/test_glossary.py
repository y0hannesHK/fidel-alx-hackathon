from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import STAFF


def test_glossary_starts_with_risky_words_and_saves_amharic():
    with TestClient(app) as client:
        assert client.get("/api/v1/glossary").status_code == 401
        terms = client.get("/api/v1/glossary", headers=STAFF).json()["terms"]
        assert {"en": "disability", "am": None, "note": None} in terms
        body = {"terms": [{"en": "Disability ", "am": " አካል ጉዳት "}, {"en": "disability", "am": "duplicate"},
                          {"en": "sign language", "am": "የምልክት ቋንቋ"}]}
        saved = client.put("/api/v1/glossary", headers=STAFF, json=body).json()["terms"]
        assert [t["en"] for t in saved] == ["disability", "sign language"]  # one per word, tidy
        assert client.get("/api/v1/glossary", headers=STAFF).json()["terms"][1]["am"] == "የምልክት ቋንቋ"
