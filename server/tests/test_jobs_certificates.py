"""Career gateway: jobs (schema.org/JobPosting) and certificates."""

import re

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import STAFF

JOB = {
    "title": "Junior Web Developer",
    "organization": "Example Tech PLC",
    "description": "Build accessible web pages with our team.",
    "location": "Addis Ababa",
    "remote": True,
    "employment_type": "FULL_TIME",
    "date_posted": "2026-11-14",
    "closing_date": "2026-11-30",
    "apply_email": "jobs@example.com",
    "how_to_apply": "Send your CV by email.",
    "accommodations": ["sign_language_interpreter", "screen_reader_tools"],
    "other_accommodations": ["Quiet room"],
    "summary_en": "A full-time web developer job in Addis Ababa or remote.",
    "summary_am": "በአዲስ አበባ ወይም ከርቀት የሙሉ ጊዜ የድር ገንቢ ሥራ።",
}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_job_is_valid_schema_org_jobposting(client):
    created = client.post("/api/v1/jobs", headers=STAFF, json=JOB)
    assert created.status_code == 201, created.text
    assert created.headers["content-type"].startswith("application/ld+json")
    job_id = created.json()["identifier"]["value"]

    posting = client.get(f"/api/v1/jobs/{job_id}").json()
    assert posting["@type"] == "JobPosting"
    assert "https://schema.org" in posting["@context"]
    # Properties Google requires or recommends for JobPosting:
    for required in ("title", "description", "datePosted", "hiringOrganization", "validThrough", "employmentType"):
        assert posting[required], required
    assert posting["hiringOrganization"]["@type"] == "Organization"
    assert posting["jobLocation"]["address"]["addressCountry"] == "ET"
    assert posting["jobLocationType"] == "TELECOMMUTE"
    assert posting["applicantLocationRequirements"]["name"] == "Ethiopia"
    assert posting["validThrough"] == "2026-11-30T23:59:59+03:00"
    assert re.match(r"\d{4}-\d{2}-\d{2}$", posting["datePosted"])
    assert "Sign language interpreter available" in posting["jobBenefits"]
    assert posting["applicationContact"]["email"] == "jobs@example.com"
    assert posting["fidel:summaryAm"] == JOB["summary_am"]


def test_job_validation(client):
    bad = {**JOB, "location": None, "remote": False}
    assert client.post("/api/v1/jobs", headers=STAFF, json=bad).status_code == 400
    assert client.post("/api/v1/jobs", headers=STAFF, json={**JOB, "closing_date": "2026-01-01"}).status_code == 400
    assert client.post("/api/v1/jobs", headers=STAFF, json={**JOB, "apply_email": "not-an-email"}).status_code == 400
    assert client.post("/api/v1/jobs", json=JOB).status_code == 401


def test_job_summary_recording(client, tiny_video):
    job_id = client.post("/api/v1/jobs", headers=STAFF, json=JOB).json()["identifier"]["value"]
    with open(tiny_video, "rb") as f:
        response = client.post(f"/api/v1/jobs/{job_id}/summary-recording/am", headers=STAFF,
                               files={"audio": ("summary.m4a", f, "audio/mp4")})
    assert response.status_code == 200, response.text
    audio_url = response.json()["fidel:summaryAudio"]["am"]
    assert client.get(audio_url.split("testserver", 1)[1]).status_code == 200


def test_certificate_issue_verify_and_revoke(client):
    created = client.post("/api/v1/certificates", headers=STAFF, json={
        "learner_name": "Selam <Tesfaye>", "course": "Software Engineering", "issued_on": "2026-11-15",
    })
    assert created.status_code == 201, created.text
    cert = created.json()
    assert len(cert["id"]) >= 20  # long and random
    assert cert["issued_on_ethiopian"] == "ህዳር 6 2019"

    page = client.get(f"/verify/{cert['id']}")
    assert page.status_code == 200
    assert "Verified by ALX Digital Bridge" in page.text
    assert "Selam &lt;Tesfaye&gt;" in page.text  # names are escaped
    assert "ህዳር 6 2019" in page.text
    assert 'name="robots" content="noindex"' in page.text

    assert client.get(f"/api/v1/certificates/{cert['id']}").json()["status"] == "valid"
    client.post(f"/api/v1/certificates/{cert['id']}/revoke", headers=STAFF)
    page = client.get(f"/verify/{cert['id']}")
    assert "was revoked" in page.text and "Verified by" not in page.text


def test_unknown_certificate(client):
    page = client.get("/verify/doesNotExist12345678")
    assert page.status_code == 404
    assert "No certificate was found" in page.text
    assert client.get("/api/v1/certificates").status_code == 401  # list is staff only
