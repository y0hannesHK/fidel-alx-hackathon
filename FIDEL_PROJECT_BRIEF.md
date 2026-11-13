# Fidel — Project Brief for Claude Code

> Paste this whole file into Claude Code at the start of the project, or save it in the repo root as `CLAUDE.md` so it is read automatically.

---

## 0. How I want you (Claude Code) to work

- Work in the **phases** in section 9. Finish one phase, show me what works, then continue. Do not jump ahead.
- **Everything you build must actually work.** No placeholder buttons, no fake "coming soon" features, no mocked results presented as real. If something can't be done, tell me and leave it out.
- **Explain as you go.** Our team must understand every part of the code, because judges may ask us to change things live. After each phase, give a short plain-English summary of what each new file does.
- **Ask before** adding a dependency, changing the architecture, or choosing between two reasonable options.
- **Accessibility is not a final polish step.** Every component must be keyboard-usable and screen-reader-friendly from the first commit.
- Prefer **simple, boring, well-known tools** over clever ones. Small files, clear names, comments where the "why" isn't obvious.
- Never add a paid API as a required dependency. Never send learner data to a third party.
- Write tests as you go (unit tests for logic, Playwright + axe-core for UI).

---

## 1. Context

We are a team in the **Digital Bridge Accessibility Hackathon 2026** (ALX Ethiopia, with AAAPD and Tomorrow is Better; under the LIWAY programme with SNV and Mercy Corps).

- **Dates:** build days Saturday 14 and Sunday 15 November 2026, ALX Tech Hub Lideta, Addis Ababa. Submission Sunday 16:30. We are allowed to start building before the event.
- **Our track: Track 2 — Accessible learning media.**
- **Target platform:** ALX's learning platform **Savanna** (web only, no mobile app), then eight Ethiopian job-matching platforms and two regional training institutions.
- We get a **Savanna starter repo and documentation at kick-off on Saturday**. Until then, build against a **mock Savanna lesson page** (see section 6.6), and keep the integration isolated so swapping in the real starter is easy.
- Every team works with a **co-designer** (a person who is blind, Deaf, has a disability, or is a refugee/returnee). They test our work on their own devices.

### The problem (from the 21 October co-design session)
Forty people who are blind, Deaf, live with a disability, or are refugees/returnees tried to follow an ALX lesson. Most could not finish. Lesson videos lack sign language, Amharic subtitles, screen-reader-usable controls, and an offline option for slow connections.

### Who we build for
- Deaf and hard-of-hearing learners (Ethiopian Sign Language, captions)
- Blind and low-vision learners (screen readers: NVDA on Windows, TalkBack on Android; zoom up to 200%)
- Learners on cheap Android phones with 3G or intermittent connection
- Learners who read Amharic better than English; low-literacy learners

---

## 2. Product: what Fidel is

**Fidel** (ፊደል, "alphabet/script") is an open, embeddable accessible media module for Ethiopian learning platforms. It has three parts:

