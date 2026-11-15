// Package A components on demo/components.html (assets/AGENT_TASK_fidel_components.md):
// axe at 100/200/400% zoom (with each dialog open, and with ui-lang="am"),
// no sideways scrolling at 320 px, controls by role and name, keyboard,
// and one behaviour test per component.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGE = '/demo/components.html';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const ZOOMS = [
  { name: '100%', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  { name: '200%', viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 },
  { name: '400%', viewport: { width: 320, height: 200 }, deviceScaleFactor: 4 },
];

async function seriousAxeIssues(page) {
  const results = await new AxeBuilder({ page }).include('#package-a').withTags(TAGS).analyze();
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

async function open(page) {
  await page.goto(PAGE);
  await expect(page.locator('fidel-code-block .fidel-code-block').first()).toBeVisible();
}

const section = (page) => page.locator('#package-a');
const codeBlock = (page) => page.locator('fidel-code-block').first();

for (const zoom of ZOOMS) {
  test(`Package A at ${zoom.name}: axe clean, no sideways scrolling`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });
    const page = await context.newPage();
    await open(page);
    await page.waitForTimeout(500);
    expect(await seriousAxeIssues(page)).toEqual([]);
    // Open everything that opens, then check again.
    await codeBlock(page).getByRole('button', { name: 'Read line by line' }).click();
    await page.locator('#package-a details').evaluateAll((all) => all.forEach((d) => { d.open = true; }));
    expect(await seriousAxeIssues(page)).toEqual([]);
    let { pixels, outermost } = await sidewaysScroll(page);
    expect(pixels, `sideways scrolling; sticking out: ${outermost.join(', ')}`).toBeLessThanOrEqual(1);
    // Every dialog open once (English and Amharic interface).
    for (const term of ['server', 'accessible']) {
      await page.locator('fidel-word').getByRole('button', { name: term }).click();
      await expect(page.getByRole('dialog', { name: term })).toBeVisible();
      expect(await seriousAxeIssues(page)).toEqual([]);
      ({ pixels, outermost } = await sidewaysScroll(page));
      expect(pixels, `sideways scrolling with the ${term} dialog: ${outermost.join(', ')}`).toBeLessThanOrEqual(1);
      await page.keyboard.press('Escape');
    }
    await context.close();
  });
}

test('code block: copy, line by line, symbols, play from', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  const block = codeBlock(page);
  await expect(block.locator('pre code')).toContainText('print(i)');

  await block.getByRole('button', { name: 'Copy' }).click();
  await expect(block.locator('.fidel-code-block-status')).toHaveText('Copied');
  await expect(page.locator('.fidel-announcer[aria-live="polite"]')).toHaveText('Copied');
  // (Windows turns copied \n into \r\n.)
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.replace(/\r\n/g, '\n')).toBe('for i in range(3):\n    print(i)');

  const lines = block.getByRole('button', { name: 'Read line by line' });
  await lines.click();
  await expect(lines).toHaveAttribute('aria-expanded', 'true');
  const first = block.locator('.fidel-code-block-line').first();
  await expect(first).toBeFocused();
  await expect(first).toHaveText('Line 1 of 2: for i in range open bracket 3 close bracket colon');
  await page.keyboard.press('ArrowDown');
  const second = block.locator('.fidel-code-block-line').nth(1);
  await expect(second).toBeFocused();
  await expect(second).toHaveText('Line 2 of 2, indent 4 spaces: print open bracket i close bracket');

  const symbols = block.getByRole('button', { name: 'Symbols as words' });
  await expect(symbols).toHaveAttribute('aria-pressed', 'true');
  await symbols.click();
  await expect(symbols).toHaveAttribute('aria-pressed', 'false');
  await expect(second).toHaveText('Line 2 of 2, indent 4 spaces: print(i)');

  // Line numbers are shown but hidden from screen readers.
  await expect(block.locator('.fidel-code-block-num').first()).toHaveAttribute('aria-hidden', 'true');

  await expect(block.getByText('From the video at 1:23')).toBeVisible();
  await expect(page.locator('#a-lesson-player .fidel-panel')).toBeAttached({ timeout: 20_000 });
  await block.getByRole('button', { name: 'Play from 1:23' }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector('#a-lesson-player video').currentTime)).toBeGreaterThanOrEqual(83);
});

