// LTI 1.3, phase 1: Studio's "LMS connections" page.
// Runs against whatever the server has: with FIDEL_LTI_ENABLED off, it checks
// the page explains how to switch it on; with it on, it registers a platform by
// keyboard, copies Fidel's addresses and removes the platform again.
// Needs the staff token (FIDEL_STAFF_TOKEN or ../.env).
import { existsSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function staffToken() {
  if (process.env.FIDEL_STAFF_TOKEN) return process.env.FIDEL_STAFF_TOKEN;
  if (!existsSync('../.env')) return '';
  const line = readFileSync('../.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('FIDEL_STAFF_TOKEN='));
  return line ? line.split('=', 2)[1].trim() : '';
}
const TOKEN = staffToken();
const STAFF = { Authorization: `Bearer ${TOKEN}` };
test.skip(!TOKEN, 'Set FIDEL_STAFF_TOKEN (or create ../.env) to run LTI tests.');

async function openPage(page) {
  await page.goto('/studio/');
  await page.getByLabel('Staff token').fill(TOKEN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'LMS connections' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'LMS connections' })).toBeFocused();
}

async function axeIssues(page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => v.id);
}

let enabled;
test.beforeAll(async ({ request }) => {
  enabled = (await (await request.get('/api/v1/lti/tool', { headers: STAFF })).json()).enabled;
});

test('switched off: the page says how to switch it on', async ({ page, request }) => {
  test.skip(enabled, 'LTI is on in this server.');
  await openPage(page);
  await expect(page.getByRole('heading', { name: 'Switched off' })).toBeVisible();
  await expect(page.getByText('FIDEL_LTI_ENABLED=true')).toBeVisible();
  expect((await request.get('/lti/jwks')).status()).toBe(404);
  expect(await axeIssues(page)).toEqual([]);
});

test('switched on: copy Fidel\'s addresses, add and remove a platform by keyboard', async ({ page, context, request }) => {
  test.skip(!enabled, 'Start the server with FIDEL_LTI_ENABLED=true to run this.');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const jwks = await (await request.get('/lti/jwks')).json();
  expect(jwks.keys[0].kty).toBe('RSA');

  await openPage(page);
  const keySet = page.getByLabel('Public keyset URL', { exact: true }).first();
  await expect(keySet).toHaveValue(/\/lti\/jwks$/);
  await page.getByRole('button', { name: 'Copy Public keyset URL' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Copied the Public keyset URL.' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/lti\/jwks$/);

  // Open "Add a platform" and fill it in by keyboard only.
  const summary = page.locator('summary', { hasText: 'Add a platform' });
  await summary.focus();
  await page.keyboard.press('Enter');
  const name = `Keyboard Moodle ${Date.now()}`;
  const values = [
    ['Name', name],
    ['Platform ID (issuer)', 'http://localhost:8081'],
    ['Client ID', `kb-${Date.now()}`],
    ['Deployment ID', '1'],
    ['Authentication request URL', 'http://localhost:8081/mod/lti/auth.php'],
    ['Access token URL', 'http://localhost:8081/mod/lti/token.php'],
  ];
  for (const [label, value] of values) {
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(label, { exact: true })).toBeFocused();
    await page.keyboard.type(value);
  }
  await page.keyboard.press('Tab');
  await page.keyboard.type('http://localhost:8081/mod/lti/certs.php');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Add platform' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('status').filter({ hasText: `Added ${name}.` })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name })).toBeVisible();
  expect(await axeIssues(page)).toEqual([]);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: `Remove ${name}` }).click();
  await expect(page.getByRole('status').filter({ hasText: `Removed ${name}.` })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name })).toHaveCount(0);
});

test('a bad address is refused in words', async ({ page }) => {
  test.skip(!enabled, 'Start the server with FIDEL_LTI_ENABLED=true to run this.');
  await openPage(page);
  await page.locator('summary', { hasText: 'Add a platform' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Insecure');
  await page.getByLabel('Platform ID (issuer)').fill('http://moodle.example.org');
  await page.getByLabel('Client ID').fill('x');
  await page.getByLabel('Deployment ID').fill('1');
  await page.getByLabel('Authentication request URL').fill('https://moodle.example.org/mod/lti/auth.php');
  await page.getByLabel('Access token URL').fill('https://moodle.example.org/mod/lti/token.php');
  await page.locator('form').getByLabel('Public keyset URL').fill('https://moodle.example.org/mod/lti/certs.php');
  await page.getByRole('button', { name: 'Add platform' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Not added: .*https:\/\// })).toBeVisible();
});
