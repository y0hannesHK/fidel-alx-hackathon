# Able Player patches

We have **not** edited any Able Player file. All changes to its behaviour are
made from outside, by wrapping methods on `AblePlayer.prototype`, in
[`../src/able-extensions.js`](../src/able-extensions.js):

| Method wrapped | Why |
|---|---|
| `getSupportedLangs` | Adds Amharic (`am`) as an interface language. |
| `getTranslationText` | Loads our Amharic strings (`../i18n/am.json`); renames "Auto scroll" to "Follow along" in English. |
| `getSampleDescriptionText` | Stops a crash: Able Player looks up a sample text for every language in its private table, which has no Amharic. |
| `getAvailablePreferences` | Makes the transcript keyboard-usable by default. |
| `injectSignPlayerCode` | Fixes the sign video file type (Able Player 5.0.0 turns `sign.webm` into `video/ebm`, which browsers will not play). |

When upgrading Able Player, check these methods still exist and re-run the
tests in `e2e/`.
