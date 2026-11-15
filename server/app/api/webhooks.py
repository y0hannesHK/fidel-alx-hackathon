"""Webhooks: the host's server is told when something happens, with no person
involved (the Team Technical Guide's Level 2 example).

A host registers an address and the events it wants. Fidel then POSTs a small
JSON message to it:

    {"event": "lesson.ready", "data": {"lesson_id": "..."}, "sent_at": "..."}

with the header  X-Fidel-Signature: sha256=<HMAC-SHA256 of the body with the
webhook's secret>,  so the host can check the message really came from Fidel.
Messages carry ids and links only, never personal data. Delivery is tried once
(5-second timeout); failures are logged.
"""

import hashlib
import hmac
import json
import logging
import secrets
import threading
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path as PathParam, status
from pydantic import BaseModel, Field, HttpUrl

from ..config import settings
from ..db import Database
from .auth import require_staff

log = logging.getLogger("fidel.webhooks")
router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"], dependencies=[Depends(require_staff)])
db = Database(settings.data_dir / "fidel.db")

Event = Literal["lesson.ready", "lesson.published", "lesson.unpublished", "captions.reviewed", "caption.reported",
                "certificate.issued", "certificate.revoked"]


class WebhookIn(BaseModel):
    url: HttpUrl = Field(description="Where Fidel sends the messages (your server)")
    events: list[Event] = Field(min_length=1, description="Which events to send")


class Webhook(BaseModel):
    id: str
    url: str
    events: list[str]
    secret: str | None = Field(default=None, description="Shown only once, when created. Use it to check signatures.")


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Webhook)
def register(body: WebhookIn):
    """Register an address. Keep the returned secret: it is not shown again."""
    hook = {"id": secrets.token_hex(6), "url": str(body.url), "events": list(dict.fromkeys(body.events)),
            "secret": secrets.token_urlsafe(24)}
    db.add_webhook(hook)
    return Webhook(**hook)


@router.get("", response_model=list[Webhook])
def list_webhooks():
    return [Webhook(id=h["id"], url=h["url"], events=h["events"]) for h in db.list_webhooks()]


@router.delete("/{hook_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(hook_id: str = PathParam(pattern=r"^[a-f0-9]{12}$")):
    if not db.delete_webhook(hook_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No webhook with this id.")


def sign(secret: str, body: bytes) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _send(url: str, body: bytes, headers: dict) -> None:
    try:
        httpx.post(url, content=body, headers=headers, timeout=5)
    except httpx.HTTPError as problem:
        log.warning("Webhook to %s failed: %s", url, problem)


def notify(event: str, data: dict) -> None:
    """Send an event to every webhook that asked for it (in the background)."""
    for hook in db.list_webhooks():
        if event not in hook["events"]:
            continue
        body = json.dumps({"event": event, "data": data,
                           "sent_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}).encode()
        headers = {"Content-Type": "application/json", "X-Fidel-Event": event,
                   "X-Fidel-Signature": sign(hook["secret"], body)}
        threading.Thread(target=_send, args=(hook["url"], body, headers), daemon=True).start()
