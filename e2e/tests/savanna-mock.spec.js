// Tests for the mock Savanna lesson page with <fidel-player> embedded.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGE = '/demo/savanna-mock/';

// Wait until Able Player has built its controls inside <fidel-player>.
// Returns the Play button in the control bar. (Able Player also shows a big
// Play button over the video; both have the name "Play".)
async function openLesson(page) {
  await page.goto(PAGE);
  const playButton = page
    .locator('fidel-player .able-control-row')
    .getByRole('button', { name: 'Play' });
  await expect(playButton).toBeVisible();
  return playButton;
}

test('page has no critical or serious axe violations (WCAG 2.2 AA)', async ({ page }) => {
  await openLesson(page);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  // Print every issue (including minor ones) so we can fix them over time.
  for (const v of results.violations) {
    console.log(`[axe ${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} element(s))`);
  }

  // The hackathon gate: zero critical or serious issues.
  const blocking = results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => `${v.id}: ${v.help}`);
  expect(blocking).toEqual([]);
});

test('video plays with captions using the keyboard only', async ({ page }) => {
  const playButton = await openLesson(page);

  // Press Tab until the Play button has focus (like a keyboard user would).
  let found = false;
  for (let i = 0; i < 40 && !found; i++) {
    await page.keyboard.press('Tab');
    found = await playButton.evaluate((el) => el === document.activeElement);
  }
  expect(found, 'Play button should be reachable with Tab').toBe(true);

  await page.keyboard.press('Enter');

  const video = page.locator('fidel-player video');
  await expect
    .poll(() => video.evaluate((v) => !v.paused && v.currentTime > 1), { timeout: 15_000 })
    .toBe(true);

  // English captions are on by default and show text while playing.
  const captions = page.locator('fidel-player .able-captions');
  await expect(captions).toHaveText(/\S/, { timeout: 15_000 });
});

test('fidel-player builds the video with English captions and chapters', async ({ page }) => {
  await openLesson(page);
  await expect(page.locator('fidel-player video track[kind="captions"][srclang="en"]')).toHaveCount(1);
  await expect(page.locator('fidel-player video track[kind="chapters"]')).toHaveCount(1);
});
