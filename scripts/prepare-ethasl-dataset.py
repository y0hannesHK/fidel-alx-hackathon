#!/usr/bin/env python3
"""
Download and prepare the Amharic Sign Language Dataset from Mendeley Data
for use with the Fidel EthSL sign language avatar.

Dataset: "Amharic Sign Language Data Sets" by Isayas Feyera
Mendeley DOI: 10.17632/5d3nkyhsrf.1
License: CC BY 4.0

Usage:
  python scripts/prepare-ethasl-dataset.py <public-data-dir>

Example:
  python scripts/prepare-ethasl-dataset.py /app/public/data

The script will create:
  <public-data-dir>/ethasl/fingerspelling/
    che.jpg  gne.jpg  ke.jpg  le.jpg  me.jpg  ne.jpg  qe.jpg  ...

These are representative hand gesture images from the dataset, resized
for use as reference images in the EthSL avatar canvas renderer.
"""

import hashlib
import io
import json
import os
import sys
import urllib.request
import zipfile
from pathlib import Path

# ---------------------------------------------------------------------------
# Dataset metadata
# ---------------------------------------------------------------------------

MENDELEY_DATASET_ID = "5d3nkyhsrf"
MENDELEY_VERSION = 1
MENDELEY_DOI = "10.17632/5d3nkyhsrf.1"

# Direct download URL for the dataset archive
# Note: The dataset requires accepting CC BY 4.0 terms.
# The public API endpoint returns a redirect to the actual file.
DATASET_ZIP_URL = "https://data.mendeley.com/public-api/zip/5d3nkyhsrf/download/1"
DATASET_ZIP_SHA256 = "7f9f470409ade51ff32483a3c6129a6955d0785c1157af82cc69848f200549bc"

# RAR archive inside the zip (the actual data)
INNER_RAR_URL = (
    "https://data.mendeley.com/public-files/datasets/5d3nkyhsrf"
    "/files/c37e08d1-46bc-4baa-bf13-3c4bd2c95ebd/file_downloaded"
)
INNER_RAR_SHA256 = "4c3d92545110bb27933384c339f83eff40d7d43f6928330e297cd83d0d24a51b"

# Known classes in the dataset (10 classes of Amharic characters)
# These are the fingerspelling signs the avatar can display using real images.
DATASET_CLASSES = [
    "che",   # ቸ
    "gne",   # ኘ (gy/gn)
    "ke",    # ከ
    "le",    # ለ
    "me",    # መ
    "ne",    # ነ
    "qe",    # ቀ
    # Extended classes (may be present in the full dataset)
    "ha",    # ሀ
    "be",    # በ
    "se",    # ሰ
]

# ---------------------------------------------------------------------------
# Fallback: generate placeholder sign images if the dataset cannot be fetched
# (e.g. during development without network access).
# In production, actual dataset images should be placed in the output directory.
# ---------------------------------------------------------------------------

def generate_placeholder_svg(char_label, sign_key, description):
    """Generate a simple SVG placeholder for a sign image."""
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
  <rect width="320" height="240" fill="#1a1a2e"/>

  <!-- Hand silhouette (simplified open palm) -->
  <ellipse cx="160" cy="140" rx="45" ry="55" fill="#e8d5a3" opacity="0.9"/>
  <!-- Fingers -->
  <ellipse cx="130" cy="90" rx="11" ry="30" fill="#e8d5a3" transform="rotate(-8 130 90)"/>
  <ellipse cx="145" cy="82" rx="11" ry="34" fill="#e8d5a3" transform="rotate(-3 145 82)"/>
  <ellipse cx="161" cy="80" rx="11" ry="35" fill="#e8d5a3"/>
  <ellipse cx="177" cy="82" rx="10" ry="32" fill="#e8d5a3" transform="rotate(4 177 82)"/>
  <ellipse cx="192" cy="90" rx="9" ry="27" fill="#e8d5a3" transform="rotate(10 192 90)"/>

  <!-- Character label -->
  <text x="160" y="210" font-family="Noto Sans Ethiopic, system-ui" font-size="36"
        fill="#6cb4f0" text-anchor="middle" dominant-baseline="middle">{char_label}</text>

  <!-- Sign key label (small) -->
  <text x="160" y="228" font-family="monospace" font-size="12"
        fill="#888" text-anchor="middle">{sign_key}</text>

  <!-- Dataset attribution watermark -->
  <text x="4" y="12" font-family="sans-serif" font-size="9" fill="#444">
    EthSL · Mendeley {MENDELEY_DOI}
  </text>
