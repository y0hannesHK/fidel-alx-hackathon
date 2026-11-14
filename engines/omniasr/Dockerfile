# syntax=docker/dockerfile:1
# Optional Amharic speech-to-text engine (Meta Omnilingual ASR), CPU only.
# Built by:  docker compose --profile amharic-speech build omniasr

# ---- Stage 1: compile kenlm (a required dependency with no ready-made wheel) ----
FROM python:3.10-slim AS kenlm
RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 ffmpeg time \
    build-essential cmake zlib1g-dev libbz2-dev liblzma-dev libboost-program-options-dev \
    libboost-system-dev libboost-thread-dev libboost-test-dev libeigen3-dev \
    && rm -rf /var/lib/apt/lists/*
RUN --mount=type=cache,target=/root/.cache/pip pip wheel kenlm==0.3.0 --no-deps -w /wheels

# ---- Stage 2: the engine (no compiler) ----
FROM python:3.10-slim
RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 \
    && rm -rf /var/lib/apt/lists/*
# CPU-only PyTorch, pinned to the version fairseq2 0.6 is built for.
RUN --mount=type=cache,target=/root/.cache/pip pip install torch==2.8.0+cpu torchaudio==2.8.0+cpu \
    --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple
COPY --from=kenlm /wheels /wheels
RUN --mount=type=cache,target=/root/.cache/pip pip install /wheels/kenlm-*.whl omnilingual-asr==0.2.0 \
    torch==2.8.0+cpu torchaudio==2.8.0+cpu --extra-index-url https://download.pytorch.org/whl/cpu \
    && ! pip list 2>/dev/null | grep -iq nvidia
# The fairseq2n on PyPI is the CUDA 12.8 build and refuses CPU PyTorch: use fairseq2's CPU build.
RUN pip install --no-cache-dir --force-reinstall --no-deps "fairseq2n==0.6" \
    --index-url https://fair.pkg.atmeta.com/fairseq2/whl/pt2.8.0/cpu \
    && python -c "import fairseq2, omnilingual_asr"

WORKDIR /engine
COPY engines/omniasr/server.py ./
ENV FAIRSEQ2_CACHE_DIR=/models/omniasr PYTHONUNBUFFERED=1 PORT=8001
EXPOSE 8001
CMD ["python", "server.py"]
