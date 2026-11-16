// Savanna's pages rebuilt by Team GNU (/demo/savanna-rebuild/): a demo,
// not ALX's product. Checks the gate on each page (axe at 100/200/400 % zoom
// and in Amharic, no sideways scrolling at 320 px, Tab never stuck), the main
// task on the lesson page by keyboard, and the page widgets (course switcher,
// week strip, module switcher, programme dialog, language switch, sidebar).
//
// Needs the staff token (FIDEL_STAFF_TOKEN or ../.env) for the jobs test.
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

const BASE = '/demo/savanna-rebuild/';
const PAGES = [
  { name: 'lesson', url: 'lesson.html', ready: 'fidel-player .fidel-panel' },
  { name: 'reading lesson', url: 'lesson.html?n=3', ready: 'fidel-step-nav nav' },
  { name: 'paced homepage', url: 'index.html', ready: '#week-panel h3' },
  { name: 'self-paced homepage', url: 'self-paced.html', ready: '#module-panel h3' },
  { name: 'jobs', url: 'jobs.html', ready: '#jobs-status:not(:empty)' },
];
const ZOOMS = [
  { name: '100%', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  { name: '200%', viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 },
  { name: '400%', viewport: { width: 320, height: 200 }, deviceScaleFactor: 4 },
];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function seriousAxeIssues(page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations
    .filter((v) => ['critical', 'serious'].includes(v.impact))
    .map((v) => `${v.impact} ${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

async function expectNoSidewaysScroll(page) {
  const { pixels, outermost } = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const over = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > width + 1);
    return {
      pixels: document.documentElement.scrollWidth - width,
      outermost: over.filter((e) => !over.includes(e.parentElement)).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`),
    };
  });
  expect(pixels, `sideways scrolling; sticking out: ${outermost.join(', ')}`).toBeLessThanOrEqual(1);
}

async function open(page, url, ready) {
  await page.goto(BASE + url);
  await expect(page.locator(ready).first()).toBeAttached({ timeout: 20_000 });
  await page.waitForTimeout(500); // late layout (fonts, player controls)
}

// Use a control the way a keyboard user does: focus it, press a key.
async function press(locator, key = 'Enter') {
  await locator.focus();
  await locator.press(key);
}

// A job, so that the jobs page has a card (each worker makes its own).
let jobId;
const JOB_TITLE = `Accessible web assistant ${Date.now()}-${Math.round(Math.random() * 1e6)}`;

test.beforeAll(async ({ request }) => {
  if (!TOKEN) return;
  const created = await request.post('/api/v1/jobs', {
    headers: STAFF,
    data: {
      title: JOB_TITLE, organization: 'Example Learning PLC',
      description: 'Help our team make course pages that everyone can use.', location: 'Hawassa', remote: true,
      employment_type: 'PART_TIME', date_posted: '2026-11-15', closing_date: '2027-12-31',
      apply_email: 'jobs@example.com', how_to_apply: 'Send your CV by email.',
      accommodations: ['screen_reader_tools', 'flexible_hours'],
      summary_en: 'A part-time job making web pages accessible, in Hawassa or remote.',
      summary_am: 'በሃዋሳ ወይም ከርቀት የድረ-ገጾችን ተደራሽነት የማሻሻል የትርፍ ጊዜ ሥራ።',
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  jobId = (await created.json()).identifier.value;
});

test.afterAll(async ({ request }) => {
  if (jobId) await request.delete(`/api/v1/jobs/${jobId}`, { headers: STAFF });
});

for (const zoom of ZOOMS) {
  test.describe(`rebuild at ${zoom.name} zoom`, () => {
    for (const p of PAGES) {
      test(`${p.name}: axe clean, no sideways scrolling`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });
        const page = await context.newPage();
        await open(page, p.url, p.ready);
        expect(await seriousAxeIssues(page)).toEqual([]);
        await expectNoSidewaysScroll(page);
        await context.close();
      });
    }
  });
}

test.describe('rebuild in Amharic', () => {
  for (const p of PAGES) {
    test(`${p.name}: axe clean in Amharic, no sideways scrolling at 320 px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await open(page, p.url, p.ready);
      await press(page.getByRole('banner').getByRole('button', { name: 'አማርኛ (Amharic)' }));
      await expect(page.getByRole('banner').getByRole('button', { name: 'አማርኛ (Amharic)' })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.demo-note')).toHaveAttribute('lang', 'am');
      expect(await seriousAxeIssues(page)).toEqual([]);
      await expectNoSidewaysScroll(page);
    });
  }
});

test.describe('rebuild by keyboard', () => {
  for (const p of PAGES) {
    test(`${p.name}: Tab moves through the page and never gets stuck`, async ({ page }) => {
      await open(page, p.url, p.ready);
      const seen = [];
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        seen.push(await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return 'body';
          return `${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') || el.textContent.trim()).slice(0, 30)}`;
        }));
      }
      expect(seen[0]).toMatch(/^a:Skip to main content/);
      const stuck = seen.some((s, i) => i >= 9 && seen.slice(i - 9, i + 1).every((x) => x === s && x !== 'body'));
      expect(stuck, `focus order: ${seen.slice(0, 25).join(' > ')}`).toBe(false);
      expect(new Set(seen).size).toBeGreaterThan(8);
    });
  }
});

