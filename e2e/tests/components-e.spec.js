// Package E components on demo/components.html and in Fidel Studio: lesson
// formats (E1), questions and voice notes (E2), callouts (E3), tables (E4),
// notes (E5), quiz (E6), progress / mark complete / skip link / toggletip (E7).
// axe at 100/200/400% zoom with each dialog and panel open, and in Amharic;
// no sideways scrolling at 320 px; keyboard use; Escape returns focus.
//
// Needs the staff token: FIDEL_STAFF_TOKEN in the environment or in ../.env.
// Uploads the demo lesson WITH sound (data/demo/lesson.mp4), because Listen
// needs the lesson's audio-only file.
import { readFileSync, existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function staffToken() {
  if (process.env.FIDEL_STAFF_TOKEN) return process.env.FIDEL_STAFF_TOKEN;
  if (!existsSync('../.env')) return '';
  const line = readFileSync('../.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('FIDEL_STAFF_TOKEN='));
  return line ? line.split('=', 2)[1].trim() : '';
}
const TOKEN = staffToken();
const STAFF = { Authorization: `Bearer ${TOKEN}` };
const VIDEO = '../data/demo/lesson.mp4'; // has sound: the lesson gets audio.opus (Listen)
const AUDIO_FILE = { name: 'question.webm', mimeType: 'audio/webm', buffer: Buffer.from('1a45dfa3fake-audio-for-the-file-picker', 'utf8') };
test.skip(!TOKEN, 'Set FIDEL_STAFF_TOKEN (or create ../.env) to run these tests.');
test.skip(!existsSync(VIDEO), 'Needs data/demo/lesson.mp4 (the demo lesson).');
// Chromium's fake microphone and camera (voice notes, sign answers).
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

const ZOOMS = [
  { name: '100%', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  { name: '200%', viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 },
  { name: '400%', viewport: { width: 320, height: 200 }, deviceScaleFactor: 4 },
];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const CUES = [{ start: 0, end: 4, text: 'Welcome to the lesson.' }, { start: 4, end: 8, text: 'Now we look at the code.' }];

let lessonId;

test.beforeAll(async ({ request }) => {
  test.setTimeout(240_000);
  const upload = await request.post('/api/v1/lessons', {
    headers: STAFF,
    multipart: {
      title: 'Package E test lesson', spoken_language: 'en',
      video: { name: 'e.mp4', mimeType: 'video/mp4', buffer: readFileSync(VIDEO) },
    },
  });
  expect(upload.status()).toBe(201);
  lessonId = (await upload.json()).id;
  await expect.poll(async () => {
    const steps = await (await request.get(`/api/v1/lessons/${lessonId}/status`)).json();
    return Object.values(steps).every((s) => !['pending', 'running'].includes(s.status));
  }, { timeout: 200_000 }).toBe(true);
  const put = await request.put(`/api/v1/lessons/${lessonId}/captions/en`, { headers: STAFF, data: { cues: CUES } });
  expect(put.status(), await put.text()).toBe(200);
  await request.post(`/api/v1/lessons/${lessonId}/publish`, { headers: STAFF, data: { published: true } });
});

test.afterAll(async ({ request }) => {
  if (lessonId) await request.delete(`/api/v1/lessons/${lessonId}`, { headers: STAFF });
});

async function seriousAxeIssues(page, include = '#package-e') {
  let builder = new AxeBuilder({ page }).withTags(TAGS);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  return results.violations
    .filter((v) => ['critical', 'serious'].includes(v.impact))
    .map((v) => `${v.impact} ${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

async function expectNoSidewaysScroll(page) {
  const { pixels, outermost } = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const over = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > width + 1);
    const out = over.filter((e) => !over.includes(e.parentElement)).slice(0, 5)
      .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} (${Math.round(e.getBoundingClientRect().right - width)} px)`);
    return { pixels: document.documentElement.scrollWidth - width, outermost: out };
  });
  expect(pixels, `sideways scrolling; sticking out: ${outermost.join(', ')}`).toBeLessThanOrEqual(1);
}

async function expectDialogFits(page) {
  const fits = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]');
    const r = dialog.getBoundingClientRect();
    return r.left >= -1 && r.right <= document.documentElement.clientWidth + 1 && dialog.scrollWidth <= dialog.clientWidth + 1;
  });
  expect(fits, 'the open dialog fits the screen width').toBe(true);
}

const section = (page) => page.locator('#package-e');
const withLesson = () => `/demo/components.html?lesson=${lessonId}`;

/** The components page; with the test lesson unless lesson=false. */
async function openPage(page, { lesson = true } = {}) {
  await page.goto(lesson ? withLesson() : '/demo/components.html');
  await expect(page.locator('#e-lesson-player .fidel-panel')).toBeVisible({ timeout: 20_000 });
  await expect(section(page).locator('fidel-lesson-formats button').first()).toBeVisible({ timeout: 20_000 });
}

/** Play the E lesson player muted from `seconds`. */
async function playAt(page, seconds, id = 'e-lesson-player') {
  await page.evaluate(([s, playerId]) => {
    const video = document.querySelector(`#${playerId} video`);
    video.muted = true;
    video.currentTime = s;
    return video.play();
  }, [seconds, id]);
}

