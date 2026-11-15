# Backlog

Known issues and agreed follow-ups, with the phase they are planned for.

## Open

- **REMINDER (B1, a teammate is doing it): interface text in JSON files**
  (`i18n/en.json`, `am.json`; adding a language = one file, as the Team
  Technical Guide asks). Then: `translate="no"` on language names, "Fidel" and
  key names; a MADLAD tool that drafts a new language file, reviewed in Studio
  before learners see it.

- **Glossary for reviewers (suggestion, not yet agreed).** MADLAD mistranslates
  key words for our audience ("disability" became "street people" or
  "affected people"; "captions" became "titles"; "fails" became "succeeds").
  Idea: a staff-edited glossary; Studio highlights captions containing those
  terms so reviewers check them first.
- **Improve the Amharic text** (captions draft, `player/i18n/am.json`,
  `player/src/strings.js`). Reviewed once: acceptable, but needs polish.

## Before the demo

- **Manual tests with NVDA, TalkBack and the co-designer** (twice before the
  pitch): checklists in docs/manual-testing.md; add results to CONFORMANCE.md.
- **Team names** in README Credits; co-designer only with consent.
- **Merge** the phase branches into `main` (they are stacked:
  phase-8-submission contains everything).

- **Test the offline page on a real Android phone in airplane mode** (automated
  tests block the network in desktop Chrome; a phone check is still needed).

- Replace `data/demo/sign.webm` (colour-bar test pattern) with a real EthSL
  recording.
- Speaker's name tile is visible in the demo clip: confirm consent or choose
  another section.

## Phase 7 (bonus, not started: needs new dependencies, ask first)

- Accessible HTML + **tagged PDF** of each lesson (WeasyPrint, BSD licence) with
  slide images and staff-written alt text.
- **Braille** export `.brf` (liblouis, LGPL).
- **Recorded live-session viewer** with captions and a timestamped chat log
  (needs the Zoom chat export).

## Later / reminders

- **Afaan Oromo, beyond captions.** Captions (draft, reviewed in Studio) are
  done. Not yet in Afaan Oromo: the player's interface text, the draft notice
  sentence, the offline lesson, PDF and Braille. These need text written by a
  fluent Oromo speaker. MADLAD's Oromo output is weak: always review.

- **Offline page has no description recordings.** Descriptions appear as text
  in the one-page lesson; recordings play only in the online player.
- **Amharic voice engine: decisions for Amharic speakers.** (1) Listen to the
  test recordings in `data/model-tests/outputs/toucan/` and decide whether the
  voice is good enough to offer at all. (2) Ejectives (ጵ ቀ ጥ ጠ ቅ) are read as
  plain p/k/t by default; `TOUCAN_EJECTIVE_MARK=1` tries the ejective sound:
  compare `amh_*.wav` with `amh_*_ejectivefix.wav`. (3) Review the job card's
  new Amharic sentence `machineReadAm` in `player/src/job-card.js`.
- **Machine-read description audio is not labelled for learners.** It is now
  made automatically for Amharic and Afaan Oromo. Studio marks it, the job
  card says so for summaries, and the lesson manifest has `machine_read` for
  each recording, but the player does not yet tell learners it is a computer
  voice.
- **Afaan Oromo voice and captions: test with a speaker.** The voice is a best
  guess (Oromo is not in the voice's training data), and Oromo speech-to-text
  has not been tried on a real clip.

- **Addis AI translation provider (reminder for the user).** Left out in
  Phase 3 because we have no API key or docs to test it. The translator slot is
  pluggable (`server/app/providers/`), so it can be added once a key exists.
  Must stay off by default and only run when the key is set.
- **Amharic speech-to-text: measure caption quality.** Omnilingual ASR (optional
  engine) is in. On one 20-second clip an Amharic speaker judged the captions
  good (15 Nov 2026), but there is no measured error rate yet. Measure the character error rate on a few
  reviewed Amharic lessons. Afaan Oromo and Tigrinya are supported by the model
  but untested: add them to `FIDEL_OMNIASR_LANGUAGES` only after a test.
- **Somali voice: not offered.** ToucanTTS reaches Somali only through
  Transphone, a model from another publisher, which we chose not to load.
- **Unpublished lesson files.** Phase 4 hides unpublished lessons from the API,
  but their files (/files/lessons/ID/...) can still be opened by anyone who
  knows the random 12-character id.

## Done

- Amharic chapter titles (`chapters-am`) and `lang="en"` on English chapter
  titles inside an Amharic transcript (Phase 4).

## Component library: not finished, Amharic to review, placeholders

<!-- PACKAGE A START -->
<!-- PACKAGE A END -->

<!-- PACKAGE B START -->
<!-- PACKAGE B END -->

<!-- PACKAGE C START -->
<!-- PACKAGE C END -->

<!-- PACKAGE D START -->
- **Package D: all items D1-D7 done** (resumed after the usage limit).
- **Studio caption editor shows empty text boxes** (found while testing D2/D3,
  not fixed: `studio/js/util.js` `h()` sets a `<textarea>`'s `value` with
  `setAttribute`, which a textarea ignores). Staff see blank caption boxes; the
  saved text is unchanged unless they type. Fix: set `el.value` for
  textareas in `h()` (or in caption-editor.js).
- **Caption reports from other websites:** the server's CORS rule allows only
  GET, so a player embedded on another domain cannot POST a report (it is
  kept on the device and never sent). Allow POST for `/caption-reports` if needed.
- **"Sound-off check done"** is remembered per browser (localStorage), not on
  the server.
- **Sign-language answers storage policy:** Fidel has no endpoint for them;
  the host decides. If we add one: store like lesson files, no personal data,
  delete after the course, document in OpenAPI.
- **Tigrinya keyboard layout** (`layout="tigrinya"` on
  `<fidel-amharic-keyboard>`: the ቐ row and Tigrinya punctuation) not done.
- **Savanna starter defects not patched** (they do not block the player): the
  menu button is a `<div>` with a click handler (sidebar unreachable by
  keyboard when collapsed at 200%/400%), the logo link and several image links
  have no accessible name, some images use a file name as alt text.
- **Event card times** are shown in the learner's time zone; the Ethiopian
  date is the Addis Ababa date; Ethiopian clock time (6-hour offset) is not shown.
- **Server error messages** for caption reports are in English even when the
  component's interface is Amharic.
- **Package D Amharic text to review:** `player/i18n/components-d.am.json`
  (written by an AI, not a native speaker).
- **Caption-report abuse limit** is counted in memory: it resets on restart and
  is per server process.
<!-- PACKAGE D END -->
