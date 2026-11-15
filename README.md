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

### More components

Live examples of every component: [`demo/components.html`](demo/components.html).

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

### How LTI 1.3 would connect (not built)

LTI 1.3 lets a learning platform such as Moodle or Canvas open Fidel inside a
course with the learner already signed in. We have not built it: the guide says
a clear plan is better than a broken attempt, and we had no LMS to test with.
This is how it would plug into Fidel's existing parts:

1. **Registration.** The LMS admin registers Fidel as a tool: login URL
   `/lti/login`, launch URL `/lti/launch`, and Fidel's public key set at
   `/lti/jwks`. Fidel stores the platform's issuer, client id and key-set URL.
2. **Launch.** A learner clicks the activity. The LMS sends a signed message (a
   JWT, signed with the platform's private key). Fidel checks the signature with
   the platform's public keys, and checks issuer, audience, expiry and a one-time
   nonce; if any check fails, nothing opens.
3. **Content.** The launch names a Fidel lesson (chosen by the teacher through
   LTI Deep Linking). Fidel shows the same page a learner sees today: the
   `<fidel-player lesson="…">`, so nothing in the player changes.
4. **Grades (LTI Advantage).** Fidel's `fidel-complete` event would send
   "completed" back to the LMS gradebook through the Assignment and Grade
   Services API, the same moment our webhooks already report.

Libraries to use: PyLTI1p3 (MIT) for the launch checks. Effort: about a day,
plus testing against a Moodle instance.

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
