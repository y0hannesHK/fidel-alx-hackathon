// Automated checks for three WCAG criteria the conformance report listed as
// "manual check pending". They do not replace a person's check (see
// docs/manual-testing.md), but they catch the common failures:
//   1.4.12 Text Spacing: with the WCAG spacing applied, no text is cut off
//          and nothing scrolls sideways.
//   1.4.13 Content on Hover or Focus: the player's tooltips appear on focus,
//          can be dismissed with Escape, and stay while the pointer is on them.
//   2.4.11 Focus Not Obscured (Minimum): no focused control is hidden behind
//          a sticky or fixed bar (Studio's caption toolbar, the floating sign window).
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

function staffToken() {
  if (process.env.FIDEL_STAFF_TOKEN) return process.env.FIDEL_STAFF_TOKEN;
  if (!existsSync('../.env')) return '';
  const line = readFileSync('../.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('FIDEL_STAFF_TOKEN='));
  return line ? line.split('=', 2)[1].trim() : '';
}
const TOKEN = staffToken();
const STAFF = { Authorization: `Bearer ${TOKEN}` };

const PAGES = [
  ['landing page', '/demo/', 'main'],
  ['lesson demo', '/demo/savanna-mock/', 'fidel-player .fidel-panel'],
  ['Savanna rebuild lesson', '/demo/savanna-rebuild/lesson.html', 'fidel-player .fidel-panel'],
  ['components', '/demo/components.html', 'main'],
  ['form fields', '/demo/inputs.html', 'fidel-form form'],
];

// The WCAG 1.4.12 test values, applied to everything (as the W3C bookmarklet does).
const SPACING = `* {
  line-height: 1.5 !important; letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
}
p, li, dd, dt, label, legend, figcaption, blockquote { margin-bottom: 2em !important; }`;

/** Visible text that the spacing pushed out of a box that hides overflow. */
function clippedText() {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.offsetParent || !el.textContent.trim()) continue;
    const cs = getComputedStyle(el);
    const hides = (v) => v === 'hidden' || v === 'clip';
    // Visually hidden text (screen-reader-only spans) is meant to be 1px.
    if (el.offsetWidth <= 2 || el.offsetHeight <= 2 || cs.clipPath.includes('inset(50%)')) continue;
    const cutY = hides(cs.overflowY) && el.scrollHeight > el.clientHeight + 2;
    const cutX = hides(cs.overflowX) && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis';
    if (cutY || cutX) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 40)}"`);
  }
  return out.slice(0, 10);
}

test.describe('1.4.12 Text Spacing', () => {
  for (const [name, url, ready] of PAGES) {
    test(`${name}: no text cut off, no sideways scrolling, with WCAG text spacing`, async ({ page }) => {
      await page.goto(url);
      await expect(page.locator(ready).first()).toBeVisible({ timeout: 20_000 });
      await page.addStyleTag({ content: SPACING });
      await page.waitForTimeout(400);
      expect(await page.evaluate(clippedText), 'text cut off').toEqual([]);
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sideways, 'sideways scrolling').toBeLessThanOrEqual(1);
    });
  }
});

test.describe('1.4.13 Content on Hover or Focus', () => {
  test('player tooltips: shown on focus and hover, dismissed with Escape, stay while hovered', async ({ page }) => {
    await page.goto('/demo/savanna-mock/');
    await expect(page.locator('fidel-player .fidel-panel')).toBeVisible({ timeout: 20_000 });
    const button = page.locator('fidel-player .able-control-row').getByRole('button', { name: 'Captions' });
    const tooltip = page.locator('fidel-player .able-tooltip:visible');

    await button.focus();
    await expect(tooltip).toHaveCount(1);
    await page.keyboard.press('Escape'); // dismissible without moving focus
    await expect(tooltip).toHaveCount(0);
    await expect(button).toBeFocused();

    await button.hover();
    await expect(tooltip).toHaveCount(1);
    const box = await tooltip.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); // hoverable
    await page.waitForTimeout(300);
    await expect(tooltip).toHaveCount(1);
  });
});

