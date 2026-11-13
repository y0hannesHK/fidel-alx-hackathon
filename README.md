# Fidel (ፊደል)

Fidel makes every lesson readable, watchable, hearable and downloadable for every
Ethiopian learner. It is an open, embeddable accessible media module for learning
platforms such as ALX Savanna, built for Deaf, blind, low-vision and low-bandwidth
learners, and for learners who read Amharic better than English.

> Status: **Phase 4 (Studio)**. Built for the Digital Bridge Accessibility
> Hackathon 2026, Track 2. This README grows with each phase.

## Quick start

Needs: [Docker](https://docs.docker.com/get-docker/) with Docker Compose.

```sh
docker compose up --build
```

Then open:

| URL | What |
|---|---|
| http://localhost:8000/ | Mock Savanna lesson page with the Fidel player |
| http://localhost:8000/api/docs | API documentation |
| http://localhost:8000/health | Health check |

### Process your own lessons (staff)

1. Set a staff token: copy `.env.example` to `.env` and set `FIDEL_STAFF_TOKEN`
   to a long random value. Restart with `docker compose up -d`.
2. Download the AI models once (needs internet, about 3.5 GB; after this Fidel
   runs fully offline):

   ```sh
   docker compose run --rm server python -m app.download_models
   ```

3. Open **Fidel Studio** at `http://localhost:8000/studio/`, sign in with the
   staff token, and upload a video (or use the API, below). Fidel then, in the
   background:
   - extracts the audio,
   - makes web versions: 720p MP4 and WebM, a 360p low-data MP4, and a 24 kbps
     audio-only file,
   - writes English captions with Whisper (speech-to-text),
   - writes an Amharic **draft** with MADLAD-400 (machine translation). Machine
     Amharic is never final: it is marked `draft` until a person reviews it.
4. In Studio, open the lesson and:
   - **check the Amharic captions** next to the video: fix the text, tick
     "Amharic checked" (or press Ctrl+Enter for "Checked, go to next"), save.
     When every caption is checked, learners no longer see the "not yet
     reviewed" notice;
   - add **chapters** (English and Amharic titles), **audio description** text,
     and the **sign-language video**;
   - **publish**. Unpublished lessons are only visible to staff.
5. Learners see it at `http://localhost:8000/demo/savanna-mock/lesson.html?id=LESSON_ID`.

Captions a person has checked are never overwritten when steps are run again.

If a model is missing, that step fails with a message saying how to download
it; the video itself still plays.

### Demo video

The demo video is not in git (it is cut from a large recording). With the
recording in `assets/`, run:

```sh
sh scripts/make-demo-clip.sh
```

This writes `data/demo/lesson.webm` and `data/demo/lesson.mp4`. The captions
and chapters for the clip are in git, in `demo/media/`.

It also writes `data/demo/sign.webm`, a **colour-bar test pattern**, not real
signing. It only lets us build and test the sign-language window until a real
Ethiopian Sign Language recording is available. Replace it before any demo.

## Embed the player (Level 1)

Add two tags and one element to any web page:

```html
<link rel="stylesheet" href="https://YOUR-FIDEL-HOST/embed/fidel.css">
<script src="https://YOUR-FIDEL-HOST/embed/fidel.js" defer></script>

<fidel-player
  src="lesson.mp4"
  src-webm="lesson.webm"
  captions-en="en.vtt"
  captions-am="am.vtt"
  captions-am-status="draft"
  chapters="chapters.vtt"
  sign="sign.webm"
  lang="en">
</fidel-player>
```

The player then shows, under the video:

- **Accessibility settings**: interface language (English / አማርኛ); caption
  language, size (100–250%), colours, background and position; sign-language
  window on/off, beside or over the video, size, and corner.
- **Transcript**: search box with "Play from" results, and the interactive
  transcript (highlights the current line; "Follow along" scrolls with the video
  and switches off when you move into the text with the keyboard).

Settings are saved in the learner's browser only (localStorage). Nothing is sent
to a server.

| Attribute | Meaning |
|---|---|
| `src` | Video file (MP4). Required. |
| `src-webm` | Optional WebM version, used first when the browser supports it. |
| `poster` | Optional image shown before playing. |
| `captions-en`, `captions-am` | English / Amharic captions (WebVTT). |
| `chapters-en` (or `chapters`), `chapters-am` | Chapter titles (WebVTT). |
| `descriptions-en` (or `descriptions`), `descriptions-am` | Audio description text (WebVTT). |
| `captions-am-status` | `draft` (machine-made: shows a "not yet reviewed" notice) or `reviewed`. |
| `sign` | Sign-language video (WebM or MP4), shown in its own window. |
| `lang` | Default interface language: `en` or `am`. |
| `lesson` | Instead of the above: the URL of a lesson on a Fidel server. |

## REST API (Level 2)

Interactive docs: `http://localhost:8000/api/docs`. Read endpoints are public;
write endpoints need `Authorization: Bearer <FIDEL_STAFF_TOKEN>`.

```sh
# Upload a lesson (starts processing in the background)
curl -H "Authorization: Bearer $FIDEL_STAFF_TOKEN"      -F "video=@lesson.mp4" -F "title=Intro to HTML" -F "spoken_language=en"      http://localhost:8000/api/v1/lessons

# Follow progress of each step
curl http://localhost:8000/api/v1/lessons/LESSON_ID/status

# Lesson manifest: all file URLs and caption statuses (what the player reads)
curl http://localhost:8000/api/v1/lessons/LESSON_ID

# Captions as WebVTT
curl http://localhost:8000/api/v1/lessons/LESSON_ID/captions/am

# Publish (learners can only see published lessons)
curl -X POST -H "Authorization: Bearer $FIDEL_STAFF_TOKEN" -H "Content-Type: application/json"      -d '{"published": true}' http://localhost:8000/api/v1/lessons/LESSON_ID/publish

# Run steps again, e.g. after downloading a model
curl -X POST -H "Authorization: Bearer $FIDEL_STAFF_TOKEN" -H "Content-Type: application/json"      -d '{"steps": ["transcribe", "translate"]}'      http://localhost:8000/api/v1/lessons/LESSON_ID/rebuild
```

Embed a processed lesson with just its address:

```html
<fidel-player lesson="https://YOUR-FIDEL-HOST/api/v1/lessons/LESSON_ID"></fidel-player>
```

## AI engines and offline use

All engines run on the Fidel server. No lesson or learner data is sent to any
other service. Choose engines in `.env`:

| Setting | Values | Default |
|---|---|---|
| `FIDEL_STT_PROVIDER` | `local_whisper`, `none` | `local_whisper` |
| `FIDEL_WHISPER_MODEL` | `tiny`, `base`, `small`, `medium` | `small` |
| `FIDEL_TRANSLATOR` | `local_madlad`, `none` | `local_madlad` |

`none` switches a step off (it shows as "skipped"). Lessons spoken in Amharic
cannot be transcribed yet (the Amharic speech model is not installed).
CPU only is fine; it is just slower.

## Development

| Folder | What | Commands |
|---|---|---|
| `player/` | `<fidel-player>` (Able Player + our code), built with Vite | `npm install`, `npm run build`, `npm test` (unit tests) |
| `server/` | FastAPI server | `docker compose run --rm server pytest` |
| `e2e/` | Browser tests: Playwright + axe-core | `npm install`, `npx playwright install chromium`, `npm test` |
| `studio/` | Fidel Studio (staff page): plain HTML + JS, no build step | |
| `demo/` | Mock Savanna page and demo captions | |
| `scripts/` | Helper scripts (demo clip, caption cutting) | |
| `tools/translation-eval/` | One-off test of English → Amharic machine translation | `sh tools/translation-eval/run.sh` |

The e2e tests use a running server at `http://localhost:8000` (or start one with
Docker). Use `FIDEL_BASE_URL` to test another server.

## Measured numbers

| What | Value |
|---|---|
| Player bundle `fidel.js` (Able Player + jQuery + DOMPurify + Fidel), gzipped | 153 KB (Fidel's own code: about 10 KB) |
| Player styles `fidel.css`, gzipped | 6 KB |
| Ethiopic font (2 weights, downloaded only when Amharic text is shown) | 2 × 75 KB |
| Demo clip, 2 min 39 s, 720p: WebM / MP4 | 1.5 MB / 2.2 MB |
| Audio-only (Opus 24 kbps) | 187 KB per minute (about 2.8 MB for 15 minutes) |
| Processing time, CPU only (laptop, Intel i5-12500H), Whisper small + MADLAD | about 30 s per minute of video, plus about 30 s to make the web videos for a 2.5-minute clip |

## Licence

MIT. See [LICENSE](LICENSE). Third-party licences: [LICENSES.md](LICENSES.md).
