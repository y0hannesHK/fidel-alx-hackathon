// New tags and the lesson document:
//   <fidel-certificate>, <fidel-session-viewer>, document.html.
// Needs the staff token (FIDEL_STAFF_TOKEN or ../.env).
import { readFileSync, existsSync } from 'node:fs';
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
test.skip(!TOKEN, 'Set FIDEL_STAFF_TOKEN (or create ../.env) to run these tests.');

async function noSeriousAxeIssues(page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => v.id)).toEqual([]);
}

// Put a component on a page that already loads fidel.js.
async function addElement(page, tag, attributes) {
  await page.goto('/demo/savanna-mock/jobs.html');
  await page.evaluate(([tagName, attrs]) => {
    const el = document.createElement(tagName);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.id = 'under-test';
    document.querySelector('main').prepend(el);
  }, [tag, attributes]);
  return page.locator('#under-test');
}

test('<fidel-certificate> shows a verified certificate, then a revoked one', async ({ page, request }) => {
  const cert = await (await request.post('/api/v1/certificates', {
    headers: STAFF, data: { learner_name: 'Card Test Learner', course: 'Accessible Web Basics', issued_on: '2026-11-15' },
  })).json();
  const url = `/api/v1/certificates/${cert.id}`;

  let card = await addElement(page, 'fidel-certificate', { certificate: url, 'heading-level': '2' });
  await expect(card.getByRole('heading', { level: 2 })).toHaveText('✓ Verified certificate');
  await expect(card).toContainText('Card Test Learner');
  await expect(card).toContainText('15 Nov 2026 / ህዳር 6 2019');
  await expect(card.getByRole('link', { name: /Check this certificate/ })).toHaveAttribute('href', cert.verify_url);
  await noSeriousAxeIssues(page);

  await request.post(`${url}/revoke`, { headers: STAFF });
  card = await addElement(page, 'fidel-certificate', { certificate: url, lang: 'am' });
  await expect(card.getByRole('heading')).toHaveText('✗ ይህ የምስክር ወረቀት ተሰርዟል');
});

test('lesson document: headings, described slide image, transcript; linked from the player', async ({ page, request }) => {
  // A lesson with captions and a described chapter image (silent video: no AI runs).
  const upload = await request.post('/api/v1/lessons', {
    headers: STAFF,
    multipart: { title: 'Document test lesson', spoken_language: 'en',
      video: { name: 'v.webm', mimeType: 'video/webm', buffer: readFileSync('../data/demo/sign.webm') } },
  });
  const lessonId = (await upload.json()).id;
  await expect.poll(async () => {
    const steps = await (await request.get(`/api/v1/lessons/${lessonId}/status`)).json();
    return Object.values(steps).every((s) => !['pending', 'running'].includes(s.status));
  }, { timeout: 120_000 }).toBe(true);
  const put = (path, data) => request.put(`/api/v1/lessons/${lessonId}/${path}`, { headers: STAFF, data });
  await put('captions/en', { cues: [{ start: 0, end: 4, text: 'Welcome to the lesson.' }, { start: 5, end: 9, text: 'Here is the main idea.' }] });
  await put('chapters', { chapters: [
    { start: 0, title_en: 'Welcome', image_alt_en: 'Colour bars test pattern.' },
    { start: 5, title_en: 'Main idea' },
  ] });
  await request.post(`/api/v1/lessons/${lessonId}/publish`, { headers: STAFF, data: { published: true } });

  try {
    await page.goto(`/api/v1/lessons/${lessonId}/document.html?lang=en`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Document test lesson');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Welcome', 'Main idea']);
    await expect(page.getByRole('img', { name: 'Colour bars test pattern.' })).toBeVisible();
    await expect(page.getByRole('img')).toHaveCount(1); // the undescribed chapter has no image
    await expect(page.locator('main')).toContainText('Here is the main idea.');
    await noSeriousAxeIssues(page);

    await page.goto(`/demo/savanna-mock/lesson.html?id=${lessonId}`);
    const panel = page.locator('fidel-player .fidel-panel');
    await expect(panel.getByRole('link', { name: 'Read the lesson as a document (web page)' }))
      .toHaveAttribute('href', /document\.html\?lang=en$/);
  } finally {
    await request.delete(`/api/v1/lessons/${lessonId}`, { headers: STAFF });
  }
});

test.describe('<fidel-session-viewer>', () => {
  test.skip(!existsSync('../data/demo/session/session.webm'), 'Run scripts/make-demo-session.sh first.');

  test('chat beside the recording: anonymised, select a message to jump there, read aloud while playing', async ({ page }) => {
    await page.goto('/demo/savanna-mock/session.html');
    const viewer = page.locator('fidel-session-viewer');
    await expect(viewer.locator('.fidel-panel')).toBeVisible({ timeout: 15_000 });
    const chat = viewer.getByRole('region', { name: 'Chat' });
    await expect(chat).toContainText('messages');
    await expect(chat).not.toContainText('Naod'); // names hidden
    await expect(chat.locator('.fidel-chat-name').first()).toHaveText('Participant 1:');

    // Chat times are lined up with the recording (chat-offset): every message
    // is within its 44:58 length. The first one ("Sound is not clear") is at 0:27.
    const times = await chat.locator('.fidel-chat-time').allTextContents();
    expect(times[0]).toBe('0:27');
    expect(times.every((t) => t.split(':').length === 2 && Number(t.split(':')[0]) < 45)).toBe(true);

    // Select a message: the recording jumps there.
    await chat.getByRole('button', { name: /Play from 0:27/ }).click();
    const video = viewer.locator('.able-media-container video');
    await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeGreaterThanOrEqual(26);

    // Normal playback past a message reads it aloud (polite live region).
    await video.evaluate((v) => { v.currentTime = 40; return v.play(); });
    await expect(viewer.locator('[aria-live]').last()).toContainText('Replying to', { timeout: 15_000 });
    await noSeriousAxeIssues(page);
  });

  test('one column, no sideways scrolling on a narrow screen', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 800 } });
    const page = await context.newPage();
    await page.goto('/demo/savanna-mock/session.html');
    await expect(page.locator('fidel-session-viewer .fidel-panel')).toBeVisible({ timeout: 15_000 });
    const [scrollWidth, clientWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    await context.close();
  });
});
