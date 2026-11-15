# Third-party licences

Every library, model and asset Fidel uses, and its licence. Rule: nothing with a
non-commercial (NC) licence as a default.

## Player (shipped in `fidel.js` / `fidel.css`)

| Name | Version | Licence | Use |
|---|---|---|---|
| [Able Player](https://github.com/ableplayer/ableplayer) | 5.0.0 | MIT | Accessible media player |
| [jQuery](https://jquery.com/) | 3.x | MIT | Required by Able Player |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.x | Apache-2.0 / MPL-2.0 | Required by Able Player (sanitises caption HTML) |
| [Noto Sans Ethiopic](https://fonts.google.com/noto/specimen/Noto+Sans+Ethiopic) via [@fontsource/noto-sans-ethiopic](https://fontsource.org/fonts/noto-sans-ethiopic) | 5.x | SIL OFL 1.1 (shipped as `fonts/OFL.txt`) | Self-hosted font for Amharic text |
| [Atkinson Hyperlegible](https://fonts.google.com/specimen/Atkinson+Hyperlegible) (Braille Institute of America), regular weight, Latin subset WOFF2 from [@fontsource/atkinson-hyperlegible](https://fontsource.org/fonts/atkinson-hyperlegible) (one file, 17.2 KB, copied into `player/src/fonts/`; no npm dependency) | 5.x | SIL OFL 1.1 (full text in `player/src/fonts/OFL-atkinson-hyperlegible.txt`, shipped as `fonts/OFL-atkinson-hyperlegible.txt`) | "Easy-read font" option of `<fidel-display-prefs>` (Package E, E8), Latin text only; downloaded only when a learner chooses it |

## Server

| Name | Version | Licence | Use |
|---|---|---|---|
| [FastAPI](https://fastapi.tiangolo.com/) | 0.162.7 | MIT | Web API |
| [Uvicorn](https://www.uvicorn.org/) | 0.54.0 | BSD-3-Clause | Web server |
| [python-multipart](https://github.com/Kludex/python-multipart) | 0.0.33 | Apache-2.0 | File uploads |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | 1.2.1 | MIT | English speech-to-text |
| [CTranslate2](https://github.com/OpenNMT/CTranslate2) | 4.9.0 | MIT | Runs Whisper and MADLAD on CPU |
| [SentencePiece](https://github.com/google/sentencepiece) | 0.2.3 | Apache-2.0 | Tokenizer for MADLAD |
| [huggingface_hub](https://github.com/huggingface/huggingface_hub) | 2.4.0 | Apache-2.0 | Model download command only |
| [WeasyPrint](https://weasyprint.org/) | 70.0 | BSD-3-Clause | Tagged PDF (PDF/UA) lesson documents |
| [Brotli](https://github.com/google/brotli) | 1.2.1 | MIT | Lets WeasyPrint read the WOFF2 Ethiopic font |
| [liblouis](https://liblouis.io/) (Debian package) | distro | LGPL-2.1+ (tables: various free licences) | Braille (.brf) export, run as a separate program |
| [Pango](https://pango.gnome.org/), [HarfBuzz](https://harfbuzz.github.io/) (Debian packages) | distro | LGPL-2.0+ / MIT | Text layout for WeasyPrint |
| [FFmpeg](https://ffmpeg.org/) (Debian package) | distro | LGPL-2.1+ / GPL-2+ (Debian build) | Media processing, run as a separate program |

## Build and test tools (not shipped)

| Name | Licence |
|---|---|
| [Vite](https://vite.dev/) | MIT |
| [Playwright](https://playwright.dev/) | Apache-2.0 |
| [axe-core](https://github.com/dequelabs/axe-core) / @axe-core/playwright | MPL-2.0 |
| [pytest](https://pytest.org/) | MIT |
| [HTTPX](https://www.python-httpx.org/) | BSD-3-Clause |

## Models (downloaded once by `python -m app.download_models`)

| Name | Licence | Use |
|---|---|---|
| [Whisper](https://github.com/openai/whisper) via [Systran/faster-whisper-small](https://huggingface.co/Systran/faster-whisper-small) | MIT | English speech-to-text |
| [MADLAD-400 3B MT](https://huggingface.co/google/madlad400-3b-mt), CTranslate2 int8 conversion by [Nextcloud-AI](https://huggingface.co/Nextcloud-AI/madlad400-3b-mt-ct2-int8) | Apache-2.0 | English → Amharic draft translation |

## Optional Amharic speech engines (own containers, off by default)

These run only if staff start them (`docker compose --profile amharic-speech` /
`--profile amharic-voice`). They are separate programs in separate images; the
main Fidel image contains none of them.

| Name | Version | Licence | Use |
|---|---|---|---|
| [Omnilingual ASR](https://github.com/facebookresearch/omnilingual-asr) code and `omniASR_CTC_300M_v2` model (Meta) | 0.2.0 | Apache-2.0 | Amharic speech-to-text |
| [fairseq2](https://github.com/facebookresearch/fairseq2) / fairseq2n (CPU build) | 0.6 | MIT | Runs the Omnilingual model |
| [KenLM](https://github.com/kpu/kenlm) | 0.3.0 | LGPL-2.1 (a few files BSD/other) | Required by Omnilingual ASR's install; not used for our transcription |
| [PyTorch](https://pytorch.org/) (CPU builds) | 2.8.0 / 2.4.0 | BSD-3-Clause | Runs both engines |
| [IMS ToucanTTS](https://github.com/DigitalPhonetics/IMS-Toucan) code (MassiveScaleToucan, pinned commit) and [Flux9665/ToucanTTS](https://huggingface.co/Flux9665/ToucanTTS) `ToucanTTS.pt`, `Vocoder.pt` | 3cc2094 | Apache-2.0 | Machine-read Amharic recordings |
| [eSpeak NG](https://github.com/espeak-ng/espeak-ng) (Debian package) | 1.52 | **GPL-3.0-or-later** | Turns Amharic letters into sounds for ToucanTTS |
| [phonemizer](https://github.com/bootphon/phonemizer) | 3.2.x | **GPL-3.0** | Calls eSpeak NG |
| [Parselmouth](https://github.com/YannickJadoul/Parselmouth) (Praat) | 0.4.x | **GPL-3.0** | Imported by ToucanTTS |

**GPL note:** running the voice engine on your own server is fine. If you
hand the voice engine's Docker image to someone else, the GPL requires offering
the source of eSpeak NG, phonemizer and Parselmouth (all are public on GitHub).
Not loaded: Toucan's speaker-matching model (speechbrain, another publisher),
replaced by a stub because Fidel never copies a voice from a recording.

