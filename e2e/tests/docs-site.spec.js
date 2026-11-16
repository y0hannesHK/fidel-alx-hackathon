// The component docs at /demo/docs/ (built by scripts/build-docs.mjs from
// demo/docs/components.mjs):
//   - every registered tag (player/src/index.js and every register.js) has an
//     entry in the data file and a page that answers 200, and is defined on a
//     page that loads fidel.js
//   - axe: 0 critical/serious on the start page (also in Amharic) and on a
//     sample of component pages, at 100 / 200 / 400 % zoom
//   - no sideways scrolling at 320 px on every page
//   - the filter box, the Copy button, the skip link, the language switch,
//     and Tab never getting stuck
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, readdirSync } from 'node:fs';
import { COMPONENTS } from '../../demo/docs/components.mjs';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const ZOOMS = [
  { name: '100%', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  { name: '200%', viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 },
  { name: '400%', viewport: { width: 320, height: 200 }, deviceScaleFactor: 4 },
];
// A player, a form field, code, a sortable table, a dialog and a quiz.
const SAMPLE = ['fidel-player', 'fidel-input', 'fidel-code-block', 'fidel-table', 'fidel-help', 'fidel-quiz'];

/** Tags defined in the source: the 4 core tags and every register.js. */
function registeredTags() {
  const SRC = '../player/src';
  const files = [`${SRC}/index.js`, ...readdirSync(`${SRC}/components`).map((d) => `${SRC}/components/${d}/register.js`)];
  const tags = new Set();
  for (const file of files) {
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; } // a folder without register.js
    const code = text.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    for (const m of code.matchAll(/['"](fidel-[a-z-]+)['"]\s*[:,)]/g)) tags.add(m[1]);
  }
  return [...tags].sort();
}

const serious = (results) => results.violations.filter((v) => ['critical', 'serious'].includes(v.impact))
  .map((v) => `${v.impact} ${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

async function sideways(page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const over = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > width + 1);
    const outermost = over.filter((e) => !over.includes(e.parentElement)).slice(0, 5)
      .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`);
    return { pixels: document.documentElement.scrollWidth - width, outermost };
  });
}

test('every registered tag has a docs entry and a page that answers 200', async ({ request }) => {
  const registered = registeredTags();
  expect(registered.length).toBeGreaterThanOrEqual(47);
  const documented = COMPONENTS.map((c) => c.tag).sort();
  expect(documented).toEqual(registered);
  for (const tag of registered) {
    const response = await request.get(`/demo/docs/${tag}.html`);
    expect(response.status(), tag).toBe(200);
    expect(await response.text(), tag).toContain(`<h1 id="title" tabindex="-1"><code>&lt;${tag}&gt;</code></h1>`);
  }
  const index = await request.get('/demo/docs/');
  expect(index.status()).toBe(200);
  const html = await index.text();
  for (const tag of registered) expect(html, tag).toContain(`href="${tag}.html"`);
});

test('every documented tag is defined once fidel.js has loaded the components', async ({ page }) => {
  await page.goto('/demo/docs/fidel-quiz.html');
  await page.waitForFunction(() => customElements.get('fidel-quiz') && customElements.get('fidel-player'));
  const missing = await page.evaluate((tags) => tags.filter((t) => !customElements.get(t)), COMPONENTS.map((c) => c.tag));
  expect(missing).toEqual([]);
});

for (const zoom of ZOOMS) {
  test(`start page: axe clean at ${zoom.name}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });
    const page = await context.newPage();
    await page.goto('/demo/docs/');
    await expect(page.locator('#filter')).toBeVisible();
    expect(serious(await new AxeBuilder({ page }).withTags(TAGS).analyze())).toEqual([]);
    expect(await page.getByRole('heading', { level: 1 }).count()).toBe(1);
    expect((await sideways(page)).pixels).toBeLessThanOrEqual(1);
    await context.close();
  });

  for (const tag of SAMPLE) {
    test(`${tag} page: axe clean at ${zoom.name}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });
      const page = await context.newPage();
      await page.goto(`/demo/docs/${tag}.html`);
      await page.waitForFunction((t) => customElements.get(t), tag);
      await page.waitForTimeout(tag === 'fidel-player' ? 1500 : 500); // the component builds itself
      expect(serious(await new AxeBuilder({ page }).withTags(TAGS).analyze())).toEqual([]);
      expect(await page.getByRole('heading', { level: 1 }).count()).toBe(1);
      await context.close();
    });
  }
}

