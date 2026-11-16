// LTI 1.3 against a real Moodle (phase 5). Skipped unless MOODLE_URL is set.
//
//   docker compose -f docker-compose.lti-test.yml up -d && sh scripts/moodle-test-setup.sh
//   docker compose run -d --rm -e FIDEL_LTI_ENABLED=true -e FIDEL_PUBLIC_URL=http://host.docker.internal:8011 \
//     -p 8011:8000 --name fidel-lti-server server
//   cd e2e && MOODLE_URL=http://host.docker.internal:8081 FIDEL_BASE_URL=http://host.docker.internal:8011 \
//     npx playwright test tests/moodle.spec.js
//
// The browser maps host.docker.internal to this computer (Windows' own entry
// for it can be out of date), so the same addresses work in the browser and in
// both containers, as LTI needs.
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

const MOODLE = process.env.MOODLE_URL;
test.skip(!MOODLE, 'Set MOODLE_URL to run the real Moodle test.');
test.describe.configure({ mode: 'serial' });
test.use({ launchOptions: { args: ['--host-resolver-rules=MAP host.docker.internal 127.0.0.1'] } });
test.setTimeout(180_000);

function staffToken() {
  if (process.env.FIDEL_STAFF_TOKEN) return process.env.FIDEL_STAFF_TOKEN;
  if (!existsSync('../.env')) return '';
  const line = readFileSync('../.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('FIDEL_STAFF_TOKEN='));
  return line ? line.split('=', 2)[1].trim() : '';
}
const STAFF = { Authorization: `Bearer ${staffToken()}` };
// The test's own API calls (from Node, not the browser) go to localhost: Windows'
// entry for host.docker.internal can be out of date.
const API = (process.env.FIDEL_BASE_URL || '').replace('host.docker.internal', 'localhost');

/** One SQL query in the test Moodle's database; rows as arrays of strings. */
function sql(query) {
  query = query.replace(/\s+/g, ' ');
  const out = execSync(`docker compose -f docker-compose.lti-test.yml exec -T moodle-db mariadb -N -B -u bn_moodle bitnami_moodle -e "${query}"`,
    { cwd: '..', encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
  return out.trim().split('\n').filter(Boolean).map((line) => line.split('\t'));
}

// This test Moodle sometimes refuses a correct login ("Invalid login": its
// login token did not survive); a second try works, as it would for a person.
async function logIn(page, username, password) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${MOODLE}/login/index.php`);
    await page.waitForLoadState('networkidle');
    await page.fill('#username', username);
    await page.fill('#password', password);
    await Promise.all([page.waitForNavigation(), page.click('#loginbtn')]);
    if (!/login\/index\.php/.test(page.url())) return;
  }
  throw new Error(`Moodle refused the login for ${username} three times`);
}

const TOOL = `Fidel ${Date.now()}`;
let typeId;
let platformId;
let courseModule;

test.afterAll(async ({ request }) => {
  if (platformId) await request.delete(`${API}/api/v1/lti/platforms/${platformId}`, { headers: STAFF });
});

test('1. an admin registers Fidel in Moodle, with the README\'s values', async ({ page, baseURL }) => {
  await logIn(page, 'admin', 'Admin-1234!');
  await page.goto(`${MOODLE}/mod/lti/toolconfigure.php`);
  await page.goto(await page.locator('a', { hasText: 'configure a tool manually' }).getAttribute('href'));
  await page.locator('[name=lti_typename]').fill(TOOL);
  await page.locator('[name=lti_toolurl]').fill(`${baseURL}/lti/launch`);
  await page.locator('[name=lti_ltiversion]').selectOption('1.3.0');
  await page.locator('[name=lti_keytype]').selectOption('JWK_KEYSET');
  await page.locator('[name=lti_publickeyset]').fill(`${baseURL}/lti/jwks`);
  await page.locator('[name=lti_initiatelogin]').fill(`${baseURL}/lti/login`);
  await page.locator('[name=lti_redirectionuris]').fill(`${baseURL}/lti/launch\n${baseURL}/lti/deep-link`);
  await page.locator('[name=lti_coursevisible]').selectOption('2');
  await page.locator('[name=lti_launchcontainer]').selectOption('3');
  await page.locator('#id_lti_contentitem').check();
  await page.locator('[name=lti_toolurl_ContentItemSelectionRequest]').fill(`${baseURL}/lti/deep-link`);
  // By field name: Moodle's help icons carry the same labels. Some sections are collapsed.
  await page.locator('.collapseexpand').first().click(); // "Expand all"
  await page.locator('select[name=ltiservice_gradesynchronization]').selectOption('1');
  await page.locator('select[name=lti_sendname]').selectOption('0');
  await page.locator('select[name=lti_sendemailaddr]').selectOption('0');
  await page.locator('select[name=lti_acceptgrades]').selectOption('2');
  await page.locator('#id_submitbutton').click();
  await page.waitForLoadState();

  const [[id, clientId]] = sql(`SELECT id, clientid FROM mdl_lti_types WHERE name = '${TOOL}'`);
  typeId = id;
  // Fidel's side: Studio's "Add a platform" with what "View configuration details" shows.
  const response = await page.request.post(`${API}/api/v1/lti/platforms`, {
    headers: STAFF,
    data: {
      name: 'Test Moodle', issuer: MOODLE, client_id: clientId, deployment_ids: [typeId],
      auth_login_url: `${MOODLE}/mod/lti/auth.php`, auth_token_url: `${MOODLE}/mod/lti/token.php`,
      key_set_url: `${MOODLE}/mod/lti/certs.php`,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  platformId = (await response.json()).id;
});

test('2. a teacher adds a Fidel lesson with the picker', async ({ page }) => {
  await logIn(page, 'admin', 'Admin-1234!');
  const [[courseId]] = sql("SELECT id FROM mdl_course WHERE shortname = 'fidel-lti'");
  await page.goto(`${MOODLE}/course/modedit.php?add=lti&typeid=${typeId}&course=${courseId}&section=0&return=0`);
  await page.locator('#id_selectcontent').click();
  const picker = page.frameLocator('iframe[src*="contentitem"], .modal iframe').first();
  await expect(picker.getByRole('heading', { level: 1, name: /Choose a Fidel lesson/ })).toBeVisible({ timeout: 30_000 });
  await picker.getByRole('radio').first().check();
  await picker.getByRole('button', { name: 'Add to course' }).click();
  // Moodle fills its form from Fidel's signed answer and closes the dialog.
  await expect(page.locator('#id_name')).not.toHaveValue('', { timeout: 30_000 });
  await page.locator('#id_submitbutton').click(); // Save and display
  await page.waitForLoadState();
  courseModule = new URL(page.url()).searchParams.get('id');
  expect(courseModule).toBeTruthy();
});

test('3. a student opens it inside the course, marks it complete, and Moodle\'s gradebook shows 100', async ({ page }) => {
  await logIn(page, 'student1', 'Student-1234!');
  await page.goto(`${MOODLE}/mod/lti/view.php?id=${courseModule}`);
  const lesson = page.frameLocator('#contentframe');
  await expect(lesson.getByText(/Opened from Test Moodle/)).toBeVisible({ timeout: 30_000 });
  await expect(lesson.locator('fidel-player .fidel-panel')).toBeVisible({ timeout: 30_000 });
  const mark = lesson.getByRole('button', { name: 'Mark as complete' });
  await mark.focus();
  await page.keyboard.press('Enter');
  await expect(lesson.locator('#lti-result')).toContainText('Saved to your course: lesson completed.', { timeout: 30_000 });

  const rows = sql(`SELECT g.finalgrade, gi.grademax FROM mdl_grade_grades g JOIN mdl_grade_items gi ON gi.id = g.itemid
    JOIN mdl_user u ON u.id = g.userid WHERE gi.itemmodule = 'lti' AND u.username = 'student1' ORDER BY g.id DESC LIMIT 1`);
  expect(rows.length).toBe(1);
  expect(Number(rows[0][0])).toBe(Number(rows[0][1])); // full marks: completed
});
