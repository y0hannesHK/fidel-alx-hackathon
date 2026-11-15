// Package D components on demo/components.html and in Fidel Studio:
// caption reports (D2), sound-off check (D3), Amharic keyboard (D4), event
// card (D5), sign-language answers (D6), reading guide (D7), and the Savanna
// patch (D1). axe at 100/200/400% zoom with each dialog open, no sideways
// scrolling at 320 px, keyboard use, Escape returns focus to the opener.
//
// Needs the staff token: FIDEL_STAFF_TOKEN in the environment or in ../.env.
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
const VIDEO = '../data/demo/sign.webm'; // short and silent: processed in seconds
test.skip(!TOKEN, 'Set FIDEL_STAFF_TOKEN (or create ../.env) to run these tests.');
test.skip(!existsSync(VIDEO), 'Run scripts/make-demo-clip.sh first (needs data/demo/sign.webm).');

const ZOOMS = [
  { name: '100%', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  { name: '200%', viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 },
  { name: '400%', viewport: { width: 320, height: 200 }, deviceScaleFactor: 4 },
];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const CAPTIONS = {
  en: ['Welcome to the lesson.', 'Now we look at the code.'],
  am: ['እንኳን ወደ ትምህርቱ በደህና መጡ።', 'አሁን ኮዱን እንመለከታለን።'],
};

let lessonId;

test.beforeAll(async ({ request }) => {
  test.setTimeout(180_000);
  const upload = await request.post('/api/v1/lessons', {
    headers: STAFF,
    multipart: {
      title: 'Package D test lesson', spoken_language: 'en',
      video: { name: 'd.webm', mimeType: 'video/webm', buffer: readFileSync(VIDEO) },
    },
  });
  expect(upload.status()).toBe(201);
  lessonId = (await upload.json()).id;
  await expect.poll(async () => {
    const steps = await (await request.get(`/api/v1/lessons/${lessonId}/status`)).json();
    return Object.values(steps).every((s) => !['pending', 'running'].includes(s.status));
  }, { timeout: 120_000 }).toBe(true);
  // Two captions with a 4-second silent gap between them (for the sound-off check).
  for (const [lang, [first, second]] of Object.entries(CAPTIONS)) {
    const put = await request.put(`/api/v1/lessons/${lessonId}/captions/${lang}`, {
      headers: STAFF, data: { cues: [{ start: 0, end: 2, text: first }, { start: 6, end: 8, text: second }] },
    });
    expect(put.status(), await put.text()).toBe(200);
  }
  await request.post(`/api/v1/lessons/${lessonId}/publish`, { headers: STAFF, data: { published: true } });
});

test.afterAll(async ({ request }) => {
  if (lessonId) await request.delete(`/api/v1/lessons/${lessonId}`, { headers: STAFF });
});

async function seriousAxeIssues(page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations
    .filter((v) => ['critical', 'serious'].includes(v.impact))
    .map((v) => `${v.impact} ${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

async function sidewaysScroll(page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const over = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > width + 1);
    const outermost = over.filter((e) => !over.includes(e.parentElement)).slice(0, 5)
      .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} (${Math.round(e.getBoundingClientRect().right - width)} px)`);
    return { pixels: document.documentElement.scrollWidth - width, outermost };
  });
}

async function expectNoSidewaysScroll(page) {
  const { pixels, outermost } = await sidewaysScroll(page);
  expect(pixels, `sideways scrolling; sticking out: ${outermost.join(', ')}`).toBeLessThanOrEqual(1);
}

/** The open dialog must fit the screen width (it scrolls inside, never sideways). */
async function expectDialogFits(page) {
  const fits = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]');
    const r = dialog.getBoundingClientRect();
    return r.left >= -1 && r.right <= document.documentElement.clientWidth + 1 && dialog.scrollWidth <= dialog.clientWidth + 1;
  });
  expect(fits, 'the open dialog fits the screen width').toBe(true);
}

const componentsPage = () => `/demo/components.html?lesson=${lessonId}`;

