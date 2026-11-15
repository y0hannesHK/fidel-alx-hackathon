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
// Chromium's fake camera, for the sign-language answer (D6); no other test uses a camera.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

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
  { name: 'event access request', opener: (page) => page.getByRole('button', { name: 'Request access support' }) },
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
      // Open panels: the Amharic keyboard at step 2.
      await page.getByRole('button', { name: 'Show Amharic keyboard' }).click();
      await page.getByRole('button', { name: 'ለ, le' }).click();
      expect(await seriousAxeIssues(page), 'Amharic keyboard open').toEqual([]);
      await expectNoSidewaysScroll(page);
      // The reading guide on, dimming the rest.
      await page.getByRole('button', { name: 'Reading guide' }).click();
      await page.getByLabel('Dim the rest').check();
      await page.getByRole('button', { name: 'Next line' }).click();
      expect(await seriousAxeIssues(page), 'reading guide on').toEqual([]);
      await expectNoSidewaysScroll(page);
      await page.getByRole('button', { name: 'Reading guide' }).click();
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

// --- Studio: caption reports (D2) and the sound-off check (D3) ------------------

async function studioLesson(page) {
  await page.goto('/studio/');
  await page.getByLabel('Staff token').fill(TOKEN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lessons' })).toBeVisible();
  await page.evaluate((id) => { location.hash = `#/lesson/${id}`; }, lessonId);
  await expect(page.getByRole('heading', { level: 1, name: 'Package D test lesson' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /^Silent gaps/ })).toBeVisible({ timeout: 20_000 });
}

test.describe('Studio lesson page with the Package D panels', () => {
  test.describe.configure({ mode: 'serial' });

  for (const zoom of ZOOMS) {
    test(`axe clean and no sideways scrolling at ${zoom.name} zoom`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });
      const page = await context.newPage();
      await studioLesson(page);
      await page.getByRole('button', { name: 'Add a sound caption here' }).first().click();
      await page.waitForTimeout(500);
      expect(await seriousAxeIssues(page)).toEqual([]);
      await expectNoSidewaysScroll(page);
      await context.close();
    });
  }

  test('D2: staff see a learner report, go to the caption, and resolve it', async ({ page, request }) => {
    const created = await request.post(`/api/v1/lessons/${lessonId}/caption-reports`, {
      data: { time: 6.5, lang: 'am', kind: 'wrong_words', correction: 'አሁን ኮዱን እናያለን።' },
    });
    expect(created.status()).toBe(201);
    await studioLesson(page);
    const panel = page.locator('section', { has: page.getByRole('heading', { name: /^Caption reports/ }) });
    await expect(panel.getByRole('heading', { name: /^Caption reports \(\d+ open\)/ })).toBeVisible();
    const item = panel.locator('li', { hasText: 'አሁን ኮዱን እናያለን።' });
    await item.getByRole('button', { name: 'Go to this caption' }).click();
    // Focus is in the Amharic text box of the caption at 0:06 in the caption editor.
    // (Checked by the caption's legend: the editor's text boxes are filled by caption-editor.js.)
    const focused = page.locator('textarea[lang="am"]:focus');
    await expect(focused).toHaveCount(1);
    const legend = await focused.evaluate((box) => document.getElementById(box.getAttribute('aria-describedby')).textContent);
    expect(legend).toBe('Caption 2, 0:06.0 to 0:08.0');
    await item.getByRole('button', { name: 'Resolved' }).click();
    await expect(panel.getByRole('status')).toContainText('Marked resolved.');
    await expect(panel.locator('li', { hasText: 'አሁን ኮዱን እናያለን።' })).toHaveCount(0);
  });

  test('D3: a silent gap gets a sound caption in English and Amharic; the check is marked done', async ({ page, request }) => {
    await studioLesson(page);
    const panel = page.locator('section', { has: page.getByRole('heading', { name: 'Sound-off check' }) });
    await expect(panel.getByText('English: 0 sound descriptions in 2 captions.')).toBeVisible();
    const gap = panel.locator('li', { hasText: '0:02.0 to 0:06.0: no caption.' });
    const toggle = gap.getByRole('button', { name: 'Add a sound caption here' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(gap.getByLabel('[music] / [ሙዚቃ]')).toBeFocused();
    await gap.getByRole('button', { name: 'Save sound caption' }).click();
    // The page is drawn again: the new captions are in the editor and counted.
    await expect(page.getByRole('heading', { name: 'Sound-off check' })).toBeFocused({ timeout: 20_000 });
    await expect(page.getByText('English: 1 sound description in 3 captions.')).toBeVisible();
    const cues = async (lang) => (await (await request.get(`/api/v1/lessons/${lessonId}/captions/${lang}/cues`, { headers: STAFF })).json()).cues;
    expect((await cues('en')).map((c) => c.text)).toContain('[music]');
    expect((await cues('am')).map((c) => c.text)).toContain('[ሙዚቃ]');

    await page.getByLabel('Sound-off check done for this lesson').check();
    await page.getByRole('link', { name: '← All lessons' }).click();
    const row = page.getByRole('row', { name: /Package D test lesson/ });
    await expect(row.getByRole('cell').last()).toHaveText('Done');
  });
});