test('start page in Amharic: axe clean, and the language is remembered', async ({ page }) => {
  await page.goto('/demo/docs/');
  const amharic = page.getByRole('button', { name: /አማርኛ/ });
  await amharic.click();
  await expect(page.locator('html')).toHaveAttribute('data-ui-lang', 'am');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en'); // the reference content stays English
  await expect(amharic).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'የፊደል ክፍሎች ሰነድ' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'ለመጀመር' })).toBeVisible();
  await expect(page).toHaveTitle(/ፊደል/);
  expect(serious(await new AxeBuilder({ page }).withTags(TAGS).analyze())).toEqual([]);
  await page.goto('/demo/docs/fidel-quiz.html');
  await expect(page.getByRole('heading', { level: 2, name: 'የቀጥታ ምሳሌ' })).toBeVisible();
  await page.getByRole('button', { name: /^English/ }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'Live example' })).toBeVisible();
});

test.describe('no sideways scrolling at 320 px', () => {
  for (const name of ['', ...COMPONENTS.map((c) => `${c.tag}.html`)]) {
    test(name || 'start page', async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 320, height: 640 } });
      const page = await context.newPage();
      await page.goto(`/demo/docs/${name}`);
      if (name) await page.waitForFunction((t) => customElements.get(t), name.slice(0, -5));
      await page.waitForTimeout(500);
      const { pixels, outermost } = await sideways(page);
      expect(pixels, `sticking out: ${outermost.join(', ')}`).toBeLessThanOrEqual(1);
      await context.close();
    });
  }
});

test('the filter narrows the list and announces the count', async ({ page }) => {
  await page.goto('/demo/docs/');
  const links = page.locator('.component-list a');
  await expect(links.filter({ visible: true })).toHaveCount(COMPONENTS.length);
  const filter = page.getByRole('searchbox', { name: 'Filter components' });
  await filter.fill('quiz');
  const status = page.getByRole('status').filter({ hasText: 'components shown' });
  await expect(status).toHaveText(new RegExp(`^\\d+ of ${COMPONENTS.length} components shown\\.$`));
  const shown = await links.filter({ visible: true }).count();
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThan(COMPONENTS.length);
  await expect(page.locator('.component-list').getByRole('link', { name: /fidel-quiz/ })).toBeVisible();
  await expect(page.locator('.component-list').getByRole('link', { name: /fidel-player/ })).toBeHidden();
  await expect(status).toHaveText(`${shown} of ${COMPONENTS.length} components shown.`);
  await filter.fill('zzzz no such thing');
  await expect(page.locator('#no-match')).toHaveText('No component matches. Try another word.');
  await filter.fill('');
  await expect(links.filter({ visible: true })).toHaveCount(COMPONENTS.length);
});

test('the Copy button copies the code, or selects it', async ({ browser }) => {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  await page.goto('/demo/docs/fidel-quiz.html');
  await page.getByRole('button', { name: 'Copy the example code' }).click();
  await expect(page.locator('.copy-status').first()).toHaveText('Copied.');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('<fidel-quiz label="Check what you learned">');
  await context.close();

  // No clipboard (an old browser, or not https): the code is selected instead.
  const plain = await browser.newPage();
  await plain.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined }));
  await plain.goto('/demo/docs/fidel-quiz.html');
  await plain.getByRole('button', { name: 'Copy the example code' }).click();
  await expect(plain.locator('.copy-status').first()).toHaveText('Code selected. Press Ctrl+C to copy.');
  expect(await plain.evaluate(() => getSelection().toString())).toContain('<fidel-quiz');
  await plain.close();
});

for (const url of ['/demo/docs/', '/demo/docs/fidel-input.html']) {
  test(`the skip link moves focus to the h1 (${url})`, async ({ page }) => {
    await page.goto(url);
    await page.keyboard.press('Tab');
    const skip = page.locator('.skip-link');
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('h1#title')).toBeFocused();
  });
}

test('start page: Tab moves through the page and never gets stuck', async ({ page }) => {
  await page.goto('/demo/docs/');
  await expect(page.locator('#filter')).toBeVisible();
  const seen = [];
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return 'body';
      return `${el.tagName.toLowerCase()}:${(el.getAttribute('href') || el.getAttribute('aria-label') || el.id || el.textContent.trim()).slice(0, 40)}`;
    }));
  }
  const stuck = seen.some((s, i) => i >= 4 && seen.slice(i - 4, i + 1).every((x) => x === s && x !== 'body'));
  expect(stuck, `focus order: ${seen.slice(0, 30).join(' > ')}`).toBe(false);
  expect(new Set(seen).size).toBeGreaterThan(60);
  expect(seen).toContain('input:filter');
  expect(seen).toContain('a:fidel-quiz.html');
});
