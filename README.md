# Fidel (ፊደል)

Fidel makes every lesson readable, watchable, hearable and downloadable for every
Ethiopian learner. It is an open, embeddable accessible media module for
learning platforms such as ALX Savanna: a video player with English and Amharic
captions, a sign-language window, audio description, a searchable transcript and
offline lessons for 3G phones, plus a staff studio and an accessible job card
with verifiable certificates. It is built for Deaf and hard-of-hearing, blind and
low-vision learners, learners on cheap phones with slow connections, and learners
who read Amharic better than English. It runs free and offline by default, and a
human always checks the Amharic.

Built for the Digital Bridge Accessibility Hackathon 2026 (Track 2: accessible
learning media).

**Documents:** [WCAG 2.2 AA conformance report](CONFORMANCE.md) ·
[manual test checklists](docs/manual-testing.md) · [API (OpenAPI)](openapi.json) ·
[known issues and next steps](BACKLOG.md) · [licences](LICENSES.md)

## Quick start

Needs: [Docker](https://docs.docker.com/get-docker/) with Docker Compose.

```sh
git clone <this repository> fidel && cd fidel
cp .env.example .env          # then set FIDEL_STAFF_TOKEN in .env (any long random text)
docker compose up --build -d
```

Then open:

| Address | What |
|---|---|
| http://localhost:8000/ | Mock Savanna lesson page with the Fidel player |
| http://localhost:8000/demo/savanna-mock/jobs.html | Jobs page with Fidel job cards |
| http://localhost:8000/studio/ | Fidel Studio (staff), sign in with `FIDEL_STAFF_TOKEN` |
| http://localhost:8000/api/docs | Interactive API documentation |

### Fidel inside Savanna, and on a blank page

The hackathon's two proofs that Fidel plugs in:

```sh
sh scripts/setup-savanna.sh   # downloads ALX's Savanna starter pages, adds Fidel
```

| Address | Proof |
|---|---|
| http://localhost:8000/savanna/pages/concept-with-navigation.html | **Inside Savanna**: ALX's starter lesson page, unchanged except two lines in `<head>` and one `<fidel-player>` in the lesson body (`#curriculum_navigation_content .savanna-styles`) |
| http://localhost:8000/savanna/pages/jobs.html | Savanna-styled jobs page with `<fidel-job-card>` |
| http://localhost:8000/demo/blank.html | **Outside Savanna**: no Bootstrap, no Savanna CSS, only Fidel |

The starter is downloaded, not stored in this repository (it is ALX's).
Fidel resets the few host styles that would otherwise reach it (Bootstrap's
large floated `<legend>`, light-blue links) only inside its own elements.

The demo video is not in git (it is cut from a large recording), so on a fresh
install the mock page's player says the video could not be loaded. Upload any
lesson video in Studio instead (next section).

### Install in one hour: what takes time

| Step | Time |
|---|---|
| `docker compose up --build` (first time; downloads Python, Node, ffmpeg and libraries) | about 5–15 minutes, depending on the connection |
| Upload a video in Studio: web versions, low-data version and audio-only file | about 30 seconds for a 2.5-minute video |
| Optional: download the AI models for automatic captions (about 3.5 GB) | depends on your connection: 10 minutes on fast internet, much longer on slow |

Without the AI models everything works except automatic captions: those steps
show "model not downloaded" with the command to fix it. For a quick install,
use the small Whisper model and skip translation (see "Hardware and models").

## Process your own lessons (staff)

1. **Download the AI models once** (needs internet; after this Fidel runs fully offline):

   ```sh
   docker compose run --rm server python -m app.download_models
   ```

2. **Upload** a video in Studio (or with the API below). In the background Fidel:
   - makes web versions (720p MP4 and WebM), a 360p **low-data** version and a
     24 kbps **audio-only** file,
   - writes **English captions** with Whisper (speech-to-text),
   - writes **Amharic and Afaan Oromo drafts** with MADLAD-400 (machine
     translation). Machine translation is never final: it stays `draft` until a
     person checks it.
3. In Studio, open the lesson and:
   - **check the Amharic captions** next to the video: fix the text, tick
     "Amharic checked" (or press Ctrl+Enter for "Checked, go to next"), save.
     When every caption is checked, learners no longer see the "not yet
     reviewed" notice. Checked captions are never overwritten by the machine;
   - add **chapters** (English and Amharic titles), **audio description** text
     (with optional recordings, needed for Amharic), and the **sign-language video**;
   - **publish**. Unpublished lessons are visible to staff only.
4. Learners open it at `/demo/savanna-mock/lesson.html?id=LESSON_ID`, or on any
   site with `<fidel-player lesson="…">` (below).

## Level 1: add Fidel to any page with a script tag

```html
<link rel="stylesheet" href="https://YOUR-FIDEL-HOST/embed/v1/fidel.css">
<script src="https://YOUR-FIDEL-HOST/embed/v1/fidel.js" defer></script>

<!-- A lesson processed by Fidel: everything is filled in from the server -->
<fidel-player lesson="https://YOUR-FIDEL-HOST/api/v1/lessons/LESSON_ID"></fidel-player>

<!-- Or your own files, no Fidel server needed -->
<fidel-player src="lesson.mp4" captions-en="en.vtt" captions-am="am.vtt"
              captions-am-status="draft" chapters="chapters.vtt" sign="sign.webm"
              lang="en"></fidel-player>

<!-- A job card -->
<fidel-job-card job="https://YOUR-FIDEL-HOST/api/v1/jobs/JOB_ID" lang="en"></fidel-job-card>

<!-- A verified certificate (for a learner profile, job platform or employer site) -->
<fidel-certificate certificate="https://YOUR-FIDEL-HOST/api/v1/certificates/CERT_ID"></fidel-certificate>

<!-- A recorded live session with captions and its chat log side by side -->
<fidel-session-viewer src="session.mp4" captions-en="session.vtt"
                      chat="zoom-chat.txt" anonymize></fidel-session-viewer>
```

**What learners get**

- **Player** (built on [Able Player](https://github.com/ableplayer/ableplayer)):
  every control a real `<button>` with a name (Play, Back 10 seconds, Captions,
  Sign language, Transcript, Full screen…); keys while the player has focus
  (K or Space to play/pause, ← → to move 5 seconds) and a **Keyboard help**
  button that lists them; interface in English or **አማርኛ**;
  captions in English or Amharic, 100–250% size, four colour presets, background,
  position; a notice when Amharic captions are machine-made and not yet checked.
- **Sign-language window**: beside the video (the signer never covers the
  slides) or over it, three sizes, corner buttons: no dragging needed.
- **Transcript**: searchable in both languages ("Play from 1:33"), highlights the
  current line; "Follow along" scrolling switches off when a keyboard user enters it.
- **Audio description**: read by the browser or screen reader, or recordings made
  by staff (most phones have no Amharic voice).
- **Offline and data**: "Use less data" (360p video); download the lesson as one
  web page that works with **no internet** (audio, both transcripts with
  read-along, chapters, descriptions); a .zip pack; "Save for offline" on pages
  served by Fidel itself.
- **Job card**: employer, place, closing date in **both calendars**
  (`30 Nov 2026 / ህዳር 21 2019`), how to apply, **workplace accommodations**, a
  summary to read or **listen to**; adds schema.org/JobPosting to the page.
- **Certificates**: a public check page (`/verify/ID`) in English and Amharic:
  "Verified by ALX Digital Bridge", or revoked, or not found; copy link; JSON.
- **Lesson document**: the lesson to read, as an accessible web page and a
  **tagged PDF** (PDF/UA) with chapters as headings, the transcript, audio
  descriptions, and slide images described by staff (an image is included only
  once a person has described it). Also in **Braille** (`.brf`, 40 × 25 cells)
  for embossers and Braille displays: English in Unified English Braille grade 2,
  Amharic in Ethiopic Braille (liblouis `ethio-g1` table).
- **Recorded live sessions** (`<fidel-session-viewer>`): the recording with
  captions and transcript, and the **Zoom chat** beside it (one column on
  phones). Select a message to jump there; new messages are read aloud while it
  plays (never while jumping around); `anonymize` hides participants' names.
- **Certificate card** (`<fidel-certificate>`): shows "✓ Verified certificate"
  (or revoked) with name, course, date in both calendars, and a link to the
  official check page.
- Settings are remembered in the learner's own browser only.

**All `<fidel-player>` attributes**

| Attribute | Meaning |
|---|---|
| `lesson` | URL of a lesson on a Fidel server; fills in all the others. |
| `src`, `src-webm`, `src-small` | Video (MP4), optional WebM, optional small video for "Use less data". |
| `poster` | Image shown before playing. |
| `captions-en`, `captions-am`, `captions-om`, `captions-am-status`, `captions-om-status` | Captions in English, Amharic, Afaan Oromo (WebVTT); status `draft` shows the "not yet reviewed" notice. |
| `chapters-en` (or `chapters`), `chapters-am` | Chapter titles (WebVTT). |
| `descriptions-en` (or `descriptions`), `descriptions-am` | Audio description text (WebVTT). |
| `description-recordings` | JSON: recorded descriptions, e.g. `{"am":[{"start":12.5,"url":"d1.opus"}]}`. |
| `sign` | Sign-language video (WebM or MP4). |
| `offline-page`, `offline-page-video`, `offline-pack` | Offline downloads. |
| `lang` | Default interface language: `en` or `am`. |

`<fidel-job-card>`: `job` (URL), `lang` (`en`/`am`), `heading-level` (2–6).
`<fidel-certificate>`: `certificate` (URL), `lang`, `heading-level`.
`<fidel-session-viewer>`: the player's attributes plus `chat` (Zoom chat .txt),
`chat-offset` (Zoom chat times count from the meeting start; give how much later
the recording started, e.g. `19:05`), `anonymize`, `heading-level`.

**Events (settings in, events out).** Components tell the host page what
happens, so it can, for example, mark a lesson as done. Events bubble, carry no
personal data, and are listened to like any DOM event:

```js
document.addEventListener('fidel-ended', (e) => markLessonDone(e.target.id));
```

| Event | Sent by | `event.detail` |
|---|---|---|
| `fidel-ready` | player | `lang`, `captionLanguages`, `hasSignLanguage` |
| `fidel-ended` | player | `duration`: the lesson was watched to the end |
| `fidel-captions-change` | player | `lang` (`en`, `am` or `off`) |
| `fidel-language-change` | player | `lang`: interface language |
| `fidel-low-data-change` | player | `lowData` (true/false) |
| `fidel-offline-saved` | player | `url` of the saved lesson |
| `fidel-progress` | player | `seconds`, `percent` (at most every 5 seconds of playback) |
| `fidel-complete` | player | `{}` when watched to the end (same moment as `fidel-ended`) |
| `fidel-prefs` | player | the learner's display choices: `captionSize`, `captionColor`, `captionLanguage`, `signPosition`, `signSize`, `lowData`, `language` |
| `fidel-error` | player | `message` |
| `fidel-job-ready` | job card | `id`, `title` |
| `fidel-summary-play` | job card | `lang` |
| `fidel-certificate-ready` | certificate card | `status` (`valid`, `revoked`, `missing`) |
| `fidel-session-ready` | session viewer | `messages`: number of chat messages |

**Fitting your page.** Fidel uses your page's font. Its accent colour is the
CSS variable `--fidel-accent` (default `#0b4f9c`, 8:1 contrast on white); set it
to your brand colour if that has at least 4.5:1 contrast on white:
`fidel-player { --fidel-accent: #123f6d; }`. (We do not take Savanna's
`--bs-primary` automatically: its red `#db3e3e` is 4.4:1, just below the 4.5:1
that text needs.) Fidel's styles are scoped to its own elements and reset the
few host styles that would reach them (e.g. Bootstrap's `<legend>`).

**Globals.** Fidel adds only `window.Fidel` (its version), and Able Player
inside it sets `window.onYouTubeIframeAPIReady` (used only for YouTube videos).
It does not change the host's elements or `<body>` styles.

**Versions (we never break your page).** Load Fidel from `/embed/v1/`. Changes
to `v1` keep every attribute and event working; anything that would break a
page goes to a new `/embed/v2/`, and `v1` stays available. `/embed/` (no
version) always serves the latest, for testing only. `window.Fidel.version`
says which version a page has loaded.

## Level 2: REST API

Interactive docs at `/api/docs`; the spec is in [openapi.json](openapi.json)
(regenerate with `sh scripts/export-openapi.sh`). Read endpoints are public;
write endpoints need `Authorization: Bearer <FIDEL_STAFF_TOKEN>`.

```sh
# Upload a lesson (starts processing in the background)
curl -H "Authorization: Bearer $FIDEL_STAFF_TOKEN" \
     -F "video=@lesson.mp4" -F "title=Intro to HTML" -F "spoken_language=en" \
     http://localhost:8000/api/v1/lessons

# Follow progress of each step
curl http://localhost:8000/api/v1/lessons/LESSON_ID/status

# Lesson manifest: all file URLs and caption statuses (what the player reads).
# Unpublished lessons need the staff token.
curl -H "Authorization: Bearer $FIDEL_STAFF_TOKEN" http://localhost:8000/api/v1/lessons/LESSON_ID

# Captions as WebVTT, and the transcript as plain text
curl http://localhost:8000/api/v1/lessons/LESSON_ID/captions/am
curl "http://localhost:8000/api/v1/lessons/LESSON_ID/transcript?lang=am"

# Upload a caption file (replaces that language; marked draft until checked)
curl -H "Authorization: Bearer $FIDEL_STAFF_TOKEN" \
     -F "lang=am" -F "file=@captions-am.vtt" \
     http://localhost:8000/api/v1/lessons/LESSON_ID/captions

# Publish (learners can only see published lessons)
curl -X POST -H "Authorization: Bearer $FIDEL_STAFF_TOKEN" -H "Content-Type: application/json" \
     -d '{"published": true}' http://localhost:8000/api/v1/lessons/LESSON_ID/publish

# Lesson document: accessible web page, tagged PDF, Braille (published lessons)
curl http://localhost:8000/api/v1/lessons/LESSON_ID/document.html?lang=am
curl -OJ "http://localhost:8000/api/v1/lessons/LESSON_ID/document.pdf?lang=en"
curl -OJ "http://localhost:8000/api/v1/lessons/LESSON_ID/braille.brf?lang=en"

# Offline: one-page lesson, or the .zip pack (published lessons)
curl -OJ http://localhost:8000/api/v1/lessons/LESSON_ID/offline.html
curl -OJ http://localhost:8000/api/v1/lessons/LESSON_ID/pack

# Run steps again, e.g. after downloading a model
curl -X POST -H "Authorization: Bearer $FIDEL_STAFF_TOKEN" -H "Content-Type: application/json" \
     -d '{"steps": ["transcribe", "translate"]}' \
     http://localhost:8000/api/v1/lessons/LESSON_ID/rebuild

# Add a job (returns schema.org/JobPosting JSON-LD)
curl -X POST -H "Authorization: Bearer $FIDEL_STAFF_TOKEN" -H "Content-Type: application/json" \
     -d '{"title": "Junior Web Developer", "organization": "Example Tech PLC",
          "description": "Build accessible web pages.", "location": "Addis Ababa", "remote": true,
          "closing_date": "2026-11-30", "how_to_apply": "Send your CV by email.",
          "apply_email": "jobs@example.com",
          "accommodations": ["sign_language_interpreter", "screen_reader_tools"],
          "summary_en": "A full-time web developer job.", "summary_am": "የሙሉ ጊዜ የድር ገንቢ ሥራ።"}' \
     http://localhost:8000/api/v1/jobs

# Issue a certificate (the answer includes the verify_url to share)
curl -X POST -H "Authorization: Bearer $FIDEL_STAFF_TOKEN" -H "Content-Type: application/json" \
     -d '{"learner_name": "Selam Tesfaye", "course": "Software Engineering"}' \
     http://localhost:8000/api/v1/certificates
```

## Level 3: schema.org/JobPosting

`GET /api/v1/jobs/JOB_ID` returns standard JSON-LD that job boards and search
engines read (and `<fidel-job-card>` adds it to the page), for example:

```json
{
  "@context": ["https://schema.org", {"fidel": "https://YOUR-FIDEL-HOST/api/v1/ns#"}],
  "@type": "JobPosting",
  "title": "Junior Web Developer",
  "description": "Build accessible web pages with our team.",
  "datePosted": "2026-11-14",
  "validThrough": "2026-11-30T23:59:59+03:00",
  "employmentType": "FULL_TIME",
  "hiringOrganization": {"@type": "Organization", "name": "Example Tech PLC"},
  "jobLocation": {"@type": "Place", "address": {"@type": "PostalAddress",
                  "addressLocality": "Addis Ababa", "addressCountry": "ET"}},
  "jobLocationType": "TELECOMMUTE",
  "applicantLocationRequirements": {"@type": "Country", "name": "Ethiopia"},
  "applicationContact": {"@type": "ContactPoint", "email": "jobs@example.com"},
  "jobBenefits": "Workplace accommodations: Sign language interpreter available; Screen-reader compatible tools.",
  "fidel:accommodations": ["sign_language_interpreter", "screen_reader_tools"]
}
```

schema.org has no property for workplace accommodations, so they are written in
`jobBenefits` and, as keys, in the small `fidel:` extension.

## AI engines and running fully offline

All AI runs **on the Fidel server**. No lesson, learner or staff data is sent to
any other service. Engines are chosen in `.env`, never by changing code:

| Setting | Values | Default |
|---|---|---|
| `FIDEL_STT_PROVIDER` | `local_whisper`, `none` | `local_whisper` |
| `FIDEL_WHISPER_MODEL` | `tiny`, `base`, `small`, `medium` | `small` |
| `FIDEL_TRANSLATOR` | `local_madlad`, `none` | `local_madlad` |
| `FIDEL_TRANSLATE_TO` | caption languages to translate into: `am` (Amharic), `om` (Afaan Oromo) | `am,om` |

`none` switches a step off (shown as "skipped" in Studio). After
`python -m app.download_models`, Fidel needs no internet at all: fonts, player
and models are all served from the Fidel server.

Not available yet: a cloud translation option (Addis AI) and speech-to-text for
lessons **spoken** in Amharic (see [BACKLOG.md](BACKLOG.md)).

## Hardware and models

- **CPU only works.** Measured on a laptop (Intel i5-12500H, 16 GB RAM): about
  30 seconds of processing per minute of video with Whisper `small` + MADLAD.
- **Memory**: MADLAD needs about 4 GB of RAM while translating; give Docker at
  least 8 GB. **Disk**: about 4 GB for models, plus lesson files.
- **Quick or small setups**: `FIDEL_WHISPER_MODEL=base` (145 MB download) and
  `FIDEL_TRANSLATOR=none` (staff write or paste the Amharic in Studio).

| Model | Licence | Size | Used for |
|---|---|---|---|
| Whisper small (`Systran/faster-whisper-small`) | MIT | ~0.5 GB | English captions |
| MADLAD-400 3B, int8 (`Nextcloud-AI/madlad400-3b-mt-ct2-int8`) | Apache-2.0 | ~3 GB | Amharic caption draft |

Machine translation is a draft: in our tests MADLAD often got key words wrong
in both Amharic and Afaan Oromo (for example "disability" became "street people"
in Amharic and "people with a disease" in Afaan Oromo), so every translated
caption is reviewed by a person before it counts as final.

## Measured numbers

| What | Value |
|---|---|
| `fidel.js` (Able Player + jQuery + DOMPurify + Fidel), gzipped | 158 KB (Fidel's own code: about 17 KB) |
| `fidel.css`, gzipped | 6.5 KB |
| Ethiopic font (2 weights, loaded only when Amharic text is shown) | 2 × 75 KB |
| Audio-only lesson (Opus 24 kbps) | 187 KB per minute (2.8 MB per 15 minutes) |
| Offline one-page lesson (audio + text + font) | 778 KB for 2 min 39 s, about **3.9 MB per 15 minutes** |
| Offline .zip pack | about 3.3 MB per 15 minutes |
| Processing, CPU only, Whisper small + MADLAD | about 30 s per minute of video |

## Privacy

- **Stored**: lesson videos and their files; caption, chapter and description
  text; jobs; certificates (the name as the learner wants it written, course,
  date, issuer). In SQLite and files under `data/` on your server.
- **Never stored**: anything about learners' disabilities, learner accounts,
  tracking or analytics. The player keeps settings (caption size, language…) only
  in the learner's own browser.
- **Nothing leaves your server**: all AI runs locally; fonts and scripts are
  self-hosted; no third-party requests. The only outgoing traffic is the
  one-time model download, run by staff.
- Certificate pages are marked `noindex`; certificate links are random and
  cannot be guessed. Staff actions need the staff token.

## Development

| Folder | What | Commands |
|---|---|---|
| `player/` | `<fidel-player>`, `<fidel-job-card>` (Able Player + our code), Vite build | `npm install`, `npm run build`, `npm test` |
| `server/` | FastAPI server, pipeline, AI providers | `docker compose run --rm server pytest` |
| `studio/` | Fidel Studio (staff page): plain HTML + JS, no build step | |
| `e2e/` | Browser tests: Playwright + axe-core | `npm install`, `npx playwright install chromium`, `npm test` |
| `demo/` | Mock Savanna pages and demo captions | |
| `scripts/` | Demo clip, caption cutting, OpenAPI export | |
| `tools/translation-eval/` | One-off test of English → Amharic machine translation | `sh tools/translation-eval/run.sh` |

The e2e tests use a running server at `http://localhost:8000` (set
`FIDEL_BASE_URL` for another) and the staff token from `.env`. Change the port
with `FIDEL_PORT` in `.env`.

Demo media: with the original recordings in `assets/`, `sh scripts/make-demo-clip.sh`
makes `data/demo/lesson.*`, and `sh scripts/make-demo-session.sh` makes the
recorded session for `/demo/savanna-mock/session.html`. It also makes `data/demo/sign.webm`, a
**colour-bar test pattern, not real signing**, used only to build and test the
sign-language window.

## Credits

- [Able Player](https://github.com/ableplayer/ableplayer) (MIT), the accessible
  media player Fidel is built on, and every library and model in
  [LICENSES.md](LICENSES.md).
- Built by our team for the Digital Bridge Accessibility Hackathon 2026
  (ALX Ethiopia, with AAAPD and Tomorrow is Better, under the LIWAY programme
  with SNV and Mercy Corps). Team: *(names to be added)*.
- Our co-designer: credited here only with their consent.

## Licence

MIT. See [LICENSE](LICENSE).