// --- Every zoom: axe, no sideways scrolling, each dialog and panel open --------------

for (const zoom of ZOOMS) {
  test.describe(`Package E at ${zoom.name} zoom`, () => {
    test('axe clean and no sideways scrolling, also with the dialog and panels open', async ({ browser }) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });
      const page = await context.newPage();
      await openPage(page);
      const e = section(page);
      await page.waitForTimeout(500);
      expect(await seriousAxeIssues(page)).toEqual([]);
      await expectNoSidewaysScroll(page);

      // Listen and Read views, the toggletip, a notes form, quiz feedback and the own-way panel.
      await e.getByRole('button', { name: /^Listen/ }).click();
      await expect(e.locator('.fidel-formats-transcript li button').first()).toBeVisible();
      expect(await seriousAxeIssues(page), 'Listen view').toEqual([]);
      await expectNoSidewaysScroll(page);
      await e.getByRole('button', { name: /^Read/ }).click();
      await expect(e.getByRole('link', { name: 'Open the lesson as a web page' })).toBeVisible();
      expect(await seriousAxeIssues(page), 'Read view').toEqual([]);
      await e.getByRole('button', { name: /^Watch/ }).click();
      await e.getByRole('button', { name: 'What is a transcript?' }).click();
      await e.getByRole('button', { name: /^Add a note at/ }).click();
      const quiz = e.locator('fidel-quiz').first();
      await quiz.getByLabel('<h1>').check();
      await quiz.getByRole('button', { name: 'Check answer Question 1.' }).click();
      await e.getByRole('button', { name: 'Answer in your own way Question 2.' }).click();
      await page.waitForTimeout(300);
      expect(await seriousAxeIssues(page), 'panels open').toEqual([]);
      await expectNoSidewaysScroll(page);

      // The question dialog, in each of its three ways.
      const opener = e.getByRole('button', { name: 'Ask about this moment' });
      await opener.click();
      const dialog = page.getByRole('dialog', { name: 'Ask about this moment' });
      await expect(dialog).toBeVisible();
      for (const way of ['Write', 'Voice note', 'Sign language']) {
        await dialog.getByLabel(way, { exact: true }).check();
        expect(await seriousAxeIssues(page, null), `question dialog: ${way}`).toEqual([]);
        await expectDialogFits(page);
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
      await context.close();
    });
  });
}

// --- E1 ----------------------------------------------------------------------------

