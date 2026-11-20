// Optional British Sign Language avatar, on the lesson demo page.
//
// ?sign=bsl       a BSL avatar video made in advance (data/demo/sign-bsl.webm,
//                 git-ignored): tests run only when that file is there.
// ?sign=bsl-live  the live avatar (docker compose --profile bsl-avatar): tests
//                 run only when the Kozha service answers on port 8001.
// The first test always runs: without ?sign the page must not touch Kozha.
import { test, expect } from '@playwright/test';

const PAGE = '/demo/savanna-mock/';
const KOZHA = process.env.FIDEL_KOZHA_URL || 'http://localhost:8001';

async function kozhaRunning() {
  try {
    const response = await fetch(`${KOZHA}/api/chat2hamnosys/health`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

const avatarRegion = (page) => page.getByRole('region', { name: 'Experimental British Sign Language avatar' });
const showSign = (page) => page.locator('.fidel-panel').getByRole('button', { name: 'Show sign language' });
const playButton = (page) => page.locator('fidel-player .able-control-row').getByRole('button', { name: 'Play' });
// The frame's own "ready" messages. (Not just /ready/: "did not become ready" must fail.)
const READY = /Experimental BSL (avatar ready|is ready)/;

// Show the avatar the way a learner does: press the button, then look at it.
// Browsers do not draw a cross-origin frame that is off screen, so the avatar
// only finishes loading once the sign window is in view.
async function openAvatar(page) {
  await showSign(page).click();
  const frame = page.locator('iframe.fidel-kozha-sign-frame');
  await frame.scrollIntoViewIfNeeded();
  return page.frameLocator('iframe.fidel-kozha-sign-frame');
}

test('without ?sign=bsl the lesson keeps its recorded sign video and never loads Kozha', async ({ page }) => {
  const kozhaRequests = [];
  page.on('request', (request) => {
    if (request.url().includes(':8001')) kozhaRequests.push(request.url());
  });
  await page.goto(PAGE);
  await expect(page.locator('fidel-player .able-control-row')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('fidel-player')).not.toHaveAttribute('sign-provider', /.+/);
  await expect(page.locator('iframe.fidel-kozha-sign-frame')).toHaveCount(0);
  expect(kozhaRequests).toEqual([]);
});

test.describe('pre-made BSL avatar video (?sign=bsl)', () => {
  test.beforeEach(async ({ request }) => {
    const response = await request.head('/media/sign-bsl.webm');
    test.skip(!response.ok(), 'data/demo/sign-bsl.webm is not there (made by the BSL recording scripts)');
  });

  test('plays in the normal sign window, with a clear note, and never contacts Kozha', async ({ page }) => {
    const kozhaRequests = [];
    page.on('request', (request) => { if (request.url().includes(':8001')) kozhaRequests.push(request.url()); });
    await page.goto(`${PAGE}?sign=bsl`);
    const note = page.locator('#bsl-note');
    await expect(note).toBeVisible();
    await expect(note).toContainText('not by an interpreter');
    await expect(note).toContainText('not Ethiopian Sign Language');
    await showSign(page).click();
    const signVideo = page.locator('fidel-player .able-sign-window video');
    await expect.poll(() => signVideo.evaluate((v) => v.currentSrc || v.querySelector('source')?.src || '')).toMatch(/sign-bsl\.webm/);
    await expect(page.locator('iframe.fidel-kozha-sign-frame')).toHaveCount(0);
    expect(kozhaRequests).toEqual([]);
  });

  test('the BSL video follows the lesson video', async ({ page }) => {
    await page.goto(`${PAGE}?sign=bsl`);
    await showSign(page).click();
    await playButton(page).focus();
    await playButton(page).press('Enter');
    const main = page.locator('fidel-player video').first();
    const sign = page.locator('fidel-player .able-sign-window video');
    await expect.poll(() => main.evaluate((v) => v.currentTime), { timeout: 10_000 }).toBeGreaterThan(2);
    await expect.poll(async () => Math.abs(await sign.evaluate((v) => v.currentTime) - await main.evaluate((v) => v.currentTime)), { timeout: 10_000 })
      .toBeLessThan(0.5);
    await expect.poll(() => sign.evaluate((v) => v.paused)).toBe(false);
    // It is playing, so no "Loading the sign-language video…" notice is left on screen.
    await expect(page.locator('fidel-player .fidel-sign-status')).toHaveCount(0, { timeout: 5_000 });
  });
});

test.describe('live avatar (?sign=bsl-live) with the bsl-avatar service running', () => {
  test.beforeEach(async () => {
    test.skip(!(await kozhaRunning()), 'Kozha is not running (docker compose --profile bsl-avatar up -d)');
  });

  test('the avatar is labelled BSL, experimental and not an interpreter, and loads only when shown', async ({ page }) => {
    await page.goto(`${PAGE}?sign=bsl-live`);
    const region = avatarRegion(page);
    await expect(region).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('iframe.fidel-kozha-sign-frame')).not.toHaveAttribute('src', /.+/);

    const avatar = await openAvatar(page);
    await expect(region).toBeVisible();
    await expect(region.locator('.fidel-kozha-sign-warning')).toContainText('not a human interpreter');
    await expect(region.locator('.fidel-kozha-sign-warning')).toContainText('Non-commercial');
    await expect(avatar.locator('#status')).toContainText(READY, { timeout: 60_000 });
  });

  test('English captions drive the avatar while the video plays, without avatar errors', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
    await page.goto(`${PAGE}?sign=bsl-live`);
    await page.locator('.fidel-panel').getByRole('radio', { name: 'English' }).check();
    const avatar = await openAvatar(page);
    await expect(avatar.locator('#status')).toContainText(READY, { timeout: 60_000 });

    const video = page.locator('fidel-player video').first();
    await playButton(page).focus();
    await playButton(page).press('Enter');
    await expect.poll(() => video.evaluate((media) => media.currentTime), { timeout: 10_000 }).toBeGreaterThan(0.5);
    await page.waitForTimeout(8_000);

    await expect(avatar.locator('#status')).not.toContainText(/error|could not|did not/i);
    expect(pageErrors.filter((error) => /allcsa\.js|AnimScheduler|reading 'reset'/i.test(error))).toEqual([]);
  });

  test('Amharic captions are not sent to the BSL avatar; the window says so', async ({ page }) => {
    await page.goto(`${PAGE}?sign=bsl-live`);
    await showSign(page).click();
    await page.locator('.fidel-panel').getByRole('radio', { name: 'አማርኛ' }).check();
    await expect(avatarRegion(page).locator('.fidel-sign-status')).toContainText('English captions only');
  });
});
