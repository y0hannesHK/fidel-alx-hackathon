"""Amharic speech-to-text engine: Meta Omnilingual ASR (omniASR_CTC_300M_v2,
Apache-2.0), on CPU. An optional helper for the Fidel server.

It runs in its own container (PyTorch and fairseq2 stay out of the main Fidel
image) and is only reachable inside Docker's network. Two addresses:

    GET  /health       {"status": "ok", "model_downloaded": true}
    POST /transcribe   body: 16 kHz mono 16-bit WAV
                       answer: {"words": [{"start": 0.4, "end": 0.9, "text": "..."}], ...}

How it works:
- The model accepts at most 40 seconds, so long audio is cut into pieces of up
  to 25 s, at the quietest moment (between words), never in mid-word.
- The model writes one letter-piece per 20 ms "frame". We note the frame where
  each piece appears, so every word gets a real start and end time; Fidel then
  builds caption cues from the words exactly as it does for Whisper.
- It is a CTC model: no language code is given, it decides by itself. It writes
  no punctuation.
- float32 on purpose: the library's default (bfloat16) is about 20x slower on
  most CPUs.

The model is never downloaded while serving. Download it once with:
    docker compose --profile amharic-speech run --rm omniasr python server.py --download
"""

import io
import json
import logging
import os
import sys
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np

MODEL_CARD = "omniASR_CTC_300M_v2"
CACHE_DIR = Path(os.environ.get("FAIRSEQ2_CACHE_DIR", "/models/omniasr"))
SAMPLE_RATE = 16000
MAX_PIECE_S = 25.0  # the model's hard limit is 40 s; 30 s is recommended
MIN_PIECE_S = 12.0  # look for a quiet moment between 12 and 25 s
MAX_UPLOAD = 200 * 1024 * 1024  # about 1 h 45 min of 16 kHz audio

log = logging.getLogger("omniasr")
_pipeline = None
_lock = threading.Lock()  # one transcription at a time (the model is not thread-safe, and CPU-bound)


def model_downloaded() -> bool:
    return any(CACHE_DIR.rglob("*.pt"))


def load_pipeline():
    global _pipeline
    if _pipeline is None:
        import torch
        from omnilingual_asr.models.inference.pipeline import ASRInferencePipeline

        _pipeline = ASRInferencePipeline(model_card=MODEL_CARD, device="cpu", dtype=torch.float32)
        _add_timings(_pipeline)
    return _pipeline


def _add_timings(pipeline) -> None:
    """Replace the CTC decoding step with one that also keeps, for every
    letter-piece, the first and last frame where the model wrote it."""
    import torch
    from fairseq2.nn import BatchLayout

    def apply(batch):
        layout = BatchLayout(batch.source_seqs.shape, seq_lens=batch.source_seq_lens, device=batch.source_seqs.device)
        logits, layout_out = pipeline.model(batch.source_seqs, layout)
        ids = torch.argmax(logits, dim=-1)[0][: layout_out.seq_lens[0]].tolist()
        pieces = []  # [token id, first frame, last frame]
        blank = 0  # fairseq2 trains with torch's ctc_loss default: blank = token 0
        previous = None
        for frame, token in enumerate(ids):
            if token != previous and token != blank:
                pieces.append([token, frame, frame])
            elif token == previous and token != blank and pieces:
                pieces[-1][2] = frame
            previous = token
        pipeline.last_pieces = pieces
        pipeline.last_frame_count = len(ids)
        return [pipeline.token_decoder(torch.tensor([p[0] for p in pieces], dtype=torch.int64))] if pieces else [""]

    pipeline._apply_model_wav2vec2asr = apply


