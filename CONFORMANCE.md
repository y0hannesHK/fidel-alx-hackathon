# Fidel: WCAG 2.2 AA conformance report

Product: **Fidel 0.8**: player, job card, offline lesson page, certificate check page, Fidel Studio.

## Conformance claim

The parts below are the ones WCAG requires in a conformance claim
(WCAG 2.0 "Required Components of a Conformance Claim", unchanged in 2.2).

| | |
|---|---|
| **1. Date** | 14 November 2026 |
| **2. Guidelines** | Web Content Accessibility Guidelines 2.2, https://www.w3.org/TR/WCAG22/ . WCAG 2.2 includes every WCAG 2.0 and 2.1 success criterion at levels A and AA (except 4.1.1 Parsing, which 2.2 made obsolete; we report it below for WCAG 2.0 readers: https://www.w3.org/TR/2008/REC-WCAG20-20081211/ ). |
| **3. Level** | AA (target). **Status: draft**: automated testing is complete and passing; manual testing with NVDA, TalkBack and our co-designer is not yet done. Until it is, this is a self-assessment, not a final claim. |
| **4. Pages covered** | Fidel is a product installed on a partner's server and embedded in their pages, so most of it has no fixed address. As WCAG allows for such products, we state that these parts **would conform when installed**: the player (`<fidel-player>`), the job card (`<fidel-job-card>`), the offline lesson page (`/api/v1/lessons/{id}/offline.html`), the certificate check page (`/verify/{id}`) and Fidel Studio (`/studio/`). Tested on our demo install: `/demo/savanna-mock/`, `/demo/savanna-mock/lesson.html`, `/demo/savanna-mock/jobs.html`, `/verify/{id}`, `/studio/`. The host page around Fidel is not covered. |
| **5. Technologies relied upon** | HTML, CSS, JavaScript, WAI-ARIA, SVG (icons), WebVTT (captions, descriptions, chapters), HTML audio/video. |

**Used but not relied upon** (everything still works without them): service
workers ("Save for offline": the download links do the same job), the browser's
speech synthesis (text descriptions and summaries are always shown as text and
reach screen readers), the Clipboard API (the link is also in a text field).

**Tested with**: Chromium (Playwright 1.65) and axe-core 4.14 on Windows,
desktop and mobile (touch, 360 px) emulation. Manual tests with NVDA, TalkBack
and Chrome on Android: pending.

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
| **axe-core 4.14** (via Playwright), WCAG 2.0/2.1/2.2 A and AA rules | Mock lesson page (default, every feature switched on, Amharic interface), lesson page from the API, jobs page with job card, certificate check page, offline lesson page, Studio (sign-in and lesson editor) | **0 critical, 0 serious issues** on every page and state tested |
| **Keyboard tests** (Playwright, keyboard only) | Main task: Amharic captions on, bigger captions, sign-language window, transcript search and jump, playback; caption review in Studio (Ctrl+Enter flow) | Pass |
| **Reflow tests** | 320 CSS px wide; 200% zoom on a 1280 px screen; job card at 360 px with 200% zoom (180 CSS px) | No horizontal scrolling |
| **Target size tests** | All Fidel buttons; all player controls on a touch phone | ≥ 44 × 44 px |
| **Offline test** | Offline page opened with the network switched off | Works; zero network requests |
| **Unit tests** | Caption, search, preference, calendar logic | 16 + 43 tests pass |
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
| 1.4.12 Text Spacing | AA | Supports (manual check pending) | Layouts use flexible sizes; to be confirmed with a text-spacing bookmarklet. |
| 1.4.13 Content on Hover or Focus | AA | Supports (manual check pending) | Able Player tooltips appear on hover/focus and can be dismissed with Escape; to be confirmed manually. |

### 2. Operable

