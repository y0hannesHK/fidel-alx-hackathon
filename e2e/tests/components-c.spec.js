// Package C components on demo/components.html:
//   <fidel-sign-term>, <fidel-visual-alert>, <fidel-step-nav>,
//   <fidel-session-keeper>, <fidel-lesson-map>, <fidel-help>.
// axe (0 critical / 0 serious) at 100/200/400% zoom, with every dialog open
// and in Amharic; no sideways scrolling at 320px; keyboard; one behaviour
// test per component. Only Package C's section is checked here (the whole
// page is checked by gate.spec.js).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGE = '/demo/components.html';
const SECTION = '#package-c';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const ZOOMS = [
  { name: '100%', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  { name: '200%', viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 },
  { name: '400%', viewport: { width: 320, height: 200 }, deviceScaleFactor: 4 },
];
const OUR_TAGS = ['fidel-sign-term', 'fidel-visual-alert', 'fidel-step-nav', 'fidel-session-keeper', 'fidel-lesson-map', 'fidel-help'];

async function seriousAxeIssues(page) {
  const results = await new AxeBuilder({ page }).include(SECTION).withTags(TAGS).analyze();
  return results.violations
    .filter((v) => ['critical', 'serious'].includes(v.impact))
    .map((v) => `${v.impact} ${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

// Our elements that stick out to the right of the screen (sideways scrolling).
async function stickingOut(page) {
  return page.evaluate((section) => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll(`${section} *`)]
      .filter((e) => e.getBoundingClientRect().right > width + 1)
      .filter((e) => !e.closest('fidel-player')) // the player is checked by gate.spec.js
      .slice(0, 5)
      .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} (${Math.round(e.getBoundingClientRect().right - width)} px)`);
  }, SECTION);
}

async function open(page) {
  await page.goto(PAGE);
  await expect(page.locator('fidel-help button').first()).toBeVisible();
}

/** Text the shared announcer (aria-live regions) currently says. */
async function announced(page) {
  return page.locator('.fidel-announcer').allTextContents().then((texts) => texts.join(' | '));
}

const section = (page) => page.locator(SECTION);

for (const zoom of ZOOMS) {
  test(`Package C at ${zoom.name}: axe clean with every dialog open, no sideways scrolling`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });
    const page = await context.newPage();
    await page.clock.install();
    await open(page);
    const s = section(page);
    expect(await seriousAxeIssues(page)).toEqual([]);
    expect(await stickingOut(page)).toEqual([]);

    // A banner and the alert settings.
    await s.getByRole('button', { name: 'Show a test alert' }).click();
    await s.locator('.fidel-visual-alert-settings summary').click();
    await s.locator('fidel-session-keeper summary').click();
    expect(await seriousAxeIssues(page)).toEqual([]);
    expect(await stickingOut(page)).toEqual([]);

    // Every dialog, one at a time.
    const dialogs = [
      () => s.getByRole('button', { name: /^log in/ }).click(),
      () => s.getByRole('button', { name: /^server/ }).click(),
      () => s.getByRole('button', { name: 'Get help' }).click(),
      () => s.getByRole('button', { name: 'እርዳታ ያግኙ' }).click(),
      async () => {
        await s.getByRole('button', { name: 'Start a 40-second test session' }).click();
        await page.clock.fastForward(11_000);
      },
    ];
    for (const openDialog of dialogs) {
      await openDialog();
      const dialog = page.locator(`${SECTION} dialog[open]`);
      await expect(dialog).toBeVisible();
      expect(await seriousAxeIssues(page)).toEqual([]);
      expect(await stickingOut(page)).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
    await context.close();
  });
}

