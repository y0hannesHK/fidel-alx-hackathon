// Offline: the downloaded one-page lesson works with NO network at all
// (like airplane mode), and the player offers the downloads and low-data mode.
//
// Needs the staff token (FIDEL_STAFF_TOKEN or ../.env) and data/demo/lesson.mp4.
// The lesson is uploaded as "spoken in Amharic" on purpose: Amharic
// speech-to-text is not installed, so no AI model runs and the test controls
// the captions itself. The lesson is deleted at the end.
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function staffToken() {
  if (process.env.FIDEL_STAFF_TOKEN) return process.env.FIDEL_STAFF_TOKEN;
  if (!existsSync('../.env')) return '';
  const line = readFileSync('../.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('FIDEL_STAFF_TOKEN='));
  return line ? line.split('=')[1].trim() : '';
}
const TOKEN = staffToken();
const STAFF = { Authorization: `Bearer ${TOKEN}` };
const VIDEO = '../data/demo/lesson.mp4';

test.skip(!TOKEN, 'Set FIDEL_STAFF_TOKEN (or create ../.env) to run offline tests.');
test.skip(!existsSync(VIDEO), 'Run scripts/make-demo-clip.sh first.');

let lessonId;

test.beforeAll(async ({ request }) => {
  test.setTimeout(180_000);
  const upload = await request.post('/api/v1/lessons', {
    headers: STAFF,
    multipart: {
      title: 'Offline test lesson',
      spoken_language: 'am',
      video: { name: 'lesson.mp4', mimeType: 'video/mp4', buffer: readFileSync(VIDEO) },
    },
  });
  expect(upload.status()).toBe(201);
  lessonId = (await upload.json()).id;
  await expect.poll(async () => {
    const steps = await (await request.get(`/api/v1/lessons/${lessonId}/status`)).json();
    return Object.values(steps).every((s) => !['pending', 'running'].includes(s.status));
  }, { timeout: 150_000 }).toBe(true);

  const put = (path, data) => request.put(`/api/v1/lessons/${lessonId}/${path}`, { headers: STAFF, data });
  const cues = (texts) => texts.map((text, i) => ({ start: i * 5, end: i * 5 + 5, text }));
  await put('captions/en', { cues: cues(['First sentence.', 'Second sentence.', 'Third sentence.']) });
  await put('captions/am', { cues: cues(['የመጀመሪያ ዓረፍተ ነገር።', 'ሁለተኛ ዓረፍተ ነገር።', 'ሦስተኛ ዓረፍተ ነገር።']) });
  await put('chapters', { chapters: [{ start: 0, title_en: 'Start', title_am: 'መጀመሪያ' }] });
  await put('descriptions/en', { cues: [{ start: 5, end: 8, text: 'A slide shows a diagram.' }] });
  await request.post(`/api/v1/lessons/${lessonId}/publish`, { headers: STAFF, data: { published: true } });
});

test.afterAll(async ({ request }) => {
  if (lessonId) await request.delete(`/api/v1/lessons/${lessonId}`, { headers: STAFF });
});

test('the one-page lesson works with the network switched off', async ({ browser, request }) => {
  const page = await request.get(`/api/v1/lessons/${lessonId}/offline.html`);
  expect(page.status()).toBe(200);
  const file = join(mkdtempSync(join(tmpdir(), 'fidel-')), 'lesson.html');
  writeFileSync(file, await page.body());

  const context = await browser.newContext();
  await context.setOffline(true); // like airplane mode
  const outside = [];
  await context.route('**/*', (route) => {
    if (route.request().url().startsWith('file:')) return route.continue();
    outside.push(route.request().url());
    return route.abort();
  });
  const tab = await context.newPage();
  await tab.goto(pathToFileURL(file).href);

  // Amharic first (it exists), with chapters and the draft notice.
  await expect(tab.getByRole('heading', { level: 2, name: 'መጀመሪያ' })).toBeVisible();
  await expect(tab.getByRole('status')).toContainText('not yet reviewed');

  // The audio inside the file plays, and choosing a sentence jumps there.
  const audio = tab.locator('#media');
  await expect.poll(() => audio.evaluate((a) => a.duration), { timeout: 10_000 }).toBeGreaterThan(100);
  await tab.getByRole('button', { name: 'ሦስተኛ ዓረፍተ ነገር።' }).click();
  await expect.poll(() => audio.evaluate((a) => a.currentTime)).toBeGreaterThanOrEqual(10);
  await expect(tab.locator('.cue.now')).toHaveText('ሦስተኛ ዓረፍተ ነገር።');

  // English, with the description; large text.
  await tab.getByRole('button', { name: 'English' }).click();
  await expect(tab.locator('.desc')).toContainText('A slide shows a diagram.');
  await tab.getByRole('button', { name: /Large text/ }).click();
  await expect(tab.locator('html')).toHaveClass(/large/);

  const results = await new AxeBuilder({ page: tab }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => v.id)).toEqual([]);
  expect(outside).toEqual([]); // nothing tried to reach the network
  await context.close();
});