| Criterion | Level | Result | Notes |
|---|---|---|---|
| 2.1.1 Keyboard | A | Supports | All functions work with the keyboard (tested). Player keys (K, Space, arrows) work while the player has focus and are listed in a "Keyboard help" dialog. Every transcript line can be reached and activated with Enter or Space; transcript lines are `role="button"` spans (Able Player's), not native buttons. |
| 2.1.2 No Keyboard Trap | A | Supports | No traps found in testing; dialogs close with Escape. |
| 2.1.4 Character Key Shortcuts | A | Supports | Able Player shortcuts need Alt+Ctrl by default and can be changed or switched off in Preferences. Studio's only shortcut is Ctrl+Enter inside a text box. |
| 2.2.1 Timing Adjustable | A | Supports | No time limits. |
| 2.2.2 Pause, Stop, Hide | A | Supports | Transcript "Follow along" scrolling can be switched off (and switches off when a keyboard user enters the transcript). Studio progress updates stop when processing ends. |
| 2.3.1 Three Flashes | A | Supports | No flashing content; `prefers-reduced-motion` respected. |
| 2.4.1 Bypass Blocks | A | Supports | Skip links on the demo pages and Studio; landmarks (`main`, `nav`, labelled sections) and headings on every page. |
| 2.4.2 Page Titled | A | Supports | Every page and Studio view has a descriptive title. |
| 2.4.3 Focus Order | A | Supports | Focus moves in reading order; after switching language or low-data mode, focus returns to the button used; Studio views focus their heading. |
| 2.4.4 Link Purpose (In Context) | A | Supports | Links say where they go (e.g. "Download lesson for offline use (sound and text)"). |
| 2.4.5 Multiple Ways | AA | Not applicable | Fidel provides components inside the host platform's pages; the platform provides navigation. |
| 2.4.6 Headings and Labels | AA | Supports | Descriptive headings; every field has a visible label. |
| 2.4.7 Focus Visible | AA | Supports | Strong two-colour focus ring on all controls. |
| 2.4.11 Focus Not Obscured (Minimum) | AA | Supports (manual check pending) | Studio's sticky caption toolbar leaves room with `scroll-padding-top`; floating sign window can be docked instead. To be confirmed manually. |
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
| 3.1.2 Language of Parts | AA | Supports | `lang="am"`/`lang="en"` on captions, transcripts, summaries, language names and chapter titles (English chapter titles inside Amharic transcripts are marked English). |
| 3.2.1 On Focus | A | Supports | Focus never triggers a change of context (it only switches off "Follow along", which the learner can switch back on). |
| 3.2.2 On Input | A | Supports | Changing an option changes only that setting; switching interface language is a button. |
| 3.2.3 Consistent Navigation | AA | Supports | Studio navigation is the same on every view. |
| 3.2.4 Consistent Identification | AA | Supports | Same names for the same functions throughout. |
| 3.2.6 Consistent Help | A | Not applicable | No help mechanism yet. |
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
| 4.1.2 Name, Role, Value | A | Supports | Native controls where possible; toggle buttons expose `aria-pressed`. All player controls are native `<button>` elements (Able Player patched at build time; see `player/patches/`). To be confirmed with NVDA/TalkBack. |
| 4.1.3 Status Messages | AA | Supports | Search results count, saving, upload progress, pipeline changes, the draft-caption notice and "Saved for offline" are announced through `role="status"` without moving focus. |

## Known limitations

- **Manual screen reader testing not yet done** (NVDA, TalkBack). Planned with
  our co-designer; see [docs/manual-testing.md](docs/manual-testing.md).
- **Sign-language window on iPhone/iPad**: iOS does not allow two videos to play
  at once, so Able Player does not offer the sign window there.
- **Machine captions are drafts.** Lessons meet 1.2.2 only after staff check the
  captions; the player says clearly when Amharic captions are not yet checked.
- **Amharic speech**: phones rarely have an Amharic voice, so Amharic audio
  description and job summaries need recordings made by staff.

## Component library (`demo/components.html`)

Notes per package, for the WCAG criteria each component touches.

<!-- PACKAGE A START -->
<!-- PACKAGE A END -->

<!-- PACKAGE B START -->
<!-- PACKAGE B END -->

<!-- PACKAGE C START -->
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