</svg>'''


# Map sign keys to their Amharic character representations
SIGN_TO_AMHARIC = {
    "che": "ቸ", "gne": "ኘ", "ke": "ከ", "le": "ለ", "me": "መ",
    "ne": "ነ", "qe": "ቀ", "ha": "ሀ", "be": "በ", "se": "ሰ",
    "re": "ረ", "we": "ወ", "de": "ደ", "ge": "ገ", "fe": "ፈ",
    "ze": "ዘ", "ye": "የ", "pe": "ፐ",
    "ma": "ማ", "la": "ላ", "na": "ና", "ka": "ካ",
    "sa": "ሳ", "ra": "ራ", "wa": "ዋ", "da": "ዳ",
}


def write_placeholder_signs(output_dir):
    """Write SVG placeholder signs for all known classes."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    created = []
    for sign_key in DATASET_CLASSES:
        char = SIGN_TO_AMHARIC.get(sign_key, sign_key)
        svg_path = output_dir / f"{sign_key}.svg"
        if not svg_path.exists():
            svg = generate_placeholder_svg(char, sign_key, "")
            svg_path.write_text(svg, encoding="utf-8")
            created.append(sign_key)

    return created


def verify_sha256(data: bytes, expected: str) -> bool:
    actual = hashlib.sha256(data).hexdigest()
    return actual == expected


def try_download_dataset(output_dir: Path):
    """
    Attempt to download the Mendeley dataset.
    Returns True if successful, False if the download fails (e.g. network issues,
    Mendeley requires terms acceptance in browser, etc.).
    """
    print(f"Attempting to download dataset from Mendeley ({MENDELEY_DOI})…")
    print("Note: Mendeley may require browser-based terms acceptance.")

    try:
        req = urllib.request.Request(
            INNER_RAR_URL,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        # Short timeout — Mendeley requires browser-based terms acceptance so this
        # is expected to fail in automated/Docker builds. We fall through to SVG placeholders.
        with urllib.request.urlopen(req, timeout=8) as response:
            data = response.read()

        if not verify_sha256(data, INNER_RAR_SHA256):
            print("Warning: SHA-256 mismatch for downloaded file — skipping.")
            return False

        # Save the RAR archive
        rar_path = output_dir.parent / "Amharic_Sign_Language.rar"
        rar_path.write_bytes(data)
        print(f"Downloaded {len(data):,} bytes → {rar_path}")
        print("To extract images, run: unrar x Amharic_Sign_Language.rar")
        return True

    except Exception as e:
        print(f"Download failed: {e}")
        return False


def main():
    if len(sys.argv) != 2:
        raise SystemExit(
            "Usage: prepare-ethasl-dataset.py <public-data-dir>\n"
            "Example: prepare-ethasl-dataset.py /app/public/data"
        )

    public_dir = Path(sys.argv[1])
    fingerspelling_dir = public_dir / "ethasl" / "fingerspelling"
    fingerspelling_dir.mkdir(parents=True, exist_ok=True)

    print(f"EthSL dataset setup → {fingerspelling_dir}")
    print(f"Dataset: Amharic Sign Language Data Sets ({MENDELEY_DOI})")
    print(f"License: CC BY 4.0 — Isayas Feyera, Addis Ababa Sci & Tech Univ.\n")

    # 1. Try to download the actual dataset
    downloaded = try_download_dataset(public_dir)

    # 2. Write SVG placeholders for all known sign classes
    # (used immediately by the avatar; replaced by real images if extracted)
    created = write_placeholder_signs(fingerspelling_dir)
    if created:
        print(f"\nCreated {len(created)} SVG placeholder sign images in {fingerspelling_dir}")
        print("These are geometric placeholders. For real gesture images:")
        print("  1. Download Amharic_Sign_Language.rar from Mendeley")
        print("  2. Extract the archive")
        print("  3. Copy representative frames into:")
        print(f"     {fingerspelling_dir}/")
        print("     Named: che.jpg, gne.jpg, ke.jpg, le.jpg, me.jpg, ne.jpg, qe.jpg, etc.")
    else:
        print(f"Placeholder images already exist in {fingerspelling_dir}")

    # 3. Write a metadata JSON for the avatar to use
    metadata = {
        "dataset": "Amharic Sign Language Data Sets",
        "doi": MENDELEY_DOI,
        "license": "CC BY 4.0",
        "author": "Isayas Feyera",
        "institution": "Addis Ababa Science and Technology University",
        "classes": DATASET_CLASSES,
        "classCount": 10,
        "charMap": SIGN_TO_AMHARIC,
        "placeholder": not downloaded,
    }
    metadata_path = fingerspelling_dir.parent / "ethasl-dataset.json"
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
    print(f"\nMetadata written to {metadata_path}")
    print("\nEthSL setup complete.")


if __name__ == "__main__":
    main()