test.describe('D4: Amharic keyboard', () => {
  test('ለ then ሉ inserts at the cursor and fires input; arrows, Escape and Delete one letter', async ({ page }) => {
    await openComponents(page);
    const field = page.getByLabel('Your answer in Amharic');
    await field.fill('ሰም');
    await field.evaluate((box) => box.setSelectionRange(1, 1));
    const toggle = page.getByRole('button', { name: 'Show Amharic keyboard' });
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Hide keyboard' }).first()).toHaveAttribute('aria-expanded', 'true');

    // Arrow keys, Home and End move between the letters (one Tab stop).
    const first = page.getByRole('button', { name: 'ሀ, he' });
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: 'ለ, le' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('button', { name: 'ፐ, pe' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(first).toBeFocused();
    expect(await page.locator('.fidel-kb-step1 button[tabindex="0"]').count()).toBe(1);

    // Step 2 and Escape back to step 1.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Step 2: choose the form of ለ')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ለ, le' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Step 1: choose a letter')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ለ, le' })).toBeFocused();

    // Choose ለ, then ሉ.
    const inputs = field.evaluate((box) => new Promise((resolve) => box.addEventListener('input', () => resolve(true), { once: true })));
    await page.getByRole('button', { name: 'ለ, le' }).click();
    await page.getByRole('button', { name: 'ሉ, lu' }).click();
    expect(await inputs).toBe(true);
    await expect(field).toHaveValue('ሰሉም');
    await expect(page.getByText('Letters typed: 3')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ለ, le' })).toBeFocused(); // back at step 1

    // Delete one letter removes one syllable before the cursor.
    await page.getByRole('button', { name: 'Delete one letter' }).click();
    await expect(field).toHaveValue('ሰም');
    await page.getByRole('button', { name: '።, Full stop' }).click();
    await expect(field).toHaveValue('ሰ።ም');

    await page.getByRole('button', { name: 'Back to the text' }).click();
    await expect(field).toBeFocused();
  });
});

test.describe('D5: live session card', () => {
  test('access line in words, JSON-LD Event, Join only in its window, request, calendar file', async ({ page }) => {
    await openComponents(page);
    const card = page.locator('fidel-event-card[event-id="office-hours-demo"]');
    await expect(card.getByRole('heading', { level: 4, name: 'Office hours: how to present' })).toBeVisible();
    await expect(card.locator('.fidel-event-access li')).toHaveText([
      'Live captions: yes', 'Ethiopian Sign Language interpreter: on request', 'Spoken in: English, Amharic']);
    await expect(card.getByText('Ethiopian calendar:')).toBeVisible();
    await expect(card.locator('[lang="am"]', { hasText: 'ኅዳር' }).or(card.locator('[lang="am"]', { hasText: 'ህዳር' }))).toBeVisible();

    // Before the window: no Join link, and it says when it appears.
    await expect(card.getByRole('link', { name: 'Join the session' })).toHaveCount(0);
    await expect(card.getByText('The Join link appears 15 minutes before the start.')).toBeVisible();
    // After the end (the Amharic card): the recording link.
    const past = page.locator('fidel-event-card[event-id="info-session-demo"]');
    await expect(past.getByRole('link', { name: 'ቅጂውን ይመልከቱ' })).toHaveAttribute('href', '/demo/savanna-mock/session.html');
    // In the window: Join is shown.
    await page.evaluate(() => {
      const soon = document.createElement('fidel-event-card');
      const start = new Date(Date.now() + 5 * 60000);
      for (const [k, v] of Object.entries({ title: 'Starting soon', start: start.toISOString(),
        end: new Date(start.getTime() + 3600000).toISOString(), 'join-url': 'https://meet.example.org/soon', 'event-id': 'soon' })) soon.setAttribute(k, v);
      document.querySelector('fidel-event-card').after(soon);
    });
    await expect(page.locator('fidel-event-card[event-id="soon"]').getByRole('link', { name: 'Join the session' })).toBeVisible();

    // schema.org Event JSON-LD, valid JSON.
    const events = await page.evaluate(() => [...document.querySelectorAll('fidel-event-card script[type="application/ld+json"]')]
      .map((s) => JSON.parse(s.textContent)));
    const office = events.find((e) => e.name === 'Office hours: how to present');
    expect(office).toMatchObject({ '@type': 'Event', startDate: '2026-12-04T16:00:00.000Z',
      eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
      location: { '@type': 'VirtualLocation', url: 'https://meet.example.org/office-hours' }, inLanguage: ['en', 'am'] });
    expect(office.description).toContain('Ethiopian Sign Language interpreter: on request');

    // Request access support: only which support, never why.
    const requested = page.evaluate(() => new Promise((resolve) =>
      document.addEventListener('fidel-event-request', (e) => resolve(e.detail), { once: true })));
    const opener = card.getByRole('button', { name: 'Request access support' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Request access support' });
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(dialog.getByText('Choose at least one kind of support.')).toBeVisible();
    await dialog.getByLabel('Sign language interpreter').check();
    await dialog.getByRole('button', { name: 'Send' }).click();
    expect(await requested).toEqual({ eventId: 'office-hours-demo', needs: ['sign-language'] });
    await expect(card.locator('.fidel-report-message')).toHaveText('Request sent. The organisers receive your request.');
    await expect(opener).toBeFocused();

    // Add to calendar: an .ics download.
    const download = page.waitForEvent('download');
    await card.getByRole('button', { name: 'Add to calendar' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('office-hours-demo.ics');
    const ics = readFileSync(await file.path(), 'utf8');
    expect(ics).toContain('DTSTART:20261204T160000Z');
    expect(ics).toContain('SUMMARY:Office hours: how to present');
  });
});

test.describe('D6: answer in sign language (fake camera)', () => {
  test('start camera -> record -> watch -> send (event for the host); the camera goes off', async ({ page }) => {
    await openComponents(page);
    const answer = page.locator('fidel-sign-answer');
    await answer.getByRole('button', { name: 'Start camera' }).click();
    await expect(answer.getByRole('heading', { name: 'Step 2: record your answer' })).toBeFocused();
    await expect(answer.getByText('Camera on')).toBeVisible();
    expect(await seriousAxeIssues(page), 'camera step').toEqual([]);
    await answer.getByRole('button', { name: 'Record' }).click();
    await expect(answer.getByText('Recording starts in 3')).toBeVisible();
    const stop = answer.getByRole('button', { name: 'Stop recording' });
    await expect(stop).toBeFocused({ timeout: 6000 });
    await expect(answer.locator('.fidel-sign-banner')).toContainText('Recording');
    await page.waitForTimeout(1500);
    await stop.click();
    await expect(answer.getByRole('heading', { name: 'Step 3: watch your answer' })).toBeFocused();
    // The camera is off as soon as recording stops.
    expect(await answer.evaluate((el) => el.stream === null)).toBe(true);
    await expect(answer.getByRole('button', { name: 'Slower (0.5×)' })).toHaveAttribute('aria-pressed', 'false');
    await answer.getByRole('button', { name: 'Slower (0.5×)' }).click();
    expect(await answer.locator('video').evaluate((v) => v.playbackRate)).toBe(0.5);
    expect(await seriousAxeIssues(page), 'review step').toEqual([]);

    const ready = page.evaluate(() => new Promise((resolve) => document.addEventListener('fidel-sign-answer-ready',
      (e) => resolve({ size: e.detail.blob.size, mimeType: e.detail.mimeType, seconds: e.detail.durationSeconds }), { once: true })));
    await answer.getByRole('button', { name: /^Send \(\d+\.\d MB\)$/ }).click();
    const detail = await ready;
    expect(detail.size).toBeGreaterThan(0);
    expect(detail.mimeType).toMatch(/^video\/webm/);
    expect(detail.seconds).toBeGreaterThanOrEqual(1);
    await expect(answer.locator('.fidel-sign-status')).toHaveText('Your answer is ready.');
  });

  test('camera refused: the message in words and the file-picker fallback', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });
    await openComponents(page);
    const answer = page.locator('fidel-sign-answer');
    await answer.getByRole('button', { name: 'Start camera' }).click();
    await expect(answer.getByRole('heading', { name: 'Your camera is not available here.' })).toBeFocused();
    await expect(answer.getByText('Permission to use the camera was refused.')).toBeVisible();
    const picker = answer.getByLabel("Record with your phone's camera app, or choose a video file");
    await expect(picker).toHaveAttribute('accept', 'video/*');
    await expect(picker).toHaveAttribute('capture', 'user');
    await picker.setInputFiles(VIDEO);
    await expect(answer.getByRole('heading', { name: 'Step 3: watch your answer' })).toBeFocused();
    await expect(answer.getByRole('button', { name: /^Send \(\d+\.\d MB\)$/ })).toBeVisible();
  });
});

test.describe('D7: reading guide', () => {
  test('toggling marks the focused block; Next line moves it; the choice is remembered', async ({ page }) => {
    await openComponents(page);
    const toggle = page.getByRole('button', { name: 'Reading guide' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.fidel-guide-box')).toBeHidden(); // off by default
    // Focus the link in the third list item, then switch the guide on.
    const link = page.getByRole('link', { name: 'another place' });
    await link.focus();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const boxAround = async (locator) => {
      const [box, block] = await Promise.all([page.locator('.fidel-guide-box').boundingBox(), locator.boundingBox()]);
      return box && block && box.y <= block.y && box.y + box.height >= block.y + block.height - 1;
    };
    const item = page.locator('#d-reading-text li').nth(2);
    await link.focus();
    expect(await boxAround(item)).toBe(true);
    // The overlay never takes clicks.
    expect(await page.locator('.fidel-guide-box').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');

    await page.getByRole('button', { name: 'Next line' }).click();
    const amharic = page.locator('#d-reading-text p[lang="am"]');
    await expect.poll(() => boxAround(amharic)).toBe(true);
    await page.getByRole('button', { name: 'Next line' }).click();
    await expect(page.locator('fidel-reading-guide .fidel-d-status')).toHaveText('This is the last line.');
    await page.getByRole('button', { name: 'Previous line' }).click();
    await expect.poll(() => boxAround(item)).toBe(true);

    await page.getByLabel('Dim the rest').check();
    await expect(page.locator('.fidel-guide-veil:not([hidden])').first()).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fidel-prefs')).readingGuide)).toEqual({ on: true, mode: 'dim' });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Reading guide' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Dim the rest')).toBeChecked();
    // The block under the pointer is highlighted.
    const firstParagraph = page.locator('#d-reading-text p').first();
    await firstParagraph.scrollIntoViewIfNeeded();
    await page.mouse.move(5, 5);
    await firstParagraph.hover({ position: { x: 20, y: 5 } });
    await expect.poll(() => boxAround(firstParagraph)).toBe(true);
  });
});

test.describe('Package D in Amharic (ui-lang="am")', () => {
  test('axe clean with each component and dialog in Amharic', async ({ page }) => {
    await openComponents(page);
    await page.evaluate(() => {
      const section = document.createElement('section');
      section.setAttribute('aria-label', 'Amharic');
      const start = new Date(Date.now() + 86400000);
      section.innerHTML = `
        <fidel-caption-report for="report-player" ui-lang="am"></fidel-caption-report>
        <label for="am-answer">መልስ</label><textarea id="am-answer" lang="am"></textarea>
        <fidel-amharic-keyboard for="am-answer" ui-lang="am"></fidel-amharic-keyboard>
        <fidel-event-card ui-lang="am" title="የቢሮ ሰዓት" event-id="am-demo" start="${start.toISOString()}"
          end="${new Date(start.getTime() + 3600000).toISOString()}" captions="yes" sign-language="on-request" languages="am" heading-level="3"></fidel-event-card>
        <fidel-sign-answer ui-lang="am" label="ጥያቄዎን በምልክት ቋንቋ ይጠይቁ" heading-level="3"></fidel-sign-answer>
        <fidel-reading-guide ui-lang="am" target="#d-reading-text"></fidel-reading-guide>`;
      document.querySelector('main').append(section);
    });
    const am = page.getByRole('region', { name: 'Amharic' });
    await am.getByRole('button', { name: 'የአማርኛ ቁልፍ ሰሌዳ አሳይ' }).click();
    await am.getByRole('button', { name: 'የንባብ መመሪያ' }).click();
    expect(await seriousAxeIssues(page)).toEqual([]);
    await expectNoSidewaysScroll(page);
    for (const name of ['የግርጌ ጽሑፍ ችግር ያሳውቁ', 'የተደራሽነት ድጋፍ ይጠይቁ']) {
      const opener = am.getByRole('button', { name });
      await opener.click();
      await expect(page.locator('dialog[open]')).toBeVisible();
      expect(await seriousAxeIssues(page), name).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(opener).toBeFocused();
    }
  });
});

test.describe('D1: Savanna lesson page patch', () => {
  test('"Skip to the lesson" is the first Tab stop and leads to the player', async ({ page, request }) => {
    const patched = await request.get('/savanna/fidel/fidel-savanna-patch.js');
    test.skip(!patched.ok(), 'Run sh scripts/setup-savanna.sh to add the Savanna patch.');
    await page.goto('/savanna/pages/concept-with-navigation.html');
    await expect(page.locator('fidel-player .fidel-panel')).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to the lesson' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('#curriculum_navigation_content')).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('fidel-player')))).toBe(true);
    // The fixed bars are allowed for: scroll-padding-top covers their height.
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop))).toBeGreaterThan(100);
  });
});