test('Package C in Amharic (ui-lang="am"): axe clean, dialogs open', async ({ page }) => {
  // Serve the demo page with ui-lang="am" on every Package C tag.
  await page.route('**/demo/components.html', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(new RegExp(`<(${OUR_TAGS.join('|')})(?=[\\s>])(?![^>]*ui-lang)`, 'g'), '<$1 ui-lang="am"');
    await route.fulfill({ response, body });
  });
  await page.clock.install();
  await open(page);
  const s = section(page);
  await expect(s.locator('fidel-step-nav nav')).toHaveAttribute('aria-label', 'ትምህርት');
  await expect(s.locator('fidel-step-nav')).toContainText('ትምህርት 3 ከ8');
  expect(await seriousAxeIssues(page)).toEqual([]);
  await s.getByRole('button', { name: /^log in/ }).click();
  await expect(page.locator('dialog[open]')).toContainText('ትርጉም');
  expect(await seriousAxeIssues(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await s.getByRole('button', { name: 'እርዳታ ያግኙ' }).first().click();
  expect(await seriousAxeIssues(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await s.getByRole('button', { name: 'Start a 40-second test session' }).click();
  await page.clock.fastForward(11_000);
  await expect(page.getByRole('button', { name: 'አዎ፣ ተጨማሪ ጊዜ' })).toBeFocused();
  expect(await seriousAxeIssues(page)).toEqual([]);
});

test('keyboard: Tab reaches every Package C control and never gets stuck', async ({ page }) => {
  await open(page);
  await page.locator('#package-c-title').evaluate((el) => {
    el.tabIndex = -1;
    el.focus();
  });
  const seen = [];
  for (let i = 0; i < 120; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate((sel) => {
      const el = document.activeElement;
      return {
        inside: Boolean(el.closest(sel)),
        inPlayer: Boolean(el.closest('fidel-player')),
        name: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      };
    }, SECTION);
    if (!info.inside) break;
    if (!info.inPlayer) seen.push(info.name);
  }
  for (const name of ['log in', 'server', 'Alert settings', 'Previous', 'Next', 'Time limit', 'Video', 'Transcript', 'Notes', 'Code', 'Get help', 'እርዳታ ያግኙ']) {
    expect(seen.some((s) => s.includes(name)), `Tab reaches "${name}" (seen: ${seen.join(', ')})`).toBe(true);
  }
});

test('<fidel-sign-term>: the sign loads only when opened; Escape returns focus; no sign says so', async ({ page }) => {
  await open(page);
  const s = section(page);
  await page.waitForTimeout(500);
  // Nothing heavy before the learner asks: the sign-terms have no video with a
  // source yet. (Checked in the DOM, not the network: other packages' players
  // on the same page may load the same test clip for their own sign window.)
  const loadedEarly = await s.locator('fidel-sign-term').evaluateAll((terms) =>
    terms.flatMap((t) => [...t.querySelectorAll('video')]).filter((v) => v.getAttribute('src') || v.currentSrc).length);
  expect(loadedEarly, 'nothing heavy before the learner asks').toBe(0);

  const word = s.getByRole('button', { name: 'log in (sign and meaning)' });
  await word.click();
  const dialog = page.getByRole('dialog', { name: 'log in' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('video')).toHaveAttribute('src', '/media/sign.webm');
  expect(await dialog.locator('video').evaluate((v) => v.muted && v.loop)).toBe(true);
  await expect(dialog).toContainText('Placeholder clip');
  await expect(dialog.locator('p[lang="am"]')).toContainText('መለያዎን');
  await expect(dialog.getByRole('button', { name: /Pause|Play/ })).toBeVisible();
  const slower = dialog.getByRole('button', { name: 'Slower (0.5×)' });
  await slower.click();
  await expect(slower).toHaveAttribute('aria-pressed', 'true');
  expect(await dialog.locator('video').evaluate((v) => v.playbackRate)).toBe(0.5);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(word).toBeFocused();

  await s.getByRole('button', { name: /^server/ }).click();
  const none = page.getByRole('dialog', { name: 'server' });
  await expect(none).toContainText('No sign recorded yet for this word.');
  await expect(none.locator('video')).toHaveCount(0);
  await none.getByRole('button', { name: 'Close' }).click();
  await expect(s.getByRole('button', { name: /^server/ })).toBeFocused();
});

test('<fidel-visual-alert>: banner stays until closed, announced politely; timed when chosen', async ({ page }) => {
  await page.clock.install();
  await open(page);
  const s = section(page);
  await s.getByRole('button', { name: 'Show a test alert' }).click();
  const banner = s.locator('.fidel-visual-alert-banner');
  await expect(banner).toContainText('Your lesson finished downloading');
  await expect.poll(() => announced(page)).toContain('Your lesson finished downloading');
  await page.clock.fastForward(20_000);
  await expect(banner).toHaveCount(1); // default: stays until closed
  await banner.getByRole('button', { name: 'Close alert' }).click();
  await expect(banner).toHaveCount(0);

  // Any component can raise one with an event on document.
  await s.getByRole('button', { name: 'Send an alert from another component' }).click();
  await expect(banner).toContainText('A new message from your teacher');
  await banner.getByRole('button', { name: 'Close alert' }).click();

  // The learner chooses timed alerts: remembered, and the banner goes after 15 s.
  await s.getByText('Alert settings', { exact: true }).click();
  await s.getByRole('checkbox', { name: 'Keep alerts until I close them' }).uncheck();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fidel-components-c')).keepAlerts)).toBe(false);
  await s.getByRole('button', { name: 'Show a test alert' }).click();
  await expect(banner).toHaveCount(1);
  await page.clock.fastForward(16_000);
  await expect(banner).toHaveCount(0);
  await page.evaluate(() => localStorage.removeItem('fidel-components-c'));
});

test('<fidel-step-nav>: a Lesson landmark with two big links that say where they go', async ({ page }) => {
  await open(page);
  const nav = section(page).getByRole('navigation', { name: 'Lesson', exact: true });
  await expect(nav).toContainText('Lesson 3 of 8');
  const prev = nav.getByRole('link', { name: 'Previous Lesson 2: The player on a blank page' });
  const next = nav.getByRole('link', { name: 'Next Lesson 4: A lesson inside Savanna' });
  await expect(prev).toHaveAttribute('href', '/demo/blank.html');
  await expect(next).toHaveAttribute('href', '/demo/savanna-mock/');
  for (const link of [prev, next]) expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(48);
  expect(await nav.evaluate((el) => getComputedStyle(el.closest('fidel-step-nav')).position)).toBe('static');
});

test('<fidel-session-keeper>: warns before the time-out, Yes extends and tells the page', async ({ page }) => {
  await page.clock.install();
  await open(page);
  const s = section(page);
  const start = s.getByRole('button', { name: 'Start a 40-second test session' });
  await start.click();
  await page.clock.fastForward(5_000);
  await expect(page.locator('dialog[open]')).toHaveCount(0); // not yet
  await page.clock.fastForward(6_000);
  const dialog = page.getByRole('dialog', { name: 'Do you need more time?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Your session ends in 30 seconds or less.');
  const yes = dialog.getByRole('button', { name: 'Yes, more time' });
  await expect(yes).toBeFocused();
  await yes.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#c-session-log')).toHaveText(/fidel-session-extend/);
  await expect(start).toBeFocused();
  await expect.poll(() => announced(page)).toContain('Time extended. You have 40 seconds more.');

  // Extended: no warning 11 s later... only after another 10 s from the extension.
  await page.clock.fastForward(11_000);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'No' }).click();
  await expect(page.locator('#c-session-log')).toHaveText(/fidel-session-decline/);
  await page.clock.fastForward(31_000);
  await expect(s.locator('fidel-session-keeper')).toContainText('Your session has ended.');
  await expect(page.locator('#c-session-log')).toHaveText(/fidel-session-timeout/);

  // "Never time me out" tells the page.
  await s.getByText('Time limit', { exact: true }).click();
  await s.getByRole('checkbox', { name: 'Never time me out' }).check();
  await expect(page.locator('#c-session-log')).toHaveText(/fidel-session-no-timeout/);
  await page.evaluate(() => localStorage.removeItem('fidel-components-c'));
});

test('<fidel-lesson-map>: jump links to what exists, chapters play, progress on request', async ({ page }) => {
  await open(page);
  const map = section(page).getByRole('navigation', { name: 'This lesson' });
  await expect(map.getByRole('link', { name: 'Video' })).toHaveAttribute('href', '#c-lesson-player');
  await expect(map.getByRole('link', { name: 'Notes' })).toHaveAttribute('href', '#c-notes');
  await expect(map.getByRole('link', { name: 'Code' })).toHaveAttribute('href', '#c-code');
  await expect(map.getByRole('link', { name: 'Next lesson: Lesson 4: A lesson inside Savanna' })).toHaveAttribute('href', '/demo/savanna-mock/');
  await expect(map.getByRole('link', { name: 'Transcript' })).toBeVisible({ timeout: 20_000 }); // after the player builds
  const chapter = map.getByRole('button', { name: 'Play from 0:59 (59 seconds) Tech education as an equalizer' });
  await expect(chapter).toBeVisible();

  // Progress comes from the player's fidel-progress event; shown, not read out.
  await page.locator('#c-lesson-player').evaluate((player) => player.dispatchEvent(
    new CustomEvent('fidel-progress', { bubbles: true, detail: { seconds: 62, percent: 40 } })));
  await expect(map).toContainText('You have watched 40%');
  expect(await map.locator('progress').evaluate((p) => p.value)).toBe(40);
  expect(await announced(page)).not.toContain('40%');
  await map.getByRole('button', { name: 'Where am I?' }).click();
  await expect.poll(() => announced(page)).toContain('You have watched 40%. Chapter: Tech education as an equalizer.');

  // A chapter button seeks the player.
  await chapter.click();
  await expect.poll(() => page.locator('#c-lesson-player video').evaluate((v) => v.currentTime)).toBeGreaterThanOrEqual(58);
});

test('<fidel-help>: only the routes given, text first, voice last; Escape returns focus', async ({ page }) => {
  await open(page);
  const s = section(page);
  const button = s.getByRole('button', { name: 'Get help' });
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Get help' });
  await expect(dialog).toContainText('A person answers during working hours.');
  const links = dialog.getByRole('link');
  await expect(links).toHaveText(['Text chat', 'Email', 'Video call with a sign-language interpreter', 'Phone (voice call)']);
  await expect(dialog.getByRole('link', { name: 'Email' })).toHaveAttribute('href', 'mailto:help@example.org');
  await expect(dialog.getByRole('link', { name: 'Phone (voice call)' })).toHaveAttribute('href', 'tel:+251110000000');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();

  // The Amharic one lists only the two routes it was given.
  await s.getByRole('button', { name: 'እርዳታ ያግኙ' }).click();
  await expect(page.locator('dialog[open]').getByRole('link')).toHaveText(['የጽሑፍ ውይይት', 'ኢሜይል']);
});

test('<fidel-sign-term>: a clip that fails to load says so in words', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const el = document.createElement('fidel-sign-term');
    el.setAttribute('term', 'browser');
    el.setAttribute('sign', '/media/no-such-sign.webm');
    el.setAttribute('meaning-en', 'The program you use to open websites.');
    el.textContent = 'browser';
    document.querySelector('#package-c').append(el);
  });
  // Scoped to this section: Package A's <fidel-word> on the same page also has a 'browser' button.
  await page.locator('#package-c').getByRole('button', { name: /^browser/ }).click();
  const dialog = page.getByRole('dialog', { name: 'browser' });
  await expect(dialog).toContainText('No sign recorded yet for this word.');
  await expect(dialog.locator('figure')).toBeHidden();
});
