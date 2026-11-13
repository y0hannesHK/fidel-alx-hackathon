# Backlog

Known issues and agreed follow-ups, with the phase they are planned for.

## Phase 4 (Studio)

- **Amharic chapter titles.** Chapter titles come only from the English
  `chapters.vtt`, so they stay English in the Amharic transcript and Chapters
  menu. Worse, they sit inside `lang="am"` markup, so screen readers read them
  with an Amharic voice (fails WCAG 3.1.2). Fix:
  1. Add a `chapters-am` attribute (Able Player already picks the chapter track
     matching the caption language); the pipeline/Studio produces the file.
  2. Fallback: when no Amharic chapters exist, mark the English titles
     `lang="en"`.
- **Improve the Amharic text** (captions draft, `player/i18n/am.json`,
  `player/src/strings.js`). Reviewed once: acceptable, but needs polish.

## Before the demo

- Replace `data/demo/sign.webm` (colour-bar test pattern) with a real EthSL
  recording.
- Speaker's name tile is visible in the demo clip: confirm consent or choose
  another section.
- Manual NVDA and TalkBack test (Able Player controls are `div role="button"`).

## Later / reminders

- **Addis AI translation provider (reminder for the user).** Left out in
  Phase 3 because we have no API key or docs to test it. The translator slot is
  pluggable (`server/app/providers/`), so it can be added once a key exists.
  Must stay off by default and only run when the key is set.
- **Amharic speech-to-text** (`Samuael/ethiopic-asr`, needs PyTorch). Skipped
  in Phase 3 to keep the image small; lessons spoken in Amharic fail the
  transcribe step with a clear "not installed" message.
- **Unpublished lessons are public.** Phase 3 serves every lesson's manifest
  and files without a token. Phase 4 adds "publish"; then hide unpublished ones.
