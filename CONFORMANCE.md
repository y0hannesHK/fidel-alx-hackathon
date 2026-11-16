# Fidel: WCAG 2.2 AA conformance report

Product: **Fidel 1.0.0** (released 16 November 2026): the player, job card, session viewer, certificate card and check page, offline lesson page, the component library (43 tags: Packages A–E and form fields), Fidel Studio, the landing page, and the Savanna rebuild demo.

## Conformance claim

The parts below are the ones WCAG requires in a conformance claim
(WCAG 2.0 "Required Components of a Conformance Claim", unchanged in 2.2).

| | |
|---|---|
| **1. Date** | 16 November 2026 |
| **2. Guidelines** | Web Content Accessibility Guidelines 2.2, https://www.w3.org/TR/WCAG22/ . WCAG 2.2 includes every WCAG 2.0 and 2.1 success criterion at levels A and AA (except 4.1.1 Parsing, which 2.2 made obsolete; we report it below for WCAG 2.0 readers: https://www.w3.org/TR/2008/REC-WCAG20-20081211/ ). |
| **3. Level** | AA (target). **Status: draft**. Automated testing is complete and passing, and a team member has tested with Windows Narrator (problems found were fixed, see below). Testing with NVDA, TalkBack and our co-designer is not yet done. Until it is, this is a self-assessment, not a final claim. |
| **4. Pages covered** | Fidel is a product installed on a partner's server and embedded in their pages, so most of it has no fixed address. As WCAG allows for such products, we state that these parts **would conform when installed**: the player (`<fidel-player>`), the job card (`<fidel-job-card>`), the offline lesson page (`/api/v1/lessons/{id}/offline.html`), the certificate check page (`/verify/{id}`) and Fidel Studio (`/studio/`). The component library (`<fidel-…>` tags) is covered the same way. Tested on our demo install: the landing page `/demo/`; the Savanna rebuild `/demo/savanna-rebuild/` (paced and self-paced homepages, lesson, jobs); `/demo/savanna-mock/` (lesson, `lesson.html`, `jobs.html`, `session.html`); `/demo/blank.html`; `/demo/components.html`; `/demo/inputs.html`; ALX's Savanna lesson page with our patch; `/verify/{id}`; `/studio/` (including LMS connections); the LTI pages Fidel shows inside a course (sign-in, lesson page, lesson picker, problem pages; see "LTI pages" below). The host page around Fidel is not covered. |
| **5. Technologies relied upon** | HTML, CSS, JavaScript, WAI-ARIA, SVG (icons), WebVTT (captions, descriptions, chapters), HTML audio/video. |

**Used but not relied upon** (everything still works without them): service
workers ("Save for offline": the download links do the same job), the browser's
speech synthesis (text descriptions and summaries are always shown as text and
reach screen readers), the Clipboard API (the link is also in a text field).

**Tested with**: Chromium (Playwright 1.65) and axe-core 4.14 on Windows,
desktop and mobile (touch, 360 px) emulation; Windows Narrator with Edge and
Brave (team member, 15 November). Manual tests with NVDA, TalkBack and Chrome on
Android: pending.

### Statement of partial conformance: content added after installation

Fidel shows content that staff add after installation: lesson videos,
captions, chapters, audio descriptions, sign-language videos, jobs. WCAG
allows a statement of partial conformance for such content. Fidel conforms;
**whether each lesson conforms depends on that lesson's content.** Fidel helps
staff get it right: machine captions are marked draft until a person checks
them (and learners are told), and Studio has editors for chapters,
descriptions and sign-language video. See criteria 1.2.2 and 1.2.5 below.

### Beyond AA

These AAA criteria are also met where the lesson provides the content:
**1.2.6 Sign Language** (sign-language window, when a sign video is uploaded),
**1.2.7 Extended Audio Description** (the lesson pauses while a description
plays), **1.2.8 Media Alternative** (full transcript, also offline),
**2.5.5 Target Size (Enhanced)** (44 × 44 px controls; for the player's own
buttons, on touch screens).

## How we tested

