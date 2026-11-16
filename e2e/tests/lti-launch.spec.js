// LTI 1.3, phases 2 to 4: a lesson opened from a learning platform, in a real
// browser: signing in, the lesson page, "completed" in the gradebook (watched to
// the end, or "Mark as complete"), and the teacher's lesson picker (Deep Linking).
// A fake platform (addresses intercepted by Playwright) starts the sign-in,
// signs the launch with its own key and posts it to Fidel. Fidel reads the
// platform's public key from a file under /media/ (data/demo/). The platform's
// token address and gradebook are a small server started by this test; the Fidel
// container reaches it at host.docker.internal.
//
// Needs a server with FIDEL_LTI_ENABLED=true (skipped otherwise), e.g.
//   docker compose run -d --rm -e FIDEL_LTI_ENABLED=true -p 8011:8000 --name fidel-lti-test server
//   FIDEL_BASE_URL=http://localhost:8011 npx playwright test tests/lti-launch.spec.js
// and the staff token (FIDEL_STAFF_TOKEN or ../.env).
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createServer } from 'node:http';
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
test.describe.configure({ mode: 'serial' });
// The fake course page is intercepted, so Chrome does not know it is on this
// computer and blocks it from framing localhost (Local Network Access). A real
// platform framing Fidel's public https address is not affected.
test.use({ launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] } });

