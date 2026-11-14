"""Settings, read once from environment variables.

Every setting has a safe default, so `docker compose up` works with no
configuration. See .env.example for the full list.
"""

import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def _path(name: str, default: Path) -> Path:
    return Path(os.environ.get(name, default))


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    embed_dir: Path
    demo_dir: Path
    studio_dir: Path
    models_dir: Path

    # Write endpoints need this token (Authorization: Bearer <token>).
    # Empty = write endpoints are switched off.
    staff_token: str

    max_upload_mb: int
    # Public address of this server, used to build absolute file URLs in the
    # lesson manifest. Empty = use the address the request came in on.
    public_url: str
    # Websites allowed to embed the player and fetch lessons ("*" = any).
    allowed_origins: list[str]

    # AI engines (see app/providers/). "none" switches a step off.
    stt_provider: str  # local_whisper | none
    whisper_model: str  # tiny | base | small | medium
    translator: str  # local_madlad | none
    translate_to: list[str]  # caption languages to machine-translate into, e.g. ['am', 'om']


def load_settings() -> Settings:
    data_dir = _path("FIDEL_DATA_DIR", REPO_ROOT / "data")
    return Settings(
        data_dir=data_dir,
        embed_dir=_path("FIDEL_EMBED_DIR", REPO_ROOT / "player" / "dist"),
        demo_dir=_path("FIDEL_DEMO_DIR", REPO_ROOT / "demo"),
        studio_dir=_path("FIDEL_STUDIO_DIR", REPO_ROOT / "studio"),
        models_dir=_path("FIDEL_MODELS_DIR", data_dir / "models"),
        staff_token=os.environ.get("FIDEL_STAFF_TOKEN", "").strip(),
        max_upload_mb=int(os.environ.get("FIDEL_MAX_UPLOAD_MB", "1024")),
        public_url=os.environ.get("FIDEL_PUBLIC_URL", "").rstrip("/"),
        allowed_origins=[o.strip() for o in os.environ.get("FIDEL_ALLOWED_ORIGINS", "*").split(",") if o.strip()],
        stt_provider=os.environ.get("FIDEL_STT_PROVIDER", "local_whisper"),
        whisper_model=os.environ.get("FIDEL_WHISPER_MODEL", "small"),
        translator=os.environ.get("FIDEL_TRANSLATOR", "local_madlad"),
        translate_to=[c.strip() for c in os.environ.get("FIDEL_TRANSLATE_TO", "am,om").split(",") if c.strip()],
    )


settings = load_settings()