test('code snapshots: time order, Now follows the video, announced once, quiet after a seek', async ({ page }) => {
  await open(page);
  const snapshots = page.locator('fidel-code-snapshots');
  const items = snapshots.locator('.fidel-code-snapshots-item');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText('Step 1');
  await expect(page.locator('#a-lesson-player .fidel-panel')).toBeAttached({ timeout: 20_000 });

  // Play from here: jumps, marks "Now", no announcement (the learner chose it).
  await items.nth(2).getByRole('button', { name: 'Play from 2:10' }).click();
  await expect(items.nth(2)).toHaveAttribute('aria-current', 'time');
  await expect(items.nth(2).getByText('Now', { exact: true })).toBeVisible();
  await expect(items.nth(0).getByText('Now', { exact: true })).toBeHidden();

  // Playing across 0:59 announces "Code for 0:59 is ready".
  await page.evaluate(() => {
    const video = document.querySelector('#a-lesson-player video');
    video.muted = true;
    video.currentTime = 57.5;
    return video.play();
  });
  const polite = page.locator('.fidel-announcer[aria-live="polite"]');
  await expect(polite).toHaveText('Code for 0:59 is ready', { timeout: 10_000 });
  await expect(items.nth(1)).toHaveAttribute('aria-current', 'time');
  await page.evaluate(() => document.querySelector('#a-lesson-player video').pause());
});

test('described image: figure, alt, caption, lazy, full description in details', async ({ page }) => {
  await open(page);
  const figure = page.locator('fidel-described-image').first().getByRole('figure');
  await expect(figure).toBeVisible();
  const img = figure.getByRole('img', { name: /how a web request travels/i });
  await expect(img).toHaveAttribute('loading', 'lazy');
  await expect(figure.locator('figcaption')).toHaveText('How a web request travels');
  const description = figure.getByText('The browser sends a request to the server');
  await expect(description).toBeHidden();
  await figure.getByText('Full description').click();
  await expect(description).toBeVisible();
  await expect(figure.locator('[id]')).toHaveCount(0); // no copied ids
  // Missing alt: alt="" (not the file name) and a visible warning on the demo.
  const bad = page.locator('fidel-described-image').nth(1);
  await expect(bad.locator('img')).toHaveAttribute('alt', '');
  await expect(bad.getByText(/no alt text/)).toBeVisible();
});

test('word: button opens a dialog with both meanings; Escape returns focus', async ({ page }) => {
  await open(page);
  const word = page.locator('fidel-word').getByRole('button', { name: 'server' });
  await word.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'server' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'server' })).toBeVisible();
  await expect(dialog.getByText('A computer that stores websites')).toBeVisible();
  await expect(dialog.locator('[lang="am"]')).toContainText('ኮምፒውተር');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(word).toBeFocused();

  // Close button, and the Amharic interface.
  const am = page.locator('fidel-word[ui-lang="am"]').getByRole('button');
  await am.click();
  const amDialog = page.getByRole('dialog', { name: 'accessible' });
  await expect(amDialog.getByText('በአማርኛ', { exact: true })).toBeVisible();
  await amDialog.getByRole('button', { name: 'ዝጋ' }).click();
  await expect(am).toBeFocused();
});

test('word: reads the glossary format when there are no attributes', async ({ page }) => {
  await page.route('**/test-glossary.json', (route) => route.fulfill({
    json: { terms: [{ en: 'Caption', am: 'የግርጌ ጽሑፍ', note: 'Words of the video shown as text.' }] },
  }));
  await open(page);
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.innerHTML = '<fidel-word term="caption" glossary="/test-glossary.json">caption</fidel-word>';
    document.getElementById('a-word').after(p);
  });
  await page.getByRole('button', { name: 'caption', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'caption' });
  await expect(dialog.getByText('Words of the video shown as text.')).toBeVisible();
  await expect(dialog.getByText('የግርጌ ጽሑፍ')).toBeVisible();
});

test('Package A keyboard: Tab reaches every control and never gets stuck', async ({ page }) => {
  await open(page);
  await page.locator('#package-a-title').evaluate((el) => { el.tabIndex = -1; el.focus(); });
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const el = document.activeElement;
      const a = document.getElementById('package-a');
      return a.contains(el) ? `${el.tagName}:${el.textContent.slice(0, 40)}:${el.className}` : null;
    });
    if (!inside) break;
    seen.add(inside);
  }
  const expected = await section(page).locator('fidel-code-block button').count();
  expect(seen.size).toBeGreaterThanOrEqual(expected);
});
