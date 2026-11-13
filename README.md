# Fidel (ፊደል)

Fidel makes every lesson readable, watchable, hearable and downloadable for every
Ethiopian learner. It is an open, embeddable accessible media module for learning
platforms such as ALX Savanna, built for Deaf, blind, low-vision and low-bandwidth
learners, and for learners who read Amharic better than English.

> Status: **Phase 2 (core player)**. Built for the Digital Bridge Accessibility
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
| `captions-am-status` | `draft` (machine-made: shows a "not yet reviewed" notice) or `reviewed`. |
| `sign` | Sign-language video (WebM or MP4), shown in its own window. |
| `chapters` | Chapter list (WebVTT). |
| `descriptions` | Audio description text (WebVTT). |
| `lang` | Default interface language: `en` or `am`. |

## Development

| Folder | What | Commands |
|---|---|---|
| `player/` | `<fidel-player>` (Able Player + our code), built with Vite | `npm install`, `npm run build`, `npm test` (unit tests) |
| `server/` | FastAPI server | `docker compose run --rm server pytest` |
| `e2e/` | Browser tests: Playwright + axe-core | `npm install`, `npx playwright install chromium`, `npm test` |
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

## Licence

MIT. See [LICENSE](LICENSE). Third-party licences: [LICENSES.md](LICENSES.md).
