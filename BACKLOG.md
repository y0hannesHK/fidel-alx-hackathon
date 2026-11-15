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

- Supply `data/demo/sign.webm` as a genuine, authorized EthSL recording. The
  demo no longer generates fake sign-language footage.
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
- **Amharic text-to-speech for descriptions** (speecht5_tts_amharic, needs
  PyTorch) not added; staff attach recordings instead.

- **Addis AI translation provider (reminder for the user).** Left out in
  Phase 3 because we have no API key or docs to test it. The translator slot is
  pluggable (`server/app/providers/`), so it can be added once a key exists.
  Must stay off by default and only run when the key is set.
- **Amharic speech-to-text** (`Samuael/ethiopic-asr`, needs PyTorch). Skipped
  in Phase 3 to keep the image small; lessons spoken in Amharic fail the
  transcribe step with a clear "not installed" message.
- **Unpublished lesson files.** Phase 4 hides unpublished lessons from the API,
  but their files (/files/lessons/ID/...) can still be opened by anyone who
  knows the random 12-character id.

## Done

- Amharic chapter titles (`chapters-am`) and `lang="en"` on English chapter
  titles inside an Amharic transcript (Phase 4).
