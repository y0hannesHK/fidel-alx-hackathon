// Package B components on demo/components.html: data saver, offline status,
// download later, Ethiopian date, section language, display settings.
// axe (0 critical / 0 serious) at 100%, 200% and 400% zoom, with the dialog
// open and in Amharic; no sideways scrolling at 320 px; keyboard; one
// behaviour test per component. Needs only the server (no staff token).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGE = '/demo/components.html';
const B = '.demo-b';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const ZOOMS = [
  { name: '100%', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  { name: '200%', viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 },
  { name: '400%', viewport: { width: 320, height: 200 }, deviceScaleFactor: 4 },
];

async function seriousAxeIssues(page, include = B) {
  const results = await new AxeBuilder({ page }).include(include).withTags(TAGS).analyze();
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

async function ready(page) {
  await page.goto(PAGE);
  await expect(page.locator('fidel-data-saver .fidel-data-saver-choices')).toBeVisible({ timeout: 20_000 });
}

for (const zoom of ZOOMS) {
  test(`package B at ${zoom.name}: axe clean, no sideways scrolling`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });
    const page = await context.newPage();
    await ready(page);
    await page.waitForTimeout(300);
    expect(await seriousAxeIssues(page)).toEqual([]);
    const { pixels, outermost } = await sidewaysScroll(page);
    expect(pixels, `sideways scrolling; sticking out: ${outermost.join(', ')}`).toBeLessThanOrEqual(1);

    // With the dialog open, and then with the biggest settings applied.
    await page.getByRole('button', { name: 'Display settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Display settings' })).toBeVisible();
    expect(await seriousAxeIssues(page, 'fidel-display-prefs')).toEqual([]);
    await page.getByRole('radio', { name: '200 %' }).check();
    await page.getByRole('radio', { name: 'Wide' }).check();
    await page.keyboard.press('Escape');
    const after = await sidewaysScroll(page);
    expect(after.pixels, `sideways scrolling at 200 % text; sticking out: ${after.outermost.join(', ')}`).toBeLessThanOrEqual(1);
    await context.close();
  });
}