test('lesson, main task by keyboard: skip to h1, Amharic captions, bigger, sign window, search, download', async ({ page }) => {
  await open(page, 'lesson.html', 'fidel-player .fidel-panel');

  // The skip link is the first Tab stop and lands on the lesson's <h1>.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Tech education as an equalizer' })).toBeFocused();

  const panel = page.locator('.fidel-panel');
  await press(panel.getByRole('radio', { name: 'አማርኛ' }), 'Space');
  await expect(panel.getByRole('radio', { name: 'አማርኛ' })).toBeChecked();
  await expect(page.locator('fidel-player .able-captions-wrapper')).toHaveAttribute('lang', 'am');

  const larger = panel.getByRole('button', { name: /Larger captions/ });
  await press(larger);
  await press(larger);
  await expect(panel.locator('output')).toHaveText('200%');

  const signToggle = panel.getByRole('button', { name: 'Show sign language' });
  await press(signToggle);
  await expect(signToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.fidel-sign-dock .able-sign-window video')).toBeVisible();

  const search = page.getByRole('searchbox', { name: 'Search the transcript' });
  await search.focus();
  await page.keyboard.type('ALX');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'for “ALX”' })).toBeVisible();
  await expect(page.locator('.fidel-result').first()).toContainText('Play from');

  const download = page.getByRole('link', { name: 'Download the video (MP4)' });
  await expect(download).toHaveAttribute('href', '/media/lesson.mp4');
  await expect(download).toHaveAttribute('download', /\.mp4$/);
  await expect(page.getByRole('button', { name: 'Download the transcript as text (.txt)' })).toBeVisible();
});

