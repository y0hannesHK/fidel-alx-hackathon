// The landing page at /demo/ (and / redirects there): accessible in English
// and Amharic at every zoom, every "Try it" link works, the skip link and
// the language switch work, and the language is remembered.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const ZOOMS = [
  { name: '100%', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  { name: '200%', viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 },
  { name: '400%', viewport: { width: 320, height: 200 }, deviceScaleFactor: 4 },
];
const NOT_YET_MERGED = []; // the Savanna rebuild is merged: every link is checked

const serious = (results) => results.violations.filter((v) => ['critical', 'serious'].includes(v.impact))
  .map((v) => `${v.impact} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

async function chooseLanguage(page, code) {
  await page.locator(`.lang-switch button[data-set-lang="${code}"]`).click();
  await expect(page.locator('html')).toHaveAttribute('lang', code);
}

test('/ redirects to the landing page', async ({ request, page }) => {
  const response = await request.get('/', { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe('/demo/');
  await page.goto('/');
  await expect(page).toHaveURL(/\/demo\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every lesson');
});

for (const zoom of ZOOMS) {
  for (const lang of ['en', 'am']) {
    test(`axe clean and no sideways scrolling at ${zoom.name} in ${lang === 'en' ? 'English' : 'Amharic'}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });
      const page = await context.newPage();
      await page.goto('/demo/');
      if (lang === 'am') await chooseLanguage(page, 'am');
      await page.waitForTimeout(300); // fonts
      expect(serious(await new AxeBuilder({ page }).withTags(TAGS).analyze())).toEqual([]);
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sideways, 'sideways scrolling').toBeLessThanOrEqual(1);
      expect(await page.locator('h1').count()).toBe(1);
      await context.close();
    });
  }
}

test('every "Try it" link answers 200', async ({ page, request }) => {
  await page.goto('/demo/');
  const hrefs = await page.locator('#try a').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThanOrEqual(9);
  for (const href of hrefs) {
    if (NOT_YET_MERGED.includes(href)) continue; // see NOT_YET_MERGED above
    if (href.startsWith('http')) {
      // External (GitHub): only check the address is the project's.
      expect(href).toBe('https://github.com/y0hannesHK/fidel-alx-hackathon');
      continue;
    }
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
  }
});

test('the skip link moves focus to the h1', async ({ page }) => {
  await page.goto('/demo/');
  await page.keyboard.press('Tab');
  const skip = page.locator('.skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('h1#title')).toBeFocused();
});

test('the language switch changes the page and is remembered after reload', async ({ page }) => {
  await page.goto('/demo/');
  const english = page.getByRole('button', { name: /^English/ });
  const amharic = page.getByRole('button', { name: /አማርኛ/ });
  await expect(english).toHaveAttribute('aria-pressed', 'true');
  await expect(amharic).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('img', { name: 'Fidel', exact: true })).toBeVisible();

  await amharic.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'am');
  await expect(amharic).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: 'ፊደል', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Fidel', exact: true })).toBeHidden();
  await expect(page.getByRole('heading', { level: 2, name: 'ፊደል ለማን ነው' })).toBeVisible();
  await expect(page).toHaveTitle(/ፊደል/);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'am');
  await expect(page.getByRole('button', { name: /አማርኛ/ })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: /^English/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 2, name: 'Who Fidel is for' })).toBeVisible();
});

test('nothing heavy loads: no player script, no video', async ({ page }) => {
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('/demo/');
  await page.waitForLoadState('networkidle');
  expect(urls.filter((u) => /fidel(-components)?\.js|\.(mp4|webm|opus)/.test(u))).toEqual([]);
});
