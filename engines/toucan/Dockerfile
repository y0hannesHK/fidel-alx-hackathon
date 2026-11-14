# syntax=docker/dockerfile:1
# Optional Amharic text-to-speech engine (IMS ToucanTTS), CPU only.
# Built by:  docker compose --profile amharic-voice build toucan
FROM python:3.10-slim
# espeak-ng: turns Amharic letters into sounds (GPL-3.0, runs inside this optional image only)
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng libsndfile1 time \
    && rm -rf /var/lib/apt/lists/*
RUN --mount=type=cache,target=/root/.cache/pip pip install torch==2.4.0+cpu torchaudio==2.4.0+cpu --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple
# Only what speaking needs (Toucan's requirements.txt also lists GUI and training tools).
RUN --mount=type=cache,target=/root/.cache/pip pip install "numpy~=1.23.4" "scipy~=1.9.3" "librosa~=0.9.2" "soundfile~=0.12.0" \
    "pyloudnorm~=0.1.0" "matplotlib~=3.9.2" "phonemizer~=3.2.1" "dragonmapper~=0.2.6" "pypinyin~=0.47.1" \
    "dotwiz==0.4.0" "huggingface-hub~=0.25.2" "torch_complex~=0.4.3" "alias_free_torch~=0.0.6" \
    "einops==0.7.0" "tqdm" "praat-parselmouth~=0.4.2" "imageio~=2.34.0" "transphone==1.5.3" "phonepiece==1.4.2"

# Toucan's source code (MassiveScaleToucan branch), pinned to the commit Fidel was tested with.
ARG TOUCAN_COMMIT=3cc2094d9c7123336eda7e299ac0bc90319ca9ff
ADD https://github.com/DigitalPhonetics/IMS-Toucan/archive/${TOUCAN_COMMIT}.tar.gz /tmp/toucan.tar.gz
RUN python -c "import tarfile; tarfile.open('/tmp/toucan.tar.gz').extractall('/tmp')" \
    && mv /tmp/IMS-Toucan-${TOUCAN_COMMIT} /toucan && rm /tmp/toucan.tar.gz

WORKDIR /engine
COPY engines/toucan/server.py ./
ENV TOUCAN_SRC=/toucan TOUCAN_MODEL_DIR=/models/Flux9665--ToucanTTS MPLCONFIGDIR=/tmp \
    HF_HUB_DISABLE_TELEMETRY=1 PYTHONUNBUFFERED=1 PORT=8002
EXPOSE 8002
CMD ["python", "server.py"]
