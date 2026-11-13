"""SQLite database: lessons, their pipeline steps, and caption tracks.

Plain sqlite3 from the standard library. One small file: data/fidel.db.
No learner data and no disability data is ever stored here.
"""

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS lessons (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    spoken_language TEXT NOT NULL,          -- 'en' or 'am'
    source_file     TEXT NOT NULL,          -- e.g. 'source.mp4' in the lesson folder
    created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS steps (
    lesson_id   TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,              -- see app/pipeline/steps.py
    status      TEXT NOT NULL,              -- pending | running | done | failed | skipped
    message     TEXT,                       -- error or note shown to staff
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (lesson_id, name)
);

CREATE TABLE IF NOT EXISTS captions (
    lesson_id   TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    lang        TEXT NOT NULL,              -- 'en' or 'am'
    status      TEXT NOT NULL,              -- draft (machine-made) | reviewed (checked by a person)
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (lesson_id, lang)
);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Database:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript(SCHEMA)

    @contextmanager
    def connect(self):
        # A new connection per use: simple and safe across threads
        # (pipeline jobs run in background threads).
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        try:
            yield db
            db.commit()
        finally:
            db.close()

    # --- lessons --------------------------------------------------------------

    def add_lesson(self, lesson_id: str, title: str, spoken_language: str, source_file: str) -> None:
        with self.connect() as db:
            db.execute(
                "INSERT INTO lessons (id, title, spoken_language, source_file, created_at) VALUES (?, ?, ?, ?, ?)",
                (lesson_id, title, spoken_language, source_file, now()),
            )

    def get_lesson(self, lesson_id: str) -> dict | None:
        with self.connect() as db:
            row = db.execute("SELECT * FROM lessons WHERE id = ?", (lesson_id,)).fetchone()
        return dict(row) if row else None

    def list_lessons(self) -> list[dict]:
        with self.connect() as db:
            rows = db.execute("SELECT * FROM lessons ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

    # --- pipeline steps --------------------------------------------------------

    def set_step(self, lesson_id: str, name: str, status: str, message: str | None = None) -> None:
        with self.connect() as db:
            db.execute(
                """INSERT INTO steps (lesson_id, name, status, message, updated_at) VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT (lesson_id, name) DO UPDATE SET
                     status = excluded.status, message = excluded.message, updated_at = excluded.updated_at""",
                (lesson_id, name, status, message, now()),
            )

    def get_steps(self, lesson_id: str) -> dict[str, dict]:
        with self.connect() as db:
            rows = db.execute("SELECT name, status, message, updated_at FROM steps WHERE lesson_id = ?", (lesson_id,))
            return {r["name"]: {"status": r["status"], "message": r["message"], "updated_at": r["updated_at"]} for r in rows}

    def fail_interrupted_steps(self) -> None:
        """After a restart, steps that were 'running' will never finish."""
        with self.connect() as db:
            db.execute(
                "UPDATE steps SET status = 'failed', message = 'Interrupted by a server restart. Run it again.', "
                "updated_at = ? WHERE status IN ('running', 'pending')",
                (now(),),
            )

    # --- caption tracks ----------------------------------------------------------

    def set_caption_status(self, lesson_id: str, lang: str, status: str) -> None:
        with self.connect() as db:
            db.execute(
                """INSERT INTO captions (lesson_id, lang, status, updated_at) VALUES (?, ?, ?, ?)
                   ON CONFLICT (lesson_id, lang) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at""",
                (lesson_id, lang, status, now()),
            )

    def get_captions(self, lesson_id: str) -> dict[str, str]:
        with self.connect() as db:
            rows = db.execute("SELECT lang, status FROM captions WHERE lesson_id = ?", (lesson_id,))
            return {r["lang"]: r["status"] for r in rows}
