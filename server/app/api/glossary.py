"""Reviewer glossary: key words and their agreed Amharic.

Machine translation gets some words badly wrong for our audience (in our test,
"disability" became "street people"). Studio marks every caption containing a
glossary word so reviewers check those first, and shows the agreed Amharic.
The Amharic is filled in by a fluent speaker; it is never guessed.
"""

import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..config import settings
from .auth import require_staff

router = APIRouter(prefix="/api/v1/glossary", tags=["editing (staff)"], dependencies=[Depends(require_staff)])
PATH = settings.data_dir / "glossary.json"

# Words to watch, from the translation test (tools/translation-eval).
STARTER = ["disability", "disabled", "deaf", "blind", "sign language", "interpreter", "caption", "subtitle",
           "refugee", "returnee", "displaced", "accessible", "screen reader", "wheelchair", "fail", "pass",
           "deadline", "apply", "internship", "equalizer"]


class Term(BaseModel):
    en: str = Field(min_length=1, max_length=60, description="English word or phrase")
    am: str | None = Field(default=None, max_length=120, description="Agreed Amharic (written by a fluent speaker)")
    note: str | None = Field(default=None, max_length=300)


class Glossary(BaseModel):
    terms: list[Term] = Field(max_length=300)


@router.get("", response_model=Glossary)
def get_glossary():
    if PATH.is_file():
        return Glossary.model_validate_json(PATH.read_text(encoding="utf-8"))
    return Glossary(terms=[Term(en=word) for word in STARTER])


@router.put("", response_model=Glossary)
def save_glossary(body: Glossary):
    terms = sorted({t.en.strip().lower(): t for t in body.terms}.values(), key=lambda t: t.en.lower())
    glossary = Glossary(terms=[Term(en=t.en.strip(), am=(t.am or "").strip() or None, note=(t.note or "").strip() or None)
                               for t in terms])
    PATH.write_text(json.dumps(glossary.model_dump(), ensure_ascii=False, indent=1), encoding="utf-8")
    return glossary
