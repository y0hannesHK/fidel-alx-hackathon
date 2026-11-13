# Backlog

Known issues and agreed follow-ups, with the phase they are planned for.

## Open

- **Glossary for reviewers (suggestion, not yet agreed).** MADLAD mistranslates
  key words for our audience ("disability" became "street people" or
  "affected people"; "captions" became "titles"; "fails" became "succeeds").
  Idea: a staff-edited glossary; Studio highlights captions containing those
  terms so reviewers check them first.
- **Improve the Amharic text** (captions draft, `player/i18n/am.json`,
  `player/src/strings.js`). Reviewed once: acceptable, but needs polish.

## Before the demo

- **Test the offline page on a real Android phone in airplane mode** (automated
  tests block the network in desktop Chrome; a phone check is still needed).

- Replace `data/demo/sign.webm` (colour-bar test pattern) with a real EthSL
  recording.
- Speaker's name tile is visible in the demo clip: confirm consent or choose
  another section.
- Manual NVDA and TalkBack test (Able Player controls are `div role="button"`).

## Later / reminders

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
