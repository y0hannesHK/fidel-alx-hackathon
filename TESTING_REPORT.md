# Functional Testing Report

**Date:** 2026-11-15
**Scope:** Fidel/Savanna demo, player, upload API, media-processing pipeline, captions, translation, sign-language processing and synchronization.

## Executive result

Docker is healthy. The owner-provided 159-second H.264/AAC video is available locally in both the Digital Bridge lesson route and a separate Whisper-caption QA route. The English/Amharic interface buttons now select only their matching caption and transcript track. A live browser check confirmed Amharic-only captions/transcript and an Amharic BSL limitation notice; English captions and the English BSL avatar played across multiple cue changes without JavaScript errors. Caption timing/translation and sign meaning still need human review. No video was sent to an external service. The actual upload API pipeline, Amharic/Oromo speech recognition, and EthSL remain incomplete. Whisper small is downloaded; MADLAD is not.

## Experimental Kozha BSL integration follow-up

The English-caption path uses a pinned, self-hosted Kozha service and an isolated BSL avatar frame. It is an experimental, non-commercial demonstration, not EthSL or a verified interpretation. Amharic captions are not sent to Kozha; no Amharic or EthSL sign output is available. A prior cue change exposed a CWASA `AnimScheduler.restart` runtime error. The frame now avoids stopping the avatar before every new cue, coordinates pause/resume with CWASA animation events, and surfaces engine errors. A live browser check confirmed English captions and avatar playback through multiple cue changes without page errors.

Browser testing exposed three integration bugs: CWASA initially requested its default external configuration, the frame called a nonexistent stop method, and repeated stops around cue replacement could break CWASA's animation scheduler. The frame now selects the self-hosted CWASA config/assets, calls the actual `CWASA.stopSiGML(0)` API only when needed, and reports asynchronous animation errors. The lesson page uses the owner-provided clip at `/media/original/lesson.mp4` with English and draft Amharic caption tracks. The legacy URL `/media/lesson.mp4` remains absent. Human caption review and fluent BSL/Amharic sign-language work are still required.

The BSL corpus contains limited reviewed entries; other words are fingerspelled or omitted with status disclosure. CWASA controls animation timing independently, so cue-following is approximate and can restart animations on resume. A fluent BSL interpreter must verify sign choices, meaning, and timing before the output is presented as an interpretation.

## Environment and test limits

- Docker Compose is healthy; the app and Kozha services are bound to `127.0.0.1:8000` and `127.0.0.1:8001`. Set `$env:FIDEL_BIND='127.0.0.1'` before a later Compose restart to keep the private video local-only.
- The host Python environment lacks FastAPI/pytest and `ffmpeg`/`ffprobe`; the running Docker image has the media tools and pytest.
- The backend test suite passes inside Docker (56 passed). Its upload test uses a generated 3-second synthetic video and fake speech-to-text/translation providers; it is not a real lesson-quality test.
- Player unit tests pass (27) and the player production build succeeds. The full Playwright suite could not launch in the CLI because its Chromium executable is not installed; the language-switch and avatar path were instead checked in the live browser.
- The live database has no Digital Bridge lesson records or sign clip. The owner-provided video and draft captions are under git-ignored `/app/data/demo/original`; the synthetic CC0 fixture is under `/app/data/demo/qa`.
- The owner-provided clip is local and not committed. `?source=lesson` pairs it with the matching Zoom-derived English and Amharic caption files. Their timing/translation review limitations are shown on the page.
- Whisper small is downloaded locally; MADLAD is not. The original CC0 flower sample is silent and not an ASR fixture; its separate synthetic QA derivative has its own generated narration and matching WebVTT.
- Two videos found in an adjacent desktop project were inspected but not adopted: its `lesson.mp4` is about 10 seconds while its fraction-lesson VTT cues continue to 116 seconds, and the video frames do not establish that transcript as its narration; `animation ved.mp4` is a real-estate/TikTok montage, not an EthSL clip. Neither is safe to pair with the lesson captions or sign panel.
- The newly provided YouTube URL identifies “DISCIPLINE | An Animated Short Film” by Day One Films and exposes an English auto-generated caption track. It does not expose Amharic or EthSL media. The Fidel player expects MP4/WebM plus WebVTT and cannot use a YouTube watch URL as its media source; an iframe test did not produce playable video in this browser (unsupported codec warning/black frame). The video was not downloaded or transcribed.

