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

**Landing page:** `/` is Fidel's landing page (`/demo/`, in English and
Amharic): what Fidel does, who it is for, links to every demo, and how to add
it to your site. Plain HTML and one small CSS file, no player loaded.

| Address | What |
|---|---|
| http://localhost:8000/ | Landing page (redirects to `/demo/`), with links to every demo |
| http://localhost:8000/demo/savanna-mock/ | Mock Savanna lesson page with the Fidel player |
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

### Savanna rebuilt with Fidel (`/demo/savanna-rebuild/`)

A demo, **not ALX's product**: Team GNU's own pages, written from scratch
(plain HTML, one CSS file, small scripts; no Bootstrap, no ALX code, logo or
images), with Fidel built in. Every page says so in a visible note. The
learner (Selam) and all course data are made up.

| Page | What it rebuilds |
|---|---|
| http://localhost:8000/demo/savanna-rebuild/lesson.html | The lesson page: course contents (done / in progress / not started in words, `aria-current="page"`) beside the lesson, a `<fidel-player>` with English and Amharic captions, chapters and sign language, and `<fidel-lesson-formats>`, `<fidel-lesson-map>`, `<fidel-question>`, `<fidel-callout>`, `<fidel-notes>`, `<fidel-quiz>`, `<fidel-mark-complete manual>`, `<fidel-step-nav>`, `<fidel-display-prefs>`. Lessons 1-3, 5 and 6 (`?n=`) are short reading lessons. |
| http://localhost:8000/demo/savanna-rebuild/index.html | The paced homepage: course switcher, week strip, "continue where you left off", deliverables (`<progress>` + text), score (`<meter>` + text), `<fidel-event-card>`s, `<fidel-offline-status>`. |
| http://localhost:8000/demo/savanna-rebuild/self-paced.html | The self-paced homepage: progress gauge (`<meter>`, "16% of 70% needed to graduate"), module switcher, activities, programme details in a `<dialog>`. |
| http://localhost:8000/demo/savanna-rebuild/jobs.html | Jobs: one `<fidel-job-card>` per open job from `/api/v1/jobs`, or a sentence when there are none; today's date with `<fidel-ethiopian-date>`. |

Savanna defects fixed by design (Team Technical Guide, section 2):

- The menu and the course switcher are real `<button>`s (`aria-expanded`), not
  `<div>`s with click handlers; the week strip and the module switcher are
  buttons with `aria-pressed` that wrap instead of scrolling sideways.
- A "Skip to main content" link is the first Tab stop on every page and lands
  on the page's `<h1>` (not on `<main>`, which Narrator reads out whole).
- No file names as text alternatives; the only image is the Fidel logo, `alt="Fidel"`.
- Headings in order and landmarks: banner, `<nav aria-label="Main">` with
  `aria-current="page"`, main, the course contents as an `<aside>`, contentinfo.
- No fixed or sticky bars, so nothing covers the focused element (WCAG 2.4.11).
- Visible 3 px focus, 44 px targets, `rem` units, no sideways scrolling at
  320 px / 400 % zoom, `prefers-reduced-motion` and `forced-colors` respected.
- An English / አማርኛ switch for the page around the lesson (buttons with
  `aria-pressed`, remembered); Amharic text has `lang="am"`, Noto Sans Ethiopic
  and taller lines. Lesson content stays in English. "Get help" (`<fidel-help>`)
  is in the same place on every page.

Tests: `e2e/tests/savanna-rebuild.spec.js` (axe at 100/200/400 % and in
Amharic, Tab never stuck, the main task by keyboard, the widgets, the jobs page).

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

**Two files, still one script tag.** `fidel.js` holds the player, job card,
session viewer and certificate. The other component tags (`<fidel-quiz>`,
`<fidel-input>`, … see "More components") are in `fidel-components.js` and
`fidel-components.css`, and `fidel.js` loads them **by itself, only when the
page uses one of those tags**. A lesson page with only a player downloads
159 KB instead of 226 KB (gzipped). A page that creates component tags from
its own script before they are needed (like Studio) can load the second file
directly:

```html
<link rel="stylesheet" href="https://YOUR-FIDEL-HOST/embed/v1/fidel-components.css">
<script src="https://YOUR-FIDEL-HOST/embed/v1/fidel-components.js" defer></script>
```

**Without a Fidel server: from GitHub through a CDN.** Pushing a version tag
(`git tag v1.0.0 && git push origin v1.0.0`) runs
`.github/workflows/release-player.yml`: it builds and tests the player, makes a
GitHub release with the files attached, and publishes them on the `cdn` branch
so the free jsDelivr CDN serves a fixed version:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/y0hannesHK/fidel-alx-hackathon@v1.0.0-cdn/fidel.css">
<script src="https://cdn.jsdelivr.net/gh/y0hannesHK/fidel-alx-hackathon@v1.0.0-cdn/fidel.js" defer></script>
```

The player alone works this way with your own files (`src=`, `captions-en=` …);
lessons, jobs and certificates still need a Fidel server for their data.

**Why not copy the components into your project (like shadcn)?** You can:
each component is one folder (`player/src/components/<package>/`, its
`components.css` and `player/i18n/components-<package>.*.json`). But a copy
does not receive our accessibility fixes, and small edits can break them
(a label, a focus rule). For learners, using the hosted files is safer.

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
| `descriptions-en` (or `descriptions`), `descriptions-am`, `descriptions-om` | Audio description text (WebVTT). |
| `description-recordings` | JSON: recorded descriptions, e.g. `{"am":[{"start":12.5,"url":"d1.opus"}]}`. |
| `sign` | Sign-language video (WebM or MP4). |
| `sign-provider="kozha-bsl"`, `kozha-origin` | Experimental British Sign Language avatar for the English captions, instead of a sign video (see "Optional British Sign Language avatar"). `kozha-origin` is the address of the `kozha` service, e.g. `http://localhost:8001`. |
| `sign-visible` | `true`: show the sign window as soon as the player is ready. |
| `sign-full`, `sign-full-timing` | A second sign video that signs every word on its own, longer timeline, and its timing JSON (`{"cues":[{"start","next","signStart","signEnd"}]}`). Adds the setting "Wait for the signer": the lesson pauses after each caption until the signer finishes. |
| `offline-page`, `offline-page-video`, `offline-pack` | Offline downloads. |
| `offline-page-size`, `offline-page-video-size`, `offline-pack-size` | Sizes in bytes, shown on the download buttons (filled in from the lesson). |
| `document-html-en`, `document-html-am`, `document-pdf-en`, `document-pdf-am`, `document-brf-en`, `document-brf-am` | The lesson document as a web page, tagged PDF and Braille (filled in from the lesson). |
| `lang` | Default interface language: `en` or `am`. |

`<fidel-job-card>`: `job` (URL), `lang` (`en`/`am`), `heading-level` (2–6, default 3).
`<fidel-certificate>`: `certificate` (URL), `lang`, `heading-level` (2–6, default 3).
`<fidel-session-viewer>`: the player's attributes plus `chat` (Zoom chat .txt),
`chat-offset` (Zoom chat times count from the meeting start; give how much later
the recording started, e.g. `19:05`), `anonymize`, `heading-level` (2–6, default 3).

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

### More components

Live examples of every component: [`demo/components.html`](demo/components.html).
The full reference, one page per tag with a live example, code to copy,
attributes, events and accessibility notes, is at `/demo/docs/`
([`demo/docs/`](demo/docs/)). It is generated from `demo/docs/components.mjs`:
after changing a component's attributes or events, update that file and run
`node scripts/build-docs.mjs`, then commit the generated HTML.

<!-- PACKAGE A START -->
#### Reading and understanding (Package A)

Every tag below also takes `ui-lang="en|am"` (default: the page's `lang`, else
English). Text is in `player/i18n/components-a.en.json` and `.am.json`.

