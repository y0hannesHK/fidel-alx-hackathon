// Tests for the mock Savanna lesson page with <fidel-player> embedded.
// Each test gets a fresh browser profile, so saved preferences start empty.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGE = '/demo/savanna-mock/?source=lesson';

// Open the lesson and wait until Fidel's panel is built (Able Player ready).
async function openLesson(page) {
  await page.goto(PAGE);
  await expect(page.locator('fidel-player .fidel-panel')).toBeVisible({ timeout: 15_000 });
}

test('default mock page plays its local CC0 sample without mismatched captions', async ({ page }) => {
  await page.goto('/demo/savanna-mock/');
  await expect(page.locator('fidel-player .fidel-panel')).toBeVisible({ timeout: 15_000 });
  const video = page.locator('fidel-player .able-media-container video');
  await expect.poll(() => video.evaluate((v) => v.readyState >= 2 && v.duration > 0)).toBe(true);
  expect(await video.evaluate((v) => v.currentSrc)).toContain('/demo/media/flower.');
  await expect(page.locator('#media-note')).toContainText('not the Digital Bridge talk');
  await expect(page.locator('fidel-player .able-media-container track[kind="captions"]')).toHaveCount(0);

  const muteButton = page.locator('.fidel-panel').getByRole('button', { name: 'Mute audio' });
  await muteButton.click();
  await expect.poll(() => video.evaluate((v) => v.muted)).toBe(true);
  const unmuteButton = page.locator('.fidel-panel').getByRole('button', { name: 'Unmute audio' });
  await unmuteButton.click();
  await expect.poll(() => video.evaluate((v) => v.muted)).toBe(false);

  await press(playButton(page));
  await expect.poll(() => video.evaluate((v) => v.currentTime), { timeout: 5_000 }).toBeGreaterThan(0.25);
  await expect(page.locator('.fidel-panel')).toContainText('This lesson does not have a sign language video yet.');
});

test('shows an accessible error when every video source fails', async ({ page }) => {
  await page.route('**/demo/media/flower.*', (route) => route.abort());
  await page.goto('/demo/savanna-mock/');
  await expect(page.locator('fidel-player .fidel-video-error')).toBeVisible();
  await expect(page.locator('fidel-player .fidel-video-error')).toContainText('could not be loaded');
});

test('lesson route shows the configured Kozha sign panel by default', async ({ page }) => {
  await page.goto(PAGE);
  const sign = page.getByRole('region', { name: 'Experimental British Sign Language avatar' });
  await expect(sign).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Show sign language' })).toHaveAttribute('aria-pressed', 'true');
});

test('interface language selects only the matching caption track', async ({ page }) => {
  await openLesson(page);
  const panel = page.locator('.fidel-panel');
  const captionBox = page.locator('fidel-player .able-captions-wrapper');

  await panel.locator('[data-fidel-ui-lang="am"]').click();
  await expect(panel.getByRole('radio', { name: 'አማርኛ' })).toBeChecked();
  await expect(captionBox).toHaveAttribute('lang', 'am');
  await expect(page.locator('.fidel-transcript select')).toHaveValue('am');
  await expect(page.locator('.fidel-draft-notice p')).toHaveCount(1);
  await expect(page.locator('.fidel-draft-notice p')).toHaveAttribute('lang', 'am');
  await expect(page.locator('.fidel-sign-status')).toContainText('የአማርኛ የምልክት');

  await panel.locator('[data-fidel-ui-lang="en"]').click();
  await expect(panel.getByRole('radio', { name: 'English' })).toBeChecked();
  await expect(captionBox).toHaveAttribute('lang', 'en');
  await expect(page.locator('.fidel-transcript select')).toHaveValue('en');
  await expect(page.locator('.fidel-draft-notice')).toHaveCount(0);
});

test('Kozha replaces English caption animations without scheduler errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
  await page.goto(PAGE);

  const avatar = page.frameLocator('iframe.fidel-kozha-sign-frame');
  await expect(avatar.locator('#status')).toContainText('ready', { timeout: 45_000 });
  const video = page.locator('fidel-player video').first();
  await press(playButton(page));
  await expect.poll(() => video.evaluate((media) => media.currentTime), { timeout: 5_000 })
    .toBeGreaterThan(0.5);
  await page.waitForTimeout(7_000);

  expect(pageErrors.filter((error) => /allcsa\.js|AnimScheduler|reading 'reset'/i.test(error)))
    .toEqual([]);
  await expect(avatar.locator('#status')).not.toContainText('animation error');
});

