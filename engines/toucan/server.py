"""Amharic text-to-speech engine: IMS ToucanTTS (Apache-2.0 code and model),
on CPU. An optional helper for the Fidel server.

It makes a MACHINE-READ recording when no person has recorded one yet (most
phones have no Amharic voice to read text aloud). It runs in its own
container, so PyTorch and the GPLv3 parts it needs (espeak-ng, phonemizer,
parselmouth) stay out of the main Fidel image. Only reachable inside Docker's
network:

    GET  /health   {"status": "ok", "languages": ["am", "om"], "model_downloaded": true}
    POST /speak    JSON {"text": "...", "language": "am"}  ->  audio/wav (24 kHz mono)

Speed on a laptop CPU: about 0.8 s of work per second of speech.

Notes:
- Only ToucanTTS.pt and Vocoder.pt from the official Flux9665/ToucanTTS
  repository are loaded. Toucan also loads a voice-matching model from another
  publisher (speechbrain) to copy a voice from a recording; we never do that,
  so it is replaced by a stub and never downloaded.
- espeak-ng writes Amharic ejectives (ጵ ቀ ጥ ጠ ቅ) as "k`", and Toucan drops the
  "`". TOUCAN_EJECTIVE_MARK=1 turns it into the IPA ejective mark Toucan knows.
  Which sounds better must be decided by Amharic speakers (default: off).

Download the model once (about 330 MB) with:
    docker compose --profile amharic-voice run --rm toucan python /engine/server.py --download
"""

import io
import json
import logging
import os
import re
import sys
import threading
import time
import types
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

TOUCAN_SRC = Path(os.environ.get("TOUCAN_SRC", "/toucan"))
MODEL_DIR = Path(os.environ.get("TOUCAN_MODEL_DIR", "/models/Flux9665--ToucanTTS"))
FILES = ("ToucanTTS.pt", "Vocoder.pt")
LANGUAGES = {"am": "amh", "om": "gaz"}  # Fidel code -> Toucan code. Amharic was trained on real
# recordings; Afaan Oromo (West Central, "gaz") was not, so its voice is a best guess.
# Speaking rate: TOUCAN_DURATION_SCALE above 1 is slower (1.25 = 25% slower).
DURATION_SCALE = float(os.environ.get("TOUCAN_DURATION_SCALE", "1.0"))
MAX_CHARS = 2000
SENTENCE_END = re.compile(r"(?<=[።፧!?.])\s+|(?<=፤)\s+")

log = logging.getLogger("toucan")
_engine = None
_language = None
_lock = threading.Lock()


def model_downloaded() -> bool:
    return all((MODEL_DIR / name).is_file() for name in FILES)


def _stub_unused_modules() -> None:
    # Live playback (needs a sound card) and the voice-matching model: unused.
    sys.modules["sounddevice"] = types.ModuleType("sounddevice")
    pretrained = types.ModuleType("speechbrain.pretrained")

    class NoVoiceMatching:
        @staticmethod
        def from_hparams(*args, **kwargs):
            return None

    pretrained.EncoderClassifier = NoVoiceMatching
    sys.modules["speechbrain"] = types.ModuleType("speechbrain")
    sys.modules["speechbrain.pretrained"] = pretrained


def load_engine(language: str):
    global _engine, _language
    if _engine is None:
        _stub_unused_modules()
        os.chdir(TOUCAN_SRC)  # Toucan reads some lookup files relative to its folder
        sys.path.insert(0, str(TOUCAN_SRC))
        from InferenceInterfaces.ToucanTTSInterface import ToucanTTSInterface

        _engine = ToucanTTSInterface(device="cpu", tts_model_path=str(MODEL_DIR / FILES[0]),
                                     vocoder_model_path=str(MODEL_DIR / FILES[1]))
    if _language != language:
        _engine.set_language(language)
        if os.environ.get("TOUCAN_EJECTIVE_MARK") == "1":
            backend = _engine.text2phone.phonemizer_backend
            original = backend.phonemize
            backend.phonemize = lambda texts, **kw: [t.replace("`", "ʼ") for t in original(texts, **kw)]
        _language = language
    return _engine


def download() -> None:
    from huggingface_hub import hf_hub_download

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        if not (MODEL_DIR / name).is_file():
            print(f"Downloading {name} from Flux9665/ToucanTTS ...")
            hf_hub_download(repo_id="Flux9665/ToucanTTS", filename=name, local_dir=MODEL_DIR)
    print(f"Done: {MODEL_DIR}")


def speak(text: str, language: str) -> bytes:
    import numpy as np
    import soundfile
    import torch

    sentences = [s.strip() for s in SENTENCE_END.split(" ".join(text.split())) if s.strip()]
    began = time.perf_counter()
    with _lock:
        engine = load_engine(LANGUAGES[language])
        parts, rate = [], 24000
        for sentence in sentences:
            with torch.inference_mode():
                wave, rate = engine(sentence, duration_scaling_factor=DURATION_SCALE)
            parts.append(wave.cpu().numpy() if torch.is_tensor(wave) else np.asarray(wave))
            parts.append(np.zeros(int(0.35 * rate), dtype=np.float32))  # short pause between sentences
    audio = np.concatenate(parts[:-1]) if parts else np.zeros(rate // 2, dtype=np.float32)
    out = io.BytesIO()
    soundfile.write(out, audio, rate, format="WAV", subtype="PCM_16")
    log.info("Spoke %d characters (%.1f s of audio) in %.1f s", len(text), len(audio) / rate, time.perf_counter() - began)
    return out.getvalue()


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status: int, body: dict) -> None:
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            return self.send_json(200, {"status": "ok", "languages": sorted(LANGUAGES),
                                        "model_downloaded": model_downloaded()})
        self.send_json(404, {"detail": "Not found."})

    def do_POST(self):
        if self.path != "/speak":
            return self.send_json(404, {"detail": "Not found."})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(min(length, 64 * 1024)) or b"{}")
            text, language = str(body.get("text", "")).strip(), body.get("language")
        except (ValueError, json.JSONDecodeError):
            return self.send_json(400, {"detail": "Send JSON: {\"text\": \"...\", \"language\": \"am\"}."})
        if language not in LANGUAGES:
            return self.send_json(400, {"detail": f"Language must be one of: {', '.join(sorted(LANGUAGES))}."})
        if not 0 < len(text) <= MAX_CHARS:
            return self.send_json(400, {"detail": f"Text must be 1 to {MAX_CHARS} characters."})
        if not model_downloaded():
            return self.send_json(503, {"detail": "The ToucanTTS model is not downloaded. Download it once with: "
                                        "docker compose --profile amharic-voice run --rm toucan python /engine/server.py --download"})
        audio = speak(text, language)
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)

    def log_message(self, format, *args):
        log.debug(format, *args)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    if "--download" in sys.argv:
        return download()
    port = int(os.environ.get("PORT", "8002"))
    log.info("Listening on port %d (model downloaded: %s)", port, model_downloaded())
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
