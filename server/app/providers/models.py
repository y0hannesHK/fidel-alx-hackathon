"""Where each AI model lives on disk, and how to download it.

Models are never downloaded automatically while the server runs (no surprise
network traffic). Staff download them once with:

    docker compose run --rm server python -m app.download_models
"""

from pathlib import Path

DOWNLOAD_HINT = "Download it once with: docker compose run --rm server python -m app.download_models"

# Hugging Face repositories (all licences allow commercial use).
WHISPER_REPOS = {  # faster-whisper (CTranslate2) conversions of OpenAI Whisper, MIT
    size: f"Systran/faster-whisper-{size}" for size in ("tiny", "base", "small", "medium")
}
MADLAD_REPO = "Nextcloud-AI/madlad400-3b-mt-ct2-int8"  # MADLAD-400 3B, Apache-2.0


def model_dir(models_dir: Path, repo: str) -> Path:
    # Same folder naming as tools/translation-eval, so a model is never downloaded twice.
    return models_dir / repo.replace("/", "--")


def is_downloaded(path: Path) -> bool:
    return (path / "model.bin").is_file()