// The Play button in the control bar. (Able Player also shows a big Play
// button over the video; both are named "Play".)
const playButton = (page, name = 'Play') =>
  page.locator('fidel-player .able-control-row').getByRole('button', { name });

// Use a control the way a keyboard user does: focus it, press a key.
async function press(locator, key = 'Enter') {
  await locator.focus();
  await locator.press(key);
}

async function expectNoSeriousAxeIssues(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  for (const v of results.violations) {
    console.log(`[axe ${label}] ${v.impact} ${v.id}: ${v.help} (${v.nodes.length})`);
  }
  // The hackathon gate: zero critical or serious issues.
  const blocking = results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(blocking, label).toEqual([]);
}

async function expectNoHorizontalScroll(page) {
  const [scrollWidth, clientWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test('axe: no critical or serious issues, before and after using every feature', async ({ page }) => {
  await openLesson(page);
  await expectNoSeriousAxeIssues(page, 'initial');

  const panel = page.locator('.fidel-panel');
  await panel.getByRole('radio', { name: 'አማርኛ' }).check();
  await panel.getByRole('button', { name: 'Show sign language' }).click();
  await panel.getByRole('button', { name: 'Show sign language' }).click();
  await page.getByRole('searchbox', { name: 'Search the transcript' }).fill('ALX');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.fidel-search-results li')).not.toHaveCount(0);
  await expectNoSeriousAxeIssues(page, 'features on');

  await panel.getByRole('button', { name: 'አማርኛ' }).click();
  await expect(playButton(page, 'አጫውት')).toBeVisible({ timeout: 15_000 });
  await expectNoSeriousAxeIssues(page, 'Amharic interface');
});

test('main task with the keyboard: Amharic captions, bigger, sign language, search', async ({ page }) => {
  await openLesson(page);
  const panel = page.locator('.fidel-panel');

  // Turn on Amharic captions (radio buttons are chosen with Space).
  await press(panel.getByRole('radio', { name: 'አማርኛ' }), 'Space');
  await expect(panel.getByRole('radio', { name: 'አማርኛ' })).toBeChecked();
  const captionBox = page.locator('fidel-player .able-captions-wrapper');
  await expect(captionBox).toHaveAttribute('lang', 'am');

  // The machine-translation notice follows the selected interface language.
  await expect(page.locator('.fidel-draft-notice')).toContainText('not yet reviewed');

  // Make captions bigger: 150% -> 200%.
  const larger = panel.getByRole('button', { name: /Larger captions/ });
  await press(larger);
  await press(larger);
  await expect(panel.locator('output')).toHaveText('200%');

  // Play with the keyboard and check the Amharic caption text is shown, large.
  await press(playButton(page));
  const caption = page.locator('fidel-player .able-captions');
  await expect(caption).toHaveText(/[ሀ-፿]/, { timeout: 15_000 }); // Ethiopic letters
  const fontSize = await caption.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(24);

  // Show the sign-language window; it is docked beside the video.
  await press(panel.getByRole('button', { name: 'Show sign language' }));
  const signToggle = panel.getByRole('button', { name: 'Show sign language' });
  await press(signToggle);
  await expect(signToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(signToggle).toBeFocused(); // focus did not jump away
  await expect(page.locator('.fidel-sign-dock .able-sign-window video')).toBeVisible();

  // Search the transcript and jump to a result.
  const search = page.getByRole('searchbox', { name: 'Search the transcript' });
  await search.focus();
  await page.keyboard.type('ALX');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'for “ALX”' })).toBeVisible();
  const result = page.locator('.fidel-result').first();
  await expect(result).toContainText('Play from 2:10');
  await press(result);
  const video = page.locator('fidel-player .able-media-container video');
  await expect.poll(() => video.evaluate((v) => v.currentTime), { timeout: 10_000 }).toBeGreaterThan(129);
});

test('the sign window can float over the video and move to a corner with buttons', async ({ page }) => {
  await openLesson(page);
  const panel = page.locator('.fidel-panel');
  await panel.getByRole('radio', { name: 'Over the video', exact: true }).check();
  await panel.getByRole('radio', { name: 'Small' }).check();
  await panel.getByRole('button', { name: 'Top left' }).click();

  const sign = page.locator('.fidel-player-slot .able-sign-window');
  const media = page.locator('.fidel-player-slot .able-media-container');
  await expect(sign).toBeVisible();
  const [s, m] = [await sign.boundingBox(), await media.boundingBox()];
  expect(Math.abs(s.x - m.x)).toBeLessThan(2);
  expect(Math.abs(s.y - m.y)).toBeLessThan(2);
  expect(s.width).toBeLessThanOrEqual(201); // "Small" is 200px
});

