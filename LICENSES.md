# Third-party licences

Every library, model and asset Fidel uses, and its licence. Rule: nothing with a
non-commercial (NC) licence as a default.

## Player (shipped in `fidel.js` / `fidel.css`)

| Name | Version | Licence | Use |
|---|---|---|---|
| [Able Player](https://github.com/ableplayer/ableplayer) | 5.0.0 | MIT | Accessible media player |
| [jQuery](https://jquery.com/) | 3.x | MIT | Required by Able Player |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.x | Apache-2.0 / MPL-2.0 | Required by Able Player (sanitises caption HTML) |

## Server

| Name | Version | Licence | Use |
|---|---|---|---|
| [FastAPI](https://fastapi.tiangolo.com/) | 0.162.7 | MIT | Web API |
| [Uvicorn](https://www.uvicorn.org/) | 0.54.0 | BSD-3-Clause | Web server |
| [FFmpeg](https://ffmpeg.org/) (Debian package) | distro | LGPL-2.1+ / GPL-2+ (Debian build) | Media processing, run as a separate program |

## Build and test tools (not shipped)

| Name | Licence |
|---|---|
| [Vite](https://vite.dev/) | MIT |
| [Playwright](https://playwright.dev/) | Apache-2.0 |
| [axe-core](https://github.com/dequelabs/axe-core) / @axe-core/playwright | MPL-2.0 |
| [pytest](https://pytest.org/) | MIT |
| [HTTPX](https://www.python-httpx.org/) | BSD-3-Clause |

## Models (being evaluated, not yet used by the server)

| Name | Licence | Use |
|---|---|---|
| [MADLAD-400 3B MT](https://huggingface.co/google/madlad400-3b-mt), CTranslate2 int8 conversion by [Nextcloud-AI](https://huggingface.co/Nextcloud-AI/madlad400-3b-mt-ct2-int8) | Apache-2.0 | English → Amharic draft translation (test in `tools/translation-eval/`) |
| [CTranslate2](https://github.com/OpenNMT/CTranslate2) | MIT | Runs the translation model on CPU |
| [SentencePiece](https://github.com/google/sentencepiece) | Apache-2.0 | Tokenizer for the translation model |
