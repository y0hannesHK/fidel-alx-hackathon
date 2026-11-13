"""English -> Amharic translation with MADLAD-400 3B (Apache-2.0), on CPU.

Each caption cue is translated on its own, so the Amharic cues keep exactly
the same timings as the English ones. The result is always a DRAFT: a person
must review it in Studio.
"""

from pathlib import Path

from ..captions import Cue, wrap_two_lines
from . import ProviderUnavailable
from .models import DOWNLOAD_HINT, MADLAD_REPO, is_downloaded, model_dir

BATCH_SIZE = 8


class MadladTranslator:
    def __init__(self, models_dir: Path):
        self.path = model_dir(models_dir, MADLAD_REPO)

    def translate(self, cues: list[Cue], source: str, target: str) -> list[Cue]:
        if not is_downloaded(self.path):
            raise ProviderUnavailable(f"The MADLAD translation model is not downloaded. {DOWNLOAD_HINT}")

        import ctranslate2
        import sentencepiece

        translator = ctranslate2.Translator(str(self.path), device="cpu", compute_type="int8")
        tokenizer = sentencepiece.SentencePieceProcessor(model_file=str(self.path / "spiece.model"))

        texts = [" ".join(cue.text.split()) for cue in cues]  # one line per cue for the model
        translated: list[str] = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch = [
                # MADLAD picks the output language from a "<2xx>" prefix.
                tokenizer.encode(f"<2{target}> {text}", out_type=str) + ["</s>"]
                for text in texts[i : i + BATCH_SIZE]
            ]
            results = translator.translate_batch(batch, beam_size=4, max_decoding_length=256)
            translated += [tokenizer.decode(r.hypotheses[0]) for r in results]

        return [Cue(cue.start, cue.end, wrap_two_lines(text.strip())) for cue, text in zip(cues, translated)]
