// LTI 1.3, phase 2: signing in from a learning platform, in a real browser.
// A fake platform (addresses intercepted by Playwright) starts the sign-in,
// signs the launch with its own key and posts it to Fidel. Fidel reads the
// platform's public key from a file under /media/ (data/demo/).
//
// Needs a server with FIDEL_LTI_ENABLED=true (skipped otherwise), e.g.
//   docker compose run -d --rm -e FIDEL_LTI_ENABLED=true -p 8011:8000 --name fidel-lti-test server
//   FIDEL_BASE_URL=http://localhost:8011 npx playwright test tests/lti-launch.spec.js
// and the staff token (FIDEL_STAFF_TOKEN or ../.env).
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync, sign } from 'node:crypto';
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
const platformIds = [];

test.beforeAll(async ({ request }) => {
  enabled = (await (await request.get('/api/v1/lti/tool', { headers: STAFF })).json()).enabled;
  if (!enabled) return;
  const lessons = await (await request.get('/api/v1/lessons')).json();
  lessonId = lessons[0]?.id;
  writeFileSync(`../data/demo/${KEY_FILE}`, JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }] }));
  for (const issuer of [SAME_SITE, OTHER_SITE]) {
    const response = await request.post('/api/v1/lti/platforms', {
      headers: STAFF,
      data: {
        name: `E2E platform ${issuer}`, issuer, client_id: 'e2e-client', deployment_ids: ['1'],
        auth_login_url: `${issuer}/auth`, auth_token_url: `${issuer}/token`,
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
});

/** The fake platform: its sign-in address answers with a signed launch, posted to Fidel. */
async function fakePlatform(context, issuer, { lesson = lessonId } = {}) {
  await context.route(`${issuer}/**`, async (route) => {
    const url = new URL(route.request().url());
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

test('top-level sign-in: login, the platform signs the launch, the lesson is offered', async ({ page, context, baseURL }) => {
  test.skip(!enabled, 'Start the server with FIDEL_LTI_ENABLED=true to run this.');
  test.skip(!lessonId, 'Needs a published lesson.');
  await fakePlatform(context, SAME_SITE);
  await page.goto(loginUrl(baseURL, SAME_SITE));
  await expect(page.getByRole('status')).toContainText(`Signed in through E2E platform ${SAME_SITE}.`);
  await expect(page.getByRole('link', { name: /Open the lesson/ })).toHaveAttribute('href', `/demo/savanna-mock/lesson.html?id=${lessonId}`);
  expect(await axeIssues(page)).toEqual([]);
});

test('inside a course page that blocks the cookie: the platform\'s storage is used', async ({ page, context, baseURL }) => {
  test.skip(!enabled, 'Start the server with FIDEL_LTI_ENABLED=true to run this.');
  test.skip(!lessonId, 'Needs a published lesson.');
  await fakePlatform(context, OTHER_SITE);
  const login = loginUrl(baseURL, OTHER_SITE, { lti_storage_target: '_parent' });
  await page.goto(`${OTHER_SITE}/course?login=${encodeURIComponent(login)}`);
  const frame = page.frameLocator('iframe[title="Fidel lesson"]');
  await expect(frame.getByRole('status')).toContainText(`Signed in through E2E platform ${OTHER_SITE}.`, { timeout: 15_000 });
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
