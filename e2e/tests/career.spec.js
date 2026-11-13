// Career gateway: job card (schema.org/JobPosting, both calendars, audio
// summary) and certificates (issue, verify, revoke).
// Needs the staff token (FIDEL_STAFF_TOKEN or ../.env).
import { readFileSync, existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function staffToken() {
  if (process.env.FIDEL_STAFF_TOKEN) return process.env.FIDEL_STAFF_TOKEN;
  if (!existsSync('../.env')) return '';
  const line = readFileSync('../.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('FIDEL_STAFF_TOKEN='));
  return line ? line.split('=')[1].trim() : '';
}
const TOKEN = staffToken();
const STAFF = { Authorization: `Bearer ${TOKEN}` };
const AUDIO = '../data/demo/lesson.mp4'; // anything with sound works as a "recording"
test.skip(!TOKEN, 'Set FIDEL_STAFF_TOKEN (or create ../.env) to run career tests.');

const JOB = {
  title: 'Junior Web Developer',
  organization: 'Example Tech PLC',
  description: 'Build accessible web pages with our team.',
  location: 'Addis Ababa',
  remote: true,
  employment_type: 'FULL_TIME',
  date_posted: '2026-11-14',
  closing_date: '2026-11-30',
  apply_email: 'jobs@example.com',
  how_to_apply: 'Send your CV by email.',
  accommodations: ['sign_language_interpreter', 'screen_reader_tools', 'flexible_hours', 'step_free_access'],
  other_accommodations: [],
  summary_en: 'A full-time web developer job in Addis Ababa or remote. Apply by 30 November.',
  summary_am: 'በአዲስ አበባ ወይም ከርቀት የሙሉ ጊዜ የድር ገንቢ ሥራ። እስከ ህዳር 21 ያመልክቱ።',
};
let jobId;

test.beforeAll(async ({ request }) => {
  const created = await request.post('/api/v1/jobs', { headers: STAFF, data: JOB });
  expect(created.status()).toBe(201);
  jobId = (await created.json()).identifier.value;
  if (existsSync(AUDIO)) {
    const rec = await request.post(`/api/v1/jobs/${jobId}/summary-recording/am`, {
      headers: STAFF, multipart: { audio: { name: 'am.mp4', mimeType: 'video/mp4', buffer: readFileSync(AUDIO) } },
    });
    expect(rec.status()).toBe(200);
  }
});

test.afterAll(async ({ request }) => {
  if (jobId) await request.delete(`/api/v1/jobs/${jobId}`, { headers: STAFF });
});

const card = (page) => page.locator('fidel-job-card').first();

test('the job card shows everything, with dates in both calendars and JSON-LD', async ({ page }) => {
  await page.goto(`/demo/savanna-mock/jobs.html?id=${jobId}`);
  const c = card(page);
  await expect(c.getByRole('heading', { level: 2, name: 'Junior Web Developer' })).toBeVisible();
  await expect(c).toContainText('Example Tech PLC');
  await expect(c).toContainText('Addis Ababa, or remote');
  await expect(c).toContainText('30 Nov 2026 / ህዳር 21 2019');
  await expect(c.getByRole('link', { name: 'jobs@example.com' })).toHaveAttribute('href', 'mailto:jobs@example.com');
  for (const item of ['Sign language interpreter available', 'Screen-reader compatible tools', 'Flexible hours', 'Step-free access']) {
    await expect(c.getByRole('listitem').filter({ hasText: item })).toBeVisible();
  }
  // The summary is shown as text in both languages, with lang attributes.
  await expect(c.locator('p[lang="am"].fidel-job-summary')).toHaveText(JOB.summary_am);

  // Valid schema.org/JobPosting on the page.
  const jsonld = JSON.parse(await c.locator('script[type="application/ld+json"]').textContent());
  expect(jsonld['@type']).toBe('JobPosting');
  expect(jsonld.hiringOrganization.name).toBe('Example Tech PLC');
  expect(jsonld.validThrough).toBe('2026-11-30T23:59:59+03:00');
});

test('"Listen to summary" plays the Amharic recording, and can be stopped', async ({ page }) => {
  test.skip(!existsSync(AUDIO), 'needs data/demo/lesson.mp4');
  await page.goto(`/demo/savanna-mock/jobs.html?id=${jobId}`);
  const listen = card(page).getByRole('button', { name: 'Listen to summary (Amharic)' });
  await listen.click();
  const stop = card(page).getByRole('button', { name: 'Stop' });
  await expect(stop).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page).getByRole('status')).toHaveText('Playing the summary.');
  await stop.click();
  await expect(card(page).getByRole('button', { name: 'Listen to summary (Amharic)' })).toHaveAttribute('aria-pressed', 'false');
});