1. **Fidel Player**: an embeddable video player any website adds with one `<script>` tag. Built on top of **Able Player** (MIT licence, https://github.com/ableplayer/ableplayer). We add Ethiopia-specific features on top.
2. **Fidel Pipeline**: a self-hosted server that turns a lesson video into: English captions, an Amharic caption draft, a transcript, an offline 3G pack, accessible documents (tagged PDF + HTML), and optionally Braille.
3. **Fidel Studio**: a simple staff web page where ALX staff upload a lesson, **review and correct the Amharic captions**, attach a sign-language video, and publish.

Plus the required **career gateway** for Track 2:
4. **Fidel Job Card**: an accessible, embeddable job card with an audio summary.
5. **Fidel Certificates**: simple verifiable certificate links employers can open.

**One-line pitch:** "Fidel makes every lesson readable, watchable, hearable and downloadable for every Ethiopian learner. It runs free and offline by default, and a human always checks the Amharic."

---

## 3. Hard requirements (from the official brief)

### Track 2 must-haves
1. Player that works by **keyboard and screen reader**.
2. **English and Amharic captions** the user can **resize and recolour**.
3. A **movable, resizable Ethiopian Sign Language (EthSL) window**.
4. **Audio description**.
5. An **offline pack for a 3G phone**: audio, text, light HTML.
6. **Tagged PDF and HTML documents with image descriptions**.

### Extra credit
- **Braille export (.brf)**.
- A **viewer for recorded live sessions** with captions and chat log.

### Career gateway (required for Track 2)
- An **accessible job card with an audio summary**, working at **200% zoom**.
- **Verifiable certificate links** to share with employers.

### Integration levels (more levels = more points)
- **Level 1:** install by a script tag.
- **Level 2:** REST API with an **OpenAPI** spec.
- **Level 3:** a standard such as LTI 1.3, schema.org/JobPosting, or Open Badges 3.0. (We do **schema.org/JobPosting** for sure; Open Badges 3.0 and LTI 1.3 are stretch goals only.)

### Submission (Sunday 16:30)
Code, **README**, **Docker Compose**, and a **WCAG 2.2 AA conformance report**.

---

## 4. How we are judged (design every decision around this)

### The gate: pass/fail. If we fail, nothing else counts.
- A co-designer completes the **main task unaided** using **NVDA, TalkBack, keyboard only, 200% zoom, and sound off**.
- **axe-core** shows **zero critical or serious** issues.
- We submit a **WCAG 2.2 AA conformance report**.

**Our "main task" (keep it narrow):** open a lesson → turn on Amharic captions and make them bigger → open the sign-language window → read/search the transcript → download the offline pack → open a job card and hear its summary.

### Score out of 100
| Points | Criterion | What it means for us |
|---|---|---|
| 30 | Works for the people it is for | Co-designer scores, tasks done unaided |
| 25 | Can be adopted | A judge installs it in **one hour** from our docs. More for all three integration levels |
| 15 | Built for Ethiopia | Amharic, Ethiopic script and **calendar**, cheap Android on 3G, offline |
| 15 | Quality, security, privacy | Tests, minimum data, **nothing leaves the host without consent** |
| 15 | Can be kept running | Low cost, **no paid-API lock-in**, a README a stranger can follow |

The organisers also said explicitly: they want **functional, simple** solutions, not fancy ones. A button that does nothing counts against us.

---

## 5. Tech stack

| Part | Tool |
|---|---|
| Player front end | **Able Player** (5.x) + plain JavaScript (ES modules), bundled with **Vite** into one file `fidel.js` + `fidel.css` |
| Offline | Service worker + IndexedDB (browser built-ins), PWA manifest |
| Server / API | **Python 3.11 + FastAPI** (auto-generates OpenAPI at `/api/docs`) |
| Background jobs | FastAPI background tasks (keep simple; no Redis unless needed) |
| Database | **SQLite** + files on disk under `data/` |
| Media processing | **ffmpeg** |
| English speech-to-text | **faster-whisper** (model size configurable; default `small`) |
| Amharic speech-to-text (for lessons spoken in Amharic) | **Samuael/ethiopic-asr** (Apache-2.0) via `transformers` |
| English → Amharic translation | Pluggable. Default: an open model we self-host (candidate: **MADLAD-400**; check licence and quality first). Optional plug-in: **Addis AI** API, off by default, needs the user's own API key |
| Amharic speech (audio description) | **speecht5_tts_amharic** (MIT), generated once and saved as audio files |
| Tagged PDF | **WeasyPrint** (PDF/UA variant) with embedded **Noto Sans Ethiopic** |
| Braille | **liblouis** (`lou_translate`), English UEB grade 2; Amharic only if a working table exists |
| Studio page | Plain HTML + JS served by FastAPI |
| Packaging | **Docker Compose** (`docker compose up` starts everything) |
| Testing | pytest; Playwright + `@axe-core/playwright`; manual NVDA + TalkBack checklists |

### Licence rules
- Only use models and libraries whose licence allows ALX (a company) to use them. **Avoid CC-BY-NC (non-commercial) models as defaults** (this rules out Meta NLLB and Ethio-ASR as defaults). Record each dependency and its licence in `LICENSES.md`.
- Self-host fonts (Noto Sans Ethiopic). No CDN calls at runtime: everything must work on a local network with no internet.

### AI engine design: pluggable providers
Define a small interface so engines can be swapped by config, never by code changes:

```python
class SpeechToText(Protocol):
    def transcribe(self, audio_path: str, language: str) -> list[Cue]: ...

class Translator(Protocol):
    def translate(self, cues: list[Cue], source: str, target: str) -> list[Cue]: ...

class TextToSpeech(Protocol):
    def synthesize(self, text: str, language: str, out_path: str) -> None: ...
```

Providers: `local_whisper`, `local_ethiopic_asr`, `local_madlad` (or chosen open model), `addis_ai` (optional, disabled unless an API key is set), and `none` (skip). Configure in `config.yaml` / environment variables. If a model is not downloaded, fail with a clear message, not a crash.

**Machine Amharic is a draft, never final.** Every Amharic caption file has a status: `draft` → `reviewed`. The player shows a small, accessible notice when captions are still machine drafts.

---

## 6. Feature specifications

### 6.1 Fidel Player (embeddable, Level 1)

Embed snippet that must work on any page:

```html
<link rel="stylesheet" href="https://HOST/embed/fidel.css">
<script src="https://HOST/embed/fidel.js" defer></script>

<fidel-player lesson="https://HOST/api/v1/lessons/LESSON_ID"></fidel-player>
<!-- or with explicit files, no server needed: -->
<fidel-player src="lesson.mp4" captions-en="en.vtt" captions-am="am.vtt"
              sign="esl.webm" descriptions="desc-en.vtt" chapters="chapters.vtt"
              offline-pack="lesson-pack.zip" lang="am"></fidel-player>
```

`<fidel-player>` is a thin custom element that builds the `<video>` markup Able Player expects and initialises it. Keep Fidel's own code separate from Able Player's (do not fork-edit Able Player files unless unavoidable; if we must patch, keep patches in `player/patches/` with notes).

Requirements:
- **Keyboard and screen reader:** all controls are real buttons with accessible names. Visible focus outline (minimum 3:1 contrast). No keyboard traps. Shortcuts must not hijack screen-reader keys or browser keys (no Alt+Arrow).
- **Touch / TalkBack:** every action available through visible buttons (not only keyboard shortcuts or drag), with touch targets at least 44×44 CSS px.
- **Amharic interface:** add an Amharic translation file for Able Player's interface strings (`am.json`), with a language switcher (English / አማርኛ). Use proper `lang` attributes on all Amharic text.
- **Caption styling panel:** font size 100%–250%; colour presets (white on black, yellow on black, black on white, black on cream); background opacity; position (bottom / top). Amharic text gets `line-height: 1.6` and Noto Sans Ethiopic. Use Able Player's caption preferences where they exist; add what's missing.
- **EthSL window:** use Able Player's sign-language window. Add: (a) a **"Dock beside video"** mode so the signer never covers slides, (b) visible buttons for move / resize (small / medium / large) for touch and screen-reader users. Sync with play, pause, seek and speed.
- **Audio description:** WebVTT `kind="descriptions"`. Support (a) reading description text through the browser/screen reader, and (b) **pre-recorded description audio files** (needed for Amharic, since phones usually lack an Amharic browser voice). Option to pause the video while a description plays. Lower main video volume during description.
- **Interactive transcript:** click/activate any line to jump there; current line highlighted; a **"follow along" toggle** (off by default when a screen reader user tabs into the transcript); **search box** that lists matches with timestamps.
- **Chapters** menu from `chapters.vtt`.
- **Preferences saved locally** (localStorage, wrapped in try/catch): caption style, language, EthSL position/size/dock, playback speed, description on/off. No account, nothing sent to a server.
- **Draft notice:** if Amharic captions are `draft`, show "These Amharic captions are machine-generated and not yet reviewed" in Amharic and English.
- **Low-data mode:** a toggle that loads the small video rendition and a low-bitrate sign video.
- **Download offline pack** button (see 6.3).
- Works at **200% zoom** and on a **360px-wide** screen with no horizontal scrolling and no overlapping controls.
- Target bundle: keep Fidel's own JS small; report total gzipped size (Able Player + jQuery + Fidel) in the README.

### 6.2 Fidel Pipeline (server, Level 2)

FastAPI service. Interactive docs at `/api/docs`; the OpenAPI JSON committed to the repo as `openapi.json`.

When a video is uploaded, a background job:
1. **ffmpeg:** extract audio (16 kHz mono WAV for models).
2. **Speech-to-text** in the lesson's spoken language → timed cues → `captions-<lang>.vtt`.
3. **Translate** English cues → Amharic draft → `captions-am.vtt` (status `draft`). Keep timings identical to the source cues.
4. **Transcript HTML** generated from captions + descriptions + chapters.
5. **Renditions:** small video (e.g. 360p, low bitrate) for low-data mode; **sign video** cropped/scaled to about 320×360 at a low bitrate (WebM); **audio-only** Opus at about 24 kbps.
6. **Offline pack** (see 6.3).
7. **Documents:** accessible HTML + tagged PDF (see 6.4).
8. **Braille** `.brf` (bonus).

Each step records status and errors so Studio can show progress. Steps are re-runnable individually (e.g. re-build the offline pack after captions are corrected).

Suggested endpoints (adjust if needed, but keep them documented):
```
POST   /api/v1/lessons                     upload video + metadata (title, spoken language)
GET    /api/v1/lessons                     list
GET    /api/v1/lessons/{id}                lesson manifest (all file URLs, caption statuses)
GET    /api/v1/lessons/{id}/status         pipeline progress per step
GET    /api/v1/lessons/{id}/captions/{lang}          VTT
PUT    /api/v1/lessons/{id}/captions/{lang}          save corrected cues; set status
POST   /api/v1/lessons/{id}/sign           upload EthSL video
POST   /api/v1/lessons/{id}/descriptions/{lang}      upload/edit description cues
POST   /api/v1/lessons/{id}/rebuild        re-run selected pipeline steps
GET    /api/v1/lessons/{id}/pack           download offline pack (.zip)
GET    /api/v1/lessons/{id}/document.pdf   tagged PDF
GET    /api/v1/lessons/{id}/document.html  accessible HTML
GET    /api/v1/lessons/{id}/braille.brf    Braille (bonus)
GET    /api/v1/jobs/{id}                   job as schema.org/JobPosting JSON-LD
POST   /api/v1/jobs                        create job
POST   /api/v1/certificates                issue certificate (staff only)
GET    /verify/{certificate_id}            public, accessible verification page
GET    /health
```

Security and privacy:
- Studio and write endpoints require a simple staff token (from environment variable). Read endpoints for published lessons are public.
- Store the **minimum** data. No learner tracking. No disability data stored anywhere.
- No outbound network calls unless an optional cloud provider is explicitly enabled by config.
- Validate uploads (type, size limit), sanitise filenames, escape all user text in HTML.

### 6.3 Offline 3G pack

A `.zip` (and the same content cached by the service worker when the learner taps "Save for offline"):
- `index.html`: **light, self-contained** HTML (inline CSS, tiny inline JS, no external requests), high contrast, large text option, `lang` attributes correct.
- `lesson.opus`: audio-only at about 24 kbps (report the actual size per minute in README).
- Transcript in English and Amharic, with **read-along highlighting** synced to the audio (a small JSON timestamp map; each paragraph/cue highlights as the audio plays; clicking text seeks audio).
- Captions `.vtt` files and description text.
- Optional small video rendition only if the learner chooses it (default: audio + text only).
- Target: a 15-minute lesson pack under ~5 MB without video. Measure and report.
- Must work in Chrome on Android with airplane mode on.

### 6.4 Accessible documents

- **HTML:** semantic headings, `<figure>`/`<figcaption>`, image `alt` text, `lang` on every language change, transcript sections by chapter.
- **Images:** slide keyframes extracted by ffmpeg at chapter starts; **alt text written/edited by staff in Studio** (machine suggestions allowed only as editable drafts).
- **Tagged PDF:** WeasyPrint with the PDF/UA variant; embed Noto Sans Ethiopic; verify the PDF has tags, title, language and alt text.

### 6.5 Fidel Studio (staff page)

Simple, accessible web page (it must pass axe too):
1. Upload a lesson video, set title and spoken language.
2. Watch pipeline progress (accessible status updates via `aria-live="polite"`).
3. **Caption editor:** video on one side, list of cues on the other. Each cue: start/end time, English text, Amharic text (editable). Play a single cue. Keyboard shortcuts with visible buttons as alternatives. Save marks the file `reviewed` (per cue and whole file). Show count of cues still in draft.
4. Upload/attach EthSL video; preview sync.
5. Add/edit audio description cues (text) and generate Amharic description audio.
6. Edit image alt text for document keyframes.
7. Rebuild pack and documents; publish.

### 6.6 Mock Savanna page (until we get the real starter)

`demo/savanna-mock/index.html`: a simple lesson page styled loosely like ALX's learning platform (we'll replace with the real starter on Saturday). It embeds `<fidel-player>` with **one script tag**. This is also what we show judges for "install in one hour".