test('the player offers downloads and a low-data mode', async ({ page }) => {
  await page.goto(`/demo/savanna-mock/lesson.html?id=${lessonId}`);
  const panel = page.locator('fidel-player .fidel-panel');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel.getByRole('link', { name: /Download lesson for offline use/ })).toHaveAttribute('href', /offline\.html$/);
  await expect(panel.getByRole('link', { name: /full pack \(\.zip\)/ })).toHaveAttribute('href', /\/pack$/);

  const lowData = panel.getByRole('button', { name: 'Use less data (smaller video)' });
  await lowData.click();
  await expect(page.locator('fidel-player video source')).toHaveAttribute('src', /video-small\.mp4$/, { timeout: 15_000 });
  const lowDataAgain = page.locator('fidel-player .fidel-panel').getByRole('button', { name: 'Use less data (smaller video)' });
  await expect(lowDataAgain).toHaveAttribute('aria-pressed', 'true');
  await expect(lowDataAgain).toBeFocused();
});

test('a recorded audio description plays at its time, pausing the lesson', async ({ page, request }) => {
  // Attach a recording to the English description at 0:05 (any file with sound works).
  const upload = await request.post(`/api/v1/lessons/${lessonId}/descriptions/en/recording?start=5`, {
    headers: STAFF,
    multipart: { audio: { name: 'reading.mp4', mimeType: 'video/mp4', buffer: readFileSync(VIDEO) } },
  });
  expect(upload.status()).toBe(200);

  await page.goto(`/demo/savanna-mock/lesson.html?id=${lessonId}`);
  await expect(page.locator('fidel-player .fidel-panel')).toBeVisible({ timeout: 15_000 });
  const controls = page.locator('fidel-player .able-control-row');
  await controls.getByRole('button', { name: 'Turn on descriptions' }).click();
  await page.locator('fidel-player .able-media-container video').evaluate((v) => (v.currentTime = 4));
  await controls.getByRole('button', { name: 'Play' }).click();

  // At 0:05 the recording starts and the lesson pauses for it ("pause during description" is on by default).
  const state = () => page.evaluate(() => {
    const able = document.querySelector('fidel-player').ablePlayer;
    return { recording: Boolean(able.fidelDescAudio && !able.fidelDescAudio.paused), paused: able.media.paused };
  });
  await expect.poll(state, { timeout: 10_000 }).toEqual({ recording: true, paused: true });
});

test('"Save for offline" keeps the lesson in the browser for use with no internet', async ({ page, context }) => {
  await page.goto(`/demo/savanna-mock/lesson.html?id=${lessonId}`);
  const panel = page.locator('fidel-player .fidel-panel');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await panel.getByRole('button', { name: 'Save for offline in this browser' }).click();
  const open = panel.getByRole('link', { name: 'Open saved lesson' });
  await expect(open).toBeVisible({ timeout: 30_000 });
  const savedUrl = await open.getAttribute('href');

  await context.setOffline(true); // airplane mode
  await page.goto(savedUrl);
  await expect(page.getByRole('heading', { level: 2, name: 'መጀመሪያ' })).toBeVisible();
  await expect.poll(() => page.locator('#media').evaluate((a) => a.duration), { timeout: 10_000 }).toBeGreaterThan(100);
  await context.setOffline(false);
});