// Same site as Fidel (localhost), so the state cookie works: a top-level sign-in.
const SAME_SITE = 'http://localhost:9';
// Another site: Fidel inside its course page is a third-party frame, its cookie is blocked.
const OTHER_SITE = 'http://127.0.0.1:9';
const KID = `e2e-${Date.now()}`;
const KEY_FILE = `lti-e2e-${Date.now()}.json`; // new address each run: Fidel caches key sets
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
function signToken(claims) {
  const input = `${b64({ alg: 'RS256', typ: 'JWT', kid: KID })}.${b64(claims)}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
}

let enabled = false;
let lessonId;
let lessonTitle;
const platformIds = [];

// The platform's token address and gradebook. Records each score; answers with
// the queued status codes first (to test "Try again"), then 200.
const scores = [];
const scoreAnswers = [];
let gradebookUrl;
const gradebook = createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    if (req.url === '/token') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ access_token: 'e2e-token', token_type: 'Bearer', expires_in: 3600 }));
    }
    const code = scoreAnswers.shift() || 200;
    if (code === 200) scores.push({ url: req.url, type: req.headers['content-type'], score: JSON.parse(body) });
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end('{}');
  });
});

test.beforeAll(async ({ request }) => {
  enabled = (await (await request.get('/api/v1/lti/tool', { headers: STAFF })).json()).enabled;
  if (!enabled) return;
  const lessons = await (await request.get('/api/v1/lessons')).json();
  lessonId = lessons[0]?.id;
  lessonTitle = lessons[0]?.title;
  await new Promise((resolve) => gradebook.listen(0, '127.0.0.1', resolve));
  gradebookUrl = `http://host.docker.internal:${gradebook.address().port}`;
  writeFileSync(`../data/demo/${KEY_FILE}`, JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }] }));
  for (const issuer of [SAME_SITE, OTHER_SITE]) {
    const response = await request.post('/api/v1/lti/platforms', {
      headers: STAFF,
      data: {
        name: `E2E platform ${issuer}`, issuer, client_id: 'e2e-client', deployment_ids: ['1'],
        auth_login_url: `${issuer}/auth`, auth_token_url: `${gradebookUrl}/token`,
        // Read by the Fidel server itself, inside its container (port 8000 there).
        key_set_url: `http://localhost:8000/media/${KEY_FILE}`,
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    platformIds.push((await response.json()).id);
  }
});

test.afterAll(async ({ request }) => {
  for (const id of platformIds) await request.delete(`/api/v1/lti/platforms/${id}`, { headers: STAFF });
  rmSync(`../data/demo/${KEY_FILE}`, { force: true });
  gradebook.close();
});

/** The fake platform: its sign-in address answers with a signed launch, posted to
 * Fidel (a lesson, or the teacher's picker when the target is /lti/deep-link).
 * Fidel's answer from the picker arrives at /return and is kept in `received`. */
const received = [];
async function fakePlatform(context, issuer, { lesson = lessonId } = {}) {
  await context.route(`${issuer}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/return') {
      received.push(new URLSearchParams(route.request().postData()).get('JWT'));
      return route.fulfill({ contentType: 'text/html', body: '<!DOCTYPE html><html lang="en"><title>Course</title><h1>Activity added</h1></html>' });
    }
    if (url.pathname === '/auth' && url.searchParams.get('redirect_uri').endsWith('/lti/deep-link')) {
      const q = url.searchParams;
      const now = Math.floor(Date.now() / 1000);
      const token = signToken({
        iss: issuer, aud: q.get('client_id'), sub: 'e2e-teacher', iat: now, exp: now + 60, nonce: q.get('nonce'),
        'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingRequest',
        'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
        'https://purl.imsglobal.org/spec/lti/claim/deployment_id': '1',
        'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings': {
          deep_link_return_url: `${issuer}/return`, accept_types: ['ltiResourceLink'], data: 'e2e-data',
        },
      });
      return route.fulfill({
        contentType: 'text/html',
        body: `<!DOCTYPE html><html lang="en"><title>Platform</title><body>
          <form method="post" action="${q.get('redirect_uri')}">
          <input type="hidden" name="id_token" value="${token}"><input type="hidden" name="state" value="${q.get('state')}">
          </form><script>document.forms[0].submit()</script></body></html>`,
      });
    }
    if (url.pathname === '/auth') {
      const q = url.searchParams;
      const now = Math.floor(Date.now() / 1000);
      const token = signToken({
        iss: issuer, aud: q.get('client_id'), sub: 'e2e-learner', iat: now, exp: now + 60, nonce: q.get('nonce'),
        'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest',
        'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
        'https://purl.imsglobal.org/spec/lti/claim/deployment_id': '1',
        'https://purl.imsglobal.org/spec/lti/claim/resource_link': { id: 'e2e-activity' },
        'https://purl.imsglobal.org/spec/lti/claim/custom': { lesson_id: lesson },
        'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': {
          scope: ['https://purl.imsglobal.org/spec/lti-ags/scope/score'],
          lineitem: `${gradebookUrl}/lineitems/7/lineitem?type_id=1`,
        },
      });
      return route.fulfill({
        contentType: 'text/html',
        body: `<!DOCTYPE html><html lang="en"><title>Platform</title><body>
          <form method="post" action="${q.get('redirect_uri')}">
          <input type="hidden" name="id_token" value="${token}"><input type="hidden" name="state" value="${q.get('state')}">
          </form><script>document.forms[0].submit()</script></body></html>`,
      });
    }
    if (url.pathname === '/course') {
      // A course page with Fidel in a frame. It offers its own storage
      // (LTI client-side storage) when asked: ?storage=1.
      const login = url.searchParams.get('login');
      return route.fulfill({
        contentType: 'text/html',
        body: `<!DOCTYPE html><html lang="en"><title>Course</title><body><h1>Course</h1>
          <iframe title="Fidel lesson" src="${login}" style="width:100%;height:600px"></iframe>
          <script>
            var store = {};
            window.addEventListener('message', function (e) {
              var m = e.data;
              if (!m || !m.subject) return;
              if (m.subject === 'lti.put_data') store[m.key] = m.value;
              var value = m.subject === 'lti.get_data' ? store[m.key] : m.value;
              e.source.postMessage({ subject: m.subject + '.response', message_id: m.message_id, key: m.key, value: value }, e.origin);
            });
          </script></body></html>`,
      });
    }
    return route.fulfill({ status: 404, body: 'not found' });
  });
}

function loginUrl(baseURL, issuer, extra = {}) {
  const params = new URLSearchParams({
    iss: issuer, client_id: 'e2e-client', login_hint: 'e2e-learner', lti_deployment_id: '1',
    target_link_uri: `${baseURL}/lti/launch`, ...extra,
  });
  return `${baseURL}/lti/login?${params}`;
}

async function axeIssues(page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => v.id);
}

/** Watch to the end, quickly: jump to just before the end and play (muted). */
async function watchToTheEnd(page) {
  const video = page.locator('fidel-player video').first();
  await expect.poll(() => video.evaluate((v) => v.readyState), { timeout: 20_000 }).toBeGreaterThan(0);
  await video.evaluate((v) => {
    v.muted = true;
    v.currentTime = Math.max(0, v.duration - 0.3);
    return v.play();
  });
}

test('top-level: the lesson opens, and finishing it saves "completed" to the gradebook', async ({ page, context, baseURL }) => {
  test.skip(!enabled, 'Start the server with FIDEL_LTI_ENABLED=true to run this.');
  test.skip(!lessonId, 'Needs a published lesson.');
  await fakePlatform(context, SAME_SITE);
  await page.goto(loginUrl(baseURL, SAME_SITE));
  await expect(page.getByRole('heading', { level: 1, name: lessonTitle })).toBeVisible();
  await expect(page.getByText(`Opened from E2E platform ${SAME_SITE}.`)).toBeVisible();
  await expect(page.locator('fidel-player .fidel-panel')).toBeVisible({ timeout: 20_000 });
  expect(await axeIssues(page)).toEqual([]);
  for (const zoom of [{ width: 640, height: 400 }, { width: 320, height: 200 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(zoom); // 200%, 400%, then back to 100%
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }

  scores.length = 0;
  await watchToTheEnd(page);
  await expect(page.locator('#lti-result')).toContainText('Saved to your course: lesson completed.', { timeout: 20_000 });
  await expect(page.locator('#lti-result')).toHaveAttribute('role', 'status');
  expect(scores).toHaveLength(1);
  expect(scores[0].url).toBe('/lineitems/7/lineitem/scores?type_id=1');
  expect(scores[0].type).toBe('application/vnd.ims.lis.v1.score+json');
  expect(scores[0].score).toMatchObject({ userId: 'e2e-learner', scoreGiven: 100, scoreMaximum: 100,
    activityProgress: 'Completed', gradingProgress: 'FullyGraded' });
});

test('the gradebook is down: "Try again" (by keyboard) saves it when it is back', async ({ page, context, baseURL }) => {
  test.skip(!enabled, 'Start the server with FIDEL_LTI_ENABLED=true to run this.');
  test.skip(!lessonId, 'Needs a published lesson.');
  await fakePlatform(context, SAME_SITE);
  await page.goto(loginUrl(baseURL, SAME_SITE));
  await expect(page.locator('fidel-player .fidel-panel')).toBeVisible({ timeout: 20_000 });
  scores.length = 0;
  scoreAnswers.push(500);
  await watchToTheEnd(page);
  await expect(page.locator('#lti-result')).toContainText('Not saved to your course yet', { timeout: 20_000 });
  const retry = page.getByRole('button', { name: /Try again/ });
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#lti-result')).toContainText('Saved to your course: lesson completed.');
  await expect(retry).toBeHidden();
  expect(scores).toHaveLength(1);
});

test('"Mark as complete" (by keyboard) also saves "completed"', async ({ page, context, baseURL }) => {
  test.skip(!enabled, 'Start the server with FIDEL_LTI_ENABLED=true to run this.');
  test.skip(!lessonId, 'Needs a published lesson.');
  await fakePlatform(context, SAME_SITE);
  await page.goto(loginUrl(baseURL, SAME_SITE));
  await expect(page.getByText(/or press "Mark as complete"/)).toBeVisible();
  const button = page.getByRole('button', { name: 'Mark as complete' });
  await expect(button).toBeVisible({ timeout: 20_000 });
  scores.length = 0;
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#lti-result')).toContainText('Saved to your course: lesson completed.', { timeout: 20_000 });
  expect(scores).toHaveLength(1);
  expect(scores[0].score.activityProgress).toBe('Completed');
});

test('a teacher picks a lesson by keyboard only, and it goes back to the course signed', async ({ page, context, baseURL }) => {
  test.skip(!enabled, 'Start the server with FIDEL_LTI_ENABLED=true to run this.');
  test.skip(!lessonId, 'Needs a published lesson.');
  await fakePlatform(context, SAME_SITE);
  received.length = 0;
  await page.goto(loginUrl(baseURL, SAME_SITE, { target_link_uri: `${baseURL}/lti/deep-link` }));
  await expect(page.getByRole('heading', { level: 1, name: /Choose a Fidel lesson/ })).toBeVisible();
  expect(await axeIssues(page)).toEqual([]);
  for (const zoom of [{ width: 640, height: 400 }, { width: 320, height: 200 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(zoom);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }

  // Tab to the search box, type part of the title: the list narrows and the count is said.
  await page.keyboard.press('Tab');
  const search = page.getByRole('searchbox', { name: 'Search lessons' });
  await expect(search).toBeFocused();
  await page.keyboard.type(lessonTitle.slice(0, 12));
  await page.keyboard.press('Enter'); // Enter must not add anything yet
  await expect(page.getByRole('status').filter({ hasText: /lessons shown/ })).toBeVisible();
  // Tab into the list, choose with Space, Tab to "Add to course", Enter.
  await page.keyboard.press('Tab');
  const radio = page.getByRole('radio', { name: new RegExp(lessonTitle.slice(0, 12)) }).first();
  await expect(radio).toBeFocused();
  await page.keyboard.press('Space');
  await expect(radio).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Add to course' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Activity added' })).toBeVisible();
  expect(received).toHaveLength(1);
  const answer = JSON.parse(Buffer.from(received[0].split('.')[1], 'base64url').toString());
  expect(answer['https://purl.imsglobal.org/spec/lti/claim/message_type']).toBe('LtiDeepLinkingResponse');
  expect(answer['https://purl.imsglobal.org/spec/lti-dl/claim/data']).toBe('e2e-data');
  const [item] = answer['https://purl.imsglobal.org/spec/lti-dl/claim/content_items'];
  expect(item).toMatchObject({ type: 'ltiResourceLink', url: `${baseURL}/lti/launch`, custom: { lesson_id: lessonId } });
});

test('the picker: nothing is added without a choice, and Cancel goes back with nothing', async ({ page, context, baseURL }) => {
  test.skip(!enabled, 'Start the server with FIDEL_LTI_ENABLED=true to run this.');
  test.skip(!lessonId, 'Needs a published lesson.');
  await fakePlatform(context, SAME_SITE);
  await page.goto(loginUrl(baseURL, SAME_SITE, { target_link_uri: `${baseURL}/lti/deep-link` }));
  // The browser's own required-field check stops "Add" with nothing chosen (the
  // server's own message, "Choose a lesson first.", is checked in pytest).
  received.length = 0;
  await page.getByRole('button', { name: 'Add to course' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Choose a Fidel lesson/ })).toBeVisible();
  expect(received).toHaveLength(0);
  // Cancel goes back to the course with nothing added.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'Activity added' })).toBeVisible();
  const answer = JSON.parse(Buffer.from(received[0].split('.')[1], 'base64url').toString());
  expect(answer['https://purl.imsglobal.org/spec/lti-dl/claim/content_items']).toEqual([]);
});

test('inside a course page that blocks the cookie: the platform\'s storage is used', async ({ page, context, baseURL }) => {
  test.skip(!enabled, 'Start the server with FIDEL_LTI_ENABLED=true to run this.');
  test.skip(!lessonId, 'Needs a published lesson.');
  await fakePlatform(context, OTHER_SITE);
  const login = loginUrl(baseURL, OTHER_SITE, { lti_storage_target: '_parent' });
  await page.goto(`${OTHER_SITE}/course?login=${encodeURIComponent(login)}`);
  const frame = page.frameLocator('iframe[title="Fidel lesson"]');
  await expect(frame.getByText(`Opened from E2E platform ${OTHER_SITE}.`)).toBeVisible({ timeout: 15_000 });
  await expect(frame.locator('fidel-player')).toHaveAttribute('lesson', `/api/v1/lessons/${lessonId}`);
});

test('inside a course page that blocks the cookie, with no platform storage: "Open in a new window"', async ({ page, context, baseURL }) => {
  test.skip(!enabled, 'Start the server with FIDEL_LTI_ENABLED=true to run this.');
  await fakePlatform(context, OTHER_SITE);
  const login = loginUrl(baseURL, OTHER_SITE);
  await page.goto(`${OTHER_SITE}/course?login=${encodeURIComponent(login)}`);
  const frame = page.frameLocator('iframe[title="Fidel lesson"]');
  await expect(frame.getByRole('alert')).toContainText('Open the lesson in a new window');
  const link = frame.getByRole('link', { name: /Open in a new window/ });
  await expect(link).toHaveAttribute('target', '_blank');
  expect(new URL(await link.getAttribute('href')).searchParams.get('iss')).toBe(OTHER_SITE);
});

test('a refused launch says why in words, in English and Amharic', async ({ page, context, baseURL }) => {
  test.skip(!enabled, 'Start the server with FIDEL_LTI_ENABLED=true to run this.');
  await fakePlatform(context, SAME_SITE, { lesson: '000000000000' });
  await page.goto(loginUrl(baseURL, SAME_SITE));
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('does not say which Fidel lesson to open');
  await expect(alert.locator('[lang="am"]')).toBeVisible();
  await expect(page.locator('code')).toContainText('no_lesson');
  expect(await axeIssues(page)).toEqual([]);
  for (const zoom of [{ width: 640, height: 400 }, { width: 320, height: 200 }]) {
    await page.setViewportSize(zoom);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});
