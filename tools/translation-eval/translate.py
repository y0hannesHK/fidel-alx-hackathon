"""Translate test sentences English -> Amharic with MADLAD-400 3B (CTranslate2 int8).

Writes results/translations.md (to read) and results/translations.tsv (to rate
in a spreadsheet: fill in the 'rating' and 'corrected' columns).

The model (about 3 GB) is downloaded once into /models and reused.
"""

import time
from pathlib import Path

import ctranslate2
import sentencepiece as spm
from huggingface_hub import snapshot_download

MODEL_REPO = "Nextcloud-AI/madlad400-3b-mt-ct2-int8"  # Apache-2.0
MODEL_DIR = Path("/models") / MODEL_REPO.replace("/", "--")
RESULTS_DIR = Path("/results")
TARGET = "am"  # MADLAD picks the output language from a "<2xx>" prefix


def load_sentences() -> list[str]:
    lines = Path("sentences.txt").read_text(encoding="utf-8").splitlines()
    return [line.strip() for line in lines if line.strip() and not line.startswith("#")]


def main() -> None:
    print(f"Getting model {MODEL_REPO} (first run downloads ~3 GB)...")
    snapshot_download(MODEL_REPO, local_dir=MODEL_DIR)

    t0 = time.perf_counter()
    translator = ctranslate2.Translator(str(MODEL_DIR), device="cpu", compute_type="int8")
    tokenizer = spm.SentencePieceProcessor(model_file=str(MODEL_DIR / "spiece.model"))
    print(f"Model loaded in {time.perf_counter() - t0:.1f} s")

    sentences = load_sentences()
    rows = []
    t_all = time.perf_counter()
    for i, english in enumerate(sentences, 1):
        tokens = tokenizer.encode(f"<2{TARGET}> {english}", out_type=str) + ["</s>"]
        t = time.perf_counter()
        result = translator.translate_batch([tokens], beam_size=4, max_decoding_length=256)
        seconds = time.perf_counter() - t
        amharic = tokenizer.decode(result[0].hypotheses[0])
        rows.append((english, amharic, seconds))
        print(f"[{i}/{len(sentences)}] {seconds:.1f}s  {english}\n          {amharic}")
    total = time.perf_counter() - t_all

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    md = [
        f"# English → Amharic test: {MODEL_REPO}",
        "",
        f"{len(rows)} sentences, {total:.1f} s total on CPU "
        f"({total / len(rows):.1f} s per sentence on average).",
        "",
        "| # | English | Amharic (machine draft) | Seconds |",
        "|---|---|---|---|",
    ]
    md += [f"| {i} | {en} | {am} | {s:.1f} |" for i, (en, am, s) in enumerate(rows, 1)]
    (RESULTS_DIR / "translations.md").write_text("\n".join(md) + "\n", encoding="utf-8")

    tsv = ["english\tamharic\tseconds\trating (1-5)\tcorrected"]
    tsv += [f"{en}\t{am}\t{s:.1f}\t\t" for en, am, s in rows]
    (RESULTS_DIR / "translations.tsv").write_text("\n".join(tsv) + "\n", encoding="utf-8")

    print(f"\nDone: {total:.1f} s for {len(rows)} sentences. See results/translations.md")


if __name__ == "__main__":
    main()
