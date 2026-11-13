"""Offline downloads: one-page lesson and .zip pack."""

import io
import json
import re
import zipfile

from tests.conftest import STAFF
from tests.test_editing_api import lesson  # noqa: F401  (fixture)


def page_data(page: str) -> dict:
    raw = re.search(r'<script type="application/json" id="lesson-data">(.*?)</script>', page, re.S).group(1)
    return json.loads(raw)


def test_offline_page_is_self_contained(lesson):  # noqa: F811
    client, lesson_id = lesson
    # Unpublished: only staff can download.
    assert client.get(f"/api/v1/lessons/{lesson_id}/offline.html").status_code == 404
    response = client.get(f"/api/v1/lessons/{lesson_id}/offline.html", headers=STAFF)
    assert response.status_code == 200
    assert "attachment" in response.headers["content-disposition"]
    page = response.text

    # Audio and font are inside the file; nothing is loaded from elsewhere.
    assert 'src="data:audio/ogg; codecs=opus;base64,' in page
    assert not re.search(r'(src|href)="https?://', page)
    data = page_data(page)
    assert data["captions"]["am"][0]["text"] == "[am] Hello learners."
    assert data["status"]["am"] == "draft"

    manifest = client.get(f"/api/v1/lessons/{lesson_id}", headers=STAFF).json()
    assert manifest["offline"]["pack"].endswith("/pack")


def test_text_cannot_break_out_of_the_page(lesson):  # noqa: F811
    client, lesson_id = lesson
    evil = "</script><script>alert(1)</script>"
    cues = [{"start": 0, "end": 1.5, "text": evil}]
    client.put(f"/api/v1/lessons/{lesson_id}/captions/en", headers=STAFF, json={"cues": cues})
    page = client.get(f"/api/v1/lessons/{lesson_id}/offline.html", headers=STAFF).text
    assert "<script>alert(1)" not in page
    assert page_data(page)["captions"]["en"][0]["text"] == evil  # kept as text, safely


def test_zip_pack_contents(lesson):  # noqa: F811
    client, lesson_id = lesson
    response = client.get(f"/api/v1/lessons/{lesson_id}/pack", headers=STAFF)
    assert response.headers["content-type"] == "application/zip"
    names = set(zipfile.ZipFile(io.BytesIO(response.content)).namelist())
    assert {"index.html", "captions-en.vtt", "captions-am.vtt", "transcript-en.txt", "transcript-am.txt", "README.txt"} <= names