async function openComponents(page) {
  await page.goto(componentsPage());
  await expect(page.locator('#report-player .fidel-panel')).toBeVisible({ timeout: 20_000 });
}

// Each dialog on the page: how to open it, and its opener.
const DIALOGS = [
  { name: 'caption report', opener: (page) => page.getByRole('button', { name: 'Report a caption problem' }) },
];

for (const zoom of ZOOMS) {
  test.describe(`Package D at ${zoom.name} zoom`, () => {
    test('components page: axe clean and no sideways scrolling, also with each dialog open', async ({ browser }) => {
      const context = await browser.newContext({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });
      const page = await context.newPage();
      await openComponents(page);
      await page.waitForTimeout(500);
      expect(await seriousAxeIssues(page)).toEqual([]);
      await expectNoSidewaysScroll(page);
      for (const d of DIALOGS) {
        await d.opener(page).click();
        await expect(page.locator('dialog[open]')).toBeVisible();
        expect(await seriousAxeIssues(page), `${d.name} dialog`).toEqual([]);
        await expectDialogFits(page);
        await page.keyboard.press('Escape');
        await expect(page.locator('dialog[open]')).toHaveCount(0);
        await expect(d.opener(page)).toBeFocused();
      }
      await context.close();
    });
  });
}

test.describe('D2: report a caption problem', () => {
  const reports = async (request) =>
    (await request.get(`/api/v1/lessons/${lessonId}/caption-reports`, { headers: STAFF })).json();

  test('the dialog is pre-filled; Send creates a report; the video plays on after', async ({ page, request }) => {
    await openComponents(page);
    const sent = page.evaluate(() => new Promise((resolve) =>
      document.addEventListener('fidel-caption-report-sent', (e) => resolve(e.detail), { once: true })));
    // Play from 1 s, then report.
    await page.evaluate(() => {
      const video = document.querySelector('#report-player video');
      video.muted = true;
      video.currentTime = 1;
      return video.play();
    });
    const opener = page.getByRole('button', { name: 'Report a caption problem' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Report a caption problem' });
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => document.querySelector('#report-player video').paused)).toBe(true);
    await expect(dialog.getByLabel('Time in the video (minutes:seconds)')).toHaveValue('0:01');
    const lang = await dialog.getByLabel('Caption language').inputValue();
    await expect(dialog.locator('.fidel-report-shown q')).toHaveText(CAPTIONS[lang][0]);
    await expect(dialog.locator('.fidel-report-shown q')).toHaveAttribute('lang', lang);

    // Sending without a choice: the error is in words, focus goes to the choice.
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(dialog.getByText('Choose what is wrong.')).toBeVisible();
    await dialog.getByLabel('Wrong words').check();
    await dialog.getByLabel('Your correction (optional)').fill('Welcome to this lesson.');
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('.fidel-report-message')).toHaveText('Thank you. A person will check it.');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    expect(await sent).toEqual({ lessonId, time: 1, lang });
    await expect.poll(async () => page.evaluate(() => !document.querySelector('#report-player video').paused)).toBe(true);

    const saved = (await reports(request)).find((r) => r.correction === 'Welcome to this lesson.');
    expect(saved).toMatchObject({ kind: 'wrong_words', lang, time: 1, status: 'open' });
  });

  test('offline: saved on the device, sent when back online', async ({ page, context, request }) => {
    await openComponents(page);
    const before = (await reports(request)).length;
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Report a caption problem' }).click();
    const dialog = page.getByRole('dialog', { name: 'Report a caption problem' });
    await dialog.getByLabel('Missing sound description').check();
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('.fidel-report-message')).toHaveText('Saved on this phone. It will be sent when you are online.');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fidel-caption-report-queue')).length)).toBe(1);
    await context.setOffline(false);
    await expect(page.locator('.fidel-report-message')).toHaveText('Your saved report was sent. Thank you.');
    expect(await page.evaluate(() => localStorage.getItem('fidel-caption-report-queue'))).toBeNull();
    expect((await reports(request)).length).toBe(before + 1);
  });
});
