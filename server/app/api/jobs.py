"""Jobs: staff enter a job; anyone reads it as schema.org/JobPosting JSON-LD.

The JSON-LD is standard JobPosting (Level 3 integration), so job boards and
search engines understand it. Fidel's extra fields (accommodation keys,
summaries in two languages, recorded summaries) use a small "fidel:" extension.
"""

import re
import secrets
import shutil
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Path as PathParam, Request, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

from ..config import settings
from ..pipeline import media
from .auth import require_staff
from .lessons import base_url, db, save_upload

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])
staff = [Depends(require_staff)]
JobId = PathParam(pattern=r"^[a-f0-9]{12}$")

# Workplace accommodations, with English labels (the job card also has Amharic).
ACCOMMODATIONS = {
    "sign_language_interpreter": "Sign language interpreter available",
    "screen_reader_tools": "Screen-reader compatible tools",
    "flexible_hours": "Flexible hours",
    "step_free_access": "Step-free access",
    "remote_work": "Remote work possible",
    "captioned_meetings": "Captioned meetings",
}
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class JobIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    organization: str = Field(min_length=1, max_length=150)
    description: str = Field(min_length=1, max_length=5000)
    location: str | None = Field(default=None, max_length=100, description="Town or city, e.g. Addis Ababa")
    remote: bool = False
    employment_type: Literal["FULL_TIME", "PART_TIME", "CONTRACTOR", "TEMPORARY", "INTERN", "VOLUNTEER"] = "FULL_TIME"
    date_posted: date = Field(default_factory=date.today)
    closing_date: date
    apply_url: HttpUrl | None = None
    apply_email: str | None = Field(default=None, max_length=200)
    how_to_apply: str = Field(min_length=1, max_length=1000, description="Plain words: how to apply")
    accommodations: list[Literal[tuple(ACCOMMODATIONS)]] = Field(default_factory=list)  # type: ignore[valid-type]
    other_accommodations: list[str] = Field(default_factory=list, max_length=10)
    summary_en: str = Field(min_length=1, max_length=600, description="Short summary to read or listen to")
    summary_am: str | None = Field(default=None, max_length=600)

    @field_validator("apply_email")
    @classmethod
    def valid_email(cls, value: str | None) -> str | None:
        if value and not EMAIL.match(value):
            raise ValueError("This does not look like an email address.")
        return value or None

    @model_validator(mode="after")
    def checks(self):
        if not self.location and not self.remote:
            raise ValueError("Give a location, or mark the job as remote.")
        if self.closing_date < self.date_posted:
            raise ValueError("The closing date is before the date posted.")
        return self


def job_folder(job_id: str):
    return settings.data_dir / "jobs" / job_id


def to_jsonld(job_id: str, job: dict, base: str) -> dict:
    """schema.org/JobPosting, plus fidel: extras."""
    files = f"{base}/files/jobs/{job_id}"
    folder = job_folder(job_id)
    labels = [ACCOMMODATIONS[k] for k in job["accommodations"]] + job["other_accommodations"]
    posting = {
        "@context": ["https://schema.org", {"fidel": f"{base}/api/v1/ns#"}],
        "@type": "JobPosting",
        "@id": f"{base}/api/v1/jobs/{job_id}",
        "identifier": {"@type": "PropertyValue", "name": "Fidel", "value": job_id},
        "title": job["title"],
        "description": job["description"],
        "datePosted": job["date_posted"],
        # End of the closing day, Addis Ababa time.
        "validThrough": f"{job['closing_date']}T23:59:59+03:00",
        "employmentType": job["employment_type"],
        "hiringOrganization": {"@type": "Organization", "name": job["organization"]},
        "directApply": False,
        "fidel:howToApply": job["how_to_apply"],
        "fidel:accommodations": job["accommodations"],
        "fidel:otherAccommodations": job["other_accommodations"],
        "fidel:summaryEn": job["summary_en"],
        "fidel:summaryAm": job.get("summary_am"),
        "fidel:summaryAudio": {
            lang: f"{files}/summary-{lang}.opus" for lang in ("en", "am") if (folder / f"summary-{lang}.opus").is_file()
        },
    }
    if labels:
        posting["jobBenefits"] = "Workplace accommodations: " + "; ".join(labels) + "."
    if job.get("location"):
        posting["jobLocation"] = {
            "@type": "Place",
            "address": {"@type": "PostalAddress", "addressLocality": job["location"], "addressCountry": "ET"},
        }
    if job["remote"]:
        posting["jobLocationType"] = "TELECOMMUTE"
        posting["applicantLocationRequirements"] = {"@type": "Country", "name": "Ethiopia"}
    contact = {k: v for k, v in {"email": job.get("apply_email"), "url": job.get("apply_url")}.items() if v}
    if contact:
        posting["applicationContact"] = {"@type": "ContactPoint", **contact}
        if job.get("apply_url"):
            posting["url"] = job["apply_url"]
    return posting