test('switching the interface to Amharic keeps focus and the playback position', async ({ page }) => {
  await openLesson(page);
  await page.locator('fidel-player .able-media-container video').evaluate((v) => (v.currentTime = 30));
  await press(page.locator('.fidel-panel').getByRole('button', { name: 'አማርኛ' }));

  await expect(playButton(page, 'አጫውት')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('fidel-player .fidel')).toHaveAttribute('lang', 'am');
  await expect(page.getByRole('heading', { name: 'የተደራሽነት ቅንብሮች' })).toBeVisible();
  await expect(page.locator('[data-fidel-ui-lang="am"]')).toBeFocused();
  const time = await page.locator('fidel-player .able-media-container video').evaluate((v) => v.currentTime);
  expect(time).toBeGreaterThan(29);
});

test('preferences are remembered after reloading the page', async ({ page }) => {
  await openLesson(page);
  const panel = page.locator('.fidel-panel');
  await panel.getByRole('radio', { name: 'አማርኛ' }).check();
  await panel.getByRole('button', { name: /Larger captions/ }).click();
  await panel.getByRole('radio', { name: 'Yellow on black' }).check();

  await openLesson(page); // reload
  await expect(panel.getByRole('radio', { name: 'አማርኛ' })).toBeChecked();
  await expect(panel.getByRole('radio', { name: 'Yellow on black' })).toBeChecked();
  await expect(panel.locator('output')).toHaveText('175%');
});

test('"Follow along" switches off when focus moves into the transcript text', async ({ page }) => {
  await openLesson(page);
  const followAlong = page.getByRole('checkbox', { name: 'Follow along' });
  await expect(followAlong).toBeChecked();
  await page.locator('.fidel-transcript-body .able-transcript-seekpoint').first().focus();
  await expect(followAlong).not.toBeChecked();
});

test('every Fidel button is at least 44 by 44 pixels (touch target)', async ({ page }) => {
  await openLesson(page);
  await page.locator('.fidel-panel').getByRole('radio', { name: 'Over the video', exact: true }).check();
  const sizes = await page.locator('fidel-player .fidel-button:visible').evaluateAll((buttons) =>
    buttons.map((b) => ({ text: b.textContent.trim(), w: b.offsetWidth, h: b.offsetHeight }))
  );
  expect(sizes.length).toBeGreaterThan(5);
  for (const size of sizes) {
    expect(size.w, size.text).toBeGreaterThanOrEqual(44);
    expect(size.h, size.text).toBeGreaterThanOrEqual(44);
  }
});

test.describe('reflow (WCAG 1.4.10)', () => {
  test('320px wide: no horizontal scrolling, signer wraps below the video', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openLesson(page);
    await expectNoHorizontalScroll(page);
    const video = await page.locator('.fidel-player-slot').boundingBox();
    const sign = await page.locator('.fidel-sign-dock').boundingBox();
    expect(sign.y).toBeGreaterThanOrEqual(video.y + video.height - 1);
  });

  test('200% zoom on a 1280px screen: no horizontal scrolling', async ({ browser }) => {
    // 200% zoom = half the CSS pixels with double-density rendering.
    const context = await browser.newContext({ viewport: { width: 640, height: 450 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await openLesson(page);
    await expectNoHorizontalScroll(page);
    await context.close();
  });
});

test('on a touch phone, every player control is at least 44 by 44 pixels', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await openLesson(page);
  const sizes = await page.locator('fidel-player .able-control-row button, fidel-player .fidel-button')
    .evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => ({ name: e.getAttribute('aria-label') || e.textContent.trim(), w: e.offsetWidth, h: e.offsetHeight })));
  for (const size of sizes) {
    expect(size.w, size.name).toBeGreaterThanOrEqual(44);
    expect(size.h, size.name).toBeGreaterThanOrEqual(44);
  }
  await expectNoHorizontalScroll(page);
  await context.close();
});

