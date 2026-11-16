"""SQLite database: lessons, their pipeline steps, and caption tracks.

Plain sqlite3 from the standard library. One small file: data/fidel.db.
No learner data and no disability data is ever stored here.
"""

import json
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
    created_at      TEXT NOT NULL,
    published       INTEGER NOT NULL DEFAULT 0  -- 1 = learners can see it
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
    cue_reviews TEXT,                       -- JSON list: true/false per cue, in order
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (lesson_id, lang)
);

CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT PRIMARY KEY,
    data        TEXT NOT NULL,              -- JSON: the job as entered by staff
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS certificates (
    id            TEXT PRIMARY KEY,         -- random and unguessable
    learner_name  TEXT NOT NULL,            -- written as the learner chooses
    course        TEXT NOT NULL,
    issued_on     TEXT NOT NULL,            -- YYYY-MM-DD
    issuer        TEXT NOT NULL,
    status        TEXT NOT NULL,            -- valid | revoked
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhooks (
    id          TEXT PRIMARY KEY,
    url         TEXT NOT NULL,              -- the host's address to call
    events      TEXT NOT NULL,              -- JSON list of event names
    secret      TEXT NOT NULL,              -- signs each delivery (HMAC-SHA256)
    created_at  TEXT NOT NULL
);

-- Package D: learners report a caption problem (api/caption_reports.py). No name, no account, no IP.
CREATE TABLE IF NOT EXISTS caption_reports (
    id          TEXT PRIMARY KEY,
    lesson_id   TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    time        REAL NOT NULL,              -- seconds into the video
    lang        TEXT NOT NULL,              -- caption language shown
    kind        TEXT NOT NULL,              -- wrong_words | wrong_time | missing_caption | missing_sound | other
    correction  TEXT,                       -- the learner's suggested text (optional)
    caption     TEXT,                       -- the caption shown at that moment (optional)
    status      TEXT NOT NULL,              -- open | resolved | dismissed
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Package E: learners ask about a moment in a lesson (api/questions.py). No name, no account, no IP.
CREATE TABLE IF NOT EXISTS questions (
    id          TEXT PRIMARY KEY,
    lesson_id   TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    time        REAL NOT NULL,              -- seconds into the video
    kind        TEXT NOT NULL,              -- text | voice | sign
    text        TEXT,                       -- the written question (kind = text)
    caption     TEXT,                       -- the caption shown at that moment (optional)
    media_file  TEXT,                       -- file name in data/questions/<lesson id>/ (voice | sign)
    media_type  TEXT,                       -- its MIME type
    status      TEXT NOT NULL,              -- open | answered | dismissed
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- LTI 1.3: learning platforms (Moodle, Canvas) allowed to open Fidel lessons (api/lti.py).
-- Details about the platform only; nothing about learners.
CREATE TABLE IF NOT EXISTS lti_platforms (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,          -- for staff, e.g. "ALX Moodle"
    issuer          TEXT NOT NULL,          -- the platform's id (Moodle: "Platform ID"), a URL
    client_id       TEXT NOT NULL,          -- the id the platform gave Fidel
    deployment_ids  TEXT NOT NULL,          -- JSON list: the platform's deployments of Fidel
    auth_login_url  TEXT NOT NULL,          -- where Fidel sends the learner to sign in (Moodle: auth.php)
    auth_token_url  TEXT NOT NULL,          -- where Fidel asks for a gradebook token (Moodle: token.php)
    key_set_url     TEXT NOT NULL,          -- the platform's public keys (Moodle: certs.php)
    created_at      TEXT NOT NULL,
    UNIQUE (issuer, client_id)
);

-- LTI 1.3 sign-ins in progress (api/lti.py): kept on the server, not in a cookie,
-- because browsers often block cookies inside a course page's frame.
-- A state is used once; rows are deleted an hour after they were made.
CREATE TABLE IF NOT EXISTS lti_nonces (
    state           TEXT PRIMARY KEY,       -- random; comes back with the launch
    nonce           TEXT NOT NULL UNIQUE,   -- random; must be inside the platform's signed message
    platform_id     TEXT NOT NULL REFERENCES lti_platforms(id) ON DELETE CASCADE,
    storage_target  TEXT,                   -- the platform's storage frame (lti_storage_target), if offered
    created_at      INTEGER NOT NULL,       -- seconds since 1970
    expires_at      INTEGER NOT NULL,       -- the launch must come before this
    used            INTEGER NOT NULL DEFAULT 0
);
"""

# Columns added after the first version. Older databases get them on start.
MIGRATIONS = [
    ("lessons", "published", "INTEGER NOT NULL DEFAULT 0"),
    ("captions", "cue_reviews", "TEXT"),
]


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Database:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript(SCHEMA)
            for table, column, kind in MIGRATIONS:
                columns = {row["name"] for row in db.execute(f"PRAGMA table_info({table})")}
                if column not in columns:
                    db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {kind}")

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

    def list_lessons(self, include_unpublished: bool = False) -> list[dict]:
        query = "SELECT * FROM lessons" + ("" if include_unpublished else " WHERE published = 1")
        with self.connect() as db:
            rows = db.execute(query + " ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

    def delete_lesson(self, lesson_id: str) -> None:
        with self.connect() as db:
            db.execute("DELETE FROM lessons WHERE id = ?", (lesson_id,))  # steps and captions follow (CASCADE)

    def set_published(self, lesson_id: str, published: bool) -> None:
        with self.connect() as db:
            db.execute("UPDATE lessons SET published = ? WHERE id = ?", (int(published), lesson_id))

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

    def set_caption_status(self, lesson_id: str, lang: str, status: str, cue_reviews: list[bool] | None = None) -> None:
        """cue_reviews: one true/false per cue. None = all cues unreviewed (new machine draft)."""
        with self.connect() as db:
            db.execute(
                """INSERT INTO captions (lesson_id, lang, status, cue_reviews, updated_at) VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT (lesson_id, lang) DO UPDATE SET
                     status = excluded.status, cue_reviews = excluded.cue_reviews, updated_at = excluded.updated_at""",
                (lesson_id, lang, status, json.dumps(cue_reviews) if cue_reviews is not None else None, now()),
            )

    def get_cue_reviews(self, lesson_id: str, lang: str) -> list[bool]:
        with self.connect() as db:
            row = db.execute("SELECT cue_reviews FROM captions WHERE lesson_id = ? AND lang = ?", (lesson_id, lang)).fetchone()
        return json.loads(row["cue_reviews"]) if row and row["cue_reviews"] else []

    def get_captions(self, lesson_id: str) -> dict[str, str]:
        with self.connect() as db:
            rows = db.execute("SELECT lang, status FROM captions WHERE lesson_id = ?", (lesson_id,))
            return {r["lang"]: r["status"] for r in rows}

    # --- jobs ----------------------------------------------------------------------

    def save_job(self, job_id: str, data: dict) -> None:
        with self.connect() as db:
            db.execute(
                """INSERT INTO jobs (id, data, created_at) VALUES (?, ?, ?)
                   ON CONFLICT (id) DO UPDATE SET data = excluded.data""",
                (job_id, json.dumps(data, ensure_ascii=False), now()),
            )

    def get_job(self, job_id: str) -> dict | None:
        with self.connect() as db:
            row = db.execute("SELECT data FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return json.loads(row["data"]) if row else None

    def list_jobs(self) -> list[tuple[str, dict]]:
        with self.connect() as db:
            rows = db.execute("SELECT id, data FROM jobs ORDER BY created_at DESC").fetchall()
        return [(r["id"], json.loads(r["data"])) for r in rows]

    def delete_job(self, job_id: str) -> None:
        with self.connect() as db:
            db.execute("DELETE FROM jobs WHERE id = ?", (job_id,))

    # --- certificates ----------------------------------------------------------------

    def add_certificate(self, cert: dict) -> None:
        with self.connect() as db:
            db.execute(
                "INSERT INTO certificates (id, learner_name, course, issued_on, issuer, status, created_at) "
                "VALUES (:id, :learner_name, :course, :issued_on, :issuer, 'valid', :created_at)",
                {**cert, "created_at": now()},
            )

    def get_certificate(self, cert_id: str) -> dict | None:
        with self.connect() as db:
            row = db.execute("SELECT * FROM certificates WHERE id = ?", (cert_id,)).fetchone()
        return dict(row) if row else None

    def list_certificates(self) -> list[dict]:
        with self.connect() as db:
            return [dict(r) for r in db.execute("SELECT * FROM certificates ORDER BY created_at DESC")]

    def set_certificate_status(self, cert_id: str, status: str) -> None:
        with self.connect() as db:
            db.execute("UPDATE certificates SET status = ? WHERE id = ?", (status, cert_id))

    # --- webhooks --------------------------------------------------------------------

    def add_webhook(self, hook: dict) -> None:
        with self.connect() as db:
            db.execute("INSERT INTO webhooks (id, url, events, secret, created_at) VALUES (?, ?, ?, ?, ?)",
                       (hook["id"], hook["url"], json.dumps(hook["events"]), hook["secret"], now()))

    def list_webhooks(self) -> list[dict]:
        with self.connect() as db:
            rows = db.execute("SELECT * FROM webhooks ORDER BY created_at").fetchall()
        return [{**dict(r), "events": json.loads(r["events"])} for r in rows]

    def delete_webhook(self, hook_id: str) -> bool:
        with self.connect() as db:
            return db.execute("DELETE FROM webhooks WHERE id = ?", (hook_id,)).rowcount > 0

    # --- LTI platforms -----------------------------------------------------------------

    @staticmethod
    def _platform(row) -> dict:
        return {**dict(row), "deployment_ids": json.loads(row["deployment_ids"])}

    def add_lti_platform(self, platform: dict) -> bool:
        """False if this issuer and client id are registered already."""
        with self.connect() as db:
            try:
                db.execute(
                    "INSERT INTO lti_platforms (id, name, issuer, client_id, deployment_ids, auth_login_url, "
                    "auth_token_url, key_set_url, created_at) VALUES (:id, :name, :issuer, :client_id, "
                    ":deployment_ids, :auth_login_url, :auth_token_url, :key_set_url, :created_at)",
                    {**platform, "deployment_ids": json.dumps(platform["deployment_ids"]), "created_at": now()},
                )
            except sqlite3.IntegrityError:
                return False
        return True

    def list_lti_platforms(self) -> list[dict]:
        with self.connect() as db:
            return [self._platform(r) for r in db.execute("SELECT * FROM lti_platforms ORDER BY created_at")]

    def find_lti_platform(self, issuer: str, client_id: str | None = None) -> list[dict]:
        """Platforms with this issuer (and client id, if given). Used by the launch checks."""
        query, args = "SELECT * FROM lti_platforms WHERE issuer = ?", [issuer]
        if client_id is not None:
            query, args = query + " AND client_id = ?", args + [client_id]
        with self.connect() as db:
            return [self._platform(r) for r in db.execute(query, args)]

    def get_lti_platform(self, platform_id: str) -> dict | None:
        with self.connect() as db:
            row = db.execute("SELECT * FROM lti_platforms WHERE id = ?", (platform_id,)).fetchone()
        return self._platform(row) if row else None

    def add_lti_login(self, login: dict) -> None:
        """A sign-in starts: remember its state and nonce (and forget ones older than an hour)."""
        with self.connect() as db:
            db.execute("DELETE FROM lti_nonces WHERE created_at < ?", (login["created_at"] - 3600,))
            db.execute(
                "INSERT INTO lti_nonces (state, nonce, platform_id, storage_target, created_at, expires_at) "
                "VALUES (:state, :nonce, :platform_id, :storage_target, :created_at, :expires_at)", login)

    def get_lti_login(self, state: str) -> dict | None:
        with self.connect() as db:
            row = db.execute("SELECT * FROM lti_nonces WHERE state = ?", (state,)).fetchone()
        return dict(row) if row else None

    def claim_lti_login(self, state: str, at: int) -> bool:
        """Mark a sign-in used. False if it was used already or has expired:
        two requests with the same state can never both get through."""
        with self.connect() as db:
            return db.execute("UPDATE lti_nonces SET used = 1 WHERE state = ? AND used = 0 AND expires_at > ?",
                              (state, at)).rowcount == 1

    def delete_lti_platform(self, platform_id: str) -> bool:
        with self.connect() as db:
            return db.execute("DELETE FROM lti_platforms WHERE id = ?", (platform_id,)).rowcount > 0