## Public EthSL dataset search

The user authorized processing the supplied film and asked to find training data for an exact, synchronized EthSL recording. No suitable public generation dataset was found:

- The 2025 [EthSL skeleton-recognition study](https://pmc.ncbi.nlm.nih.gov/articles/PMC12533181/) reports 5,600 short samples across 20 isolated signs from seven native signers. Its authors state that raw videos cannot be publicly released due to privacy and institutional restrictions; anonymized skeleton representations may be available on request. The study trains 20-class recognition classifiers, not an English-to-EthSL translation or sign-video generation model. Its isolated-sign vocabulary cannot represent a continuous interpretation of the supplied film.
- The [GitHub project claiming an EthSL dataset](https://github.com/fevasni/Ethiopian_sign_language_Dataset_with_RealTimeDetection) exposes only submodule pointers for its listed data directories; a dataset license or usable public release could not be verified.
- The other [GitHub EthSL project](https://github.com/dawitabeye/Continuous-Ethiopian-Sign-Language-Recognition-Using-Convolutional-BiLSTM-) describes recognition over 50 classes, not sign generation, and does not document a reusable licensed video corpus.
- Searches of Hugging Face, Kaggle, Zenodo, and OSF did not surface a licensed EthSL video-to-sign generation corpus.

No dataset or model was downloaded or integrated. The restricted research videos cannot be used without access approval, and the available recognition work cannot create an exact, continuous signed interpretation. Human EthSL translation and recording remain necessary.

## Pipeline audit

| Stage | Result | Evidence and remaining work |
|---|---|---|
| 1. Video upload | **API integration-tested; owner clip tested outside upload API** | Backend tests cover upload validation with a generated synthetic video. The owner-provided clip was copied to the local QA media directory, not submitted through Studio/API; the live database has no lesson record. |
| 2. Audio extraction | **Passed on the owner-provided clip** | Docker FFmpeg extracted its AAC audio to local WAV for transcription. The backend suite also exercises FFmpeg on a synthetic fixture. |
| 3. Language detection | **Limited to local test tool** | Whisper automatically detected English for this clip (confidence 0.96). The production upload pipeline still requires staff to select `spoken_language`; it does not detect language automatically. |
| 4. Speech recognition | **Runtime-tested for English; draft output** | The local Whisper small model transcribed the 159-second clip. Amharic and Afaan Oromoo are unsupported by the configured provider. Recognition errors remain possible and the transcript has not been human-reviewed. |
| 5. Caption generation | **Passed for draft WebVTT** | The local tool wrote 27 word-timed English cues and the browser loaded them. They are machine-generated drafts, not verified captions. The Amharic sample remains an unreviewed draft. The default silent flower demo has no captions; separate QA variants have their own matching audio/captions. |
| 6. Translation | **Partial / not runtime-verified** | Local MADLAD translation is configured for English-to-Amharic and English-to-Oromo. It requires a large local model (about 3 GB) and was not present. Results are explicitly drafts. Translation is performed cue by cue, which may lose context; Oromo outputs are documented as weak. No translation was verified by a fluent speaker. |
| 7. Sign-language matching | **Experimental English-to-BSL only; unverified** | English cues from the test clip are sent to local Kozha for limited corpus-backed planning, fingerspelling, or omission. There is no human-verified interpretation, and no EthSL dataset/model or EthSL sign matching. |
| 8. Recorded sign playback | **Partial** | The player supports a companion sign video and the controller has unit coverage, but no genuine EthSL clip is present; playback with an actual signer was not verified. |
| 9. Video synchronization | **Controller unit-tested; English BSL browser-checked** | The event-driven controller mirrors play/pause, seek, playback rate, waiting, end and significant drift. A live browser check confirmed the English avatar kept playing across multiple caption cues with no page errors. BSL timing and sign meaning remain unverified; there is no Amharic/EthSL sign output. |
| 10. Error handling | **Partially verified** | Browser testing against the rebuilt Docker app confirmed that when both video sources fail, the player announces an accessible “video could not be loaded” alert. Backend tests cover API validation; model-download, real caption-track and sign-processing failures were not exercised. |

### Language and content coverage

| Language/content | Current support and gaps |
|---|---|
| English | Player captions and local Whisper transcription are implemented. The user-provided clip was transcribed once; the draft requires human review and does not establish general ASR accuracy. |
| Amharic | Player caption track and machine-translation draft path exist. Amharic speech-to-text is explicitly unsupported; no fluent human caption review was performed. |
| Afaan Oromoo | Player/API caption track and machine-translation draft path exist. Speech-to-text and interface translations are not implemented; generated Oromo text requires fluent review. |
| Ethiopian Sign Language (EthSL) | A manually supplied companion video can be encoded and synchronized by elapsed time. There is no supplied recording, automated language recognition, semantic matching, or human verification in this repository. |

The default silent CC0 sample intentionally shows neither lesson captions nor sign video. `?source=lesson` plays the owner-provided Digital Bridge clip with its lesson captions; `?source=original` plays that same local clip with Whisper-generated draft captions. The separate QA derivative uses only its own synthetic narration and matching captions.

## Browser and build checks

- Player unit tests: **26 passed, 0 failed** (`cd player; npm test`), including the Kozha cue-synchronization tests.
- Player production build: **passed** (`cd player; npm run build`).
- Browser smoke test of the bundled MP4: **passed**; `readyState=4`, duration `5.055s`, playback advanced to about `1.24s`, with no media error.
- Browser video-source failure test: **passed after the fix**; aborting both sources now produces an accessible error instead of leaving “Loading video…” indefinitely.
- Browser Kozha test: **passed**; CWASA loaded local configuration, model archives, XSLT, shaders, and BSL corpus. The owner-provided clip drove cue planning, play/pause, seeking, 1.5× playback rate, and end handling.
- Main lesson route browser test: **passed** after connecting it to the owner-provided clip and making the Kozha panel visible at startup. The video loaded at `readyState=4` with a 159.018-second duration; English caption text appeared during playback, and the BSL panel reported playing, paused, seeked, 1.25× rate, and ended states.
- Amharic lesson caption test: **passed**; selecting Amharic loaded the Ethiopic cue text at the beginning of the same video and displayed the existing machine-translation review notice.
- Synthetic QA test: **passed in the browser**. The generated clip contains H.264 video and AAC narration; `/media/qa/lesson.mp4` and `/media/qa/captions-en.vtt` return **200**. English captions loaded and the BSL frame reported playing, paused, and ended with the clip. This does not test ASR, translation, BSL accuracy, or the real lesson.
- Live Docker routes: `/health`, player bundle/CSS, demo page, bundled MP4, Kozha health/assets, `/media/original/lesson.mp4`, `/media/original/captions-en.vtt`, both lesson VTT files, and synthetic QA media return **200**. Legacy `/media/lesson.mp4` and `/media/sign.webm` remain **404**, but the lesson page no longer requests them.
- Browser console: no JavaScript exception was observed during owner-video caption/avatar testing. Chromium emitted warnings for the sandbox combination and deprecated XSLT processing. Requests aborted during source replacement and stale BSL-plan cancellation as playback ended; the player and avatar reached the expected loaded/ended states.
- E2E test file syntax and `git diff --check`: **passed**.
- Backend pytest suite: **56 passed in Docker**. Full Playwright E2E suite: **not run**.

The existing backend upload integration test uses fake speech-to-text and translation providers, plus a generated synthetic test video. It can test API orchestration and media encoding when its dependencies are installed, but it does not prove real ASR/translation quality, language detection, or EthSL correctness.

## Issues fixed in this audit

- Fixed video-source failure handling: the browser can emit failures on individual `<source>` elements without the expected media-element error event. The player now waits for all configured sources to fail before announcing a failure, preserving fallback to another source. Added a browser E2E regression test.
- Corrected the backlog entry that still described a generated color-bar sign clip. The demo no longer creates fake sign-language footage; a genuine authorized recording is required.
- Re-ran the self-hosted CWASA path and stop-API fixes in the browser; avatar initialization and cue animation passed. Human review of caption accuracy and sign meaning remains outstanding.
- Fixed a CWASA `AnimScheduler.restart` error by avoiding a preemptive stop on every caption change and coordinating stop/resume with animation lifecycle hooks. Added runtime error reporting and an E2E regression check; live browser playback crossed caption cues without errors.
- Connected interface-language buttons to the matching captions and transcript, removed bilingual draft notices, and limited BSL input to English cues. Amharic selection displays an Amharic notice that Amharic sign-language output is unavailable.
- Added `scripts/make-qa-video.ps1` and a `?source=qa` mode that uses the CC0 flower sample with synthetic English narration and matching generated-time WebVTT. Browser testing verified caption playback and BSL play/pause/end events. The generated media is git-ignored and does not replace the missing Digital Bridge recording.
- Added `app.transcribe_local` and `scripts/make-captioned-video.ps1` for owner-provided videos. Whisper detected English and generated 27 draft cues locally; browser testing verified playback and BSL play/pause/seek/rate/end events. Captions and sign-language content still need human review.
- Connected `?source=lesson` to the owner-provided video and its matching English and draft Amharic tracks. Removed the unavailable WebM fallback so the page uses the playable H.264 file; the browser verified actual playback, visible captions, and synchronized BSL play/pause/seek/rate/end states.
- Fixed the missing-at-startup Kozha panel: it was available but hidden by the sign toggle, and browsers could retain the older avatar frame. The lesson, original-video, and QA demo routes now open the configured sign panel by default while leaving the learner able to hide it. Added `sign-visible` support and cache-busted the demo bundle and Kozha frame URLs. Browser testing confirmed the avatar becomes ready, animates from the English cue, and pauses with the video.

## Requirements to complete a real pipeline run

1. Supply and upload an authorized speech-containing lesson video through Studio or the API. Docker and the media-processing executables are available.
2. Whisper small has been downloaded; the MADLAD translation model is still absent and needs about 3 GB plus internet access. `FIDEL_STAFF_TOKEN` is required for the upload API.
3. Human-review the Zoom-derived lesson captions and the separate owner-video Whisper draft against the speech; review the Amharic translation with a fluent speaker.
4. Provide an Amharic ASR model/provider and an Afaan Oromoo ASR model/provider if speech recognition is expected for those spoken languages; validate each against representative, consented speech and evaluation data.
5. Provide an authorized, same-lesson EthSL recording plus alignment/translation review by fluent EthSL signers/interpreters. Timing synchronization alone cannot verify that signs match caption meaning.
6. If the optional Addis AI translation provider is added, obtain its API documentation and credentials first; it is not implemented/configured in this build.
7. Run NVDA/TalkBack and Deaf/low-vision co-designer sessions, and verify captions/translations/sign meaning with human reviewers before publishing.

## Other known functional/access-control gaps

- Publishing hides unpublished lesson manifests, but the static lesson-file mount can still serve files to anyone who knows the lesson URL. Publication state is therefore not a complete access boundary.
- Offline lesson pages do not include recorded audio-description clips; that limitation remains documented in the backlog.
- The main lesson route now plays the owner-provided video with captions and experimental BSL output; there is still no genuine EthSL recording or verified sign-language interpretation.
