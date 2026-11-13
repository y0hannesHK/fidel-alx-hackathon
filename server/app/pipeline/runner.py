"""Runs pipeline steps for a lesson and records each step's status.

Jobs run in a background thread (FastAPI BackgroundTasks). Only one job runs
at a time: the models need a lot of memory and CPU, and a laptop or small
server cannot run two at once. Other jobs wait with their steps 'pending'.
"""

import logging
import threading

from ..db import Database
from ..providers import ProviderUnavailable
from .steps import STEPS, Skip

log = logging.getLogger("fidel.pipeline")
_one_job_at_a_time = threading.Lock()


def queue_steps(db: Database, lesson_id: str, names: list[str]) -> None:
    """Mark steps as waiting, so staff see them queued straight away."""
    for name in names:
        db.set_step(lesson_id, name, "pending", "Waiting to start.")


def run_steps(db: Database, lesson_id: str, names: list[str]) -> None:
    with _one_job_at_a_time:
        for name in STEPS:  # always in pipeline order
            if name not in names:
                continue
            lesson = db.get_lesson(lesson_id)
            if lesson is None:
                return  # deleted meanwhile
            db.set_step(lesson_id, name, "running", None)
            try:
                note = STEPS[name](db, lesson)
                db.set_step(lesson_id, name, "done", note)
            except Skip as reason:
                db.set_step(lesson_id, name, "skipped", str(reason))
            except ProviderUnavailable as problem:
                db.set_step(lesson_id, name, "failed", str(problem))
            except Exception as error:  # noqa: BLE001 - show any failure to staff, keep going
                log.exception("Step %s failed for lesson %s", name, lesson_id)
                db.set_step(lesson_id, name, "failed", f"{type(error).__name__}: {error}")
