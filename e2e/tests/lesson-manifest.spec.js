// <fidel-player lesson="..."> reads a lesson manifest from the Fidel API.
// The API is faked here (page.route), so this test does not need the AI
// pipeline: it checks only how the player uses a manifest.
import { test, expect } from '@playwright/test';

const ID = 'abcdef012345';

function manifest({ withVideo = true } = {}) {
  return {
    id: ID,
    title: 'Fake lesson',
    spoken_language: 'en',
    created_at: '2026-11-14T00:00:00+00:00',
    video: withVideo ? { mp4: '/media/lesson.mp4', webm: '/media/lesson.webm' } : {},
    audio: {},
    captions: [
      { lang: 'en', status: 'draft', url: '/demo/media/en.vtt' },
      { lang: 'am', status: 'draft', url: '/demo/media/am.vtt' },
    ],
    steps: {},
  };
}

test('the player loads video and both caption languages from the manifest', async ({ page }) => {
  await page.route(`**/api/v1/lessons/${ID}`, (route) => route.fulfill({ json: manifest() }));
  await page.goto(`/demo/savanna-mock/lesson.html?id=${ID}`);

  await expect(page.locator('fidel-player .fidel-panel')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fake lesson');
  await expect(page.locator('fidel-player video source[type="video/webm"]')).toHaveAttribute('src', '/media/lesson.webm');
  const panel = page.locator('.fidel-panel');
  await panel.getByRole('radio', { name: 'አማርኛ' }).check();
  // Status "draft" from the manifest turns on the review notice.
  await expect(page.locator('.fidel-draft-notice')).toBeVisible();
});

test('a lesson still being processed shows a clear message', async ({ page }) => {
  await page.route(`**/api/v1/lessons/${ID}`, (route) => route.fulfill({ json: manifest({ withVideo: false }) }));
  await page.goto(`/demo/savanna-mock/lesson.html?id=${ID}`);
  await expect(page.getByRole('alert')).toHaveText(/still being prepared/);
});

test('an unknown lesson shows an error instead of a broken player', async ({ page }) => {
  await page.route(`**/api/v1/lessons/${ID}`, (route) => route.fulfill({ status: 404, json: { detail: 'No lesson' } }));
  await page.goto(`/demo/savanna-mock/lesson.html?id=${ID}`);
  await expect(page.getByRole('alert')).toHaveText(/could not be loaded \(error 404\)/);
});