/** Tab through the page; return focused controls that a sticky/fixed element covers. */
async function obscuredWhileTabbing(page, presses) {
  const hidden = [];
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press('Tab');
    const result = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      // Sample points across the focused element: is ANY part visible?
      const points = [[0.5, 0.5], [0.1, 0.5], [0.9, 0.5], [0.5, 0.1], [0.5, 0.9]];
      const visible = points.some(([fx, fy]) => {
        const x = r.left + r.width * fx;
        const y = r.top + r.height * fy;
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
        const top = document.elementFromPoint(x, y);
        return top && (el === top || el.contains(top) || top.contains(el));
      });
      return visible ? null : `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 40)}"`;
    });
    if (result) hidden.push(result);
  }
  return hidden;
}

test.describe('2.4.11 Focus Not Obscured (Minimum)', () => {
  test('lesson with the sign window floating over the video: focus is never fully hidden', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto('/demo/savanna-mock/');
    await expect(page.locator('fidel-player .fidel-panel')).toBeVisible({ timeout: 20_000 });
    const panel = page.locator('fidel-player .fidel-panel');
    await panel.getByRole('button', { name: 'Show sign language' }).click();
    await panel.getByRole('radio', { name: 'Over the video', exact: true }).check();
    await page.locator('body').focus();
    expect(await obscuredWhileTabbing(page, 60)).toEqual([]);
  });

  test('Studio caption editor with its sticky toolbar: focus is never fully hidden', async ({ page, request }) => {
    test.skip(!TOKEN, 'Set FIDEL_STAFF_TOKEN to run Studio checks.');
    test.skip(!existsSync('../data/demo/sign.webm'), 'Needs data/demo/sign.webm.');
    const upload = await request.post('/api/v1/lessons', {
      headers: STAFF,
      multipart: { title: 'Focus check lesson', spoken_language: 'en',
        video: { name: 'f.webm', mimeType: 'video/webm', buffer: readFileSync('../data/demo/sign.webm') } },
    });
    const lessonId = (await upload.json()).id;
    try {
      await expect.poll(async () => {
        const steps = await (await request.get(`/api/v1/lessons/${lessonId}/status`)).json();
        return Object.values(steps).every((s) => !['pending', 'running'].includes(s.status));
      }, { timeout: 120_000 }).toBe(true);
      const cues = Array.from({ length: 12 }, (_, i) => ({ start: i * 2, end: i * 2 + 2, text: `Caption number ${i + 1}.` }));
      await request.put(`/api/v1/lessons/${lessonId}/captions/en`, { headers: STAFF, data: { cues } });
      await request.put(`/api/v1/lessons/${lessonId}/captions/am`, { headers: STAFF, data: { cues: cues.map((c) => ({ ...c, text: 'የሙከራ ጽሑፍ።' })) } });

      await page.setViewportSize({ width: 1280, height: 700 });
      await page.goto('/studio/');
      await page.getByLabel('Staff token').fill(TOKEN);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Lessons' })).toBeVisible();
      await page.evaluate((id) => { location.hash = `#/lesson/${id}`; }, lessonId);
      await expect(page.getByRole('heading', { name: 'Captions' })).toBeVisible({ timeout: 20_000 });
      await page.getByRole('heading', { name: 'Captions' }).scrollIntoViewIfNeeded();
      await page.getByRole('heading', { name: 'Captions' }).evaluate((h) => { h.tabIndex = -1; h.focus(); });
      // Forward through the editor, then back again (Shift+Tab scrolls upwards, under the toolbar).
      expect(await obscuredWhileTabbing(page, 50)).toEqual([]);
      const back = [];
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Shift+Tab');
        const covered = await page.evaluate(() => {
          const el = document.activeElement;
          const r = el.getBoundingClientRect();
          if (!r.width) return null;
          // How much of the focused control is under the toolbar?
          const bar = document.querySelector('.toolbar')?.getBoundingClientRect();
          if (!bar) return null;
          const covered = Math.max(0, Math.min(r.bottom, bar.bottom) - Math.max(r.top, bar.top));
          return covered > 0 ? `${el.tagName} ${Math.round((100 * covered) / r.height)}% covered` : null;
        });
        if (covered) back.push(covered);
      }
      // Stricter than AA (which only fails if a control is entirely hidden): not even partly covered.
      expect(back, 'controls hidden under the sticky toolbar').toEqual([]);
    } finally {
      await request.delete(`/api/v1/lessons/${lessonId}`, { headers: STAFF });
    }
  });
});
