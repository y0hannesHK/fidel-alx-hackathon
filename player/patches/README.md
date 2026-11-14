# Able Player patches

We have **not** edited any Able Player file in `node_modules`. Changes are made
in two ways.

**1. A build-time patch**, [`able-real-buttons.js`](able-real-buttons.js), applied
by Vite while bundling: the control bar uses real `<button>` elements instead of
`<div role="button">` (the hackathon's gate checklist requires real elements).
Each replacement must match exactly once or the build fails, so an Able Player
upgrade cannot silently undo it.

**2. Wrapped methods** on `AblePlayer.prototype`, in
[`../src/able-extensions.js`](../src/able-extensions.js):

| Method wrapped | Why |
|---|---|
| `getSupportedLangs` | Adds Amharic (`am`) as an interface language. |
| `getTranslationText` | Loads our Amharic strings (`../i18n/am.json`); renames "Auto scroll" to "Follow along" and Rewind/Forward to "Back/Forward 10 seconds". |
| `getSampleDescriptionText` | Stops a crash: Able Player looks up a sample text for every language in its private table, which has no Amharic. |
| `getAvailablePreferences` | Makes the transcript keyboard-usable by default. |
| `showDescription` | Plays staff-recorded audio descriptions (needed for Amharic). |
| `injectSignPlayerCode` | Fixes the sign video file type (Able Player 5.0.0 turns `sign.webm` into `video/ebm`, which browsers will not play). |

When upgrading Able Player, check these methods still exist and re-run the
tests in `e2e/`.
