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
**Package A (reading and understanding)**: all seven components are finished and on the demo page.

- **Amharic to review by a fluent speaker:** every string in
  `player/i18n/components-a.am.json` (interface text and the code-symbol words,
  e.g. "የመክፈቻ ቅንፍ" for "("), plus the Amharic demo text in
  `demo/components.html` (word meanings, the read-aloud paragraph, the
  "ፋይል አስቀምጥ" steps). Written by the developer, not yet checked.
- **`<fidel-word>` on narrow screens** always opens a small `<dialog>`; the task
  also allowed a disclosure under the text. Test with learners which they prefer.
- **`<fidel-word>` glossary:** `/api/v1/glossary` needs the staff token, so
  learner pages use the `meaning-en`/`meaning-am` attributes. A public,
  read-only glossary endpoint (with an English meaning field, not only `note`)
  would let one glossary feed every page.
- **`<fidel-read-aloud>`:** most phones have no Amharic voice, so Amharic needs a
  recording (`audio`); recordings play without the sentence highlight. The
  highlight uses the CSS Custom Highlight API (Chrome/Edge, Safari 17.2+,
  Firefox 140+); older browsers read without the highlight.
- **Digits in Amharic text** (e.g. "ደረጃ 1 ከ3") use Noto Sans Ethiopic's Latin
  digits, which look small; check with learners.
- **`<fidel-code-snapshots>`** demo uses the general lesson video (not a real
  coding lesson): record a short coding clip for the pitch.
- **Not yet tested by people:** NVDA, TalkBack and a Braille display on
  `demo/components.html` (see docs/manual-testing.md).
<!-- PACKAGE A END -->

<!-- PACKAGE B START -->
### Package B (data, offline, dates, language)

All six components are finished and on `demo/components.html`. Still to do:

- **Amharic to review** by an Amharic speaker: every string in
  `player/i18n/components-b.am.json`, the Amharic weekday names in
  `player/src/components/b/logic.js`, and the demo's Amharic sentences.
- **Afaan Oromo and Arabic** demo sentences in `<fidel-lang>` (demo page)
  were written by the agent: check with speakers. Tigrinya and Somali names are
  built in but not demonstrated.
- **Download later demo** uses a small demo file, not a real lesson
  (`/demo/media/chapters.vtt`): only one-page lessons are served offline by
  `/fidel-sw.js`. Try it with a published lesson's `offline.html`.
- **"Only on Wi-Fi"** cannot be tested on a desktop (no `navigator.connection.type`).
- **Display settings**: text size only grows text sized in `em`/`%`; "Stop
  motion" cannot stop GIFs. The high-contrast modes override every colour in
  the target (including the player's controls).
- **Job card** still shows both calendars itself (not `<fidel-ethiopian-date>`); fine as it is.
- Manual tests (NVDA, TalkBack, Braille) not yet done.
<!-- PACKAGE B END -->

<!-- PACKAGE C START -->
**Package C** (all six components are finished and on the demo page):
- **Sign clips are placeholders.** The demo's "log in" sign is the colour-bar
  test clip (`/media/sign.webm`). Record real Ethiopian Sign Language clips with
  interpreters (and Deaf co-designers agreeing on signs for new tech words).
  The glossary has no `sign` field yet; `<fidel-sign-term glossary="…">` reads one
  if it is added.
- **Amharic to review** (written by an AI, not a native speaker): every string
  in `player/i18n/components-c.am.json`, the two `meaning-am` texts and the
  Amharic `hours` example in `demo/components.html`. In particular: "ክፍለ ጊዜ"
  (session), "ማንቂያ" (alert), "ጊዜዬ ፈጽሞ አያልቅ" (never time me out), "ግልባጭ" (transcript).
- `<fidel-session-keeper>` times from page load (or `start()`); it does not
  watch the learner's activity. The host should call `start()` whenever its own
  session is renewed. It cannot extend the host's session by itself: the host must act on `fidel-session-extend`.
- `<fidel-visual-alert>` is in the page flow; an alert can be off-screen if
  the element is placed far from where the learner is. Consider an optional
  "show near the top" mode that does not cover focused items.
- `<fidel-step-nav>`: the arrows (← →) do not flip for right-to-left pages yet.
- `<fidel-lesson-map>`: chapter titles come from the VTT file, which is English unless `chapters-am` is given;
  the "Where am I?" answer is spoken but has no separate visible copy (the
  progress text is visible).
- People's tests (NVDA, TalkBack, Braille display) are not done yet: docs/manual-testing.md.
<!-- PACKAGE C END -->

<!-- PACKAGE D START -->
<!-- PACKAGE D END -->
