"""Certificates: staff issue them; anyone with the link can check them.

Each certificate has a random, unguessable id. /verify/{id} is a public,
accessible page (English and Amharic) an employer can open; the same data is
available as JSON. Only what is needed is stored: the name as the learner
wants it written, the course, the date and the issuer.
"""

import html
import re
import secrets
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Path as PathParam, Request, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from ..ethiopian_calendar import format_both
from .auth import require_staff
from .lessons import base_url, db

router = APIRouter(tags=["certificates"])
staff = [Depends(require_staff)]
CertId = PathParam(pattern=r"^[A-Za-z0-9_-]{16,64}$")
TEMPLATE = Path(__file__).resolve().parent.parent / "templates" / "verify.html"


class CertificateIn(BaseModel):
    learner_name: str = Field(min_length=1, max_length=120, description="Written as the learner chooses")
    course: str = Field(min_length=1, max_length=200)
    issued_on: date = Field(default_factory=date.today)
    issuer: str = Field(default="ALX Digital Bridge", min_length=1, max_length=120)


class Certificate(BaseModel):
    id: str
    learner_name: str
    course: str
    issued_on: str
    issued_on_ethiopian: str
    issuer: str
    status: str = Field(description="valid or revoked")
    verify_url: str


def public(cert: dict, request: Request) -> Certificate:
    return Certificate(
        **{k: cert[k] for k in ("id", "learner_name", "course", "issued_on", "issuer", "status")},
        issued_on_ethiopian=format_both(date.fromisoformat(cert["issued_on"]))["ethiopian"],
        verify_url=f"{base_url(request)}/verify/{cert['id']}",
    )


def get_or_404(cert_id: str) -> dict:
    cert = db.get_certificate(cert_id)
    if cert is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No certificate with this id.")
    return cert


@router.post("/api/v1/certificates", status_code=status.HTTP_201_CREATED, response_model=Certificate,
             dependencies=staff)
def issue(body: CertificateIn, request: Request):
    """Issue a certificate. Share its verify_url with the learner."""
    cert = {
        "id": secrets.token_urlsafe(16),  # 22 random characters: cannot be guessed
        "learner_name": body.learner_name.strip(),
        "course": body.course.strip(),
        "issued_on": body.issued_on.isoformat(),
        "issuer": body.issuer.strip(),
    }
    db.add_certificate(cert)
    return public(db.get_certificate(cert["id"]), request)


@router.get("/api/v1/certificates", response_model=list[Certificate], dependencies=staff)
def list_certificates(request: Request):
    return [public(c, request) for c in db.list_certificates()]


@router.get("/api/v1/certificates/{cert_id}", response_model=Certificate)
def get_certificate(request: Request, cert_id: str = CertId):
    """Public: the certificate as JSON."""
    return public(get_or_404(cert_id), request)


@router.post("/api/v1/certificates/{cert_id}/revoke", response_model=Certificate, dependencies=staff)
def revoke(request: Request, cert_id: str = CertId):
    get_or_404(cert_id)
    db.set_certificate_status(cert_id, "revoked")
    return public(db.get_certificate(cert_id), request)


# --- Public verification page ---------------------------------------------------------


def render(state: str, cert: dict | None = None, request: Request | None = None) -> str:
    e = html.escape
    if cert:
        dates = format_both(date.fromisoformat(cert["issued_on"]))
        details = f"""
    <dl>
      <dt>Name <span lang="am">/ ስም</span></dt><dd>{e(cert["learner_name"])}</dd>
      <dt>Course <span lang="am">/ ኮርስ</span></dt><dd>{e(cert["course"])}</dd>
      <dt>Date <span lang="am">/ ቀን</span></dt>
      <dd>{e(dates["gregorian"])} <span lang="am">/ {e(dates["ethiopian"])}</span></dd>
      <dt>Issued by <span lang="am">/ የሰጠው</span></dt><dd>{e(cert["issuer"])}</dd>
      <dt>Certificate number <span lang="am">/ ቁጥር</span></dt><dd><code>{e(cert["id"])}</code></dd>
    </dl>
    <h2>Share this check <span lang="am">/ ይህን ማረጋገጫ ያጋሩ</span></h2>
    <label for="link">Link to this page <span lang="am">/ የዚህ ገጽ አድራሻ</span></label>
    <input id="link" readonly value="{e(base_url(request))}/verify/{e(cert["id"])}">
    <p><button type="button" id="copy">Copy link <span lang="am">/ አድራሻውን ቅዳ</span></button></p>
    <p id="copied" role="status"></p>
    <p><a href="/api/v1/certificates/{e(cert["id"])}">This certificate as data (JSON)</a></p>"""
    else:
        details = ""
    messages = {
        "valid": ('ok', f'✓ Verified by {e(cert["issuer"]) if cert else ""}',
                  f'✓ በ{e(cert["issuer"]) if cert else ""} የተረጋገጠ'),
        "revoked": ("bad", "✗ This certificate was revoked. It is no longer valid.",
                    "✗ ይህ የምስክር ወረቀት ተሰርዟል። ከአሁን በኋላ የሚሠራ አይደለም።"),
        "missing": ("bad", "✗ No certificate was found for this link. Check the link is complete.",
                    "✗ ለዚህ አድራሻ የምስክር ወረቀት አልተገኘም። አድራሻው ሙሉ መሆኑን ያረጋግጡ።"),
    }
    kind, english, amharic = messages[state]
    values = {"{{STATUS_CLASS}}": kind, "{{STATUS_EN}}": english, "{{STATUS_AM}}": amharic, "{{DETAILS}}": details}
    # One pass: text from one value is never searched for another placeholder.
    return re.sub(r"\{\{[A-Z_]+\}\}", lambda m: values.get(m.group(0), ""), TEMPLATE.read_text(encoding="utf-8"))


@router.get("/verify/{cert_id}", response_class=HTMLResponse, include_in_schema=False)
def verify_page(request: Request, cert_id: str):
    cert = db.get_certificate(cert_id) if re.fullmatch(r"[A-Za-z0-9_-]{16,64}", cert_id) else None
    if cert is None:
        return HTMLResponse(render("missing"), status_code=404)
    return HTMLResponse(render("valid" if cert["status"] == "valid" else "revoked", cert, request))