**`<fidel-code-block>`**: code that a screen reader and a Braille display can
read. The code stays real text; Copy, Read line by line ("Line 2 of 3, indent 4
spaces: print open bracket i close bracket"), Symbols as words on/off, and
"Play from 1:23" when a player is on the page.

```html
<fidel-code-block language="python" label="Example: a loop" at="1:23" for="lesson-player">
<pre><code>for i in range(3):
    print(i)</code></pre>
</fidel-code-block>
```

| Attribute | Meaning |
|---|---|
| `label` | Visible name of the code (default: "*language* code"). |
| `language` | Programming language, e.g. `python`, `html`. |
| `at` | Time in the video (`m:ss`): shows "From the video at 1:23" and a "Play from" button. |
| `for` | Id of the `<fidel-player>` (or `<video>`) to play; default: the first `<fidel-player>`. |
| `symbols` | `off` to start with symbols shown as symbols in the line view (default: words). |

Events: `fidel-code-block-copy` `{}`, `fidel-code-block-play` `{ seconds }`.

**`<fidel-code-snapshots>`**: code in sync with a coding video. Lists
`<fidel-code-block at="…">` in time order; while the video plays, the current
one shows "Now" and is announced once ("Code for 1:23 is ready"), never while
the learner seeks.

```html
<fidel-code-snapshots for="lesson-player">
  <fidel-code-block at="0:45" language="html" label="Step 1">…</fidel-code-block>
  <fidel-code-block at="1:23" language="html" label="Step 2">…</fidel-code-block>
</fidel-code-snapshots>
```

| Attribute | Meaning |
|---|---|
| `for` | Id of the player to follow; default: the first `<fidel-player>`. |

Events: `fidel-code-snapshots-change` `{ index, seconds }`.

**`<fidel-described-image>`**: a diagram with a real description: `<figure>`,
`<img alt>` (lazy-loaded), `<figcaption>`, and a "Full description" `<details>`.

```html
<fidel-described-image src="request-flow.png" alt="How a web request travels"
                       long-description-id="flow-desc"></fidel-described-image>
<div id="flow-desc" hidden><p>The browser sends a request to the server…</p></div>
```

| Attribute | Meaning |
|---|---|
| `src`, `alt` | The image and its short text alternative (required; missing alt gives a console warning). |
| `caption` | Visible caption (default: the alt text). |
| `long-description-id` | Id of an element (usually `hidden`) whose content is the full description. |
| `description` | Or: the full description as plain text. |
| `width`, `height` | Image size (avoids the page jumping while it loads). |
| `show-warnings` | Show a visible "no alt text" warning (for demo and authoring pages). |

**`<fidel-word>`**: tap a hard word for its meaning. The word becomes a button
that opens a small dialog: the term, a plain English meaning, the Amharic
meaning, and Listen buttons only if the device has a voice. Escape closes and
returns to the word.

```html
<p>We use <fidel-word term="server" meaning-en="A computer that stores websites…"
   meaning-am="ድረ-ገጾችን የሚያስቀምጥ…">server</fidel-word> software.</p>
```

| Attribute | Meaning |
|---|---|
| `term` | The word to explain (default: the text inside). |
| `meaning-en`, `meaning-am` | The meanings (main way: works with no server). |
| `glossary` | Optional URL of a glossary in the `/api/v1/glossary` format (`{ terms: [{ en, am, note }] }`), used only for missing meanings. That endpoint needs the staff token, so learner pages should use the attributes. |

Events: `fidel-word-open` `{ term }`.

**`<fidel-read-aloud>`**: a Listen / Stop button for a paragraph. Uses the
device's voice for the text's language ("Computer voice" is shown), else the
recording in `audio`, else no button (it says listening is not available). The
sentence being read is highlighted and underlined. Escape stops. Nothing speaks
until the learner presses Listen.

```html
<fidel-read-aloud lang="am" audio="/media/summary-am.mp3"><p lang="am">…</p></fidel-read-aloud>
```

| Attribute | Meaning |
|---|---|
| `lang` | Language of the text (default: the content's `lang`, else the page's). |
| `audio` | A recording to play when the device has no voice for that language (loaded only on Listen). |

Events: `fidel-read-aloud-start` `{ lang, voice: "computer" \| "recorded" }`, `fidel-read-aloud-stop` `{}`.

**`<fidel-steps>`**: instructions one step at a time: "Step 2 of 5", Previous
/ Next, "I did this step", and "Show all steps". Focus moves to the step's
heading on each change. Progress is remembered in this browser. Without
JavaScript, the plain list shows.

```html
<fidel-steps label="Install VS Code">
  <ol><li>Open the website…</li><li>Download…</li><li>Run the installer…</li></ol>
</fidel-steps>
```

| Attribute | Meaning |
|---|---|
| `label` | Title of the instructions; also the key under which progress is remembered. |
| `heading-level` | Level of the title heading (2–5, default 3); each step's heading is one level lower. |

Events: `fidel-steps-change` `{ step, total, done }`.

**`<fidel-simple-mode>`**: a "Simple words" switch between the full text and a
simpler, hand-written version. The choice is remembered (shared preference
`simpleWords`) and every copy on the page follows it.

```html
<fidel-simple-mode>
  <div data-version="full">…original lesson text…</div>
  <div data-version="simple">…short sentences, one idea each…</div>
</fidel-simple-mode>
```

Events: `fidel-simple-mode-change` `{ simple }`.
<!-- PACKAGE A END -->

<!-- PACKAGE B START -->
#### Data, offline, dates and language (Package B)

For learners on cheap phones and expensive data. Every component has
`ui-lang="en|am"` (default: the page's `lang`, else English); its text is in
`player/i18n/components-b.en.json` and `.am.json`.

**`<fidel-data-saver>`**: shows the size before anything downloads, with a
choice of the full video or a smaller version.

```html
<fidel-data-saver href="/files/lessons/ID/video.mp4" size="45000000"
                  alt-href="/api/v1/lessons/ID/offline.html" alt-size="3100000"
                  alt-label="audio and text version"></fidel-data-saver>
```

| Attribute | Meaning |
|---|---|
| `href` | The big file. A video or audio file plays in place after "Load it"; any other file is a link. |
| `size` | Its size in bytes. If missing, asked from the server with `HEAD` (`Content-Length`); else "Size unknown". |
| `alt-href`, `alt-size`, `alt-label` | The smaller version (a link), its size, and what it is. |
| `captions`, `captions-lang`, `captions-label` | Optional WebVTT captions for the video. |

If the phone asks to save data (`navigator.connection.saveData`), the smaller
version comes first and the component says why. Event:
`fidel-data-saver-choice` `{ choice: "full" | "light" }`.

**`<fidel-offline-status>`**: one always-visible line, "Online." or "You are
offline. 3 lessons are saved on this phone.", and a "Saved lessons" list. It
counts the same cache as the player's "Save for offline"
(`fidel-saved-lessons-v1`). Screen readers hear it only when the connection
changes. Event: `fidel-offline-status-change` `{ online }`.

**`<fidel-download-later>`**: "Download when I'm online". The lesson waits in a
queue (localStorage `fidel-download-queue`) and downloads into the same cache
as soon as the phone is online, then says "Lesson 3 is ready offline".
"Only on Wi-Fi" is offered only where the browser can tell (Android Chrome).

```html
<fidel-download-later href="/api/v1/lessons/ID/offline.html" label="Lesson 3" size="3100000"></fidel-download-later>
```

| Attribute | Meaning |
|---|---|
| `href` | What to download. One-page lessons (`/api/v1/lessons/ID/offline.html`) are saved through the service worker, so they open with no internet; other same-site files go into the cache directly. |
| `label` | Its name, shown and announced. |
| `size` | Bytes, shown on the button. |

Event: `fidel-download-ready` `{ href, label }`.

**`<fidel-ethiopian-date>`**: a date in both calendars inside a real `<time>`.

```html
<fidel-ethiopian-date datetime="2026-11-15" ui-lang="am" format="short"></fidel-ethiopian-date>
```

| Attribute | Meaning |
|---|---|
| `datetime` | `YYYY-MM-DD`. |
| `format` | `short`: `15 Nov 2026 / ህዳር 6 2019`. `long`: `Sunday 15 November 2026 / እሑድ ህዳር 6 2019 ዓ.ም.` |
| `ui-lang` | `en`: Gregorian first. `am`: Ethiopian first. |

Uses the browser's Ethiopic calendar (`Intl`) when it has one, otherwise
`player/src/ethiopian-calendar.js`; unit tests check both against known dates.

**`<fidel-lang>`**: switch language for one section, not the whole page.

```html
<fidel-lang label="Lesson summary">
  <div lang="en">…</div>
  <div lang="am">…</div>
  <div lang="om">…</div>
</fidel-lang>
```

One button per version, in that language's own name (English, አማርኛ, Afaan
Oromoo, ትግርኛ, Soomaali, العربية); the current one has `aria-current="true"`.
The choice is remembered (prefs key `sectionLanguage`); Arabic gets
`dir="rtl"`. Attribute: `label`. Event: `fidel-lang-change` `{ lang }`.

**`<fidel-display-prefs>`**: a "Display settings" dialog: text size
(100/125/150/200 %), line spacing, colours (high contrast, yellow on black),
stop motion, thicker focus outline.

```html
<fidel-display-prefs target="#lesson"></fidel-display-prefs>
```

| Attribute | Meaning |
|---|---|
| `target` | CSS selector of the content to adjust. The settings are `fidel-dp-*` classes on those elements and on the Fidel components of the page; never on `<html>` or `<body>`. |

Remembered in localStorage (`fidel-display-prefs`). It is not an overlay: it
does not try to repair the host page, only changes how accessible content is
shown. Text size scales text sized in `em`/`%` (text sized in `px` or `rem`
inside the target does not grow). Event: `fidel-display-prefs-change`.
<!-- PACKAGE B END -->

<!-- PACKAGE C START -->
#### Deaf learners, motor access, navigation and help

Every Package C tag takes `ui-lang="en|am"` (default: the page's `lang`, else
English). Its text is in `player/i18n/components-c.en.json` and `.am.json`. Settings
the learner chooses are kept in `localStorage` under `fidel-components-c`.

**`<fidel-sign-term>`**: a tech word with its sign. The word becomes a button
that opens a dialog with the term, a muted looping video of the sign (downloaded
only when the dialog opens), Play/Pause and Slower (0.5×) buttons, and the meaning in English and
Amharic. If there is no clip, or the clip fails to load, the dialog says "No sign recorded yet for this word".

```html
<fidel-sign-term term="login" sign="/media/signs/login.webm" poster="/media/signs/login.jpg"
                 meaning-en="Entering your name and password to open your account."
                 meaning-am="ስምዎንና የይለፍ ቃልዎን አስገብተው መለያዎን መክፈት።">login</fidel-sign-term>
```

| Attribute / event | Meaning |
|---|---|
| `term` | the word (default: the text inside) |
| `sign`, `poster` | sign-language clip (WebM/MP4) and its still picture |
| `meaning-en`, `meaning-am` | plain-language meaning |
| `sign-placeholder` | the clip is a stand-in: the dialog says "Placeholder clip" |
| `glossary` | URL of `{ terms: [{ en, sign, meaning_en, meaning_am }] }`; attributes win |
| `fidel-sign-term-open` | `{ term }` when the dialog opens |

**`<fidel-visual-alert>`**: sounds you can see. Call `notify(text)`, or send a
`fidel-visual-alert` event on `document` with `detail.message`, to show a banner
(icon + text). The banner stays until the learner closes it, or closes after 15 s if the learner
chose that in "Alert settings". The learner can turn on vibration. The banner never
flashes, and screen readers read it politely. Put it near the top of the page.

```html
<fidel-visual-alert id="alerts"></fidel-visual-alert>
<script>document.getElementById('alerts').notify('Your lesson finished downloading');</script>
```

| Attribute / method / event | Meaning |
|---|---|
| `notify(message)` | show a message |
| `fidel-visual-alert` (listened for on `document`) | `{ message }`: any script or component can raise an alert |
| `fidel-visual-alert-shown` | `{ message }` when a banner appears |

**`<fidel-step-nav>`**: big Previous / Next links at the end of a lesson,
inside `<nav aria-label="Lesson">`, with "Lesson 3 of 8". The links are at least 48 px tall and full width on phones.
They sit in the page flow and are never sticky.

```html
<fidel-step-nav prev-href="lesson-2.html" prev-label="Lesson 2: Forms"
                next-href="lesson-4.html" next-label="Lesson 4: Tables"
                position="3" total="8"></fidel-step-nav>
```

| Attribute / event | Meaning |
|---|---|
| `prev-href`, `prev-label`, `next-href`, `next-label` | the links (a missing href = no link) |
| `position`, `total` | "Lesson 3 of 8" |
| `label` | name of the landmark (default "Lesson") |
| `fidel-step-nav-go` | `{ direction: "previous" \| "next" }` |

**`<fidel-session-keeper>`**: never lose work to a time-out (WCAG 2.2.1).
Before your time-out a dialog asks "Do you need more time?" with "Yes, more
time" focused. The learner has at least 20 s to answer and can extend at least 10 times. The learner
can also tick "Never time me out"; your page receives that choice as an event and decides what to do.

```html
<fidel-session-keeper timeout="1800" warn-before="120" extend-url="/api/v1/session/extend"></fidel-session-keeper>
```

| Attribute / method / event | Meaning |
|---|---|
| `timeout`, `warn-before` | seconds (defaults 1800 and 120; warning at least 20 s) |
| `extend-url` | POSTed to (same-origin cookies) when the learner asks for more time |
| `max-extend` | how many extensions (default 20, never below 10) |
| `off` | no time limit on this page |
| `manual` | the timer starts only when you call `start()` |
| `start()`, `stop()` | `start()` (re)starts the timer, e.g. when your own session is renewed; `stop()` stops it |
| `fidel-session-warning` | the dialog opened |
| `fidel-session-extend` | `{ count }`: extend your session now |
| `fidel-session-decline` | the learner pressed "No" |
| `fidel-session-timeout` | time ran out |
| `fidel-session-no-timeout` | `{ never: true \| false }`: the learner's "Never time me out" choice |

**`<fidel-lesson-map>`**: where am I, and jump anywhere. A
`<nav aria-label="This lesson">` with jump links only to the parts that exist on the page
(Video, Transcript, Notes, Code, Next lesson) and chapter buttons ("Play from 0:59
…"). It also shows "You have watched 40%" (`<progress>` + text); this is read out only when
the learner presses "Where am I?".

```html
<fidel-lesson-map for="lesson-player" chapters="chapters.vtt"></fidel-lesson-map>
```

| Attribute / event | Meaning |
|---|---|
| `for` | id of the `<fidel-player>` (default: the first player with an id) |
| `chapters` | WebVTT chapters (default: the player's `chapters` / `chapters-am`) |
| `notes-id`, `code-id` | ids of the notes and code parts (default `notes`, `code`) |
| `next-href`, `next-label` | next lesson (default: from a `<fidel-step-nav>` on the page) |
| `fidel-lesson-map-play` | `{ seconds }` when a chapter button is used |

**`<fidel-help>`**: help in the same place, in every form (WCAG 3.2.6). A
"Get help" button opens a dialog that lists only the routes you configure, text first:
Text chat, Email, Video call with a sign-language interpreter, Phone (voice
call). **Put it in the same spot on every page.**

```html
<fidel-help chat-url="https://t.me/example_help" email="help@example.org"
            video-call-url="https://meet.example.org/interpreter" phone="+251 11 000 0000"
            hours="Monday to Friday, 8:30 to 17:00"></fidel-help>
```

| Attribute / event | Meaning |
|---|---|
| `chat-url`, `email`, `video-call-url`, `phone` | the routes (at least one; none = nothing shown) |
| `hours` | working hours, shown in the dialog |
| `fidel-help-open` | the dialog opened |
| `fidel-help-choose` | `{ route: "chat" \| "email" \| "video" \| "phone" }` |
<!-- PACKAGE C END -->

<!-- PACKAGE D START -->
#### Package D: report a caption problem

Learners tell staff when a caption is wrong. The report arrives in Studio, on
the lesson's page, under "Caption reports".

```html
<fidel-player id="lesson-player" lesson="https://FIDEL-HOST/api/v1/lessons/ID"></fidel-player>
<fidel-caption-report for="lesson-player" ui-lang="am"></fidel-caption-report>
```

| Attribute | Meaning |
|---|---|
| `for` | id of the `<fidel-player>` (default: the first one on the page) |
| `api` | API address (default: taken from the player's `lesson` URL, else `/api/v1`) |
| `lesson` | lesson id (default: taken from the player's `lesson` URL) |
| `ui-lang` | `en` or `am` |

- The dialog already holds the current time, the caption language and the
  caption shown at that moment. The learner picks what is wrong (wrong words,
  wrong time, missing caption, missing sound description, other) and may type
  a correction. No name, no account.
- The video pauses while the dialog is open and plays on afterwards.
- **Offline:** the report is kept on the phone and sent when the phone is back
  online.
- Event: `fidel-caption-report-sent` `{ lessonId, time, lang }`.

REST API (Level 2):

```bash
# A learner's report (public; lesson must be published). 201 {"id": ...}
curl -X POST https://FIDEL-HOST/api/v1/lessons/ID/caption-reports \
  -H "Content-Type: application/json" \
  -d '{"time": 12.5, "lang": "am", "kind": "wrong_words", "correction": "..."}'
# Staff: open reports, then mark one resolved or dismissed
curl -H "Authorization: Bearer $TOKEN" "https://FIDEL-HOST/api/v1/lessons/ID/caption-reports?status=open"
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status": "resolved"}' https://FIDEL-HOST/api/v1/caption-reports/REPORT_ID
```

`kind` is one of `wrong_words`, `wrong_time`, `missing_caption`,
`missing_sound`, `other`. Bad input gets a 400 with the reason in words. Abuse
limit: 20 reports per IP address per hour (`FIDEL_CAPTION_REPORTS_PER_HOUR`),
counted in the server's memory, so it resets when the server restarts. Each
report also sends the webhook event `caption.reported`.

#### Package D: sound-off check (Studio)

On a lesson's Studio page, "Sound-off check" counts the captions with a sound
description in square brackets (`[music]`, `[door closes]`) per language and
lists every silent gap longer than 3 seconds. "Add a sound caption here" saves
a new caption in every caption language through the normal caption API
(`PUT /api/v1/lessons/{id}/captions/{lang}`), with English and Amharic choices
(`[music]` / `[ሙዚቃ]`, `[laughter]` / `[ሳቅ]`, ...) or your own words; other
languages get the English words as a draft for a translator. A "Sound-off
check done" box per lesson shows on the lesson list. It warns, never blocks
publishing, and is remembered in that browser only.

#### Package D: Amharic keyboard

```html
<label for="answer">Your answer</label>
<textarea id="answer" lang="am"></textarea>
<fidel-amharic-keyboard for="answer"></fidel-amharic-keyboard>
```

| Attribute | Meaning |
|---|---|
| `for` | id of an `<input>` or `<textarea>`, or of a `<fidel-input>` / `<fidel-textarea>` (its inner field is used) |
| `ui-lang` | `en` or `am` |

The Fidel table in two steps: choose the consonant (34 buttons, each also
named in Latin letters, e.g. "ለ, le"), then its form (ለ ሉ ሊ ላ ሌ ል ሎ ሏ).
The letter goes in at the cursor with `setRangeText`, and the field's own
`input` event fires, so the host's listeners and validation see it. Space,
Delete one letter, ። ፣ ፤ ፧, Back to the text, Hide keyboard. Arrow keys,
Home and End move between letters (one Tab stop); Escape in step 2 goes back.
Event: none (the field's `input` event).

#### Package D: live session card

```html
<fidel-event-card title="Office hours: how to present"
  start="2026-11-20T19:00:00+03:00" end="2026-11-20T20:30:00+03:00"
  join-url="https://..." captions="yes" sign-language="on-request" languages="en,am"
  recording-url="session.html" request-url="/your/api/requests" reply-by="email"
  event-id="ev1" heading-level="3" ui-lang="en"></fidel-event-card>
```

| Attribute | Meaning |
|---|---|
| `title`, `start`, `end` | the session (ISO 8601 times with a time zone) |
| `join-url` | the live link; shown from 15 minutes before the start until the end |
| `captions` | `yes` or `no` |
| `sign-language` | `yes`, `no` or `on-request` (Ethiopian Sign Language interpreter) |
| `languages` | spoken languages, e.g. `en,am` |
| `recording-url` | after the end: "Watch the recording" (e.g. a page with `<fidel-session-viewer>`) |
| `request-url` | where access requests are POSTed as JSON `{eventId, needs, other?}` (optional) |
| `reply-by` | `email`: the card then says "The organisers will reply by email" |
| `event-id`, `heading-level`, `ui-lang` | id used in events and the .ics file; heading level (2–6, default 3); `en` or `am` |

Date and time in both calendars, the length, and the access line in words
("Live captions: yes", "Ethiopian Sign Language interpreter: on request",
"Spoken in: English, Amharic"). "Request access support" asks only which
support is needed (sign language interpreter, live captions, Amharic
interpreter, other), never why. "Add to calendar" downloads an `.ics` file made
in the browser. Event: `fidel-event-request` `{ eventId, needs, other? }`.

**Level 3:** each card also puts a schema.org `Event` in JSON-LD on the page
(`name`, `startDate`, `endDate`, `eventAttendanceMode: OnlineEventAttendanceMode`,
`location: VirtualLocation {url}`, `inLanguage`, and the access line as
`description`), like the job card's `JobPosting`, so search engines and
calendars can read it.

#### Package D: answer in sign language

```html
<fidel-sign-answer label="Ask your question in sign language"
  upload-url="/your/api/answers" max-seconds="120"></fidel-sign-answer>
```

| Attribute | Meaning |
|---|---|
| `label` | the heading of the box |
| `upload-url` | where Send POSTs the video (multipart field `video`); without it, the video is given to the page in an event |
| `max-seconds` | longest recording (default 120) |
| `heading-level`, `ui-lang` | heading level (2–5, default 3); `en` or `am` |

Start camera (only then is the camera asked for: video, no sound), "Camera
on" with Stop camera, Record after a 3-2-1 countdown in text, Stop recording
(the camera goes off at once), watch it back (Slower 0.5x), Record again or
Send (the size in MB is shown first). 480 x 360, WebM VP9/VP8 or MP4,
whichever the browser supports. No camera, camera refused or not https: it
says so and offers the phone's own camera app or a video file instead. Event
(no `upload-url`): `fidel-sign-answer-ready` `{ blob, durationSeconds, mimeType }`.
Fidel has no server endpoint for these videos (see BACKLOG).

#### Package D: reading guide

```html
<fidel-reading-guide target="#lesson-text"></fidel-reading-guide>
```

| Attribute | Meaning |
|---|---|
| `target` | CSS selector of the text to guide through |
| `ui-lang` | `en` or `am` |

"Reading guide" (on/off) outlines the paragraph or list item under the
pointer, with the text cursor, or with keyboard focus; "Dim the rest" fades the
other blocks (text stays above 4.5:1). "Next line" / "Previous line" move block
by block and scroll it to the middle of the screen. Overlays only (never
changes your text, never takes clicks); off by default; remembered in this
browser. Event: none.

#### Starter defects we patched (Savanna)

The gate is taken on Savanna's lesson page, so we checked the way to the player
with the keyboard at 100%, 200% and 400% zoom. Two things got in the way. We
fixed them in our own script, `integrations/savanna/fidel-savanna-patch.js`,
which `scripts/setup-savanna.sh` copies next to the page and loads; ALX's
files are not edited.

1. **No "skip to content" link** (WCAG 2.4.1). A keyboard user pressed Tab 24
   times before reaching the player. The patch adds "Skip to the lesson" as the
   first link on the page.
2. **The fixed header and curriculum bar hid the focused element** when moving
   back up the page at 200% and 400% zoom (WCAG 2.4.11). The patch sets
   `scroll-padding-top`, so the browser scrolls focused items out from under
   the bars.

After pulling this change, run `sh scripts/setup-savanna.sh` again.
<!-- PACKAGE D END -->

<!-- PACKAGE FORMS START -->
#### Form fields: text, form, choices, select, file, date

Real `<label>`s and real fields in the light DOM (no shadow DOM), so they
submit with your own `<form>` and work with every screen reader. Errors are in
words under the field and say how to fix it; they are checked when you leave
a field and on submit, never on every key. Messages are in English or Amharic
(`ui-lang`). Try them on [demo/inputs.html](demo/inputs.html) (an Amharic job
application and an English caption correction) and in the "Form fields"
section of [demo/components.html](demo/components.html).

```html
<fidel-form id="apply" sensitive="support" ui-lang="am">
  <form>
    <fidel-input label="ሙሉ ስም" name="fullName" lang="am" required></fidel-input>
    <fidel-input label="ስልክ ቁጥር" name="phone" format="phone-et" required></fidel-input>
    <fidel-date label="መጀመር የሚችሉበት ቀን" name="startDate"></fidel-date>
    <fidel-file label="CV" name="cv" accept=".pdf,.doc,.docx" max-size="5MB"></fidel-file>
    <fidel-choice type="checkbox" label="Support I need" name="support">
      <option value="sign-language">Sign language interpreter</option>
      <option value="extra-time">Extra time</option>
    </fidel-choice>
    <fidel-textarea label="About you" name="about" lang="am" listen voice-api="/api/v1"></fidel-textarea>
    <button type="submit">Send</button>
  </form>
</fidel-form>
```

**`<fidel-input>` and `<fidel-textarea>`**

| Attribute | Meaning |
|---|---|
| `label` | The visible label (required). `placeholder` is never used instead of it. |
| `name`, `value`, `placeholder`, `autocomplete`, `inputmode`, `maxlength` | As on a native field |
| `required`, `disabled`, `readonly` | As on a native field; "(required)" is shown next to the label |
| `type` | `<fidel-input>` only: `text` (default), `search`, `email`, `tel` |
| `rows` | `<fidel-textarea>` only (default 4) |
| `lang` | Language of what is typed (`am`, `en`, `om`...): set on the field itself |
| `ui-lang` | `en` or `am`: language of our messages (else the nearest `ui-lang`, else the page's `lang`) |
| `hint` | Help text under the label, read with the field |
| `format` | `mmss` (1:23.5), `phone-et` (09..., 07..., +251..., 251..., spaces allowed; tidied to +2519... when you leave the field), `email` |
| `pattern` + `error` | Your own rule (a regular expression for the whole value) and the words to show when it fails |
| `keyboard-hint` | `off` switches off the keyboard-language hint |
| `caps-warning` | `on` / `off`. Default: on for Latin-script fields, off for Amharic and Tigrinya |
| `listen` | Adds a "Listen" button that reads the field in its language |
| `voice-api` | e.g. `/api/v1`: use the server's voice engine for Listen when the browser has no voice for the language |
| `speak` | `off`, `words` or `characters`: the typing voice for this field (default: the learner's setting `typingVoice`, off) |
| `describedby` | ids of your own descriptions, read before ours |
| `field-class` | your own class names for the inner `<input>`/`<textarea>` |

Properties and methods: `value`, `validity` (`{ valid, message }`),
`checkValidity()` (checks and shows the error; returns true or false),
`focus()`.

- **Keyboard-language hint:** in an Amharic or Tigrinya field, when only
  English letters are typed (a whole word of 3+ letters, or more than 60% of
  12+ letters), "You are typing English letters. To type Amharic, switch the
  keyboard: Windows + Space." It is shown and said once, goes away as soon as
  Amharic appears, and never shows for one English word inside Amharic text
  ("HTML", "git"). English fields get the mirror hint. "Don't remind me in this
  field" is remembered for the session. None for Afaan Oromo, Somali, Arabic.
- **Caps Lock:** "Caps Lock is on" is shown and said only when it changes.
- **Listen:** "Listen" / "Stop" (Escape stops too), with "Computer voice"
  next to it. No voice for the language on this device or server = no button.
- **Typing voice** (off by default): says each word or letter as it is typed;
  with Amharic input methods it waits for the finished letter.
- **`<fidel-amharic-keyboard for="ID">`** (Package D) with `for` = the id of a
  `<fidel-input>`/`<fidel-textarea>` writes into its field.

**Other fields** (each has `label`, `name`, `hint`, `required`, `disabled`, `ui-lang`, and the same `value`, `validity`, `checkValidity()`, `focus()`):

| Tag | Extra attributes | What it does |
|---|---|---|
| `<fidel-choice>` | `type` (`radio` or `checkbox`), `options` (JSON `[{"value","label","lang"}]`) or child `<option>`s, `value` (comma-separated) | A `<fieldset>` with a `<legend>`; real radios/checkboxes, 44 px rows, `lang` per option. "Choose one option." / "Choose at least one option." `value` is a string (radio) or an array (checkbox). |
| `<fidel-select>` | `options` (JSON) or child `<option>`/`<optgroup>`s, `search`, `placeholder` | A native `<select>`. With `search`, a real "Search the list" box above it keeps the matching options and says how many match. "Choose an option from the list." |
| `<fidel-file>` | `accept`, `max-size` (e.g. `50MB`) | A native file field. The hint says "Video, up to 50 MB"; the chosen file's name and size are shown and said; a wrong type or a file too big is refused in words; "Remove". |
| `<fidel-date>` | `value`, `min`, `max` (YYYY-MM-DD) | A native date field; the same date in the Ethiopian calendar under it (`<fidel-ethiopian-date>`), read with the field. |

**`<fidel-error-summary for="FORM-ID">`**: on submit, checks every Fidel field
in the form. If any is wrong: stops the submit, shows "2 fields need fixing"
with a link to each field, moves focus to its heading, keeps everything typed.
Turns off the browser's own pop-up checks on that form (`novalidate`).
Attribute `heading-level` (2–6, default 2).

**`<fidel-form>`** (wraps your `<form>`; adds the error summary itself)

| Attribute | Meaning |
|---|---|
| `api` or `action` | Address to POST the answers to as JSON (multipart when a file is chosen). Without it, the event `fidel-form-submit` hands the answers to the page. |
| `sensitive` | Comma-separated field names NEVER stored on the device (drafts, offline queue). Files and passwords are never stored either. |
| `draft` | `off`: no draft |
| `draft-key` | Storage name (default: the element's id). Stored as `fidel-form-draft:<key>` and `fidel-form-outbox:<key>` in localStorage. |
| `ui-lang` | `en` / `am` for the form's messages and every field inside |

- **Draft:** saved as you type ("Draft saved"), put back after a reload or a
  time-out ("Your draft was restored."), "Clear draft".
- **Offline at submit:** "Saved on this phone. It will be sent when you are
  online." Sent on the browser's `online` event. Sensitive answers wait only
  in memory (sent if the page is still open).
- A second press while sending does nothing; "Sent. Thank you." is shown and
  said; then the form is emptied and the draft removed.

**Events** (all bubble and are `composed`):

| Event | From | `detail` |
|---|---|---|
| `fidel-field-input` | text fields | `{ value, name }` (every change) |
| `fidel-field-change` | every field | `{ value, name }` (`{ file, name }` for files) |
| `fidel-field-invalid` | every field | `{ message, name }` |
| `fidel-field-valid` | every field | `{ name }` |
| `fidel-keyboard-hint` | text fields | `{ shown, expected }` (`expected`: `am`, `ti` or `en`) |
| `fidel-caps-lock` | text fields | `{ on }` |
| `fidel-form-submit` | `<fidel-form>` without `api` | `{ data, queued }`; call `preventDefault()` to show your own message |
| `fidel-form-sent` | `<fidel-form>` with `api` | `{ data, status }` |
| `fidel-form-queued` | `<fidel-form>` | `{ data }` (kept for later: offline) |
| `fidel-form-draft-saved`, `fidel-form-draft-restored` | `<fidel-form>` | `{}` / `{ data }` |

**Voice for Listen (Level 2):** `GET /api/v1/speak` lists the languages of the
optional voice engine (`[]` when none is set up); `POST /api/v1/speak`
`{"text": "...", "lang": "am"}` returns WAV audio, or 409 with the reason in
words when there is no voice for that language. Text is limited to 500
characters.

In Studio, the caption editor's Start/End times are `<fidel-input format="mmss">`
and the translation boxes are `<fidel-textarea lang>`; the "Report a caption
problem" dialog's correction box is a `<fidel-textarea>`.
<!-- PACKAGE FORMS END -->

<!-- PACKAGE E START -->
#### More components (Package E): lesson formats, questions, notes, quiz, callouts, tables

Every learner chooses **how** they take part (watching, listening, reading,
sign language, simple words; asking in writing, by voice or in sign language)
and is never asked why. All of them are in the "Package E" section of
[demo/components.html](demo/components.html). Text in English or Amharic
(`ui-lang="en|am"`); events bubble and carry no personal data.

```html
<fidel-skip-link target="#lesson"></fidel-skip-link>   <!-- first thing in <body> -->
<fidel-lesson-formats for="lesson-player"></fidel-lesson-formats>
<div id="lesson">
  <fidel-player id="lesson-player" lesson="https://FIDEL-HOST/api/v1/lessons/ID"></fidel-player>
</div>
<fidel-question for="lesson-player" api="https://FIDEL-HOST/api/v1"></fidel-question>
<fidel-notes for="lesson-player" lesson-id="html-basics"></fidel-notes>
<fidel-progress for="lesson-player" label="Lesson 3"></fidel-progress>
<fidel-mark-complete for="lesson-player" lesson-id="html-basics"></fidel-mark-complete>
```

| Tag | Attributes | Events |
|---|---|---|
| `<fidel-lesson-formats>` | `for` (player id), `audio` (an audio-only file if the lesson has none), `heading-level` (2–5, default 3), `ui-lang` | `fidel-lesson-format` `{ format }` |
| `<fidel-question>` | `for`, `api` (send to the Fidel server; without it the page gets the question), `lesson` (id; default from the player's `lesson` URL), `ui-lang` | `fidel-question-ready` `{ time, kind, text \| blob, mimeType }`, `fidel-question-sent` `{ lessonId, time, kind }` |
| `<fidel-voice-note>` | `label`, `max-seconds` (default 120), `upload-url` (POST multipart field `audio`), `no-send`, `heading-level` (2–5, default 3), `ui-lang` | `fidel-voice-note-ready` `{ blob, mimeType, durationSeconds }`, `fidel-voice-note-recorded` `{ mimeType, durationSeconds, size }` |
| `<fidel-callout>` | `type` (`tip`, `warning`, `example`, `note`), `heading`, `heading-level` (2–6, default 3), `ui-lang`; content = the children | none |
| `<fidel-table>` | `sortable="true"`, `show-warnings` (visible note when the `<caption>` is missing), `ui-lang`; wraps a real `<table>` | `fidel-table-sort` `{ column, direction }` |
| `<fidel-notes>` | `for`, `lesson-id` (notes are kept per id), `heading-level` (2–5, default 3), `title-text` (first line of the .txt), `ui-lang` | `fidel-notes-change` `{ count }` |
| `<fidel-quiz>` | `questions` (JSON) or child markup, `label`, `time-limit` (seconds; none by default), `heading-level` (2–5, default 3), `ui-lang` | `fidel-quiz-done` `{ score, total }`, `fidel-quiz-own-answer` `{ question, kind, text \| blob, mimeType }` |
| `<fidel-progress>` | `for`, `label`, `ui-lang` | none (listens to `fidel-progress` and `fidel-complete`) |
| `<fidel-mark-complete>` | `lesson-id`, `for`, `manual` (usable before the end), `ui-lang` | `fidel-mark-complete` `{ done }` |
| `<fidel-skip-link>` | `target` (CSS selector, default `#main`), `label` (default "Skip to the lesson") | none |
| `<fidel-toggletip>` | `label` (the button text); content = the explanation | none |

- **`<fidel-lesson-formats>`**: buttons (`aria-pressed`) for Watch (video and
  captions), Listen (audio and transcript, low data), Read (the lesson
  document: web page, PDF, Braille), Sign language (the signer window docked
  beside the video, large) and Simple words (every `<fidel-simple-mode>` on the
  page on). Only formats the lesson has are offered: Listen needs the lesson's
  audio-only file and captions, Read the lesson document, Sign language the
  sign video, Simple words a `<fidel-simple-mode>`. Each button shows the
  download size (asked with a HEAD request; nothing is downloaded). In Listen
  and Read the `<fidel-player>` is taken out of the page (a comment keeps its
  place), so **no video is downloaded**; it comes back for the other formats.
  The choice is remembered (`lessonFormat` in the shared preferences) and
  announced ("Listen mode: audio and transcript.").
- **`<fidel-question>`**: "Ask about this moment" opens a dialog with the
  video time (a `<fidel-input format="mmss">`, editable) and the caption shown
  then. Three ways to ask, chosen with radio buttons: Write
  (`<fidel-textarea>`), Voice note (`<fidel-voice-note>`) or Sign language
  (`<fidel-sign-answer>`). The video pauses while the dialog is open and plays
  on after. Offline: kept on the phone (localStorage `fidel-question-queue`;
  recordings up to about 2 MB) and sent when the phone is online again.
- **`<fidel-voice-note>`**: the microphone is asked for only after "Start
  recording"; a "Recording" banner with the time, Stop, play back, Record
  again, the size in MB before Send. The microphone goes off when recording
  stops. **No speech-to-text**: the recording is never sent to a cloud
  service. No microphone, permission refused or not https: the reason in words
  and a file picker (`accept="audio/*" capture`) for the phone's own recorder.
- **`<fidel-callout>`**: a real heading with the type in words before it
  ("Warning: …"), a decorative icon (`aria-hidden`), and a border style and
  background per type, so the type never depends on colour.
- **`<fidel-table>`**: requires a `<caption>` (console warning; visible with
  `show-warnings`), adds `scope` to every `<th>` and explicit table roles. When
  the table is narrow (a phone, 400 % zoom; CSS container query) each row is a
  card of "Header: value" pairs instead of sideways scrolling. Sorting: header
  buttons, `aria-sort`, "Sorted by Length, ascending." announced.
- **`<fidel-notes>`**: "Add a note at 1:23" (time filled in, editable), notes
  as buttons "Play from 1:23: …", Edit, Delete with Undo (no confirm dialog),
  "Download my notes (.txt)". Kept **only in this browser**
  (localStorage `fidel-notes:<lesson-id>`).
- **`<fidel-quiz>`**: each question a `<fieldset>`/`<legend>` with radio
  buttons (or checkboxes when the answer is a list). "Check answer" shows
  "Correct." or "Not quite: the answer is …" and the explanation next to the
  question and moves focus there. Optional `time-limit`: a banner with the time
  left, a warning 1 minute before the end, "Add 5 minutes" and "Switch the
  timer off"; the timer starts when the learner enters the quiz. Optional
  "Answer in your own way" per question (`"ownWay": true` or `data-own-way`):
  writing, voice note or sign language, sent to the page and not scored. The
  score in words and as a `<progress>`. Child markup:
  `<div data-question data-answer="1" data-explanation="…"><p>Question</p><ul><li>A</li><li>B</li></ul></div>`
  (`data-answer="0,2"` = choose all that apply).
- **`<fidel-progress>`**: a `<progress>` and "40% watched" from the player's
  `fidel-progress` events; not announced by itself, "Say my progress"
  announces it.
- **`<fidel-mark-complete>`**: a toggle button (`aria-pressed`), usable once
  the player sends `fidel-complete` (or always with `manual`); remembered in
  this browser (`fidel-complete:<lesson-id>`); "Lesson marked complete."
- **`<fidel-skip-link>`**: hidden until focused; moves focus to the target
  (adds `tabindex="-1"` when needed). Put it first in `<body>`.
- **`<fidel-toggletip>`**: an info button; the explanation opens on click,
  tap, Enter or Space (never hover only), is read through a live region, and
  closes with Escape or a click elsewhere.
- **Reading font** (E8, in `<fidel-display-prefs>`): "Default font" or
  "Easy-read font (Atkinson Hyperlegible)" for Latin text; Ethiopic text stays
  in Noto Sans Ethiopic. The font (17.2 KB, SIL OFL 1.1) is self-hosted next to
  `fidel.js` and downloaded only when chosen. Remembered in
  `fidel-display-font`; class `fidel-dp-font-easy`.

Questions REST API (Level 2):

```bash
# A learner's question (public; lesson must be published). 201 {"id": ...}
curl -X POST https://FIDEL-HOST/api/v1/lessons/ID/questions \
  -F time=83.5 -F kind=text -F "text=What does this loop do?"
curl -X POST https://FIDEL-HOST/api/v1/lessons/ID/questions \
  -F time=83.5 -F kind=voice -F "media=@question.webm;type=audio/webm"
# Staff: open questions, a recording (never public), then mark one answered or dismissed
curl -H "Authorization: Bearer $TOKEN" "https://FIDEL-HOST/api/v1/lessons/ID/questions?status=open"
curl -H "Authorization: Bearer $TOKEN" -o q.webm https://FIDEL-HOST/api/v1/questions/QUESTION_ID/media
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status": "answered"}' https://FIDEL-HOST/api/v1/questions/QUESTION_ID
```

`kind` is `text` (needs `text`, up to 2000 letters), `voice` (needs `media`,
an `audio/*` file) or `sign` (needs `media`, a `video/*` file). Recordings up to
25 MB (`FIDEL_QUESTION_MEDIA_MB`) are kept in `data/questions/<lesson id>/`,
outside the public `/files/`, and deleted with the lesson. No name, account or
IP address is stored. Bad input: 400 with the reason in words. Abuse limit: 20
questions per address per hour (`FIDEL_QUESTIONS_PER_HOUR`), counted in memory.
Webhook event: `question.asked` `{ lesson_id, question_id, kind, time }`. Staff
see the questions on the lesson's Studio page under "Learner questions", play
the recordings, and mark them "Answered" or "Dismiss".
<!-- PACKAGE E END -->

## Level 2: REST API

Interactive docs at `/docs` (Swagger UI); the spec is in [openapi.yaml](openapi.yaml) and [openapi.json](openapi.json)
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

### Webhooks

The host's server can be told when something happens, with no person involved:

```sh
curl -X POST -H "Authorization: Bearer $FIDEL_STAFF_TOKEN" -H "Content-Type: application/json" \
     -d '{"url": "https://your-platform.example/fidel-hook", "events": ["lesson.ready", "captions.reviewed"]}' \
     http://localhost:8000/api/v1/webhooks
```

Events: `lesson.ready` (processing finished), `lesson.published`,
`lesson.unpublished`, `captions.reviewed` (every caption of a language checked),
`certificate.issued`, `certificate.revoked`. Fidel POSTs
`{"event", "data", "sent_at"}` with ids and links only (no personal data), signed
in the `X-Fidel-Signature: sha256=…` header with the secret returned when the
webhook was created (shown once). Bad input to any endpoint returns **400 with a
message in words**, for example `"Please check: url: input should be a valid URL."`

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

### LTI 1.3: Fidel lessons inside Moodle or Canvas

A teacher adds a Fidel lesson to a course in a learning platform (LMS) such as
Moodle. Learners open it from the course, already signed in, with no Fidel
account. When they finish, **"completed" appears in the course gradebook.**

**Status: works with Moodle 4.5.** Tested end to end on a real Moodle 4.5
(LTS) on 16 November 2026: an admin registers Fidel, a teacher adds a lesson
with Fidel's picker, a student opens it inside the course and marks it complete,
and Moodle's gradebook shows 100 (`e2e/tests/moodle.spec.js`). Not yet tried:
Canvas, Moodle's "New window" launch, and a screen reader inside Moodle.

| Included | Not yet |
|---|---|
| Launch: a learner opens a lesson from the course | Class lists from the LMS (Names and Role Provisioning Service) |
| Deep Linking: the teacher picks a lesson from a list | Quiz scores (only "completed" is sent) |
| Grades: "completed, 100 out of 100" to the gradebook (Assignment and Grade Services) | Settings per course; LTI 1.1 |

#### Switch it on

LTI is **off by default**. When it is off, every `/lti/` address answers
"not found". In `.env`:

```
FIDEL_LTI_ENABLED=true
FIDEL_PUBLIC_URL=https://fidel.example.org
```

`FIDEL_PUBLIC_URL` must be the address the LMS reaches Fidel at: Fidel builds
the addresses you give the LMS from it. Restart Fidel (`docker compose up -d`).
On first start Fidel makes its own key pair and keeps it in `data/lti/`
(git-ignored). Back it up with the rest of `data/`: if it is lost, Fidel makes a
new one, and the LMS reads the new public key from `/lti/jwks` by itself.

#### Register Fidel in Moodle

Moodle 4.x: **Site administration › Plugins › Activity modules › External tool ›
Manage tools › configure a tool manually.** Click **Expand all** first: the
Services and Privacy settings are in folded sections. In Fidel Studio, open **LMS
connections**: it shows each of Fidel's addresses with a Copy button.

| Moodle field | Value |
|---|---|
| Tool name | Fidel |
| Tool URL | `https://FIDEL/lti/launch` |
| LTI version | LTI 1.3 |
| Public key type | Keyset URL |
| Public keyset | `https://FIDEL/lti/jwks` |
| Initiate login URL | `https://FIDEL/lti/login` |
| Redirection URI(s) | `https://FIDEL/lti/launch` and `https://FIDEL/lti/deep-link`, one per line |
| Supports Deep Linking (Content-Item Message) | ticked |
| Content Selection URL | `https://FIDEL/lti/deep-link` |
| Services › IMS LTI Assignment and Grade Services | "Use this service for grade sync only" |
| Privacy › Share launcher's name with tool, Share launcher's email with tool | Never (Fidel does not use them) |
| Privacy › Accept grades from the tool | As specified in Deep Linking definition or Delegate to teacher (or Always) |
| Tool configuration usage | Show in activity chooser and as a preconfigured tool |
| Default launch container | Embed, without blocks (or New window: see "Cookies" below) |

Save. Then click **View configuration details** (the list icon next to the
tool) and copy these into **Studio › LMS connections › Add a platform**:

| Moodle shows | Fidel Studio field |
|---|---|
| Platform ID | Platform ID (issuer) |
| Client ID | Client ID |
| Deployment ID | Deployment ID |
| Public keyset URL (`…/mod/lti/certs.php`) | Public keyset URL |
| Access token URL (`…/mod/lti/token.php`) | Access token URL |
| Authentication request URL (`…/mod/lti/auth.php`) | Authentication request URL |

Addresses must start with `https://`. Plain `http://` is accepted only for a
test platform on the same computer (`localhost`, `127.0.0.1`, or a Docker
service name).

#### What teachers and learners see

- **Teacher:** in a course, *Add an activity › External tool › Fidel › Select
  content*. Fidel shows its **lesson picker**: published lessons only, a search
  box, radio buttons, *Add to course* and *Cancel*, usable by keyboard alone.
  The chosen lesson becomes an activity with a gradebook column out of 100.
- **Learner:** opens the activity and gets the normal Fidel lesson page, the
  same `<fidel-player>` as everywhere else, in the course's language (Amharic if
  Moodle's language is Amharic, else English). When they watch to the end, or
  press **Mark as complete** (for learners who read the transcript or listen
  instead), Fidel sends "completed". The page says **"Saved to your course"**,
  or what went wrong and a **Try again** button; screen readers hear it too.
- Every problem page says what happened and what to do, in English and
  Amharic, with a short reason code for the course administrator.

#### Cookies inside the course page

Browsers often block cookies for sites shown inside another site's page, and
the LTI sign-in relies on one. Fidel handles it in three ways, in order:

1. On https, the sign-in cookie is `SameSite=None; Secure; Partitioned`, which
   current Chrome keeps inside a course page.
2. If the LMS offers it, Fidel keeps the sign-in check in the **LMS's own
   storage** (LTI client-side storage, `lti_storage_target`).
3. If neither works, the page offers **Open in a new window**.

If learners see "Your browser blocked Fidel's sign-in check" often, set the
tool's launch container to **New window**.

#### Security checks

Nothing opens unless every check passes:

- the message is signed with the platform's key (RS256 only; keys read from its
  keyset address, cached for 10 minutes, read again for a new key id);
- it comes from the registered platform (`iss`), is meant for Fidel (`aud`,
  `azp`), and is current (`exp`, `iat`, one minute of leeway for clocks);
- it carries the one-time `nonce` Fidel made for this sign-in. Sign-ins are kept
  on the server, used once, and must finish within 10 minutes;
- the deployment is registered, the LTI version is 1.3.0, and the message type
  fits the address (`/lti/launch` lessons, `/lti/deep-link` the picker);
- the launch comes from the same browser that started the sign-in.

Fidel signs its own messages (the gradebook token request, the picker's
answer) with its key; the LMS checks them at `/lti/jwks`.

#### Addresses

| Address | Who calls it | What it does |
|---|---|---|
| `GET /lti/jwks` | the LMS | Fidel's public key set |
| `GET` or `POST /lti/login` | the LMS, in the learner's browser | starts a sign-in (OpenID Connect) |
| `POST /lti/launch` | the LMS, in the learner's browser | checks the signed launch, shows the lesson |
| `POST /lti/complete` | the lesson page | sends "completed" to the gradebook |
| `POST /lti/deep-link` | the LMS, in the teacher's browser | checks the request, shows the picker |
| `POST /lti/deep-link/choose` | the picker | signs the chosen lesson and takes it back to the LMS |
| `GET /api/v1/lti/tool` | Studio (staff token) | on or off, and the addresses above |
| `GET`, `POST /api/v1/lti/platforms`, `DELETE /api/v1/lti/platforms/{id}` | Studio (staff token) | registered platforms |

#### When something goes wrong

The problem page shows a reason code under "Details for your course
administrator":

| Code | Meaning | Fix |
|---|---|---|
| `unknown_platform` | No platform with this Platform ID and Client ID | Add it in Studio › LMS connections |
| `unknown_deployment` | The deployment id is not registered | Add it to the platform's Deployment ID in Studio |
| `platform_keys_unreachable` | Fidel could not read the LMS's keyset address | Check the address, and that Fidel's server can reach the LMS |
| `unknown_key`, `bad_signature` | The message was not signed with the LMS's published key | Check the Public keyset URL |
| `wrong_issuer`, `wrong_audience` | Platform ID or Client ID differ from the message | Copy them again from "View configuration details" |
| `expired`, `issued_in_the_future` | Clocks differ by more than a minute | Set the server clocks (NTP) |
| `sign_in_used` | The sign-in expired (10 minutes) or was used already | Open the activity again |
| `cookie_blocked` | The browser blocked the sign-in check in the frame | Use "New window" for the tool |
| `wrong_message_type` | A lesson sent to the picker address, or the other way round | Check Tool URL and Content Selection URL |
| `no_lesson` | The activity names no lesson, or it is not published | Pick the lesson again, or publish it |

Grade problems are logged on the server (`fidel.lti`) with the platform's
answer; the learner sees "Not saved to your course yet" and can try again.

#### Tests

- **Server** (`server/tests/test_lti_*.py`, pytest): a fake platform with its
  own RSA keys sends a good launch and bad ones (wrong signature, `HS256` and
  unsigned tokens, expired, wrong audience, issuer, nonce, version or message
  type, unknown deployment, platform or key, reused sign-in, another browser);
  it also plays the gradebook (checks the token request and the exact score
  message) and the picker's return address.
- **Browser** (`e2e/tests/lti.spec.js`, `e2e/tests/lti-launch.spec.js`): Studio's
  page; a real sign-in round trip at the top level and inside a course frame
  (platform storage, new window); the video played to the end and "Mark as
  complete" reaching a small fake gradebook; the picker by keyboard only; axe,
  200% and 400% zoom on every page. They need a server with LTI on:

  ```
  docker compose run -d --rm -e FIDEL_LTI_ENABLED=true -p 8011:8000 --name fidel-lti-test server
  cd e2e && FIDEL_BASE_URL=http://localhost:8011 npx playwright test tests/lti.spec.js tests/lti-launch.spec.js
  ```
- **Real Moodle 4.5** (`e2e/tests/moodle.spec.js`): Moodle in Docker
  (`docker-compose.lti-test.yml`, test only; `sh scripts/moodle-test-setup.sh`
  makes a course and a student). The admin fills Moodle's tool form with the
  values above, the teacher picks a lesson, the student marks it complete, and
  the test reads the grade from Moodle's database. How to run it: the comment
  at the top of the file.

## AI engines and running fully offline

All AI runs **on the Fidel server**. No lesson, learner or staff data is sent to
any other service. Engines are chosen in `.env`, never by changing code:

| Setting | Values | Default |
|---|---|---|
| `FIDEL_STT_PROVIDER` | `local_whisper`, `none` | `local_whisper` |
| `FIDEL_WHISPER_MODEL` | `tiny`, `base`, `small`, `medium` | `small` |
| `FIDEL_TRANSLATOR` | `local_madlad`, `none` | `local_madlad` |
| `FIDEL_TRANSLATE_TO` | caption languages to translate into: `am` (Amharic), `om` (Afaan Oromo) | `am,om` |
| `FIDEL_OMNIASR_URL` | address of the optional Amharic speech-to-text engine, e.g. `http://omniasr:8001` | empty (off) |
| `FIDEL_OMNIASR_LANGUAGES` | spoken languages it transcribes instead of Whisper | `am,om` |
| `FIDEL_TTS_URL` | address of the optional Amharic voice engine, e.g. `http://toucan:8002` | empty (off) |

`none` switches a step off (shown as "skipped" in Studio). After
`python -m app.download_models`, Fidel needs no internet at all: fonts, player
and models are all served from the Fidel server.

Not available yet: a cloud translation option (Addis AI), see [BACKLOG.md](BACKLOG.md).

### Optional Amharic and Afaan Oromo speech engines

Two extra engines, each in **its own container**, so PyTorch and the GPL parts
of the voice engine never enter the main image. Both are off unless you start
them. Only the Fidel server can reach them (no ports are opened).

| Engine | What it adds | Image | Model | RAM while loaded | Speed (laptop CPU) |
|---|---|---|---|---|---|
| **Omnilingual ASR** (Meta, `omniASR_CTC_300M_v2`, Apache-2.0) | Draft captions for lessons **spoken in Amharic or Afaan Oromo**, with word timings | 1.75 GB | 1.3 GB | about 3 GB | about 0.25 s per second of audio |
| **ToucanTTS** (IMS Stuttgart, Apache-2.0) | **Machine-read** Amharic and Afaan Oromo recordings of descriptions, and of Amharic job summaries | 1.8 GB | 0.33 GB | about 1.5 GB | about 1 s per second of speech |

Turn them on:

```bash
# 1. Download the models once (needs internet)
docker compose --profile amharic-speech run --rm omniasr python server.py --download
docker compose --profile amharic-voice run --rm toucan python server.py --download
# 2. In .env
FIDEL_OMNIASR_URL=http://omniasr:8001
FIDEL_TTS_URL=http://toucan:8002
# 3. Start everything
docker compose --profile amharic-speech --profile amharic-voice up -d --build
```

What changes:

- A lesson uploaded with **spoken language: Amharic or Afaan Oromo** gets draft
  captions from Omnilingual ASR. English lessons still use Whisper. (Amharic was
  checked by a speaker on one clip; Afaan Oromo is untested.) The engine
  writes no punctuation, so cues also end where the speaker pauses. Like every
  machine caption, they are a draft until a person checks them in Studio.
- **Amharic and Afaan Oromo are read aloud like English.** English
  descriptions are read by the browser's voice; most phones have no Amharic or
  Oromo voice, so when the descriptions are saved, every one without a person's
  recording gets a **machine-read recording automatically** (in the background).
  Edited text is read again. Job summaries in Amharic work the same way. A
  person's recording is never replaced, and is always better.
- Studio marks machine-read recordings, and can remake one ("Make machine-read
  recording", shown only while the voice engine runs: `GET /api/v1/engines`).
  The job card tells learners when the Amharic summary is a computer voice.
- Quality: the voice is understandable but not clear: it can blur or swallow
  words. Afaan Oromo was not in the voice's training data, so it is a best
  guess. `TOUCAN_DURATION_SCALE=1.25` (on the `toucan` service) speaks 25%
  slower. See [docs/speech-engines.md](docs/speech-engines.md) for why.
- How they were chosen and measured: [docs/speech-engines.md](docs/speech-engines.md).

### Optional British Sign Language avatar (experimental)

An avatar that signs the **English** captions in **British Sign Language
(BSL)**. It is **not Ethiopian Sign Language**: no text-to-sign system for EthSL
exists yet. It shows how automatic signing works; real EthSL comes from
interpreter videos (the `sign` attribute) and, later, an EthSL sign dictionary
made with Deaf signers.

**Demo:** http://localhost:8000/demo/savanna-mock/?sign=bsl plays a BSL avatar
video made in advance for that lesson, in the normal sign window. Learners
download only the video; nothing else runs. Two versions, chosen in the
player's Sign language settings:

| Setting | What is signed | Timing | Size (demo lesson) |
|---|---|---|---|
| Off (default) | words that have a BSL sign (45 of 144) | keeps pace with the lesson | about 2 MB |
| **Wait for the signer** | every word: signs, and fingerspelling for the rest | the lesson pauses after each caption until the signer finishes (7 min 7 s of signing for a 2 min 39 s lesson); Play skips a wait | about 3.6 MB |

The choice is saved in the browser like the other settings.

**Make the videos** (once per lesson; for now the demo lesson):

```sh
docker compose --profile bsl-avatar up -d --build   # the Kozha service, off by default
sh scripts/bsl-video/make.sh                          # writes data/demo/sign-bsl.webm, sign-bsl-all.webm/.json
```

- For each English caption, the local `kozha` service
  ([Kozha](https://github.com/zhan-a/Kozha), pinned commit) finds BSL signs in
  the DictaSign BSL dictionary; the CWASA avatar signs them in a browser on your
  machine; each caption's signing is recorded and placed at the caption's time.
- **Signs only** (default video): about a third of the words have a BSL sign
  (45 of 144 in the demo lesson); spelling the rest letter by letter takes much
  longer than the lesson. Captions with no BSL sign show the avatar at rest.
- **Every word** ("Wait for the signer"): each caption's signing at normal speed,
  never cut. The timing file (`sign-bsl-all.json`) lists, per caption, where its
  signing starts and ends in the sign video; the player pauses the lesson when
  the next caption is due and the signer is not done. Player attributes:
  `sign-full` (the video) and `sign-full-timing` (the JSON).
- The avatar engine needs XSLT, which Chrome 158 and later no longer have. For
  the recording only, `make.sh` loads a pinned
  [XSLT polyfill](https://github.com/mfreed7/xslt_polyfill) (BSD-3-Clause,
  checked with SHA-256) into Playwright's browser. It is not sent to learners.

**Live avatar** (`?sign=bsl-live`, `sign-provider="kozha-bsl"`): signs each
caption as the video plays, from the running `kozha` service. Because of the
missing XSLT it only signs in browsers that still have XSLT, so the demo uses
the video instead.

- **Non-commercial only.** The BSL dictionary is CC BY-NC-SA and the avatar
  engine CC BY-ND (see [LICENSES.md](LICENSES.md)).
- **Limits:** machine-made and not checked by a BSL interpreter; English word
  order, not BSL grammar; only words that have a sign. The demo page says so
  above the video.

## Hardware and models

- **CPU only works.** Measured on a laptop (Intel i5-12500H, 16 GB RAM), 16 Nov
  2026: about 85 seconds of processing per minute of video with Whisper `small`
  and MADLAD translating into Amharic and Afaan Oromo (captions about 11 s, each
  translation about 27 s, video versions about 9 s). Translating into one
  language only (`FIDEL_TRANSLATE_TO=am`) saves about a third.
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
| `fidel.js` (Able Player + jQuery + DOMPurify + Fidel player, job card, session viewer, certificate), gzipped | 159 KB |
| `fidel-components.js` + `.css` (43 component tags; loaded only on pages that use them), gzipped | 67 KB + 8 KB |
| `fidel.css`, gzipped | 7 KB |
| Ethiopic font (2 weights, loaded only when Amharic text is shown) | 2 × 75 KB |
| Audio-only lesson (Opus 24 kbps) | 187 KB per minute (2.8 MB per 15 minutes) |
| Offline one-page lesson (audio + text + font) | 778 KB for 2 min 39 s, about **3.9 MB per 15 minutes** |
| Offline .zip pack | 593 KB for 2 min 39 s, about 2.9 MB per 15 minutes |
| Processing, CPU only (Intel i5-12500H laptop), Whisper small + MADLAD into Amharic and Afaan Oromo | about 85 s per minute of video: video versions 9 s, captions 11 s, each translation 27 s |

## Privacy

- **Stored**: lesson videos and their files; caption, chapter and description
  text; jobs; certificates (the name as the learner wants it written, course,
  date, issuer). In SQLite and files under `data/` on your server.
- **Never stored**: anything about learners' disabilities, learner accounts,
  tracking or analytics. The player keeps settings (caption size, language…) only
  in the learner's own browser.
- **Nothing leaves your server**: all AI runs locally; fonts and scripts are
  self-hosted; no third-party requests. The only outgoing traffic is the
  one-time model download, run by staff, and, if LTI is switched on, Fidel's
  calls to the LMS that you registered (its public keys and its gradebook).
- Certificate pages are marked `noindex`; certificate links are random and
  cannot be guessed. Staff actions need the staff token.
- **LTI (only if switched on)**: for each lesson opened from a course, Fidel
  keeps the LMS's id for the learner (an opaque id such as `42`, not a name) and
  the gradebook column's address, so it can send "completed". **Deleted after
  24 hours.** Names and emails from the LMS are never stored or used (set
  "Share launcher's name / email" to Never in Moodle). Sign-in checks (random
  state and nonce) are deleted after an hour. Fidel sends the LMS only that id
  and the score.

## Development

| Folder | What | Commands |
|---|---|---|
| `player/` | `<fidel-player>`, `<fidel-job-card>` (Able Player + our code), Vite build | `npm install`, `npm run build`, `npm test` |
| `server/` | FastAPI server, pipeline, AI providers | `docker compose run --rm server pytest` |
| `studio/` | Fidel Studio (staff page): plain HTML + JS, no build step | |
| `e2e/` | Browser tests: Playwright + axe-core | `npm install`, `npx playwright install chromium`, `npm test` |
| `demo/` | Landing page (`index.html`, `landing.css`, `brand/` logos), mock Savanna pages and demo captions | |
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
- Built by **Team GNU** for the Digital Bridge Accessibility Hackathon 2026
  (ALX Ethiopia, with AAAPD and Tomorrow is Better, under the LIWAY programme
  with SNV and Mercy Corps). Team: *(names to be added)*.
- Our co-designer: credited here only with their consent.

## Licence

MIT. See [LICENSE](LICENSE).
