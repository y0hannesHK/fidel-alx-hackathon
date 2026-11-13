"""Download the AI models the pipeline needs (run once, needs internet).

    docker compose run --rm server python -m app.download_models
    docker compose run --rm server python -m app.download_models --only whisper

Models go to data/models/ (FIDEL_MODELS_DIR). After this, Fidel runs with no
internet connection at all.
"""

import argparse

from huggingface_hub import snapshot_download

from .config import settings
from .providers.models import MADLAD_REPO, WHISPER_REPOS, is_downloaded, model_dir


def wanted_models(only: str | None) -> list[tuple[str, str]]:
    models = []
    if only in (None, "whisper") and settings.stt_provider == "local_whisper":
        models.append((f"Whisper {settings.whisper_model} (speech-to-text, ~0.5 GB for 'small')", WHISPER_REPOS[settings.whisper_model]))
    if only in (None, "madlad") and settings.translator == "local_madlad":
        models.append(("MADLAD-400 3B int8 (English to Amharic, ~3 GB)", MADLAD_REPO))
    return models


def main() -> None:
    parser = argparse.ArgumentParser(description="Download Fidel's AI models.")
    parser.add_argument("--only", choices=["whisper", "madlad"], help="download just one model")
    args = parser.parse_args()

    models = wanted_models(args.only)
    if not models:
        print("No models needed with the current settings.")
    for label, repo in models:
        target = model_dir(settings.models_dir, repo)
        if is_downloaded(target):
            print(f"Already downloaded: {label}")
            continue
        print(f"Downloading {label} from {repo} ...")
        snapshot_download(repo, local_dir=target)
        print(f"Saved to {target}")


if __name__ == "__main__":
    main()
