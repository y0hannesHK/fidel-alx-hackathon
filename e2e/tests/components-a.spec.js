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

// A stand-in for the browser's voices: an English voice only, each sentence takes 1.5 s.
async function fakeSpeech(page) {
  await page.addInitScript(() => {
    const timers = [];
    window.__spoken = [];
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [{ lang: 'en-US', name: 'Test voice' }],
        addEventListener() {}, removeEventListener() {},
        speak(u) {
          window.__spoken.push(u.text);
          timers.push(setTimeout(() => u.onstart?.(), 10));
          timers.push(setTimeout(() => u.onend?.(), 1500));
        },
        cancel() { timers.splice(0).forEach(clearTimeout); },
      },
    });
  });
}

test('read aloud: Listen reads sentence by sentence with a highlight; Escape stops', async ({ page }) => {
  await fakeSpeech(page);
  await open(page);
  const [en, am] = [page.locator('fidel-read-aloud').nth(0), page.locator('fidel-read-aloud').nth(1)];
  await expect(en.getByText('Computer voice')).toBeVisible();
  // No Amharic voice: no button, and it says so in words.
  await expect(am.getByRole('button')).toHaveCount(0);
  await expect(am.getByText('Listening is not available')).toBeVisible();

  const highlighted = () => page.evaluate(() => {
    const h = CSS.highlights.get('fidel-read-aloud');
    return h ? [...h][0].toString() : null;
  });
  // Nothing speaks by itself (Able Player's silent " " warm-up does not count).
  expect(await page.evaluate(() => window.__spoken.filter((t) => t.trim()).length)).toBe(0);
  await en.getByRole('button', { name: 'Listen' }).click();
  await expect(en.getByRole('button', { name: 'Stop' })).toBeFocused();
  await expect.poll(highlighted).toBe('A web page is a document.');
  await expect.poll(highlighted).toBe('Your browser asks a server for it.');
  await page.keyboard.press('Escape');
  await expect(en.getByRole('button', { name: 'Listen' })).toBeVisible();
  expect(await highlighted()).toBeNull();
});

test('read aloud: a recording is used when there is no voice, loaded only on Listen', async ({ page }) => {
  await fakeSpeech(page);
  const requests = [];
  page.on('request', (r) => { if (r.url().includes('test-reading.mp3')) requests.push(r.url()); });
  await open(page);
  await page.evaluate(() => {
    const el = document.createElement('fidel-read-aloud');
    el.setAttribute('lang', 'om');
    el.setAttribute('audio', '/demo/media/test-reading.mp3');
    el.innerHTML = '<p lang="om">Akkam jirta?</p>';
    document.getElementById('a-read-aloud').after(el);
  });
  const el = page.locator('fidel-read-aloud[lang="om"]');
  await expect(el.getByText('Recorded voice')).toBeVisible();
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
  await el.getByRole('button', { name: 'Listen' }).click();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
});

test('steps: Next moves focus to the step heading; progress is remembered; show all', async ({ page }) => {
  await open(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const steps = page.locator('fidel-steps').first();
  await expect(steps.getByRole('heading', { name: 'Step 1 of 5' })).toBeVisible();
  await expect(steps.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await steps.getByRole('button', { name: 'Next' }).click();
  const heading = steps.getByRole('heading', { name: 'Step 2 of 5' });
  await expect(heading).toBeFocused();
  await expect(steps.locator('.fidel-steps-body')).toContainText('Download button');
  await steps.getByRole('checkbox', { name: 'I did this step' }).check();
  await expect(steps.getByText('1 of 5 steps done')).toBeVisible();

  await page.reload();
  await expect(steps.getByRole('heading', { name: 'Step 2 of 5' })).toBeVisible();
  await expect(steps.getByRole('checkbox', { name: 'I did this step' })).toBeChecked();

  const all = steps.getByRole('button', { name: 'Show all steps' });
  await all.click();
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(steps.locator('ol li')).toHaveCount(5);
  await expect(steps.locator('ol li').nth(1)).toContainText('(Done)');
  await expect(steps.locator('ol')).toBeVisible();
  await expect(steps.locator('.fidel-steps-one')).toBeHidden();

  // Amharic interface.
  const am = page.locator('fidel-steps[ui-lang="am"]');
  await expect(am.getByRole('heading', { name: 'ደረጃ 1 ከ3' })).toBeVisible();
  await expect(am.getByRole('button', { name: 'ቀጣይ' })).toBeVisible();
});

test('Package A keyboard: Tab reaches every control and never gets stuck', async ({ page }) => {
  await open(page);
  await expect(page.locator('#a-lesson-player .fidel-panel')).toBeAttached({ timeout: 20_000 });
  await page.locator('#package-a-title').evaluate((el) => { el.tabIndex = -1; el.focus(); });
  let left = false;
  for (let i = 0; i < 400; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const el = document.activeElement;
      if (!document.getElementById('package-a').contains(el)) return false;
      el.dataset.tabbed = '1';
      return true;
    });
    if (!inside) { left = true; break; }
  }
  expect(left, 'Tab must leave Package A (never stuck)').toBe(true);
  // Every control of our components (not the player's own) was reached.
  const missed = await page.evaluate(() => [...document.querySelectorAll(
    '#package-a :is(fidel-code-block, fidel-described-image, fidel-word, fidel-read-aloud, fidel-steps, fidel-simple-mode) :is(button:not([disabled]), summary, input, [tabindex="0"])',
  )].filter((el) => el.checkVisibility() && !el.dataset.tabbed).map((el) => el.outerHTML.slice(0, 80)));
  expect(missed).toEqual([]);
});

test('simple mode: switch shows the simple version, announces, is remembered', async ({ page }) => {
  await open(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const simple = page.locator('fidel-simple-mode');
  const button = simple.getByRole('button', { name: 'Simple words' });
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(simple.getByText('Your browser sends a message')).toBeHidden();
  await expect(simple.getByText('transmits an HTTP request')).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(simple.getByText('Your browser sends a message')).toBeVisible();
  await expect(simple.getByText('transmits an HTTP request')).toBeHidden();
  await expect(page.locator('.fidel-announcer[aria-live="polite"]')).toHaveText('Simple version shown');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fidel-prefs')).simpleWords)).toBe(true);
  await page.reload();
  await expect(simple.getByRole('button', { name: 'Simple words' })).toHaveAttribute('aria-pressed', 'true');
  await expect(simple.getByText('Your browser sends a message')).toBeVisible();
});

test('Package A with an Amharic interface (page lang="am"): axe clean, dialog included', async ({ page }) => {
  await page.route('**/demo/components.html', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace('<html lang="en">', '<html lang="am">');
    await route.fulfill({ response, body });
  });
  await open(page);
  await expect(codeBlock(page).getByRole('button', { name: 'ቅዳ' })).toBeVisible();
  await codeBlock(page).getByRole('button', { name: 'መስመር በመስመር አንብብ' }).click();
  await expect(codeBlock(page).locator('.fidel-code-block-line').nth(1)).toHaveText('መስመር 2 ከ2, 4 ክፍተት ገብ: print የመክፈቻ ቅንፍ i የመዝጊያ ቅንፍ');
  await page.locator('#package-a details').evaluateAll((all) => all.forEach((d) => { d.open = true; }));
  expect(await seriousAxeIssues(page)).toEqual([]);
  await page.locator('fidel-word').getByRole('button', { name: 'server' }).click();
  await expect(page.getByRole('dialog', { name: 'server' }).getByRole('button', { name: 'ዝጋ' })).toBeVisible();
  expect(await seriousAxeIssues(page)).toEqual([]);
});