def jsonld_response(data: dict, status_code: int = 200) -> JSONResponse:
    return JSONResponse(data, status_code=status_code, media_type="application/ld+json")


def get_job_or_404(job_id: str) -> dict:
    job = db.get_job(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No job with this id.")
    return job


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=staff,
             responses={201: {"content": {"application/ld+json": {}}}})
def create_job(body: JobIn, request: Request):
    """Add a job. Returns it as schema.org/JobPosting JSON-LD."""
    job_id = secrets.token_hex(6)
    job = body.model_dump(mode="json")
    db.save_job(job_id, job)
    return jsonld_response(to_jsonld(job_id, job, base_url(request)), status.HTTP_201_CREATED)


@router.get("")
def list_jobs(request: Request) -> list[dict]:
    """Open jobs (closing date today or later), newest first."""
    today = date.today().isoformat()
    return [
        {"id": job_id, "title": job["title"], "organization": job["organization"],
         "closing_date": job["closing_date"], "url": f"{base_url(request)}/api/v1/jobs/{job_id}"}
        for job_id, job in db.list_jobs() if job["closing_date"] >= today
    ]


@router.get("/{job_id}", responses={200: {"content": {"application/ld+json": {}}}})
def get_job(request: Request, job_id: str = JobId):
    """The job as schema.org/JobPosting JSON-LD."""
    return jsonld_response(to_jsonld(job_id, get_job_or_404(job_id), base_url(request)))


@router.put("/{job_id}", dependencies=staff, responses={200: {"content": {"application/ld+json": {}}}})
def update_job(body: JobIn, request: Request, job_id: str = JobId):
    get_job_or_404(job_id)
    job = body.model_dump(mode="json")
    db.save_job(job_id, job)
    return jsonld_response(to_jsonld(job_id, job, base_url(request)))


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=staff)
def delete_job(job_id: str = JobId):
    get_job_or_404(job_id)
    db.delete_job(job_id)
    shutil.rmtree(job_folder(job_id), ignore_errors=True)


@router.post("/{job_id}/summary-recording/{lang}", dependencies=staff,
             responses={200: {"content": {"application/ld+json": {}}}})
async def upload_summary_recording(request: Request, lang: Literal["en", "am"], audio: UploadFile = File(),
                                   job_id: str = JobId):
    """A recording of the summary being read aloud (needed for Amharic:
    most phones have no Amharic voice)."""
    job = get_job_or_404(job_id)
    folder = job_folder(job_id)
    folder.mkdir(parents=True, exist_ok=True)
    upload = folder / "upload.tmp"
    try:
        await save_upload(audio, upload)
        if not media.probe(upload)["has_audio"]:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file has no sound in it.")
        media.make_description_audio(upload, folder / f"summary-{lang}.opus")
    except media.MediaError as problem:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This file could not be read as audio.") from problem
    finally:
        upload.unlink(missing_ok=True)
    return jsonld_response(to_jsonld(job_id, job, base_url(request)))


@router.delete("/{job_id}/summary-recording/{lang}", dependencies=staff,
               responses={200: {"content": {"application/ld+json": {}}}})
def delete_summary_recording(request: Request, lang: Literal["en", "am"], job_id: str = JobId):
    job = get_job_or_404(job_id)
    (job_folder(job_id) / f"summary-{lang}.opus").unlink(missing_ok=True)
    return jsonld_response(to_jsonld(job_id, job, base_url(request)))