Keep all Savanna-specific glue in `integrations/savanna/` so it can be replaced cleanly.

### 6.7 Recorded live-session viewer (bonus)

`<fidel-session-viewer>`: plays a recorded Zoom session with captions, interactive transcript and **timestamped chat log** side by side (one column at 200% zoom / narrow screens). Chat entries are clickable to seek. Chat log does not announce every message while scrubbing (`aria-live="off"`), only during normal playback (`polite`, throttled).

**Demo content:** we have a real recording of the 10 November training session (MP4) and its Zoom caption file (`.cc.vtt`). Use these as test media (do not commit the large MP4 to git; reference it via `data/demo/`).

### 6.8 Career gateway

**Fidel Job Card** `<fidel-job-card job="https://HOST/api/v1/jobs/ID">`:
- Shows title, organisation, location/remote, closing date, how to apply, and **workplace accommodations offered** (clearly listed, e.g. "Sign language interpreter available", "Screen-reader compatible tools", "Flexible hours", "Step-free access").
- **"Listen to summary"** button: plays a pre-generated audio summary (Amharic and English) or falls back to browser speech for English. Visible text transcript of the summary.
- **Dates in both calendars:** Gregorian and Ethiopian, e.g. `15 Nov 2026 / ህዳር 6 2019`. Implement Ethiopian calendar conversion ourselves with unit tests. Known test pairs from the official site: 13 Nov 2026 = ህዳር 4 2019; 14 Nov 2026 = ህዳር 5 2019; 15 Nov 2026 = ህዳር 6 2019. Also test year boundaries (Ethiopian New Year, Meskerem 1, falls on 11 September, or 12 September in the year before a Gregorian leap year) and Pagume.
- Embeds valid **schema.org/JobPosting JSON-LD** (Level 3). Validate it.
- Works at **200% zoom** on a 360px screen with no horizontal scroll.