test('lesson: course contents give the state in words, and the current lesson has aria-current', async ({ page }) => {
  await open(page, 'lesson.html', 'fidel-player .fidel-panel');
  const contents = page.getByRole('complementary', { name: 'Course contents' });
  await expect(contents.getByRole('listitem')).toHaveCount(6);
  await expect(contents.locator('a[aria-current="page"]')).toHaveCount(1);
  await expect(contents.locator('a[aria-current="page"]')).toContainText('Tech education as an equalizer');
  await expect(contents.locator('a[aria-current="page"]')).toContainText('You are here');
  await expect(contents.getByRole('link', { name: /Your learning tools/ })).toContainText('Done');
  await expect(contents.getByRole('link', { name: /Module 2 wrap-up/ })).toContainText('Not started');
  // The Fidel components of the lesson are on the page.
  for (const tag of ['fidel-lesson-formats', 'fidel-lesson-map', 'fidel-notes', 'fidel-question', 'fidel-callout', 'fidel-quiz', 'fidel-mark-complete', 'fidel-step-nav', 'fidel-help', 'fidel-display-prefs']) {
    await expect(page.locator(tag), tag).toHaveCount(1);
  }
  await expect(page.getByRole('navigation', { name: 'Lesson', exact: true })).toContainText('Lesson 4 of 6');

  // Lesson 3 is a reading lesson: no video, and "You are here" moves.
  await page.getByRole('navigation', { name: 'Lesson', exact: true }).getByRole('link', { name: /Lesson 3/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your learning tools' })).toBeVisible();
  await expect(page.locator('fidel-player')).toHaveCount(0);
  await expect(contents.locator('a[aria-current="page"]')).toContainText('Your learning tools');
  await expect(page.getByRole('navigation', { name: 'Lesson', exact: true })).toContainText('Lesson 3 of 6');
});

test('paced homepage: the course switcher works by keyboard', async ({ page }) => {
  await open(page, 'index.html', '#week-panel h3');
  const switcher = page.getByRole('button', { name: 'Switch course' });
  await expect(switcher).toHaveAttribute('aria-expanded', 'false');
  await press(switcher);
  await expect(switcher).toHaveAttribute('aria-expanded', 'true');
  const current = page.getByRole('button', { name: 'Web Foundations (WF-100)' });
  await expect(current).toBeFocused();
  await expect(current).toHaveAttribute('aria-current', 'true');

  // Escape closes the list; focus goes back to the switcher.
  await page.keyboard.press('Escape');
  await expect(switcher).toHaveAttribute('aria-expanded', 'false');
  await expect(switcher).toBeFocused();

  // Choose another course with Tab and Enter.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Digital Skills for Everyone (DS-101)' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#course-name')).toHaveText('Digital Skills for Everyone (DS-101)');
  await expect(switcher).toBeFocused();
  await expect(switcher).toHaveAttribute('aria-expanded', 'false');
});

test('paced homepage: the week strip works by keyboard, and the page has its parts', async ({ page }) => {
  await open(page, 'index.html', '#week-panel h3');
  const week6 = page.getByRole('button', { name: /Week 6/ });
  const week3 = page.getByRole('button', { name: /Week 3/ });
  await expect(week6).toHaveAttribute('aria-pressed', 'true');
  await press(week3, 'Space');
  await expect(week3).toHaveAttribute('aria-pressed', 'true');
  await expect(week6).toHaveAttribute('aria-pressed', 'false');
  await expect(week3).toBeFocused();
  await expect(page.locator('#week-panel h3')).toHaveText('Week 3: Your first HTML page');
  await press(week6);
  await expect(page.locator('#week-panel h3')).toHaveText('Week 6: Accessible pages');

  await expect(page.getByRole('link', { name: /Continue lesson 4/ })).toHaveAttribute('href', 'lesson.html');
  await expect(page.locator('progress')).toHaveCount(2);
  await expect(page.getByRole('meter', { name: 'Overall score: 74%' })).toBeVisible();
  await expect(page.locator('fidel-event-card')).toHaveCount(2);
  await expect(page.locator('fidel-event-card .fidel-d-actions').first()).toBeVisible();
  // No stray "false" text in the event cards.
  for (const card of await page.locator('fidel-event-card .fidel-d-actions').all()) {
    expect(await card.evaluate((el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''))).toBe('');
  }
  await expect(page.locator('fidel-offline-status')).toContainText('Online');
});

test('self-paced homepage: module switcher, and the programme dialog closes with Escape', async ({ page }) => {
  await open(page, 'self-paced.html', '#module-panel h3');
  await expect(page.getByRole('meter', { name: 'Progress toward graduation' })).toHaveJSProperty('value', 16);
  await expect(page.getByText('16% of 70% needed to graduate')).toBeVisible();

  const module3 = page.getByRole('button', { name: /Module 3: Working with others/ });
  await press(module3);
  await expect(module3).toHaveAttribute('aria-pressed', 'true');
  await expect(module3).toBeFocused();
  await expect(page.locator('#module-panel h3')).toHaveText('Activities: Module 3: Working with others');

  const opener = page.getByRole('button', { name: 'Programme details' });
  await press(opener);
  const dialog = page.getByRole('dialog', { name: 'Programme details' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  // Close button works too.
  await press(opener);
  await press(dialog.getByRole('button', { name: 'Close' }));
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('jobs page: a card for each open job, with dates in both calendars', async ({ page }) => {
  test.skip(!TOKEN, 'Set FIDEL_STAFF_TOKEN (or create ../.env) to create a job.');
  await open(page, 'jobs.html', '#jobs-status:not(:empty)');
  await expect(page.locator('#jobs-status')).toHaveText(/^\d+ open jobs?\.$/);
  const card = page.locator('fidel-job-card').filter({ hasText: JOB_TITLE });
  await expect(card.getByRole('heading', { level: 2, name: JOB_TITLE })).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText('31 Dec 2027');
  await expect(page.locator('fidel-ethiopian-date#today time')).toBeVisible();
});

test('the language switch and the sidebar are real buttons and are remembered', async ({ page }) => {
  await open(page, 'index.html', '#week-panel h3');
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home (paced course)' })).toHaveAttribute('aria-current', 'page');

  const amharic = page.getByRole('banner').getByRole('button', { name: 'አማርኛ (Amharic)' });
  const english = page.getByRole('banner').getByRole('button', { name: 'English' });
  await expect(english).toHaveAttribute('aria-pressed', 'true');
  await press(amharic);
  await expect(amharic).toHaveAttribute('aria-pressed', 'true');
  await expect(english).toHaveAttribute('aria-pressed', 'false');
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveText('እንደምን አሉ፣ ሰላም');
  await expect(h1).toHaveAttribute('lang', 'am');
  await expect(page.getByRole('navigation', { name: 'ዋና ማውጫ' })).toBeVisible();

  const menu = page.locator('.menu-toggle');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await press(menu);
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#sidebar')).toBeHidden();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('እንደምን አሉ፣ ሰላም');
  await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'false');
  await press(page.getByRole('banner').getByRole('button', { name: 'English' }));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Good day, Selam');
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveAttribute('lang', /./);
  await press(page.locator('.menu-toggle'));
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

test('every page says it is a demo, shows Fidel, and has no ALX logo', async ({ page }) => {
  for (const url of ['lesson.html', 'index.html', 'self-paced.html', 'jobs.html']) {
    await page.goto(BASE + url);
    await expect(page.locator('.demo-note')).toHaveText("Demo: Savanna's pages rebuilt by Team GNU for the Digital Bridge hackathon. Not an ALX product.");
    await expect(page.getByRole('banner').getByRole('img', { name: 'Fidel' })).toBeVisible();
    await expect(page.getByRole('banner')).toContainText('Savanna (accessible rebuild)');
    await expect(page.locator('img[src*="alx" i]')).toHaveCount(0);
    await expect(page.locator('fidel-help')).toHaveCount(1);
  }
});