def words_from_pieces(pipeline, pieces, frame_seconds: float, offset: float) -> list[dict]:
    """Group letter-pieces into words. A new word starts where the decoded text
    gains a space. Decoding the growing prefix keeps this independent of how
    the tokenizer marks word starts."""
    import torch

    words: list[dict] = []
    text_so_far = ""
    new_word = True
    for index, (_token, first, last) in enumerate(pieces):
        ids = torch.tensor([p[0] for p in pieces[: index + 1]], dtype=torch.int64)
        text = pipeline.token_decoder(ids)
        added = text[len(text_so_far):] if text.startswith(text_so_far) else text[len(text_so_far.rstrip()):]
        text_so_far = text
        if not added.strip():  # the space itself is a piece: the next piece starts a word
            new_word = True
            continue
        start, end = offset + first * frame_seconds, offset + (last + 1) * frame_seconds
        if new_word or added[:1].isspace() or not words:
            words.append({"start": round(start, 2), "end": round(end, 2), "text": added.strip()})
        else:
            words[-1]["text"] += added.rstrip()
            words[-1]["end"] = round(end, 2)
        new_word = added[-1:].isspace()
    return words


def split_points(samples: np.ndarray) -> list[tuple[int, int]]:
    """Cut audio into pieces of at most MAX_PIECE_S, each ending at the
    quietest 30 ms between MIN_PIECE_S and MAX_PIECE_S."""
    hop = int(0.03 * SAMPLE_RATE)
    pieces, start, total = [], 0, len(samples)
    while total - start > MAX_PIECE_S * SAMPLE_RATE:
        lo, hi = start + int(MIN_PIECE_S * SAMPLE_RATE), start + int(MAX_PIECE_S * SAMPLE_RATE)
        window = samples[lo:hi]
        frames = window[: len(window) // hop * hop].reshape(-1, hop)
        quietest = int(np.argmin(np.sqrt((frames.astype(np.float64) ** 2).mean(axis=1))))
        cut = lo + quietest * hop + hop // 2
        pieces.append((start, cut))
        start = cut
    if total - start > SAMPLE_RATE // 2:
        pieces.append((start, total))
    return pieces


def read_wav(data: bytes) -> np.ndarray:
    with wave.open(io.BytesIO(data), "rb") as f:
        if f.getnchannels() != 1 or f.getsampwidth() != 2 or f.getframerate() != SAMPLE_RATE:
            raise ValueError("Send 16 kHz mono 16-bit WAV audio.")
        return np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16).astype(np.float32) / 32768


def transcribe(data: bytes) -> dict:
    samples = read_wav(data)
    began = time.perf_counter()
    with _lock:
        pipeline = load_pipeline()
        words = []
        for start, end in split_points(samples):
            piece = samples[start:end]
            pipeline.transcribe([{"waveform": piece, "sample_rate": SAMPLE_RATE}], batch_size=1)
            frame_seconds = (len(piece) / SAMPLE_RATE) / max(pipeline.last_frame_count, 1)
            words += words_from_pieces(pipeline, pipeline.last_pieces, frame_seconds, start / SAMPLE_RATE)
    seconds = len(samples) / SAMPLE_RATE
    took = time.perf_counter() - began
    log.info("Transcribed %.1f s of audio in %.1f s (%d words)", seconds, took, len(words))
    return {"words": words, "audio_seconds": round(seconds, 2), "processing_seconds": round(took, 2),
            "model": MODEL_CARD}


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
            return self.send_json(200, {"status": "ok", "model": MODEL_CARD, "model_downloaded": model_downloaded()})
        self.send_json(404, {"detail": "Not found."})

    def do_POST(self):
        if self.path != "/transcribe":
            return self.send_json(404, {"detail": "Not found."})
        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= MAX_UPLOAD:
            return self.send_json(413, {"detail": "Send between 1 byte and 200 MB of WAV audio."})
        if not model_downloaded():
            return self.send_json(503, {"detail": "The Omnilingual ASR model is not downloaded. Download it once with: "
                                        "docker compose --profile amharic-speech run --rm omniasr python server.py --download"})
        try:
            self.send_json(200, transcribe(self.rfile.read(length)))
        except (ValueError, wave.Error) as problem:
            self.send_json(400, {"detail": str(problem)})

    def log_message(self, format, *args):  # quieter than the default (one line per request to stderr)
        log.debug(format, *args)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    if "--download" in sys.argv:
        print(f"Downloading {MODEL_CARD} (about 1.3 GB) to {CACHE_DIR} ...")
        load_pipeline()
        print("Done.")
        return
    port = int(os.environ.get("PORT", "8001"))
    log.info("Listening on port %d (model downloaded: %s)", port, model_downloaded())
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