test('data saver: nothing big loads before the choice; Load it plays the video', async ({ page }) => {
  const videoGets = [];
  page.on('request', (r) => {
    if (r.url().includes('/media/lesson.mp4') && r.method() !== 'HEAD') videoGets.push(r.url());
  });
  await ready(page);
  const saver = page.locator('fidel-data-saver').first();
  await expect(saver).toContainText('This video is 2.2 MB.');
  const load = saver.getByRole('button', { name: 'Load it (2.2 MB)' });
  await expect(load).toBeVisible();
  await expect(saver.getByRole('link', { name: /Use the text-only version .* instead \(\d/ })).toBeVisible();
  await page.waitForTimeout(500);
  expect(videoGets).toEqual([]);

  const choice = page.evaluate(() => new Promise((resolve) => {
    document.addEventListener('fidel-data-saver-choice', (e) => resolve(e.detail), { once: true });
  }));
  await load.focus();
  await page.keyboard.press('Enter');
  expect(await choice).toEqual({ choice: 'full' });
  await expect(saver.locator('video')).toBeVisible();
  await expect(saver.locator('video')).toBeFocused();
});

const politeText = (page) => page.locator('.fidel-announcer[aria-live="polite"]').textContent();

test('offline status: says offline when the connection goes, announced once', async ({ page, context }) => {
  await ready(page);
  const line = page.locator('fidel-offline-status .fidel-offline-status-line');
  await expect(line).toHaveText('Online.');
  await context.setOffline(true);
  await expect(line).toHaveText('You are offline. No lessons are saved on this phone.');
  await expect.poll(() => politeText(page)).toBe('You are offline. No lessons are saved on this phone.');
  const announcements = await page.evaluate(() => new Promise((resolve) => {
    // Count changes to the announcer for a moment: nothing more may be said.
    const el = document.querySelector('.fidel-announcer[aria-live="polite"]');
    let n = 0;
    new MutationObserver(() => { n += 1; }).observe(el, { childList: true, characterData: true, subtree: true });
    setTimeout(() => resolve(n), 1500);
  }));
  expect(announcements).toBe(0);
  await context.setOffline(false);
  await expect(line).toHaveText('Online.');
});

test('download later: queued while offline, downloaded when online, can be cancelled', async ({ page, context }) => {
  await ready(page);
  const box = page.locator('fidel-download-later');
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await box.getByRole('button', { name: "Download when I'm online (Lesson 3 (demo file), 0.1 MB)" }).click();
  await expect(box).toContainText('Lesson 3 (demo file) will download when you are online.');
  const remove = box.getByRole('button', { name: 'Remove Lesson 3 (demo file) from the queue' });
  await expect(remove).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fidel-download-queue')).length)).toBe(1);

  // Cancel, then queue again.
  await remove.click();
  const download = box.getByRole('button', { name: /Download when I'm online/ });
  await expect(download).toBeFocused();
  await download.click();

  const readyEvent = page.evaluate(() => new Promise((resolve) => {
    document.addEventListener('fidel-download-ready', (e) => resolve(e.detail), { once: true });
  }));
  await context.setOffline(false);
  expect(await readyEvent).toEqual({ href: '/demo/media/chapters.vtt', label: 'Lesson 3 (demo file)' });
  await expect(box).toContainText('Lesson 3 (demo file) is ready offline.');
  await expect(box.getByRole('link', { name: 'Open Lesson 3 (demo file)' })).toBeVisible();
  await expect.poll(() => politeText(page)).toBe('Lesson 3 (demo file) is ready offline.');
  // The offline status counts it and lists it by name.
  await expect(page.locator('fidel-offline-status')).toContainText('1 lesson is saved on this phone.');
  await page.locator('fidel-offline-status summary').click();
  await expect(page.locator('fidel-offline-status').getByRole('link', { name: 'Lesson 3 (demo file)' })).toBeVisible();
});

test('Ethiopian date: both calendars in a real <time>, ordered by language', async ({ page }) => {
  await ready(page);
  const dates = page.locator('fidel-ethiopian-date time');
  await expect(dates.nth(0)).toHaveText('15 Nov 2026 / ህዳር 6 2019');
  await expect(dates.nth(0)).toHaveAttribute('datetime', '2026-11-15');
  await expect(dates.nth(0).locator('span[lang="am"]')).toHaveText('ህዳር 6 2019');
  await expect(dates.nth(1)).toHaveText('ህዳር 6 2019 / 15 Nov 2026');
  await expect(dates.nth(2)).toHaveText('Sunday 15 November 2026 / እሑድ ህዳር 6 2019 ዓ.ም.');
  await expect(dates.nth(3)).toHaveText('10 Sep 2026 / ጳጉሜ 5 2018');
});

test('section language: buttons in their own language, one version shown, remembered', async ({ page }) => {
  await ready(page);
  const section = page.locator('fidel-lang');
  const group = section.getByRole('group', { name: 'Language of “Lesson summary”' });
  const english = group.getByRole('button', { name: 'English' });
  const amharic = group.getByRole('button', { name: 'አማርኛ' });
  await expect(english).toHaveAttribute('aria-current', 'true');
  await expect(amharic).toHaveAttribute('lang', 'am');
  await expect(amharic).toHaveAttribute('translate', 'no');
  await expect(group.getByRole('button', { name: 'Afaan Oromoo' })).toBeVisible();
  await expect(section.locator('div[lang="am"]')).toBeHidden();

  await amharic.focus();
  await page.keyboard.press('Enter');
  await expect(amharic).toHaveAttribute('aria-current', 'true');
  await expect(english).not.toHaveAttribute('aria-current', /.*/);
  await expect(section.locator('div[lang="am"]')).toBeVisible();
  await expect(section.locator('div[lang="en"]:not(.fidel-lang-bar)')).toBeHidden();
  await expect.poll(() => politeText(page)).toBe('Showing Amharic');
  await expect(section.locator('div[lang="ar"]')).toHaveAttribute('dir', 'rtl');

  await page.reload();
  await expect(page.locator('fidel-lang div[lang="am"]')).toBeVisible();
  await expect(page.locator('fidel-lang').getByRole('button', { name: 'አማርኛ' })).toHaveAttribute('aria-current', 'true');
});

test('display settings: dialog, applied only to the target and Fidel components, Escape returns focus', async ({ page }) => {
  await ready(page);
  const opener = page.getByRole('button', { name: 'Display settings' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Display settings' });
  await expect(dialog).toBeVisible();
  expect(await seriousAxeIssues(page, 'fidel-display-prefs')).toEqual([]);

  await dialog.getByRole('radio', { name: '150 %' }).check();
  await dialog.getByRole('radio', { name: 'Wide' }).check();
  await dialog.getByRole('radio', { name: 'Yellow on black' }).check();
  await dialog.getByRole('checkbox', { name: 'Stop motion' }).check();
  await dialog.getByRole('checkbox', { name: 'Thicker focus outline' }).check();
  const lesson = page.locator('#demo-b-lesson');
  await expect(lesson).toHaveClass(/fidel-dp-size-150/);
  await expect(lesson).toHaveClass(/fidel-dp-contrast-yellow/);
  await expect(page.locator('fidel-lang')).toHaveClass(/fidel-dp-wide/);
  expect(await page.evaluate(() => document.body.className + document.documentElement.className)).not.toContain('fidel-dp');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#demo-b-lesson p')).color)).toBe('rgb(255, 255, 0)');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  await page.reload();
  await expect(page.locator('#demo-b-lesson')).toHaveClass(/fidel-dp-size-150/);
  await page.getByRole('button', { name: 'Display settings' }).click();
  await expect(page.getByRole('radio', { name: '150 %' })).toBeChecked();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('#demo-b-lesson')).not.toHaveClass(/fidel-dp-/);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Display settings' })).toBeFocused();
});

test('package B in Amharic (ui-lang="am"): axe clean with the dialog open', async ({ page }) => {
  await page.route('**/demo/components.html', async (route) => {
    const response = await route.fetch();
    const html = (await response.text())
      .replace(/<(fidel-(?:data-saver|offline-status|download-later|ethiopian-date|lang|display-prefs))\b/g, '<$1 ui-lang="am"');
    await route.fulfill({ response, body: html });
  });
  await ready(page);
  await expect(page.locator('fidel-data-saver')).toContainText('ይህ ቪዲዮ 2.2 MB ነው።');
  await expect(page.locator('fidel-offline-status')).toContainText('በመስመር ላይ ነዎት።');
  expect(await seriousAxeIssues(page)).toEqual([]);
  await page.getByRole('button', { name: 'የማሳያ ቅንብሮች' }).click();
  await expect(page.getByRole('dialog', { name: 'የማሳያ ቅንብሮች' })).toBeVisible();
  expect(await seriousAxeIssues(page, 'fidel-display-prefs')).toEqual([]);
});

test('keyboard: Tab reaches every package B control and never gets stuck', async ({ page }) => {
  await ready(page);
  await page.locator('#pkg-b').evaluate((el) => { el.tabIndex = -1; el.focus(); });
  const seen = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => {
      const el = document.activeElement;
      return el.closest('.demo-b') ? `${el.tagName.toLowerCase()}:${el.textContent.trim().slice(0, 40)}` : 'outside';
    }));
  }
  const expected = ['button:Load it (2.2 MB)', "button:Download when I'm online (Lesson 3 (demo",
    'button:English', 'button:አማርኛ', 'button:Afaan Oromoo', 'button:العربية', 'button:Display settings', 'a:A link inside the lesson'];
  for (const name of expected) expect(seen, seen.join(' > ')).toContain(name);
  const stuck = seen.some((s, i) => i >= 4 && seen.slice(i - 4, i + 1).every((x) => x === s));
  expect(stuck).toBe(false);
});
