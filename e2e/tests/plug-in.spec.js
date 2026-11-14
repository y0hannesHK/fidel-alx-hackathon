// The two proofs from the Team Technical Guide (section 3):
//   1. Inside Savanna: ALX's starter lesson page with Fidel's two lines and tag.
//   2. Outside Savanna: a blank page with no Bootstrap and no Savanna CSS.
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const serious = (results) => results.violations.filter((v) => ['critical', 'serious'].includes(v.impact))
  .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);

test.describe('inside Savanna', () => {
  test.skip(!existsSync('../savanna/pages/concept-with-navigation.html'), 'Run scripts/setup-savanna.sh first.');

  test('the player works in the lesson body and Savanna CSS does not break it', async ({ page }) => {
    await page.goto('/savanna/pages/concept-with-navigation.html');
    const player = page.locator('#curriculum_navigation_content .savanna-styles fidel-player');
    await expect(player.locator('.fidel-panel')).toBeVisible({ timeout: 15_000 });

    // Bootstrap would make legends 21px floated headings, bigger than our section
    // titles. They must follow the host's body text size and stay below the titles.
    const sizes = await player.evaluate((el) => {
      const px = (sel) => parseFloat(getComputedStyle(el.querySelector(sel)).fontSize);
      return {
        float: getComputedStyle(el.querySelector('.fidel-radios legend')).float,
        legend: px('.fidel-radios legend'),
        title: px('.fidel-group > summary'),
        body: parseFloat(getComputedStyle(document.documentElement).fontSize),
      };
    });
    expect(sizes.float).toBe('none');
    expect(sizes.legend).toBe(sizes.body);
    expect(sizes.legend).toBeLessThan(sizes.title);

    // Axe on Fidel's part of the page (the starter's own known defects are not ours).
    expect(serious(await new AxeBuilder({ page }).include('fidel-player').withTags(TAGS).analyze())).toEqual([]);

    // Main task steps work here too.
    await player.getByRole('radio', { name: 'አማርኛ' }).check();
    await expect(player.locator('.able-captions-wrapper')).toHaveAttribute('lang', 'am');
    await player.getByRole('button', { name: 'Show sign language' }).click();
    await expect(player.locator('.able-sign-window video')).toBeVisible();
  });

  test('job cards on a Savanna-styled jobs page', async ({ page, request }) => {
    const jobs = await (await request.get('/api/v1/jobs')).json();
    test.skip(!jobs.length, 'No open jobs to show.');
    await page.goto('/savanna/pages/jobs.html');
    const card = page.locator('fidel-job-card').first();
    await expect(card.getByRole('heading', { level: 2 })).toBeVisible();
    expect(serious(await new AxeBuilder({ page }).include('fidel-job-card').withTags(TAGS).analyze())).toEqual([]);
  });
});

test('outside Savanna: the blank page works with no host styles', async ({ page }) => {
  await page.goto('/demo/blank.html');
  expect(await page.locator('link[rel=stylesheet]').count()).toBe(1); // only fidel.css
  const player = page.locator('fidel-player');
  await expect(player.locator('.fidel-panel')).toBeVisible({ timeout: 15_000 });
  await player.locator('.able-control-row').getByRole('button', { name: 'Play' }).click();
  await expect.poll(() => player.locator('video').first().evaluate((v) => !v.paused)).toBe(true);
  expect(serious(await new AxeBuilder({ page }).withTags(TAGS).analyze())).toEqual([]);
});
