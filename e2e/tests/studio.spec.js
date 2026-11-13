// Fidel Studio: a staff member checks the Amharic captions, and the player
// stops showing the "machine-generated" notice.
//
// Needs the staff token: FIDEL_STAFF_TOKEN in the environment or in ../.env.
// The test makes its own lesson from the silent test video (so no AI model
// runs and nothing races the test), and deletes it at the end.
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
const VIDEO = '../data/demo/sign.webm'; // silent: no speech-to-text runs

test.skip(!TOKEN, 'Set FIDEL_STAFF_TOKEN (or create ../.env) to run Studio tests.');
test.skip(!existsSync(VIDEO), 'Run scripts/make-demo-clip.sh first (needs data/demo/sign.webm).');

let lessonId;

test.beforeAll(async ({ request }) => {
  const upload = await request.post('/api/v1/lessons', {
    headers: STAFF,
    multipart: {
      title: 'Studio test lesson',
      spoken_language: 'en',
      video: { name: 'test.webm', mimeType: 'video/webm', buffer: readFileSync(VIDEO) },
    },
  });
  expect(upload.status()).toBe(201);
  lessonId = (await upload.json()).id;

  // Wait for processing (only the video steps do anything for a silent video).
  await expect.poll(async () => {
    const steps = await (await request.get(`/api/v1/lessons/${lessonId}/status`)).json();
    return Object.values(steps).every((s) => !['pending', 'running'].includes(s.status));
  }, { timeout: 120_000 }).toBe(true);

  // Captions as the pipeline would make them: English + machine Amharic draft.
  const cues = (texts) => texts.map((text, i) => ({ start: i * 3, end: i * 3 + 3, text }));
  for (const [lang, texts] of [
    ['en', ['People with disability and refugees.', 'Tech education is the ultimate equalizer.']],
    ['am', ['የጎዳና ተዳዳሪዎችንና ስደተኞችን።', 'ቴክኒካዊ ትምህርት የመጨረሻው ማስተካከያ ነው።']],
  ]) {
    const put = await request.put(`/api/v1/lessons/${lessonId}/captions/${lang}`, { headers: STAFF, data: { cues: cues(texts) } });
    expect(put.status()).toBe(200);
  }
});

test.afterAll(async ({ request }) => {
  if (lessonId) await request.delete(`/api/v1/lessons/${lessonId}`, { headers: STAFF });
});

async function signIn(page) {
  await page.goto('/studio/');
  await page.getByLabel('Staff token').fill(TOKEN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lessons' })).toBeVisible();
}

test('a wrong token is refused with a clear message', async ({ page }) => {
  await page.goto('/studio/');
  await page.getByLabel('Staff token').fill('not-the-token');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('That staff token is not right.');
});

test('staff fix and check the Amharic captions; the draft notice disappears', async ({ page, request }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Studio test lesson' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Studio test lesson' })).toBeFocused();

  const editor = page.locator('section', { has: page.getByRole('heading', { name: 'Captions' }) });
  await expect(editor.locator('.counter')).toHaveText('2 of 2 Amharic captions still to check.');

  // Fix caption 1 (the machine wrote "street people" for "people with disability").
  const first = editor.getByRole('group', { name: /Caption 1/ }).getByRole('textbox', { name: /Amharic/ });
  await first.fill('አካል ጉዳተኞችና ስደተኞች።');
  await first.press('Control+Enter'); // "Checked, go to next"
  const second = editor.getByRole('group', { name: /Caption 2/ }).getByRole('textbox', { name: /Amharic/ });
  await expect(second).toBeFocused();
  await editor.getByRole('group', { name: /Caption 2/ }).getByRole('button', { name: 'Checked, go to next' }).click();
  await expect(editor.locator('.counter')).toContainText('All Amharic captions are checked.');

  await editor.getByRole('button', { name: 'Save captions' }).click();
  await expect(editor.getByRole('status').filter({ hasText: 'fully checked' })).toBeVisible();

  // The API now says "reviewed", with the corrected text.
  const manifest = await (await request.get(`/api/v1/lessons/${lessonId}`, { headers: STAFF })).json();
  expect(manifest.captions.find((c) => c.lang === 'am').status).toBe('reviewed');
  expect(await (await request.get(`/api/v1/lessons/${lessonId}/captions/am`)).text()).toContain('አካል ጉዳተኞችና ስደተኞች።');

  // The preview player shows Amharic captions without the draft notice.
  const preview = page.locator('#studio-preview');
  await expect(preview.locator('.fidel-panel')).toBeVisible({ timeout: 15_000 });
  await preview.getByRole('radio', { name: 'አማርኛ' }).check();
  await expect(preview.locator('.fidel-draft-notice')).toHaveCount(0);
});

test('chapters are saved, and English titles are marked as English in an Amharic transcript', async ({ page, request }) => {
  await signIn(page);
  await page.goto(`/studio/#/lesson/${lessonId}`);
  const chapters = page.locator('section', { has: page.getByRole('heading', { name: 'Chapters' }) });
  await chapters.getByRole('button', { name: 'Add chapter' }).click();
  await chapters.getByLabel('English title').fill('Introduction');
  await chapters.getByRole('button', { name: 'Save chapters' }).click();
  await expect(chapters.getByRole('status')).toContainText('no Amharic title');

  const manifest = await (await request.get(`/api/v1/lessons/${lessonId}`, { headers: STAFF })).json();
  expect(Object.keys(manifest.chapters)).toEqual(['en']);

  // In the preview, switch captions (and transcript) to Amharic: the English
  // chapter title must carry lang="en".
  const preview = page.locator('#studio-preview');
  await expect(preview.locator('.fidel-panel')).toBeVisible({ timeout: 15_000 });
  await preview.getByRole('radio', { name: 'አማርኛ' }).check();
  await expect(preview.locator('.able-transcript-chapter-heading').first()).toHaveAttribute('lang', 'en');
});

test('Studio pages have no critical or serious axe issues', async ({ page }) => {
  for (const url of ['/studio/', `/studio/#/lesson/${lessonId}`]) {
    if (url !== '/studio/') await signIn(page);
    await page.goto(url);
    await expect(page.locator('h1')).toBeVisible();
    if (url.includes('lesson')) await expect(page.locator('#studio-preview .fidel-panel')).toBeVisible({ timeout: 15_000 });
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    for (const v of results.violations) console.log(`[axe ${url}] ${v.impact} ${v.id}: ${v.help}`);
    const blocking = results.violations.filter((v) => ['critical', 'serious'].includes(v.impact))
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking, url).toEqual([]);
  }
});