**Fidel Certificates** (keep simple):
- Staff issue a certificate: learner name (as the learner chooses), course, date, issuer. Stored in SQLite with a random, unguessable ID.
- Public page `/verify/{id}`: accessible, readable by screen readers, shows the details and "Verified by ALX Digital Bridge" (or "Not found / revoked"). Copy-link button. Also available as JSON.
- **Stretch only:** make it an Open Badges 3.0 credential with a signature.

---

## 7. Accessibility rules (apply to everything)

- Target **WCAG 2.2 AA**. Pay special attention to: 1.2.2 captions, 1.2.5 audio description, 1.4.3 contrast, 1.4.4 resize text, 1.4.10 reflow (320 CSS px), 1.4.11 non-text contrast, 2.1.1 keyboard, 2.1.2 no keyboard trap, 2.4.7 and 2.4.11 focus visible / not obscured, 2.5.7 dragging movements (always a non-drag alternative), 2.5.8 target size, 3.1.1/3.1.2 language of page/parts, 4.1.2 name-role-value, 4.1.3 status messages.
- Use native HTML elements first; ARIA only where needed.
- Every icon button has an accessible name. Every form field has a visible label.
- No information conveyed by colour or sound alone.
- Respect `prefers-reduced-motion`.
- Plain, short interface text in both English and Amharic.
- Never auto-play with sound.