test('components send events to the page, and load from the versioned address', async ({ page }) => {
  // Record Fidel events before the page loads.
  await page.addInitScript(() => {
    window.fidelEvents = [];
    for (const name of ['fidel-ready', 'fidel-captions-change', 'fidel-language-change', 'fidel-ended']) {
      document.addEventListener(name, (e) => window.fidelEvents.push({ name, detail: e.detail }));
    }
  });
  await openLesson(page);
  expect(await page.evaluate(() => [...document.scripts].some((s) => s.src.includes('/embed/v1/fidel.js')))).toBe(true);
  expect(await page.evaluate(() => window.Fidel.version)).toBe('1.0.0');

  await page.locator('.fidel-panel').getByRole('radio', { name: 'አማርኛ' }).check();
  const video = page.locator('fidel-player .able-media-container video');
  await video.evaluate((v) => { v.currentTime = v.duration - 0.5; return v.play(); });

  await expect.poll(() => page.evaluate(() => window.fidelEvents.map((e) => e.name)), { timeout: 10_000 })
    .toEqual(expect.arrayContaining(['fidel-ready', 'fidel-captions-change', 'fidel-ended']));
  const events = await page.evaluate(() => window.fidelEvents);
  expect(events.find((e) => e.name === 'fidel-ready').detail.captionLanguages).toEqual(['en', 'am']);
  expect(events.find((e) => e.name === 'fidel-captions-change').detail.lang).toBe('am');
});

test('player controls are real <button> elements with names', async ({ page }) => {
  await openLesson(page);
  expect(await page.locator('fidel-player div[role="button"]').count()).toBe(0);
  const controls = page.locator('fidel-player .able-control-row button');
  expect(await controls.count()).toBeGreaterThan(8);
  for (const name of ['Play', 'Back 10 seconds', 'Forward 10 seconds', 'Faster', 'Slower', 'Preferences', 'Enter full screen']) {
    await expect(page.locator('fidel-player .able-control-row').getByRole('button', { name, exact: true })).toBeVisible();
  }
  // Buttons work with Enter (native), once per press.
  const back = page.locator('fidel-player .able-control-row').getByRole('button', { name: 'Forward 10 seconds' });
  const video = page.locator('fidel-player .able-media-container video');
  await back.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => video.evaluate((v) => Math.round(v.currentTime))).toBe(10);
});

test('player keys: K plays and pauses, arrows move 5 seconds, only when focus is in the player', async ({ page }) => {
  await openLesson(page);
  const video = page.locator('fidel-player .able-media-container video');
  await page.locator('fidel-player .able-control-row').getByRole('button', { name: 'Restart' }).focus();
  await page.keyboard.press('k');
  await expect.poll(() => video.evaluate((v) => !v.paused)).toBe(true);
  await page.keyboard.press('k');
  await expect.poll(() => video.evaluate((v) => v.paused)).toBe(true);
  const before = await video.evaluate((v) => v.currentTime);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeGreaterThanOrEqual(before + 4.5);

  // Typing "k" in the transcript search box does not play the video.
  await page.getByRole('searchbox', { name: 'Search the transcript' }).fill('k');
  expect(await video.evaluate((v) => v.paused)).toBe(true);
});

test('"Keyboard help" opens a dialog; Escape closes it and focus returns', async ({ page }) => {
  await openLesson(page);
  const open = page.locator('.fidel-panel').getByRole('button', { name: 'Keyboard help' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Keyboard keys for the player' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Play or pause');
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  const results = await new AxeBuilder({ page }).include('.fidel-keys-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => v.id)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
});

test('progress, prefs and complete events reach the host; transcript lines are buttons', async ({ page }) => {
  await page.addInitScript(() => {
    window.fidelEvents = [];
    for (const name of ['fidel-progress', 'fidel-prefs', 'fidel-complete']) {
      document.addEventListener(name, (e) => window.fidelEvents.push({ name, detail: e.detail }));
    }
  });
  await openLesson(page);
  await page.locator('.fidel-panel').getByRole('button', { name: /Larger captions/ }).click();
  const video = page.locator('fidel-player .able-media-container video');
  await video.evaluate((v) => { v.currentTime = 20; return v.play(); });
  await expect.poll(() => page.evaluate(() => window.fidelEvents.map((e) => e.name)), { timeout: 10_000 })
    .toEqual(expect.arrayContaining(['fidel-prefs', 'fidel-progress']));
  const events = await page.evaluate(() => window.fidelEvents);
  expect(events.find((e) => e.name === 'fidel-prefs').detail.captionSize).toBe(175);
  const progress = events.find((e) => e.name === 'fidel-progress').detail;
  expect(progress.seconds).toBeGreaterThanOrEqual(20);
  expect(progress.percent).toBeGreaterThan(0);

  const lines = page.locator('.fidel-transcript-body .able-transcript-caption');
  await expect(lines.first()).toHaveAttribute('role', 'button');
  await lines.nth(2).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeLessThan(20); // jumped back to line 3
});