| Method | What it covers | Result |
|---|---|---|
| **axe-core 4.14** (via Playwright), WCAG 2.0/2.1/2.2 A and AA rules | Every learner page (landing page, Savanna rebuild, lesson demo pages, blank page, components and form pages, offline lesson, lesson document, certificate check) and every Studio page; at 100%, 200% and 400% zoom; with each dialog open; in English and in Amharic | **0 critical, 0 serious issues** on every page and state tested |
| **Gate checks** (`e2e/tests/gate.spec.js`) | The hackathon gate's machine-checkable parts on every page above | axe clean, no sideways scrolling at 200% and 400%, Tab never gets stuck |
| **Keyboard tests** (Playwright, keyboard only) | Main task: Amharic captions on, bigger captions, sign-language window, transcript search and jump, offline download, job card summary; caption review in Studio (Ctrl+Enter flow); every component's controls | Pass |
| **Reflow tests** | 320 CSS px wide; 200% and 400% zoom on a 1280 px screen; job card at 360 px with 200% zoom (180 CSS px) | No horizontal scrolling |
| **Text spacing, hover/focus content, focus not obscured** (`e2e/tests/wcag-checks.spec.js`) | WCAG 1.4.12 spacing applied to five pages; player tooltips; Tab and Shift+Tab with the floating sign window and Studio's sticky toolbar | Pass (see 1.4.12, 1.4.13, 2.4.11) |
| **Screen-reader walk-through** (Chrome's accessibility tree) | 471 Tab stops on the lesson, job card, components and form pages: what a screen reader announces at each (name, role, state) and whether focus is visible | All named, no traps; one problem found and fixed (transcript chapter titles had no role) |
| **Windows Narrator** (team member, two screen recordings, 15 November) | The components page, and the main task on the lesson page | Four problems found and fixed; see "Narrator findings" below |
| **Target size tests** | All Fidel buttons; all player controls on a touch phone | ≥ 44 × 44 px |
| **Offline test** | Offline page opened with the network switched off | Works; zero network requests |
| **Automated test suites** | Browser tests (Playwright), player unit tests, server tests | 262 + 97 + 81 tests pass |
| **Manual: NVDA (Windows), TalkBack (Android), 200% zoom, sound off, co-designer** | Everything | **Not yet done**: see [docs/manual-testing.md](docs/manual-testing.md) |

Automated tools find only part of all accessibility problems. Criteria marked
"Supports" below are supported by design and automated tests; the manual tests
may still find problems, which we will fix and record here.

## Results by success criterion

**Supports**: the criterion is met. **Partially supports**: some content does not
meet it (explained). **Not applicable**: there is no such content.
**Depends on content**: Fidel provides the means; whether a lesson meets it
depends on what staff add (explained).

### 1. Perceivable

| Criterion | Level | Result | Notes |
|---|---|---|---|
| 1.1.1 Non-text Content | A | Supports | Icon buttons have accessible names (Able Player and Fidel). Decorative icons are hidden from screen readers. |
| 1.2.1 Audio-only and Video-only | A | Supports | Audio-only offline lesson comes with a full transcript. |
| 1.2.2 Captions (Prerecorded) | A | Depends on content | English captions are made by speech-to-text and Amharic by machine translation; both are marked **draft** until staff check them in Studio, and learners see a notice on draft Amharic captions. A lesson meets 1.2.2 once its captions are checked. |
| 1.2.3 Audio Description or Media Alternative | A | Supports | Interactive transcript (with descriptions) is always available as a media alternative. |
| 1.2.4 Captions (Live) | AA | Not applicable | No live media. |
| 1.2.5 Audio Description (Prerecorded) | AA | Depends on content | Fidel supports text descriptions (read by the browser voice or screen reader) and recorded descriptions (needed for Amharic). Staff must write descriptions for lessons with important visual content. The demo clip has none yet. |
| 1.3.1 Info and Relationships | A | Supports | Headings, lists, `fieldset`/`legend` for option groups, `dl` for job facts, table headers in Studio, labelled regions. |
| 1.3.2 Meaningful Sequence | A | Supports | DOM order matches visual order; docked sign window follows the video. |
| 1.3.3 Sensory Characteristics | A | Supports | Instructions do not rely on shape, colour or position only. |
| 1.3.4 Orientation | AA | Supports | No orientation lock. |
| 1.3.5 Identify Input Purpose | AA | Supports | Learner pages ask for no personal data. Studio token field uses `autocomplete="current-password"`. |
| 1.4.1 Use of Color | A | Supports | Pressed buttons show "✓"; step states are written in words; links are underlined. |
| 1.4.2 Audio Control | A | Supports | Nothing plays automatically. Recorded descriptions and summaries can be stopped. |
| 1.4.3 Contrast (Minimum) | AA | Supports | All Fidel colour pairs ≥ 4.5:1 (axe checked). Caption presets are white/yellow on black and black on white/cream. |
| 1.4.4 Resize Text | AA | Supports | Caption text 100–250%; pages work at 200% zoom; "Large text" in offline page. |
| 1.4.5 Images of Text | AA | Supports | No images of text. |
| 1.4.10 Reflow | AA | Supports | Tested at 400% zoom (320 CSS px) and 200% zoom on every learner page and every Studio page (`e2e/tests/gate.spec.js`): no horizontal scrolling; player controls and the transcript toolbar wrap; the signer moves below the video; Studio's tables scroll inside their own box (allowed for data tables). |
| 1.4.11 Non-text Contrast | AA | Supports | Control borders and focus rings ≥ 3:1; focus ring is a two-colour ring visible on light and dark. |
| 1.4.12 Text Spacing | AA | Supports | With the WCAG test spacing applied (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) on the landing page, lesson pages, components and form pages, no text is cut off and nothing scrolls sideways (automated, `wcag-checks.spec.js`). A person's check with a text-spacing bookmarklet is still planned. |
| 1.4.13 Content on Hover or Focus | AA | Supports | Player tooltips appear on focus and hover, can be dismissed with Escape without moving focus, and stay while the pointer is on them (automated, `wcag-checks.spec.js`). Fidel's toggletip opens on click or Enter only, not on hover. |

### 2. Operable

| Criterion | Level | Result | Notes |
|---|---|---|---|
| 2.1.1 Keyboard | A | Supports | All functions work with the keyboard (tested). Player keys (K, Space, arrows) work while the player has focus and are listed in a "Keyboard help" dialog. Every transcript line can be reached and activated with Enter or Space; transcript lines are `role="button"` spans (Able Player's), not native buttons. |
| 2.1.2 No Keyboard Trap | A | Supports | No traps found in testing; dialogs close with Escape. |
| 2.1.4 Character Key Shortcuts | A | Supports | Able Player shortcuts need Alt+Ctrl by default and can be changed or switched off in Preferences. Studio's only shortcut is Ctrl+Enter inside a text box. |
| 2.2.1 Timing Adjustable | A | Supports | No time limits. |
| 2.2.2 Pause, Stop, Hide | A | Supports | Transcript "Follow along" scrolling can be switched off (and switches off when a keyboard user enters the transcript). Studio progress updates stop when processing ends. |
| 2.3.1 Three Flashes | A | Supports | No flashing content; `prefers-reduced-motion` respected. |
| 2.4.1 Bypass Blocks | A | Supports | Skip links on every demo page, the landing page, the Savanna rebuild and Studio; they land on the page's heading, so screen readers read only the heading (not the whole page). Landmarks (`main`, `nav`, labelled sections) and headings on every page. On ALX's Savanna page, our patch adds the missing skip link. |
| 2.4.2 Page Titled | A | Supports | Every page and Studio view has a descriptive title. |
| 2.4.3 Focus Order | A | Supports | Focus moves in reading order; after switching language or low-data mode, focus returns to the button used; Studio views focus their heading. |
| 2.4.4 Link Purpose (In Context) | A | Supports | Links say where they go (e.g. "Download lesson for offline use (sound and text)"). |
| 2.4.5 Multiple Ways | AA | Supports (full pages); not applicable (components) | Components sit inside the host's pages, which provide navigation. Fidel's own full pages give more than one way: the landing page has section links and a list of every demo; the Savanna rebuild has a main menu on every page, course contents and previous/next links. |
| 2.4.6 Headings and Labels | AA | Supports | Descriptive headings; every field has a visible label. |
| 2.4.7 Focus Visible | AA | Supports | Strong two-colour focus ring on all controls. |
| 2.4.11 Focus Not Obscured (Minimum) | AA | Supports | Tabbing with the sign window floating over the video: no focused control is fully hidden. Studio measures its sticky caption toolbar and scrolls a focused field below it, so it is not even partly covered, also with Shift+Tab (automated, `wcag-checks.spec.js`). The Savanna rebuild has no fixed or sticky bars; on ALX's Savanna page, our patch adds `scroll-padding-top`. |
| 2.5.1 Pointer Gestures | A | Supports | No path-based or multi-point gestures. |
| 2.5.2 Pointer Cancellation | A | Supports | Native buttons act on release. |
| 2.5.3 Label in Name | A | Supports | Accessible names contain the visible text. |
| 2.5.4 Motion Actuation | A | Not applicable | No motion input. |
| 2.5.7 Dragging Movements | AA | Supports | Sign window: dock beside the video, size and corner buttons; no dragging needed. |
| 2.5.8 Target Size (Minimum) | AA | Supports | Fidel controls ≥ 44 × 44 px; Able Player controls 32 px (mouse) and 44 px (touch). |

### 3. Understandable

| Criterion | Level | Result | Notes |
|---|---|---|---|
| 3.1.1 Language of Page | A | Supports | `lang` on every page; the player's own `lang` follows the chosen interface language. |
| 3.1.2 Language of Parts | AA | Supports | `lang="am"`/`lang="en"` on captions, transcripts, summaries, language names and chapter titles (English chapter titles inside Amharic transcripts are marked English). Language names in Ethiopic letters also carry a hidden name in the interface language ("አማርኛ (Amharic)"), because screen readers with no Amharic voice say nothing for them. |
| 3.2.1 On Focus | A | Supports | Focus never triggers a change of context (it only switches off "Follow along", which the learner can switch back on). |
| 3.2.2 On Input | A | Supports | Changing an option changes only that setting; switching interface language is a button. |
| 3.2.3 Consistent Navigation | AA | Supports | Studio navigation is the same on every view. |
| 3.2.4 Consistent Identification | AA | Supports | Same names for the same functions throughout. |
| 3.2.6 Consistent Help | A | Supports | `<fidel-help>` lists the help routes the host gives (text chat first, phone last). The Savanna rebuild has it in the footer of every page. Hosts must put it in the same place on each page. |
| 3.3.1 Error Identification | A | Supports | Errors are described in words (e.g. "Not saved: Chapter 2 has a time that is not valid. Use minutes:seconds, like 1:30."). |
| 3.3.2 Labels or Instructions | A | Supports | Visible labels and short hints on all fields. |
| 3.3.3 Error Suggestion | AA | Supports | Error messages say how to fix the problem. |
| 3.3.4 Error Prevention (Legal, Financial, Data) | AA | Supports | Deleting a job and revoking a certificate ask for confirmation. |
| 3.3.7 Redundant Entry | A | Supports | No information has to be entered twice. |
| 3.3.8 Accessible Authentication (Minimum) | AA | Supports | Staff sign in with a token that can be pasted or filled by a password manager; no cognitive test. |

### 4. Robust

| Criterion | Level | Result | Notes |
|---|---|---|---|
| 4.1.1 Parsing (WCAG 2.0 / 2.1 only; obsolete in 2.2) | A | Supports | Pages are generated by the browser's DOM APIs and checked by axe; no duplicate IDs (each element gets a unique id). W3C made this criterion obsolete in WCAG 2.2 because browsers now repair markup consistently. |
| 4.1.2 Name, Role, Value | A | Supports | Native controls where possible; toggle buttons expose `aria-pressed`. All player controls are native `<button>` elements (Able Player patched at build time; see `player/patches/`). Checked with an accessibility-tree walk-through (471 Tab stops) and Windows Narrator; transcript chapter titles now have the button role. NVDA and TalkBack checks pending. |
| 4.1.3 Status Messages | AA | Supports | Search results count, saving, upload progress, pipeline changes, the draft-caption notice and "Saved for offline" are announced through `role="status"` without moving focus. |

## Known limitations

- **Manual testing not finished.** Windows Narrator: done by a team member,
  problems fixed. NVDA, TalkBack and the co-designer doing the main task unaided:
  not yet done; see [docs/manual-testing.md](docs/manual-testing.md).
- **No real Ethiopian Sign Language clip yet.** The sign window works, but the
  demo uses a placeholder clip until an interpreter's recording is added.
- **Amharic and Afaan Oromo interface text** was written with machine help and
  still needs review by fluent speakers (list in BACKLOG.md).
- **Machine-read description audio is not labelled in the player.** Studio
  marks it and the job card says when a summary is a computer voice, but the
  player does not yet tell learners.
- **Sign-language window on iPhone/iPad**: iOS does not allow two videos to play
  at once, so Able Player does not offer the sign window there.
- **Machine captions are drafts.** Lessons meet 1.2.2 only after staff check the
  captions; the player says clearly when Amharic captions are not yet checked.
- **Amharic speech**: phones rarely have an Amharic voice, so Amharic audio
  description and job summaries need recordings made by staff.
- **LTI pages: no screen-reader check yet.** The automated checks below pass,
  and the whole flow works inside a real Moodle 4.5 course (automated test);
  NVDA on these pages, inside Moodle, is not yet done.

## Narrator findings (15 November 2026)

A team member tested with Windows Narrator and recorded the screen. What
Narrator did wrong, and what we changed:

| Narrator said | Cause | Fix |
|---|---|---|
| "Play from one hundred twenty-three" for "1:23" | Screen readers read video times as numbers | Times stay on screen; screen readers also hear them in words, e.g. "Play from 1:23 (1 minute 23 seconds)" |
| The whole page at once, after "Skip to lesson" | The skip link moved focus to `<main>`, and Narrator reads a focused container in full | Skip links land on the page's heading (also our Savanna patch) |
| "Midnight slash 239" for the player's "0:00 / 2:39" | The time display looked like a clock time | On screen as before; screen readers get "0 seconds of 2 minutes 39 seconds" |
| Nothing for "አማርኛ" | Windows has no Amharic voice | Language options and buttons also have "(Amharic)" for screen readers |

The walk-through of the accessibility tree also found transcript chapter titles
that could be focused but had no role; they are buttons now.

## LTI pages (lessons opened from Moodle or Canvas)

Pages Fidel shows inside a course page or a new window when LTI 1.3 is switched
on (README, "LTI 1.3"): the sign-in page ("Signing in…", "Open in a new
window"), the in-course lesson page (the normal `<fidel-player>`, "Mark as
complete", "Saved to your course", "Try again"), the teacher's lesson picker,
the problem pages, and Studio's LMS connections page. Automated: axe 0
critical/serious; no sideways scrolling at 200% and 400% zoom; the picker,
"Mark as complete" and "Try again" by keyboard only; Studio's page in the gate
at 100/200/400% zoom (e2e/tests/lti.spec.js, lti-launch.spec.js). The flow
also runs inside a real Moodle 4.5 course (e2e/tests/moodle.spec.js).
Screen-reader checks: not yet done.

| Criterion | Status | Notes |
|---|---|---|
| 1.3.1 Info and Relationships | Supports | Picker: a `<fieldset>` with `<legend>` around native radio buttons, each with a `<label>`; the search box has a `<label>` and its hint is tied to it (`aria-describedby`). |
| 1.4.1 Use of Color | Supports | Results and problems are words ("✓ Saved to your course", "Not saved…") with a border, not colour alone. |
| 1.4.10 Reflow | Supports | Tested at 200% and 400% zoom (320 CSS px): no sideways scrolling on the lesson page, the picker and the problem page. |
| 2.1.1 Keyboard | Supports | Picker: Tab to search, type, Tab to the list, Space to choose, Tab to "Add to course", Enter; Enter in the search box does not submit. "Mark as complete" and "Try again" are native buttons. |
| 2.2.1 Timing Adjustable | Supports (essential limit) | The sign-in must finish within 10 minutes and the picker within an hour: these limits are part of the security checks (a one-time sign-in), so they count as essential. Both happen without the learner's action in under a second; if a limit passes, the page says so in words and how to start again. |
| 3.1.1 / 3.1.2 Language | Supports | The lesson page and the picker follow the course's language (Amharic or English); every message is in both languages, each part marked `lang`. |
| 3.3.1 Error Identification | Supports | Every refused launch says what happened and what to do, in English and Amharic, with a reason code for administrators; "Add to course" with nothing chosen says "Choose a lesson first." |
| 4.1.3 Status Messages | Supports | "Signing you in…", "Checking your sign-in…", "Saving to your course…", "Saved to your course" and the filtered lesson count are `role="status"`; problems are `role="alert"`. |

## Component library (`demo/components.html`)

Notes per package, for the WCAG criteria each component touches.

<!-- PACKAGE A START -->
**Package A: reading and understanding** (`<fidel-code-block>`, `<fidel-code-snapshots>`,
`<fidel-described-image>`, `<fidel-word>`, `<fidel-read-aloud>`, `<fidel-steps>`,
`<fidel-simple-mode>`). Automated: axe 0 critical/serious at 100/200/400 % zoom, with
every dialog and description open and with an Amharic interface; no sideways
scrolling at 320 px; keyboard path (e2e/tests/components-a.spec.js). Manual
screen-reader and Braille checks: not yet done.

| Criterion | Status | Notes |
|---|---|---|
| 1.1.1 Non-text Content | Supports | `<fidel-described-image>` always has `alt` (empty plus a warning if the author forgot it, never the file name) and a long description in real text. Code is never an image. Line numbers are hidden from screen readers. |
| 1.3.1 Info and Relationships | Supports | Real `<figure>`/`<figcaption>`, `<details>`, `<pre><code>`, `<ol>`, headings for steps, `<label>` for the checkbox, `<dialog>` named by its heading. |
| 1.4.1 Use of Color | Supports | Current snapshot: bar + tint + the word "Now". Read-aloud: background + underline. Toggles show On/Off text; disabled buttons are dashed. |
| 1.4.3 / 1.4.11 Contrast | Supports | Text 4.5:1 or more (accent #0b4f9c 8.3:1); control borders and focus 3:1 or more. |
| 1.4.4 / 1.4.10 Resize, Reflow | Supports | Sizes in rem; no sideways scrolling at 320 px. Code longer than the screen scrolls inside its own focusable box (code needs two-dimensional layout, an allowed exception). |
| 1.4.12 Text Spacing | Supports | No fixed heights on text. With the WCAG test spacing applied to `demo/components.html`, no text is cut off and nothing scrolls sideways (automated, `wcag-checks.spec.js`). |
| 2.1.1 Keyboard / 2.1.2 No Keyboard Trap | Supports | All real buttons, `<details>`, checkbox; line view uses arrow keys (one Tab stop); Escape closes dialogs and stops reading. Tested by e2e. |
| 2.2.2 Pause, Stop, Hide | Supports | Reading aloud starts only on Listen, and Stop / Escape stop it. |
| 2.4.3 Focus Order / 2.4.11 Focus Not Obscured | Supports | Focus moves to the step heading on Previous/Next; dialogs return focus to the word; nothing is sticky. |
| 2.4.7 Focus Visible | Supports | 3 px accent outline plus a white ring. |
| 2.5.8 Target Size | Supports | Buttons at least 44 × 44 px; the dotted word button is inline text (allowed exception). |
| 3.1.2 Language of Parts | Supports | `lang="am"` on Amharic meanings, labels and step text; code is `lang="en"`. Amharic interface text needs review by a fluent speaker (BACKLOG). |
| 3.1.3 / 3.1.5 Unusual Words, Reading Level (AAA, extra) | Partially supports | `<fidel-word>` and `<fidel-simple-mode>` give meanings and simpler text; their content is written by people. |
| 4.1.2 Name, Role, Value | Supports | `aria-pressed` on toggles, `aria-expanded` on Read line by line, `aria-current="time"` on the current snapshot. |
| 4.1.3 Status Messages | Supports | Shared announcer: "Copied", "Code for 1:23 is ready" (once per snapshot), steps done count, "Simple version shown". |
<!-- PACKAGE A END -->

<!-- PACKAGE B START -->
### Package B: data saver, offline status, download later, Ethiopian date, section language, display settings

| Criterion | Level | Status | Notes |
|---|---|---|---|
| 1.3.1 Info and Relationships | A | Supports | Real `<button>`, `<a href>`, `<dialog>`, `<details>`, `<time datetime>`, `<fieldset>`/`<legend>` radios, `<label>`ed checkboxes. Language buttons are a labelled `role="group"`. |
| 1.3.2 Meaningful Sequence | A | Supports | `<fidel-lang>` sets `dir="rtl"` on Arabic content. |
| 1.4.1 Use of Color | A | Supports | Offline/online and the current language are said in words (and a ✓), not only colour. |
| 1.4.3 / 1.4.11 Contrast | AA | Supports | axe clean; text ≥ 4.5:1, borders and focus rings ≥ 3:1. |
| 1.4.4 Resize Text | AA | Supports | Sizes in `rem`; display settings add 125–200 % text to the target. Text sized in `px`/`rem` inside a host target does not grow with that setting (browser zoom still works). |
| 1.4.10 Reflow | AA | Supports | No sideways scrolling at 320 px (400 %), also with 200 % text and wide spacing applied (e2e). |
| 1.4.12 Text Spacing | AA | Supports | "Wide" spacing sets line-height 2 and word spacing 0.16em; no letter-spacing (Ethiopic). |
| 2.1.1 Keyboard / 2.1.2 No Keyboard Trap | A | Supports | Every control reached with Tab (e2e); Escape closes the dialog. |
| 2.2.2 Pause, Stop, Hide | A | Partially supports | "Stop motion" stops CSS animation and transitions and pauses autoplaying/looping videos in the target. It cannot stop animated GIFs or scripted animation in host content. |
| 2.4.3 Focus Order | A | Supports | Focus returns to "Display settings" when the dialog closes; after queueing or cancelling a download, focus moves to the new button. |
| 2.5.8 Target Size | AA | Supports | Buttons and links at least 44 × 44 px. |
| 3.1.2 Language of Parts | AA | Supports | Each calendar in `<fidel-ethiopian-date>`, each language button and each version in `<fidel-lang>` has its own `lang`; buttons have `translate="no"`. |
| 3.2.2 On Input | A | Supports | Display settings apply at once but only change presentation; nothing navigates. |
| 4.1.2 Name, Role, Value | A | Supports | Native elements; current language by `aria-current="true"`. |
| 4.1.3 Status Messages | AA | Supports | Offline/online (only on change), "is ready offline", "Showing Amharic" through the shared polite announcer. Not tested yet with NVDA/TalkBack. |

Not an overlay: `<fidel-display-prefs>` only changes presentation of content
that is already accessible, and only inside its `target` and Fidel's own
components.
<!-- PACKAGE B END -->

<!-- PACKAGE C START -->
### Package C: sign term, visual alert, step nav, session keeper, lesson map, help

Checked by `e2e/tests/components-c.spec.js` (axe at 100/200/400 %, every dialog
open, Amharic) and `player/test/components-c.test.js`. The checks by people (screen readers, Braille displays and
TalkBack) are not done yet; see docs/manual-testing.md.

| Criterion | Status | Notes |
|---|---|---|
| 1.1.1 Non-text content | Supports | Icons (✋, 🔔, arrows) are `aria-hidden`; every control has a text name. The sign clip has a figcaption and a written meaning. |
| 1.2.1 Audio-only and video-only | Partially supports | The sign clip is video-only; its written meaning is the alternative. No real Ethiopian Sign Language clips are recorded yet (the demo uses a placeholder). |
| 1.3.1 Info and relationships | Supports | Real `<nav>`, `<ul>`, `<dialog>` with a heading, `<figure>`/`<figcaption>`, `<progress>`, checkboxes with `<label>`. |
| 1.4.1 Use of colour | Supports | Pressed buttons show ✓; alert banners have an icon, a thick border and text. |
| 1.4.3 / 1.4.11 Contrast | Supports | Text is at least 4.5:1; borders and focus outlines are at least 3:1 (axe finds no issues). |
| 1.4.4 / 1.4.10 Resize and reflow | Supports | Sizes in `rem`; no sideways scrolling at 320 px (tested at 200 % and 400 %). |
| 1.4.12 Text spacing | Supports | No fixed heights on text; Amharic line-height 1.7. Checked with the WCAG test spacing on `demo/components.html` (automated, `wcag-checks.spec.js`). |
| 2.1.1 / 2.1.2 Keyboard, no trap | Supports | Only native buttons, links and checkboxes; Escape closes every dialog. A Tab-through test checks this. |
| 2.2.1 Timing adjustable | Supports | `<fidel-session-keeper>` warns at least 20 s before the time-out, focuses "Yes, more time", allows at least 10 extensions, and offers "Never time me out". Alerts stay until closed by default. The host must still extend its own session when it receives `fidel-session-extend`. |
| 2.2.2 Pause, stop, hide | Supports | The looping sign clip has a Pause button. It does not start by itself when the learner prefers reduced motion. |
| 2.3.1 Three flashes | Supports | Nothing flashes; alerts appear once without animation. |
| 2.4.3 Focus order | Supports | Focus moves into each dialog and back to the button that opened it. Closing an alert moves focus to the next alert, or to the settings if there is none. |
| 2.4.11 Focus not obscured | Supports | Step nav and alerts are in the page flow, never fixed or sticky. |
| 2.5.8 Target size | Supports | Buttons are at least 44 × 44 px; step-nav links are at least 48 px tall. The sign-term word sits inside a sentence, so it uses the exception for inline targets (it is at least 24 px tall). |
| 3.1.2 Language of parts | Supports | `lang` is set on each component and on Amharic meanings and labels that come from attributes. An Amharic speaker still needs to review the Amharic text (BACKLOG.md). |
| 3.1.3 Unusual words | Supports | `<fidel-sign-term>` gives a meaning (and sign) for tech words. |
| 3.2.6 Consistent help | Supports when placed consistently | `<fidel-help>` gives text chat, email, an interpreter video call and phone. The host must put it in the same place on every page. |
| 4.1.2 Name, role, value | Supports | Native elements; `aria-pressed` on Slower; `aria-haspopup="dialog"` on the buttons that open dialogs. |
| 4.1.3 Status messages | Supports | Alerts, "Time extended" and the "Where am I?" answer go through the shared polite announcer; progress is never announced by itself. |
<!-- PACKAGE C END -->

<!-- PACKAGE D START -->
### Package D: caption reports, sound-off check, Amharic keyboard, event card, sign answers, reading guide, Savanna patch

| Criterion | Level | Support | Notes |
|---|---|---|---|
| 1.2.2 Captions (Prerecorded) | A | Supports | Learners can report wrong or missing captions and missing sound descriptions; staff see the reports in Studio. |
| 1.3.1 Info and Relationships | A | Supports | "What is wrong?" is a `<fieldset>` with `<legend>` and radio buttons; every field has a label. |
| 2.1.1 Keyboard | A | Supports | Button, dialog, radios and Send all work with the keyboard; Escape closes the dialog and returns focus. |
| 2.4.1 Bypass Blocks | A | Supports (Savanna page, with our patch) | Savanna's starter has no skip link; our patch adds "Skip to the lesson". |
| 2.4.11 Focus Not Obscured (Minimum) | AA | Supports (Savanna page, with our patch) | The patch keeps the focused element out from under Savanna's fixed bars. |
| 3.3.1 Error Identification | A | Supports | Bad time or a too-long correction is explained in words, next to the field. |
| 3.3.2 Labels or Instructions | A | Supports | The dialog says what is sent and that no name is needed. |
| 4.1.3 Status Messages | AA | Supports | "Thank you. A person will check it." and "Saved on this phone…" are announced. |
| 1.2.2 Captions (Prerecorded), sound descriptions | A | Supports (Studio tool) | Studio's sound-off check lists silent gaps over 3 s and adds [sound] captions in every caption language; a person still has to watch with the sound off. |
| 1.3.1 Info and Relationships (D4-D7) | A | Supports | Keyboard steps, event access needs and reading-guide modes are labelled groups; the event card is a heading plus a description list. |
| 1.4.1 Use of Color | A | Supports | Pressed buttons show a check mark; the reading guide uses a thick outline, not colour alone; "Recording" is written in words. |
| 1.4.10 Reflow | AA | Supports | All Package D parts and dialogs fit 320 px (tested at 400% zoom); the keyboard grid wraps. |
| 2.1.1 Keyboard (D4-D7) | A | Supports | Amharic keyboard: one Tab stop, arrows/Home/End, Enter/Space, Escape; reading guide has Next/Previous line buttons for keyboard and switch users. |
| 2.4.3 Focus Order | A | Supports | Sign-answer steps move focus to each step's heading; dialogs return focus to their opener; the keyboard returns to the letters after each letter. |
| 2.5.8 Target Size (Minimum) | AA | Supports | Every Package D button is at least 44 x 44 px. |
| 3.1.2 Language of Parts | AA | Supports | Ethiopic letters, Amharic captions and dates carry `lang="am"`; each letter button's name adds a Latin reading. |
| 4.1.2 Name, Role, Value | A | Supports | Toggles use `aria-expanded` / `aria-pressed`; all controls are native buttons, links, radios and checkboxes. |
| Camera (rule 5) | - | Note | The camera and recording start only when the learner presses a button, are shown while on ("Camera on", "Recording") and have Stop buttons. |
<!-- PACKAGE D END -->

<!-- PACKAGE FORMS START -->
### Form fields: input, textarea, form, error summary, choice, select, file, date

| Criterion | Level | Support | Notes |
|---|---|---|---|
| 1.3.1 Info and Relationships | A | Supports | Real `<label for>`, `<fieldset>`/`<legend>` for choices, hints and errors tied with `aria-describedby`, all in the light DOM. The visible "(required)" is hidden from screen readers because the field's own `required` already says it. |
| 1.3.5 Identify Input Purpose | AA | Supports | `autocomplete` is passed through; `phone-et` sets `tel-national` and `email` sets `email` unless the page sets its own. The page must set it for names (the demo does). |
| 2.2.1 Timing Adjustable | A | Supports (with `<fidel-form>`) | Every field is saved as a draft on the device as you type and put back after a reload or a session time-out. Not on forms without `<fidel-form>`. |
| 2.5.8 Target Size (Minimum) | AA | Supports | Fields, buttons and whole choice rows are at least 44 px tall; summary links are padded to 44 px. |
| 3.1.2 Language of Parts | AA | Supports | `lang` of the content is set on the field itself; our messages have the interface language; each choice option can have its own `lang`. |
| 3.3.1 Error Identification | A | Supports | The error is in words under the field ("⚠ Use minutes:seconds, for example 1:23.5"), the field gets `aria-invalid`, and the error summary lists every field with a link. Not colour alone. |
| 3.3.2 Labels or Instructions | A | Supports | A visible label is required; hints say the expected form; file fields say the types and size in words. Placeholders are never used as labels. |
| 3.3.3 Error Suggestion | AA | Supports | Every message says how to fix it (an example time, phone number or email; the largest file size; the accepted types; the earliest date). |
| 3.3.7 Redundant Entry | A | Supports (with `<fidel-form>`) | Answers are kept in the draft and after a failed or offline send, so nothing has to be typed twice. Sensitive fields are not kept by design and must be entered again after a reload. |
| 4.1.2 Name, Role, Value | A | Supports | Only native inputs, textareas, selects, checkboxes, radios, file and date fields and buttons; "Listen" buttons include the field's name. |
| 4.1.3 Status Messages | AA | Supports | Errors (when leaving a field), "Fixed", the keyboard and Caps Lock hints, "Draft saved" (said once), "Sent", "Saved on this phone", the chosen file and the number of matching options are announced through the shared polite announcer, and are also visible. |
| Speech (rule 2) | - | Note | The typing voice and Listen start only by the user's choice; nothing speaks by itself, so screen-reader users do not hear things twice. |
| Native date field | - | Partially supports | The date picker is the browser's own: its look and its Amharic support vary between browsers and phones. The Ethiopian date under it is always in words. |
<!-- PACKAGE FORMS END -->

<!-- PACKAGE E START -->
### Package E: lesson formats, questions and voice notes, callouts, tables, notes, quiz, progress, mark complete, skip link, toggletip, reading font

| Criterion | Level | Support | Notes |
|---|---|---|---|
| 1.3.1 Info and Relationships | A | Supports | Format choice is a `<fieldset>`/`<legend>`; quiz questions are fieldsets with legends and native radios/checkboxes; callouts have real headings; `<fidel-table>` keeps the `<table>`, adds `<th scope>` and explicit table roles so card layout stays a table for screen readers. Missing `<caption>` is only warned about, not fixed. |
| 1.4.1 Use of Color | A | Supports | Callout type is a word ("Warning:") plus border style and background; chosen format, Mark as complete and quiz feedback have a tick/cross and words; the recording banner says "Recording". |
| 1.4.10 Reflow | AA | Supports | Tested at 320 px / 400% zoom: no sideways scrolling, including `<fidel-table>` (rows become "Header: value" cards) and the question dialog. |
| 2.1.1 Keyboard | A | Supports | Every control is a native button, link, radio, checkbox or field; e2e tabs through the whole section. Escape closes the question dialog (focus back to its opener), the toggletip and the notes edit form. Table sort buttons stay reachable in card layout. |
| 2.2.1 Timing Adjustable | A | Supports | `<fidel-quiz>` has no time limit unless `time-limit` is set; then it warns 1 minute before the end, "Add 5 minutes" and "Switch the timer off" are always there, and the timer starts only when the learner enters the quiz. |
| 2.4.1 Bypass Blocks | A | Supports (when placed first) | `<fidel-skip-link>` moves focus to the lesson. It is the first Tab stop only if the page puts it first in `<body>`; on the shared demo page it is at the top of the Package E section. |
| 2.4.3 Focus Order | A | Supports | Focus moves to: quiz feedback after "Check answer"; the voice-note step headings; the new note after Save; Undo after Delete; the restored note after Undo; the opener after the dialog closes. |
| 2.5.8 Target Size (Minimum) | AA | Supports | Buttons, transcript times, note buttons and quiz rows are at least 44 px tall. The inline toggletip button is 44 px tall. |
| 3.3.1 Error Identification | A | Supports | Question dialog and notes: wrong time ("Use minutes:seconds…", from `<fidel-input format="mmss">`), empty question, "Record your question first" are in words; server 400 reasons are shown. |
| 3.3.2 Labels or Instructions | A | Supports | Every field has a visible label and hint; the voice note says nothing is recorded or sent until the learner chooses, and that the voice is not turned into text; notes say they stay on this device. |
| 4.1.2 Name, Role, Value | A | Supports | `aria-pressed` on format buttons and Mark as complete (with `aria-disabled` + a hint before the end, so it stays focusable); `aria-expanded` on the toggletip and "Answer in your own way"; `aria-sort` on sorted columns. |
| 4.1.3 Status Messages | AA | Supports | Format changes, "Recording", question sent / saved offline / sent later, note added / deleted / restored, sorting, quiz score, timer warning (assertive), "Lesson marked complete" are announced through the shared announcer and are visible. Progress is announced only on request ("Say my progress"). |
| Microphone and camera (rule 5) | - | Note | Asked for only after "Start recording" / "Start camera", shown while on, turned off as soon as recording stops or the dialog closes. No speech-to-text. |
| Reading font (E8) | - | Note | Easy-read font is an option only; it does not change Ethiopic text, code or icon fonts. |
<!-- PACKAGE E END -->