test('the job card in Amharic', async ({ page }) => {
  await page.goto(`/demo/savanna-mock/jobs.html?id=${jobId}`);
  await page.evaluate((id) => {
    const amCard = document.createElement('fidel-job-card');
    amCard.setAttribute('job', `/api/v1/jobs/${id}`);
    amCard.setAttribute('lang', 'am');
    amCard.id = 'am-card';
    document.querySelector('main').append(amCard);
  }, jobId);
  const am = page.locator('#am-card');
  await expect(am).toContainText('የማመልከቻ የመጨረሻ ቀን');
  await expect(am).toContainText('የምልክት ቋንቋ አስተርጓሚ አለ');
  await expect(am.locator('article')).toHaveAttribute('lang', 'am');
});

for (const [width, scale, label] of [[320, 1, '320px'], [180, 2, '360px phone at 200% zoom']]) {
  test(`job card: no sideways scrolling at ${label}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: scale });
    const page = await context.newPage();
    await page.goto(`/demo/savanna-mock/jobs.html?id=${jobId}`);
    await expect(card(page).getByRole('heading', { level: 2 })).toBeVisible();
    const [scrollWidth, clientWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    await context.close();
  });
}

test('jobs page has no critical or serious axe issues', async ({ page }) => {
  await page.goto(`/demo/savanna-mock/jobs.html?id=${jobId}`);
  await expect(card(page).getByRole('heading', { level: 2 })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => v.id)).toEqual([]);
});

test('certificate: issue in Studio, check the public page, revoke', async ({ page, browser }) => {
  await page.goto('/studio/');
  await page.getByLabel('Staff token').fill(TOKEN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('navigation', { name: 'Studio' }).getByRole('link', { name: 'Certificates' }).click();
  await page.getByLabel('Learner name').fill('Test Learner');
  await page.getByLabel('Course').fill('Accessible Web Basics');
  await page.getByLabel('Date').fill('2026-11-15');
  await page.getByRole('button', { name: 'Issue certificate' }).click();
  const issued = page.getByRole('status').filter({ hasText: 'Share this link' });
  await expect(issued).toBeVisible();
  const verifyUrl = (await issued.textContent()).match(/https?:\/\/\S+/)[0];

  // An employer opens the link (a fresh browser, not signed in).
  const employer = await (await browser.newContext()).newPage();
  await employer.goto(verifyUrl);
  await expect(employer.getByText('✓ Verified by ALX Digital Bridge')).toBeVisible();
  await expect(employer.locator('dd').filter({ hasText: 'Test Learner' })).toBeVisible();
  await expect(employer.locator('dd').filter({ hasText: '15 Nov 2026' })).toContainText('ህዳር 6 2019');
  await expect(employer.getByRole('button', { name: /Copy link/ })).toBeVisible();
  const results = await new AxeBuilder({ page: employer }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => v.id)).toEqual([]);

  // Revoke in Studio; the employer's page now says so.
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Revoke for Test Learner' }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Certificate revoked.' })).toBeVisible();
  await employer.reload();
  await expect(employer.getByText(/This certificate was revoked/)).toBeVisible();
});

test('jobs can be added in Studio', async ({ page, request }) => {
  await page.goto('/studio/');
  await page.getByLabel('Staff token').fill(TOKEN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('navigation', { name: 'Studio' }).getByRole('link', { name: 'Jobs' }).click();
  await page.getByText('Add a job').click();
  await page.getByLabel('Job title').fill('Studio Test Job');
  await page.getByLabel('Employer').fill('Test Org');
  await page.getByLabel('Description').fill('Testing.');
  await page.getByLabel('Town or city').fill('Bahir Dar');
  await page.getByLabel('Closing date').fill('2027-01-31');
  await page.getByLabel('How to apply').fill('Call us.');
  await page.getByLabel('Step-free access').check();
  await page.getByLabel('Short summary in English').fill('A test job.');
  await page.getByRole('button', { name: 'Add job' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Studio Test Job' })).toBeVisible();

  // Clean up through the API.
  const jobs = await (await request.get('/api/v1/jobs')).json();
  for (const job of jobs.filter((j) => j.title === 'Studio Test Job')) {
    await request.delete(`/api/v1/jobs/${job.id}`, { headers: STAFF });
  }
});
