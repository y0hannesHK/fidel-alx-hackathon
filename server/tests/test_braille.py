"""Braille (.brf) export. Needs liblouis in the image; skipped where it is missing."""

import pytest

from app import braille
from tests.conftest import STAFF
from tests.test_editing_api import lesson  # noqa: F401  (fixture)


def test_wrap_and_paginate():
    lines = braille.wrap("A" * 10 + " " + "B" * 35 + " " + "C" * 50)
    assert all(len(line) <= 40 for line in lines)
    brf = braille.paginate([f"line {i}" for i in range(30)])
    pages = brf.split("\f")
    assert len(pages) == 2 and pages[0].count("\r\n") == 25


@pytest.mark.skipif("en" not in braille.available_languages(), reason="liblouis not installed")
def test_lesson_brf(lesson):  # noqa: F811
    client, lesson_id = lesson
    response = client.get(f"/api/v1/lessons/{lesson_id}/braille.brf?lang=en", headers=STAFF)
    assert response.status_code == 200, response.text
    text = response.content.decode("ascii")
    assert all(len(line) <= 40 for line in text.replace("\f", "").split("\r\n"))
    assert text.strip()
    manifest = client.get(f"/api/v1/lessons/{lesson_id}", headers=STAFF).json()
    assert "brf_en" in manifest["documents"]
