"""Accessible lesson documents: HTML and tagged PDF."""

import re
import zlib

from tests.conftest import STAFF
from tests.test_editing_api import lesson  # noqa: F401  (fixture)


def add_chapters(client, lesson_id, alt_en=None):
    body = {"chapters": [
        {"start": 0, "title_en": "Welcome", "title_am": "እንኳን ደህና መጡ", "image_alt_en": alt_en},
        {"start": 1.5, "title_en": "Main part", "title_am": "ዋናው ክፍል"},
    ]}
    response = client.put(f"/api/v1/lessons/{lesson_id}/chapters", headers=STAFF, json=body)
    assert response.status_code == 200, response.text
    return response.json()["chapters"]


def test_html_document_structure(lesson):  # noqa: F811
    client, lesson_id = lesson
    chapters = add_chapters(client, lesson_id, alt_en="A slide with the word Welcome on a blue background.")
    assert chapters[0]["image_url"].endswith(".jpg")  # slide image made for Studio
    client.put(f"/api/v1/lessons/{lesson_id}/descriptions/en", headers=STAFF,
               json={"cues": [{"start": 1.6, "end": 2.5, "text": "The teacher points at a diagram."}]})

    page = client.get(f"/api/v1/lessons/{lesson_id}/document.html?lang=en", headers=STAFF).text
    assert '<html lang="en">' in page
    assert re.search(r'<h2 id="ch0" lang="en">Welcome</h2>', page)
    assert '<figure><img src="' in page and 'alt="A slide with the word Welcome on a blue background."' in page
    assert "<figcaption>" in page
    assert "Hello learners." in page  # transcript (from the fake speech-to-text)
    assert '<p class="description"><strong>Description:</strong> The teacher points at a diagram.</p>' in page
    assert "machine-made" in page  # captions are still a draft


def test_no_image_without_a_description(lesson):  # noqa: F811
    client, lesson_id = lesson
    add_chapters(client, lesson_id, alt_en=None)
    page = client.get(f"/api/v1/lessons/{lesson_id}/document.html?lang=en", headers=STAFF).text
    assert "<img" not in page


def test_amharic_document(lesson):  # noqa: F811
    client, lesson_id = lesson
    add_chapters(client, lesson_id)
    page = client.get(f"/api/v1/lessons/{lesson_id}/document.html?lang=am", headers=STAFF).text
    assert '<html lang="am">' in page
    assert 'lang="am">እንኳን ደህና መጡ</h2>' in page
    assert "[am] Hello learners." in page


def test_tagged_pdf(lesson):  # noqa: F811
    client, lesson_id = lesson
    add_chapters(client, lesson_id, alt_en="A slide with the word Welcome.")
    response = client.get(f"/api/v1/lessons/{lesson_id}/document.pdf?lang=am", headers=STAFF)
    assert response.status_code == 200, response.text
    pdf = response.content
    assert pdf.startswith(b"%PDF")
    # The structure is inside compressed object streams: decompress them first.
    content = pdf
    for match in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", pdf, re.S):
        try:
            content += zlib.decompress(match.group(1))
        except zlib.error:
            pass
    # Tagged (structure tree), PDF/UA identifier, headings, figure with its alt text, language, title.
    for marker in (b"/StructTreeRoot", b"/Marked true", b"pdfuaid:part", b"/H1", b"/H2", b"/Figure",
                   b"/DisplayDocTitle"):
        assert marker in content, marker
    assert b"A slide with the word Welcome." in re.findall(rb"/Alt\s*\((.*?)\)", content)
    assert b"am" in re.findall(rb"/Lang\s*\((.*?)\)", content)
    assert re.search(rb"/FontName\s*/[A-Z]{6}\+\S*Ethiopic", content), "Ethiopic font is not embedded"


def test_documents_are_in_the_manifest_and_private_until_published(lesson):  # noqa: F811
    client, lesson_id = lesson
    manifest = client.get(f"/api/v1/lessons/{lesson_id}", headers=STAFF).json()
    assert {"html_en", "pdf_en", "html_am", "pdf_am"} <= set(manifest["documents"])  # plus brf_* with liblouis
    assert client.get(f"/api/v1/lessons/{lesson_id}/document.html").status_code == 404