test.describe('E1: lesson formats', () => {
  test('only the formats the lesson has, with sizes; Listen, Read and Watch apply and are remembered', async ({ page }) => {
    await openPage(page);
    const formats = section(page).locator('fidel-lesson-formats');
    await expect(formats.getByRole('group', { name: 'How do you want this lesson?' })).toBeVisible();
    const names = await formats.locator('.fidel-formats-name').allTextContents();
    expect(names).toEqual(['Watch', 'Listen', 'Read', 'Simple words']); // this lesson has no sign-language video
    await expect(formats.getByRole('button', { name: /^Watch/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(formats.getByRole('button', { name: /^Watch/ })).toContainText(/video and captions, [\d.]+ MB/);
    await expect(formats.getByRole('button', { name: /^Listen/ })).toContainText(/audio and transcript, low data, [\d.]+ MB/);

    const told = page.evaluate(() => new Promise((resolve) => document.addEventListener('fidel-lesson-format', (e) => resolve(e.detail), { once: true })));
    await formats.getByRole('button', { name: /^Listen/ }).click();
    expect(await told).toEqual({ format: 'listen' });
    await expect(formats.getByRole('button', { name: /^Listen/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(formats.getByRole('button', { name: /^Watch/ })).toHaveAttribute('aria-pressed', 'false');
    await expect(formats.locator('.fidel-formats-status')).toHaveText('Listen mode: audio and transcript.');
    await expect(page.locator('.fidel-announcer[aria-live="polite"]')).toHaveText('Listen mode: audio and transcript.');
    await expect(page.locator('#e-formats-player')).toHaveCount(0); // the player is out of the page
    await expect(formats.locator('audio')).toHaveAttribute('src', /audio\.opus$/);
    await expect(formats.locator('audio')).toHaveAttribute('preload', 'none');
    const line = formats.getByRole('button', { name: 'Play from 0:04' });
    await expect(line).toBeVisible();
    await expect(formats.locator('.fidel-formats-transcript')).toContainText('Now we look at the code.');
    await line.click();
    expect(await formats.locator('audio').evaluate((a) => a.currentTime)).toBeGreaterThanOrEqual(3.9);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fidel-prefs')).lessonFormat)).toBe('listen');

    await formats.getByRole('button', { name: /^Read/ }).click();
    await expect(formats.getByRole('link', { name: 'Open the lesson as a web page' })).toHaveAttribute('href', /document\.html\?lang=en/);
    await expect(formats.getByRole('link', { name: 'Download the lesson as a PDF' })).toBeVisible();
    await expect(formats.locator('audio')).toHaveCount(0);

    // Remembered after a reload; then Watch brings the player back.
    await page.reload();
    await expect(formats.getByRole('button', { name: /^Read/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#e-formats-player')).toHaveCount(0);
    await formats.getByRole('button', { name: /^Watch/ }).click();
    await expect(page.locator('#e-formats-player .fidel-panel')).toBeVisible({ timeout: 20_000 });
    await expect(formats.locator('.fidel-formats-section')).toHaveCount(0);
  });

  test('Listen loads no video at all (checked with page.on("request"))', async ({ page }) => {
    // A page with only this lesson's player and the formats, Listen remembered.
    await page.route('**/demo/e-listen-test.html', (route) => route.fulfill({
      contentType: 'text/html',
      body: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Listen test</title>
        <link rel="stylesheet" href="/embed/v1/fidel.css"><script src="/embed/v1/fidel.js" defer></script></head>
        <body><main><h1>Listen test</h1>
        <fidel-lesson-formats for="p"></fidel-lesson-formats>
        <fidel-player id="p" lesson="/api/v1/lessons/${lessonId}" lang="en"></fidel-player></main></body></html>`,
    }));
    await page.addInitScript(() => localStorage.setItem('fidel-prefs', JSON.stringify({ lessonFormat: 'listen' })));
    const requests = [];
    page.on('request', (r) => { if (r.method() !== 'HEAD') requests.push(r.url()); }); // HEAD only asks the size
    await page.goto('/demo/e-listen-test.html');
    const formats = page.locator('fidel-lesson-formats');
    await expect(formats.getByRole('button', { name: /^Listen/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(formats.getByRole('button', { name: 'Play from 0:00' })).toBeVisible();
    await formats.locator('audio').evaluate((a) => { a.muted = true; return a.play(); });
    await page.waitForTimeout(1500);
    const videos = requests.filter((url) => /\/(video|video-small|sign)\.(mp4|webm)|\/media\/lesson\./.test(url));
    expect(videos, 'no video file is requested in Listen mode').toEqual([]);
    expect(requests.some((url) => url.endsWith('/audio.opus'))).toBe(true);
    expect(await page.locator('video').count()).toBe(0);
  });

  test('demo files: Sign language opens the large docked signer; Simple words turns simple mode on', async ({ page }) => {
    await openPage(page, { lesson: false });
    const formats = section(page).locator('fidel-lesson-formats');
    expect(await formats.locator('.fidel-formats-name').allTextContents()).toEqual(['Watch', 'Sign language', 'Simple words']);
    await formats.getByRole('button', { name: /^Sign language/ }).click();
    await expect(page.locator('#e-formats-player')).toHaveAttribute('data-sign-visible', 'true', { timeout: 15_000 });
    await expect(page.locator('#e-formats-player')).toHaveAttribute('data-sign-layout', 'docked');
    expect(await page.locator('#e-formats-player').evaluate((p) => p.style.getPropertyValue('--fidel-sign-width'))).toBe('480px');
    await formats.getByRole('button', { name: /^Simple words/ }).click();
    await expect(page.locator('#a-simple-mode ~ fidel-simple-mode [data-version="simple"]').first()).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fidel-prefs')).simpleWords)).toBe(true);
    await expect(page.locator('#e-formats-player')).toHaveAttribute('data-sign-visible', 'false');
    await formats.getByRole('button', { name: /^Watch/ }).click();
    await expect(page.locator('#a-simple-mode ~ fidel-simple-mode [data-version="full"]').first()).toBeVisible();
  });
});

// --- E2 ----------------------------------------------------------------------------

const questionsOf = async (request) => (await request.get(`/api/v1/lessons/${lessonId}/questions`, { headers: STAFF })).json();

test.describe('E2: ask about this moment', () => {
  test('time and caption pre-filled; a written question is sent; the video pauses and plays on', async ({ page, request }) => {
    await openPage(page);
    await playAt(page, 5);
    const opener = section(page).getByRole('button', { name: 'Ask about this moment' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Ask about this moment' });
    expect(await page.evaluate(() => document.querySelector('#e-lesson-player video').paused)).toBe(true);
    await expect(dialog.getByLabel('Time in the video (minutes:seconds)')).toHaveValue('0:05');
    await expect(dialog.locator('.fidel-question-shown q')).toHaveText('Now we look at the code.');
    await expect(dialog.getByLabel('Write', { exact: true })).toBeChecked();

    // Errors in words: no text; a bad time.
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(dialog.getByText('Write your question.')).toBeVisible();
    await expect(dialog.getByLabel('Your question')).toBeFocused();
    await dialog.getByLabel('Time in the video (minutes:seconds)').fill('0:02');
    await dialog.getByLabel('Your question').fill('What does this code do?');
    const sent = page.evaluate(() => new Promise((resolve) => document.addEventListener('fidel-question-sent', (e) => resolve(e.detail), { once: true })));
    await dialog.getByRole('button', { name: 'Send' }).click();
    expect(await sent).toEqual({ lessonId, time: 2, kind: 'text' });
    await expect(section(page).locator('.fidel-question-message')).toHaveText('Your question was sent. A teacher will answer.');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect.poll(() => page.evaluate(() => !document.querySelector('#e-lesson-player video').paused)).toBe(true);
    const saved = (await questionsOf(request)).find((q) => q.text === 'What does this code do?');
    expect(saved).toMatchObject({ kind: 'text', time: 2, status: 'open', caption: 'Welcome to the lesson.' });
  });

  test('voice note (fake microphone): record -> play back -> send', async ({ page, request }) => {
    await openPage(page);
    await section(page).getByRole('button', { name: 'Ask about this moment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ask about this moment' });
    await dialog.getByLabel('Voice note', { exact: true }).check();
    // Send before recording: told what to do.
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(dialog.getByText('Record your question first: press Start recording.')).toBeFocused();
    const voice = dialog.locator('fidel-voice-note');
    await voice.getByRole('button', { name: 'Start recording' }).click();
    const stop = voice.getByRole('button', { name: 'Stop recording' });
    await expect(stop).toBeFocused();
    await expect(voice.locator('.fidel-voice-banner')).toContainText('Recording');
    await page.waitForTimeout(1500);
    await stop.click();
    await expect(voice.getByRole('heading', { name: 'Step 3: listen to your voice note' })).toBeFocused();
    expect(await voice.evaluate((el) => el.stream === null)).toBe(true); // the microphone is off
    await expect(voice.locator('audio')).toHaveAttribute('src', /^blob:/);
    await expect(voice.getByText(/^Size: \d+\.\d MB\.$/)).toBeVisible();
    expect(await seriousAxeIssues(page, null), 'voice note review').toEqual([]);
    const before = (await questionsOf(request)).filter((q) => q.kind === 'voice').length;
    await dialog.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(section(page).locator('.fidel-question-message')).toHaveText('Your question was sent. A teacher will answer.');
    const voices = (await questionsOf(request)).filter((q) => q.kind === 'voice');
    expect(voices.length).toBe(before + 1);
    expect(voices.at(-1).media_type).toMatch(/^audio\//);
    const media = await request.get(voices.at(-1).media_url, { headers: STAFF });
    expect(media.status()).toBe(200);
    expect((await media.body()).length).toBeGreaterThan(100);
  });

  test('microphone refused: the reason in words and the file-picker fallback', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });
    await openPage(page);
    const voice = section(page).locator('#e-voice ~ fidel-voice-note');
    await voice.getByRole('button', { name: 'Start recording' }).click();
    await expect(voice.getByRole('heading', { name: 'Your microphone is not available here.' })).toBeFocused();
    await expect(voice.getByText('Permission to use the microphone was refused.')).toBeVisible();
    const picker = voice.getByLabel("Record with your phone's voice recorder, or choose an audio file");
    await expect(picker).toHaveAttribute('accept', 'audio/*');
    await expect(picker).toHaveAttribute('capture', '');
    await picker.setInputFiles(AUDIO_FILE);
    await expect(voice.getByRole('heading', { name: 'Step 3: listen to your voice note' })).toBeFocused();
    const ready = page.evaluate(() => new Promise((resolve) => document.addEventListener('fidel-voice-note-ready',
      (e) => resolve({ size: e.detail.blob.size, type: e.detail.mimeType }), { once: true })));
    await voice.getByRole('button', { name: /^Send \(\d+\.\d MB\)$/ }).click();
    expect(await ready).toEqual({ size: AUDIO_FILE.buffer.length, type: 'audio/webm' });
    await expect(page.locator('#e-voice-host')).toContainText('Nothing was uploaded');
  });

  test('offline: saved on the phone, sent when back online', async ({ page, context, request }) => {
    await openPage(page);
    const before = (await questionsOf(request)).length;
    await context.setOffline(true);
    await section(page).getByRole('button', { name: 'Ask about this moment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ask about this moment' });
    await dialog.getByLabel('Your question').fill('Asked while offline');
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(section(page).locator('.fidel-question-message')).toHaveText('Saved on this phone. It will be sent when you are online.');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fidel-question-queue')).length)).toBe(1);
    await context.setOffline(false);
    await expect(section(page).locator('.fidel-question-message')).toHaveText('Your saved question was sent.');
    expect(await page.evaluate(() => localStorage.getItem('fidel-question-queue'))).toBeNull();
    expect((await questionsOf(request)).length).toBe(before + 1);
  });

  test('without api the page receives the question (event), nothing is uploaded', async ({ page }) => {
    await openPage(page, { lesson: false });
    await section(page).getByRole('button', { name: 'Ask about this moment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ask about this moment' });
    await dialog.getByLabel('Your question').fill('Local only');
    const ready = page.evaluate(() => new Promise((resolve) => document.addEventListener('fidel-question-ready', (e) => resolve(e.detail), { once: true })));
    await dialog.getByRole('button', { name: 'Send' }).click();
    expect(await ready).toEqual({ time: 0, kind: 'text', text: 'Local only' });
    await expect(page.locator('#e-question-host')).toContainText('The page received a text question');
  });
});

// --- E4 ----------------------------------------------------------------------------

test.describe('E4: tables', () => {
  test('th scope, card layout at 320 px with "Header: value", sorting with aria-sort', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 600 } });
    const page = await context.newPage();
    await page.goto('/demo/components.html');
    const table = section(page).locator('fidel-table[sortable="true"]');
    await expect(table.locator('th[scope="col"]')).toHaveCount(4);
    await expect(table.locator('tbody th[scope="row"]')).toHaveCount(3);
    const cell = table.locator('tbody tr').first().locator('td').first();
    await expect(cell).toHaveAttribute('data-label', 'Length');
    expect(await cell.evaluate((td) => getComputedStyle(td).display)).toBe('block');
    expect(await cell.evaluate((td) => getComputedStyle(td, '::before').content)).toBe('"Length: "');
    await expect(page.getByRole('table', { name: 'Lessons this week' })).toBeVisible();
    await expectNoSidewaysScroll(page);
    await expect(section(page).locator('.fidel-table-warning')).toContainText('This table has no caption');

    // Sorting (the header buttons are reachable by keyboard even in card layout).
    const length = table.getByRole('button', { name: 'Length' });
    await length.focus();
    await page.keyboard.press('Enter');
    await expect(table.locator('th').nth(1)).toHaveAttribute('aria-sort', 'ascending');
    await expect(table.locator('tbody th')).toHaveText(['CSS colours', 'HTML basics', 'Forms that work for everyone']);
    await expect(page.locator('.fidel-announcer[aria-live="polite"]')).toHaveText('Sorted by Length, ascending.');
    await length.click();
    await expect(table.locator('th').nth(1)).toHaveAttribute('aria-sort', 'descending');
    await expect(table.locator('tbody th').first()).toHaveText('Forms that work for everyone');
    await context.close();
  });
});

// --- E5 ----------------------------------------------------------------------------

test.describe('E5: notes', () => {
  test('add at the current time, play from it, edit, delete with undo, download', async ({ page }) => {
    await openPage(page, { lesson: false });
    const notes = section(page).locator('fidel-notes');
    await playAt(page, 12);
    await page.evaluate(() => document.querySelector('#e-lesson-player video').pause());
    await expect(notes.getByRole('button', { name: 'Add a note at 0:12' })).toBeVisible();
    await notes.getByRole('button', { name: 'Add a note at 0:12' }).click();
    await expect(notes.getByRole('textbox', { name: /^Note/ })).toBeFocused();
    await expect(notes.getByLabel('Time in the video (minutes:seconds)')).toHaveValue('0:12');
    await notes.getByRole('textbox', { name: /^Note/ }).fill('Demography matters here');
    await notes.getByRole('button', { name: 'Save note' }).click();
    const play = notes.getByRole('button', { name: 'Play from 0:12: Demography matters here' });
    await expect(play).toBeFocused();
    const events = [];
    await page.exposeFunction('noteCount', (n) => events.push(n));
    await page.evaluate(() => document.addEventListener('fidel-notes-change', (e) => window.noteCount(e.detail.count)));

    // A second note, typed at another time.
    await notes.getByRole('button', { name: /^Add a note at/ }).click();
    await notes.getByLabel('Time in the video (minutes:seconds)').fill('0:03');
    await notes.getByRole('textbox', { name: /^Note/ }).fill('Opening');
    await notes.getByRole('button', { name: 'Save note' }).click();
    await expect(notes.locator('.fidel-notes-play')).toHaveText(['Play from 0:03: Opening', 'Play from 0:12: Demography matters here']);

    // Jump.
    await play.click();
    await expect.poll(() => page.evaluate(() => document.querySelector('#e-lesson-player video').currentTime)).toBeGreaterThanOrEqual(12);
    await page.evaluate(() => document.querySelector('#e-lesson-player video').pause());

    // Delete, then Undo (focus goes to Undo; no confirm dialog).
    await notes.getByRole('button', { name: 'Delete note at 0:03' }).click();
    await expect(notes.locator('.fidel-notes-play')).toHaveCount(1);
    await expect(notes.getByRole('button', { name: 'Undo' })).toBeFocused();
    await expect(notes.locator('.fidel-notes-said')).toHaveText('Note at 0:03 deleted.');
    await page.keyboard.press('Enter');
    await expect(notes.locator('.fidel-notes-play')).toHaveCount(2);
    await expect(notes.getByRole('button', { name: 'Play from 0:03: Opening' })).toBeFocused();

    // Edit; Escape cancels and returns focus.
    await notes.getByRole('button', { name: 'Edit note at 0:03' }).click();
    await expect(notes.getByRole('textbox', { name: /^Note/ })).toHaveValue('Opening');
    await notes.getByRole('textbox', { name: /^Note/ }).fill('The opening words');
    await notes.getByRole('button', { name: 'Save note' }).click();
    await expect(notes.getByRole('button', { name: 'Play from 0:03: The opening words' })).toBeFocused();
    expect(events).toEqual([2, 1, 2, 2]);

    // Kept on this device only, after a reload.
    await page.reload();
    await expect(notes.locator('.fidel-notes-play')).toHaveCount(2);
    const download = page.waitForEvent('download');
    await notes.getByRole('button', { name: 'Download my notes (.txt)' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('notes-components-demo.txt');
    const text = readFileSync(await file.path(), 'utf8');
    expect(text).toBe('My notes\r\n\r\n0:03  The opening words\r\n0:12  Demography matters here\r\n');
  });
});

// --- E6 ----------------------------------------------------------------------------

test.describe('E6: quiz', () => {
  test('check answer moves focus to feedback in words; score in words and a progress bar', async ({ page }) => {
    await openPage(page, { lesson: false });
    const quiz = section(page).locator('fidel-quiz').first();
    await expect(quiz.getByRole('group', { name: /Which tag is the main heading/ })).toBeVisible();
    // Nothing chosen: told so.
    await quiz.getByRole('button', { name: 'Check answer Question 1.' }).click();
    await expect(quiz.locator('.fidel-quiz-feedback').first()).toBeFocused();
    await expect(quiz.locator('.fidel-quiz-feedback').first()).toHaveText('Choose an answer first.');
    await quiz.getByLabel('<p>').check();
    await quiz.getByRole('button', { name: 'Check answer Question 1.' }).click();
    const feedback = quiz.locator('.fidel-quiz-feedback').first();
    await expect(feedback).toBeFocused();
    await expect(feedback).toContainText('Not quite: the answer is <h1>.');
    await expect(feedback).toContainText('<h1> is the main heading of the page.');
    // "All that apply" (checkboxes).
    const second = quiz.getByRole('group', { name: /help a Deaf learner/ });
    await expect(second.getByRole('checkbox')).toHaveCount(3);
    await second.getByLabel('Captions').check();
    await second.getByLabel('A transcript').check();
    const done = page.evaluate(() => new Promise((resolve) => document.addEventListener('fidel-quiz-done', (e) => resolve(e.detail), { once: true })));
    await quiz.getByRole('button', { name: 'Check answer Question 2.' }).click();
    await expect(quiz.locator('.fidel-quiz-feedback').nth(1)).toContainText('Correct.');
    expect(await done).toEqual({ score: 1, total: 2 });
    await expect(quiz.locator('.fidel-quiz-words')).toHaveText('You got 1 of 2 right (50%).');
    await expect(quiz.locator('progress')).toHaveAttribute('value', '1');
    await expect(quiz.locator('progress')).toHaveAttribute('max', '2');
  });

  test('the timer warns 1 minute before the end, can be extended and switched off', async ({ page }) => {
    await openPage(page, { lesson: false });
    await page.evaluate(() => {
      const quiz = document.createElement('fidel-quiz');
      quiz.id = 'e-timed';
      quiz.setAttribute('time-limit', '62');
      quiz.setAttribute('label', 'Quick timed quiz');
      quiz.setAttribute('questions', JSON.stringify([{ question: 'Two plus two?', options: ['3', '4'], answer: 1 }]));
      document.querySelector('#package-e').append(quiz);
    });
    const quiz = page.locator('#e-timed');
    await expect(quiz.locator('.fidel-quiz-time')).toHaveText('Time limit: 1 minutes. The timer starts when you begin.');
    await quiz.getByLabel('4').focus(); // entering the quiz starts the timer
    await expect(quiz.locator('.fidel-quiz-warning')).toHaveText('1 minute left. You can add time or switch the timer off.', { timeout: 8000 });
    await expect(quiz.locator('.fidel-quiz-timer')).toHaveClass(/fidel-quiz-timer-warning/);
    await quiz.getByRole('button', { name: 'Add 5 minutes' }).click();
    await expect(quiz.locator('.fidel-quiz-time')).toHaveText(/^Time left: (5|6) min \d+ s$/);
    await expect(quiz.locator('.fidel-quiz-warning')).toBeHidden();
    await quiz.getByRole('button', { name: 'Switch the timer off' }).click();
    await expect(quiz.locator('.fidel-quiz-time')).toHaveText('Timer off. Take as long as you need.');
    await expect(quiz.locator('.fidel-quiz-time-line')).toBeFocused();
    await expect(quiz.getByRole('button', { name: 'Add 5 minutes' })).toBeHidden();
    expect(await seriousAxeIssues(page, '#e-timed')).toEqual([]);
  });

  test('answer in your own way: writing goes to the page, not scored', async ({ page }) => {
    await openPage(page, { lesson: false });
    const quiz = section(page).locator('fidel-quiz').nth(1);
    const toggle = quiz.getByRole('button', { name: 'Answer in your own way Question 2.' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(quiz.getByRole('radio', { name: 'Voice note' })).toBeVisible();
    await quiz.getByLabel('Your answer').fill('They jump between headings with one key.');
    const own = page.evaluate(() => new Promise((resolve) => document.addEventListener('fidel-quiz-own-answer', (e) => resolve(e.detail), { once: true })));
    await quiz.getByRole('button', { name: 'Save my answer' }).click();
    expect(await own).toEqual({ question: 2, kind: 'text', text: 'They jump between headings with one key.' });
    await quiz.getByLabel('One', { exact: true }).check();
    await quiz.getByRole('button', { name: 'Check answer Question 1.' }).click();
    await expect(quiz.locator('.fidel-quiz-words')).toHaveText('You got 1 of 1 right (100%).');
    await expect(quiz.locator('.fidel-quiz-score')).toContainText('Answered in your own way: 1.');
  });
});

// --- E7 ----------------------------------------------------------------------------

test.describe('E7: progress, mark complete, skip link, toggletip', () => {
  test('progress from the player, announced only on request; mark complete after the end', async ({ page }) => {
    await openPage(page, { lesson: false });
    const progress = section(page).locator('fidel-progress');
    await expect(progress).toContainText('Package E demo lesson: 0% watched');
    await expect(progress.locator('[aria-live]')).toHaveCount(0);
    await page.evaluate(() => document.getElementById('e-lesson-player').dispatchEvent(
      new CustomEvent('fidel-progress', { bubbles: true, detail: { seconds: 64, percent: 40 } })));
    await expect(progress).toContainText('40% watched');
    await expect(progress.locator('progress')).toHaveAttribute('value', '40');
    await progress.getByRole('button', { name: 'Say my progress' }).click();
    await expect(page.locator('.fidel-announcer[aria-live="polite"]')).toHaveText('Package E demo lesson: 40% watched');

    const complete = section(page).getByRole('button', { name: 'Mark as complete' });
    await expect(complete).toHaveAttribute('aria-disabled', 'true');
    await expect(complete).toHaveAttribute('aria-pressed', 'false');
    await expect(section(page).getByText('Available when you reach the end of the video.')).toBeVisible();
    // Events from another player are ignored.
    await page.evaluate(() => document.getElementById('a-lesson-player').dispatchEvent(new CustomEvent('fidel-complete', { bubbles: true })));
    await expect(complete).toHaveAttribute('aria-disabled', 'true');
    await page.evaluate(() => document.getElementById('e-lesson-player').dispatchEvent(new CustomEvent('fidel-complete', { bubbles: true })));
    await expect(complete).not.toHaveAttribute('aria-disabled', 'true');
    await expect(progress).toContainText('100% watched');
    const done = page.evaluate(() => new Promise((resolve) => document.addEventListener('fidel-mark-complete', (e) => resolve(e.detail), { once: true })));
    await complete.click();
    expect(await done).toEqual({ done: true });
    await expect(complete).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.fidel-announcer[aria-live="polite"]')).toHaveText('Lesson marked complete.');
    await page.reload();
    await expect(section(page).getByRole('button', { name: 'Mark as complete' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('skip link: visible on focus, moves focus to the lesson; toggletip opens on click, Escape closes', async ({ page }) => {
    await openPage(page, { lesson: false });
    const skip = section(page).getByRole('link', { name: 'Skip to the Package E lesson video' });
    expect(await skip.evaluate((a) => a.getBoundingClientRect().right < 0)).toBe(true); // hidden until focused
    await skip.focus();
    expect(await skip.evaluate((a) => a.getBoundingClientRect().right > 0)).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.locator('#e-lesson')).toBeFocused();
    await expect(page.locator('#e-lesson')).toHaveAttribute('tabindex', '-1');

    const tip = section(page).getByRole('button', { name: 'What is a transcript?' });
    await expect(tip).toHaveAttribute('aria-expanded', 'false');
    await tip.focus();
    await page.keyboard.press('Enter');
    await expect(tip).toHaveAttribute('aria-expanded', 'true');
    const bubble = section(page).locator('.fidel-toggletip-bubble');
    await expect(bubble).toHaveText(/A transcript is everything said in the video/);
    await expect(bubble).toHaveAttribute('role', 'status');
    await page.keyboard.press('Escape');
    await expect(tip).toHaveAttribute('aria-expanded', 'false');
    await expect(bubble).toBeEmpty();
    await expect(tip).toBeFocused();
    // Hover alone does not open it.
    await tip.hover();
    await expect(tip).toHaveAttribute('aria-expanded', 'false');
  });
});

// --- Keyboard: every control in the section is reached with Tab -----------------------

test('keyboard: Tab reaches every Package E control outside the players, and leaves the section', async ({ page }) => {
  test.setTimeout(120_000);
  await openPage(page, { lesson: false });
  const wanted = await page.evaluate(() => {
    const all = [...document.querySelectorAll('#package-e :is(button, a[href], input, textarea, select)')]
      .filter((el) => !el.closest('fidel-player') && el.getClientRects().length && !el.disabled)
      // A radio group is one Tab stop (arrow keys move inside it): expect its first radio only.
      .filter((el) => el.type !== 'radio' || document.querySelector(`input[type="radio"][name="${el.name}"]`) === el);
    all.forEach((el, i) => el.setAttribute('data-e-tab', String(i)));
    return all.length;
  });
  await section(page).getByRole('link', { name: 'Skip to the Package E lesson video' }).focus();
  const seen = new Set();
  for (let i = 0; i < 600; i += 1) {
    const info = await page.evaluate(() => ({ id: document.activeElement?.getAttribute('data-e-tab'), inside: Boolean(document.activeElement?.closest('#package-e')) }));
    if (info.id) seen.add(info.id);
    if (!info.inside && i > 0) break;
    await page.keyboard.press('Tab');
  }
  const missed = await page.evaluate((ids) => [...document.querySelectorAll('[data-e-tab]')]
    .filter((el) => !ids.includes(el.getAttribute('data-e-tab'))).map((el) => el.outerHTML.slice(0, 120)), [...seen]);
  expect(missed).toEqual([]);
  expect(seen.size).toBe(wanted);
});

// --- Amharic ------------------------------------------------------------------------

test.describe('Package E in Amharic (ui-lang="am")', () => {
  test('axe clean with each component, dialog and panel in Amharic', async ({ page }) => {
    await openPage(page);
    await page.evaluate(() => {
      const box = document.createElement('section');
      box.id = 'e-amharic';
      box.setAttribute('aria-label', 'Amharic');
      box.innerHTML = `
        <fidel-lesson-formats for="e-formats-player" ui-lang="am"></fidel-lesson-formats>
        <fidel-question for="e-lesson-player" ui-lang="am"></fidel-question>
        <fidel-voice-note ui-lang="am"></fidel-voice-note>
        <fidel-callout type="warning" heading="ፋይሉን ያስቀምጡ" ui-lang="am" lang="am"><p>በየጥቂት ደቂቃው።</p></fidel-callout>
        <fidel-notes for="e-lesson-player" lesson-id="am-demo" ui-lang="am"></fidel-notes>
        <fidel-quiz ui-lang="am" time-limit="600" questions='[{"question":"ዋናው ርዕስ የትኛው ነው?","options":["p","h1"],"answer":1,"lang":"am","ownWay":true}]'></fidel-quiz>
        <fidel-progress for="e-lesson-player" ui-lang="am"></fidel-progress>
        <fidel-mark-complete lesson-id="am-demo" ui-lang="am"></fidel-mark-complete>
        <p lang="am">ጽሑፍ <fidel-toggletip ui-lang="am" label="የተጻፈ ቅጂ ምንድን ነው?">የቪዲዮው ንግግር በሙሉ በጽሑፍ።</fidel-toggletip></p>
        <fidel-table sortable="true" ui-lang="am"><table><caption lang="am">ትምህርቶች</caption>
          <thead><tr><th>ትምህርት</th><th>ርዝመት</th></tr></thead><tbody><tr><th>HTML</th><td>12:30</td></tr></tbody></table></fidel-table>`;
      document.querySelector('#package-e').append(box);
    });
    const am = page.locator('#e-amharic');
    await expect(am.getByRole('group', { name: 'ይህን ትምህርት እንዴት ማግኘት ይፈልጋሉ?' })).toBeVisible();
    await am.getByRole('button', { name: /^ያዳምጡ/ }).click();
    await expect(am.locator('.fidel-formats-status')).toHaveText('የማዳመጫ ሁኔታ፦ ድምፅ እና የተጻፈ ቅጂ።');
    await am.getByRole('button', { name: /ማስታወሻ ያክሉ$/ }).click();
    await am.getByRole('button', { name: 'የተጻፈ ቅጂ ምንድን ነው?' }).click();
    await am.getByRole('button', { name: /^በራስዎ መንገድ ይመልሱ/ }).click();
    await am.getByRole('button', { name: /^መልሱን አረጋግጥ/ }).click();
    await am.getByRole('button', { name: 'ትምህርት', exact: true }).click();
    expect(await seriousAxeIssues(page, '#e-amharic')).toEqual([]);
    await expectNoSidewaysScroll(page);
    const opener = am.getByRole('button', { name: 'ስለዚህ ቅጽበት ይጠይቁ' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'ስለዚህ ቅጽበት ይጠይቁ' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('የድምፅ መልእክት', { exact: true }).check();
    expect(await seriousAxeIssues(page, null), 'question dialog in Amharic').toEqual([]);
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
  });
});

// --- Studio: staff see the questions ----------------------------------------------------

test('Studio: staff see a learner question, play a voice note and mark it answered', async ({ page, request }) => {
  // One written and one voice question from "learners".
  const url = `/api/v1/lessons/${lessonId}/questions`;
  expect((await request.post(url, { multipart: { time: '3', kind: 'text', text: 'Studio test question' } })).status()).toBe(201);
  expect((await request.post(url, { multipart: { time: '4', kind: 'voice', media: AUDIO_FILE } })).status()).toBe(201);
  await page.goto('/studio/');
  await page.getByLabel('Staff token').fill(TOKEN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lessons' })).toBeVisible();
  await page.evaluate((id) => { location.hash = `#/lesson/${id}`; }, lessonId);
  const panel = page.locator('section', { has: page.getByRole('heading', { name: /^Learner questions/ }) });
  await expect(panel).toBeVisible({ timeout: 20_000 });
  const item = panel.locator('li', { hasText: 'Studio test question' });
  await expect(item).toContainText('0:03.0: Written');
  const voiceItem = panel.locator('li', { hasText: '0:04.0: Voice note' });
  await voiceItem.getByRole('button', { name: 'Load the voice note' }).click();
  await expect(voiceItem.locator('audio')).toHaveAttribute('src', /^blob:/);
  await expect(voiceItem.locator('audio')).toBeFocused();
  expect(await seriousAxeIssues(page, null)).toEqual([]);
  await item.getByRole('button', { name: 'Answered' }).click();
  await expect(panel.locator('li', { hasText: 'Studio test question' })).toHaveCount(0);
  await expect(panel.getByRole('status')).toContainText('Marked answered.');
  const answered = (await questionsOf(request)).find((q) => q.text === 'Studio test question');
  expect(answered.status).toBe('answered');
});