---

## 8. Repository structure (suggested)

```
fidel/
├── CLAUDE.md                 # this brief
├── README.md                 # install in under an hour, embed snippets for all levels
├── LICENSES.md               # every dependency/model and its licence
├── CONFORMANCE.md            # WCAG 2.2 AA conformance report
├── docker-compose.yml
├── openapi.json
├── player/                   # <fidel-player>, <fidel-job-card>, <fidel-session-viewer>
│   ├── src/
│   ├── i18n/am.json
│   ├── patches/              # any Able Player patches, documented
│   └── vite.config.js
├── server/                   # FastAPI app
│   ├── app/
│   │   ├── api/
│   │   ├── pipeline/         # steps: extract, stt, translate, renditions, pack, docs, braille
│   │   ├── providers/        # pluggable STT / translation / TTS engines
│   │   ├── ethiopian_calendar.py
│   │   └── templates/        # pack HTML, document HTML, verify page
│   └── tests/
├── studio/                   # staff page
├── integrations/savanna/     # Savanna glue (mock now, real starter Saturday)
├── demo/savanna-mock/
├── e2e/                      # Playwright + axe tests
└── data/                     # runtime files (git-ignored)
```

---

## 9. Build phases (do them in order)

**Phase 1: Skeleton (tonight / Saturday morning)**
- Repo, Docker Compose with `server` service, FastAPI `/health`, Vite build of an empty `<fidel-player>`.
- Mock Savanna page embedding Able Player with the demo video and English captions.
- Playwright + axe test running against the mock page.
- ✅ Done when: `docker compose up` works from a clean clone; axe test runs; video plays with captions by keyboard.

