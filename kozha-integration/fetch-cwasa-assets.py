import hashlib
import sys
import urllib.request
from pathlib import Path


SOURCE = "https://vhg.cmp.uea.ac.uk/tech/jas/vhg2024"
ASSETS = {
    "cwa/h2s.xsl": ("cwa/h2s.xsl", "e96036c343e15a29c1e00f9e95e7ef0b47196eb61583e97b1984b4aa2674cdea"),
    "cwa/shaders/qskin.vert": ("cwa/shaders/qskin.vert", "9b5f055bcef49472c10925daff47d7dfdb00a7b19d1ba4c3aad1ab4b7b13fd7b"),
    "cwa/shaders/qskin.frag": ("cwa/shaders/qskin.frag", "3986a7a7ffb26e5aff8677d216decd45945ff5e84dd2c99eb5042bf0986f48ff"),
    "cwa/avatars/COMMON.jar": ("avatars/COMMON.jar", "80e35056778ff74b1ea81eed42342051e6f11964afc5d8858563a2016f3585cb"),
}


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: fetch-cwasa-assets.py <kozha-public-directory>")

    public_dir = Path(sys.argv[1])
    for relative_path, (source_path, expected_sha256) in ASSETS.items():
        url = f"{SOURCE}/{source_path}"
        with urllib.request.urlopen(url, timeout=30) as response:
            data = response.read()
        actual_sha256 = hashlib.sha256(data).hexdigest()
        if actual_sha256 != expected_sha256:
            raise RuntimeError(f"SHA-256 mismatch for {url}: {actual_sha256}")

        destination = public_dir / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        print(f"Verified and installed {relative_path}")


if __name__ == "__main__":
    main()
