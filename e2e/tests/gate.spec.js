// The hackathon gate (opening presentation, 14 Nov, slide 14), the parts a
// machine can check:
//   - axe-core: zero critical and zero serious issues, on every page
//   - zoom: 200% (and 400%, WCAG 1.4.10 reflow) with no sideways scrolling
//   - keyboard only: Tab moves through every page and never gets stuck
// NVDA, TalkBack, sound off and the co-designer doing the main task unaided
// are people's tests: see docs/manual-testing.md.
//
// Needs the staff token: FIDEL_STAFF_TOKEN in the environment or in ../.env.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, readFileSync } from 'node:fs';

function staffToken() {
  if (process.env.FIDEL_STAFF_TOKEN) return process.env.FIDEL_STAFF_TOKEN;
  if (!existsSync('../.env')) return '';
  const line = readFileSync('../.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('FIDEL_STAFF_TOKEN='));
  return line ? line.split('=', 2)[1].trim() : '';
}
const TOKEN = staffToken();
const STAFF = { Authorization: `Bearer ${TOKEN}` };
// Silent and short: processed in seconds, so other tests' lessons do not wait
// behind it (the pipeline runs one lesson at a time). The offline lesson needs
// sound, so its zoom checks are in offline.spec.js.
const VIDEO = '../data/demo/sign.webm';
test.skip(!TOKEN, 'Set FIDEL_STAFF_TOKEN (or create ../.env) to run the gate.');
test.skip(!existsSync(VIDEO), 'Run scripts/make-demo-clip.sh first (needs data/demo/sign.webm).');

// 100%: a 1280 x 800 screen. 200% and 400%: the same screen zoomed in
// (half and a quarter of the CSS pixels, at double and four times the density).
const ZOOMS = [
  { name: '100%', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  { name: '200%', viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 },
  { name: '400%', viewport: { width: 320, height: 200 }, deviceScaleFactor: 4 },
];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

let lessonId;
let jobId;

test.beforeAll(async ({ request }) => {
  test.setTimeout(180_000); // the lesson is processed first
  // An Amharic lesson with captions and audio descriptions in all three languages.
  const upload = await request.post('/api/v1/lessons', {
    headers: STAFF,
    multipart: {
      title: 'Gate check lesson', spoken_language: 'am',
      video: { name: 'gate.webm', mimeType: 'video/webm', buffer: readFileSync(VIDEO) },
    },
  });
  expect(upload.status()).toBe(201);
  lessonId = (await upload.json()).id;
  await expect.poll(async () => {
    const steps = await (await request.get(`/api/v1/lessons/${lessonId}/status`)).json();
    return Object.values(steps).every((s) => !['pending', 'running'].includes(s.status));
  }, { timeout: 120_000 }).toBe(true);
  const texts = {
    en: ['People with disability and refugees.', 'A slide shows the ALX logo.'],
    am: ['አካል ጉዳተኞች እና ስደተኞች።', 'የALX አርማ ይታያል።'],
    om: ["Namoota qaama miidhamanii fi baqattoota.", "Mallattoon ALX ni mul'ata."],
  };
  for (const [lang, [caption, description]] of Object.entries(texts)) {
    await request.put(`/api/v1/lessons/${lessonId}/captions/${lang}`, {
      headers: STAFF, data: { cues: [{ start: 0, end: 3, text: caption }] },
    });
    await request.put(`/api/v1/lessons/${lessonId}/descriptions/${lang}`, {
      headers: STAFF, data: { cues: [{ start: 1, end: 3, text: description }] },
    });
  }
  await request.post(`/api/v1/lessons/${lessonId}/publish`, { headers: STAFF, data: { published: true } });

  const job = await request.post('/api/v1/jobs', {
    headers: STAFF,
    data: {
      title: 'Junior Web Developer', organization: 'Example Tech PLC',
      description: 'Build accessible web pages with our team.', location: 'Addis Ababa', remote: true,
      employment_type: 'FULL_TIME', date_posted: '2026-11-14', closing_date: '2026-12-31',
      apply_email: 'jobs@example.com', how_to_apply: 'Send your CV by email.',
      accommodations: ['screen_reader_tools', 'flexible_hours'],
      summary_en: 'A junior web developer job in Addis Ababa or remote.',
      summary_am: 'በአዲስ አበባ ወይም ከርቀት የጀማሪ የድር ገንቢ ሥራ።',
    },
  });
  expect(job.status(), await job.text()).toBe(201);
  jobId = (await job.json()).identifier.value;
});

test.afterAll(async ({ request }) => {
  if (lessonId) await request.delete(`/api/v1/lessons/${lessonId}`, { headers: STAFF });
  if (jobId) await request.delete(`/api/v1/jobs/${jobId}`, { headers: STAFF });
});

// Pages, and what shows that each is ready.
const LEARNER_PAGES = [
  { name: 'demo lesson', url: () => '/demo/savanna-mock/', ready: 'fidel-player .fidel-panel' },
  { name: 'Amharic lesson', url: () => `/demo/savanna-mock/lesson.html?id=${lessonId}`, ready: 'fidel-player .fidel-panel' },
  { name: 'job card', url: () => `/demo/savanna-mock/jobs.html?id=${jobId}`, ready: 'fidel-job-card article' },
  { name: 'live-session viewer', url: () => '/demo/savanna-mock/session.html', ready: 'fidel-session-viewer' },
  { name: 'blank page', url: () => '/demo/blank.html', ready: 'body' },
  { name: 'components page', url: () => '/demo/components.html', ready: 'main' },
  { name: 'lesson document (Amharic)', url: () => `/api/v1/lessons/${lessonId}/document.html?lang=am`, ready: 'main' },
];
const STUDIO_PAGES = [
  { name: 'Studio lessons', hash: '#/', heading: 'Lessons' },
  { name: 'Studio lesson', hash: () => `#/lesson/${lessonId}`, heading: 'Gate check lesson' },
  { name: 'Studio jobs', hash: '#/jobs', heading: 'Jobs' },
  { name: 'Studio certificates', hash: '#/certificates', heading: 'Certificates' },
  { name: 'Studio glossary', hash: '#/glossary', heading: /Glossary/ },
];

async function seriousAxeIssues(page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations
    .filter((v) => ['critical', 'serious'].includes(v.impact))
    .map((v) => `${v.impact} ${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

// Pixels of sideways scrolling, and the outermost elements that stick out.
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

for (const zoom of ZOOMS) {
  test.describe(`gate at ${zoom.name} zoom`, () => {
    for (const p of LEARNER_PAGES) {
      test(`${p.name}: axe clean, no sideways scrolling`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });
        const page = await context.newPage();
        await page.goto(p.url());
        await expect(page.locator(p.ready).first()).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(500); // late layout (fonts, player controls)
        expect(await seriousAxeIssues(page)).toEqual([]);
        await expectNoSidewaysScroll(page);
        await context.close();
      });
    }

    for (const p of STUDIO_PAGES) {
      test(`${p.name}: axe clean, no sideways scrolling`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });
        const page = await context.newPage();
        await page.goto('/studio/');
        await page.getByLabel('Staff token').fill(TOKEN);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Lessons' })).toBeVisible();
        await page.evaluate((hash) => { location.hash = hash; }, typeof p.hash === 'function' ? p.hash() : p.hash);
        await expect(page.getByRole('heading', { level: 1, name: p.heading })).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(500);
        expect(await seriousAxeIssues(page)).toEqual([]);
        await expectNoSidewaysScroll(page);
        await context.close();
      });
    }
  });
}

test.describe('keyboard only', () => {
  for (const p of LEARNER_PAGES) {
    test(`${p.name}: Tab moves through the page and never gets stuck`, async ({ page }) => {
      await page.goto(p.url());
      await expect(page.locator(p.ready).first()).toBeVisible({ timeout: 20_000 });
      const seen = [];
      for (let i = 0; i < 80; i++) {
        await page.keyboard.press('Tab');
        seen.push(await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return 'body';
          const label = el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30);
          return `${el.tagName.toLowerCase()}:${label}`;
        }));
      }
      // Stuck = the same element for 10 presses in a row (a keyboard trap).
      // (The browser's own <audio> controls are about 6 Tab stops in one element.)
      const stuck = seen.some((s, i) => i >= 9 && seen.slice(i - 9, i + 1).every((x) => x === s && x !== 'body'));
      expect(stuck, `focus order: ${seen.slice(0, 25).join(' > ')}`).toBe(false);
      expect(new Set(seen).size, 'different things reached with Tab').toBeGreaterThan(['blank page', 'lesson document (Amharic)', 'components page'].includes(p.name) ? 0 : 3);
    });
  }
});