**Phase 2: Core player (gate-critical)**
- `<fidel-player>` wrapper, Amharic interface strings, language switcher, caption styling panel, EthSL window with dock mode and button controls, interactive transcript with search and follow-along toggle, saved preferences.
- ✅ Done when: the main task works with keyboard only, at 200% zoom, at 360px width; axe shows 0 critical/serious.

**Phase 3: Pipeline**
- Upload → audio extract → English STT → Amharic translation draft → VTT files → renditions → lesson manifest API.
- Provider interface with local defaults and optional Addis AI.
- ✅ Done when: uploading the demo video produces English captions and an Amharic draft that play in the player.

**Phase 4: Studio + caption correction**
- Caption editor with draft/reviewed status, sign video upload, description editing.
- ✅ Done when: a staff member can fix Amharic cues and the player shows the corrected version without the draft notice.

**Phase 5: Offline pack + audio description**
- Pack builder, read-along HTML, service worker "Save for offline", Amharic description audio.
- ✅ Done when: the pack opens and plays in Android Chrome in airplane mode; measured sizes recorded.

**Phase 6: Career gateway**
- Job card with audio summary, Ethiopian calendar, JobPosting JSON-LD; certificate issue + verify page.
- ✅ Done when: both pass axe, work at 200% zoom on 360px, calendar tests pass.

**Phase 7: Documents + bonuses**
- Accessible HTML + tagged PDF; Braille export; session viewer with chat log.

**Phase 8: Hardening and submission**
- Full Playwright + axe suite green; manual NVDA and TalkBack checklists run; WCAG 2.2 AA conformance report; README tested by someone who didn't write it ("install in one hour"); `openapi.json` exported; licences listed.

If time runs short: Phases 1–6 are required for a strong submission. Phase 7 is bonus. Never leave a half-working feature visible; hide it behind a config flag instead.

---

## 10. README must include
1. What Fidel is (3 sentences) and who it's for.
2. Quick start: `docker compose up`, then open the demo page.
3. **Level 1** embed snippet. **Level 2** curl examples for the main endpoints. **Level 3** JobPosting JSON-LD example.
4. How to switch AI providers (local vs Addis AI), and how to run fully offline.
5. Model download instructions and hardware notes (CPU-only must work, just slower).
6. Measured numbers: bundle size, pack size per 15-minute lesson, processing time per minute of video on a normal laptop.
7. Privacy statement: what data is stored, what never leaves the host.
8. Credits: Able Player (MIT) and every model/library with licence; our team names; co-designer credit **only with their consent**.

---

## 11. Open questions to confirm at kick-off (don't block on these)
- Exact Savanna starter structure and how lessons/videos are currently embedded (the eHub welcome video appeared to be a YouTube embed).
- Branding rules (ALX logo/colours) and the open licence the code will be released under.
- Whether non-commercial-licensed models are acceptable at all.
- Whether interpreters on site can record a short EthSL clip for our demo lesson.
- Official rules on AI tool usage.

---

## 12. Co-design reminders (from the 10 Nov training)
- Involve the co-designer from the first idea; ask them to show how they normally do the task.
- Watch them use it; don't help; take notes; don't defend the design.
- Speak to the Deaf co-designer, not the interpreter; one person talks at a time; share new terms (e.g. "app", "login") with the interpreter in advance.
- Test → fix → test again **at least twice before the pitch**. Sunday afternoon is too late for the first test.
- Ask consent before using anyone's name, photo, voice or story in the pitch.
- "Nothing about us without us."
