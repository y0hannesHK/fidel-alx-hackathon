// Keyboard-only tour of the main task (the hackathon gate), in a visible
// browser, for recording a screen-reader demo. It is NOT a test (npm test does
// not run it).
//
// How to use it (Windows):
//   1. Start a Fidel server (e.g. docker compose up -d) with a published job.
//   2. Turn on Narrator (Ctrl + Windows + Enter) and close its welcome window.
//   3. Start a screen recording with system sound (Windows + Shift + R).
//   4. From this folder:  node narrator-tour.mjs
//      Do not touch the keyboard or mouse until the window closes (~2.5 min).
// Narrator follows keyboard focus, so it reads every step. A banner at the
// bottom names each step for viewers; it is aria-hidden, so Narrator skips it.
//
// Options:  BASE=http://host:port   (default http://localhost:8000)
//           PAUSE=6000              (ms per step, for slower speech)
//           DRY=1                   (headless, fast: checks every step works)
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:8000';
const DRY = process.env.DRY === '1';
const PAUSE = DRY ? 150 : Number(process.env.PAUSE || 5000); // time for Narrator to speak

const browser = await chromium.launch({ headless: DRY, channel: DRY ? undefined : 'msedge', args: ['--start-maximized'] })
  .catch(() => chromium.launch({ headless: DRY, args: ['--start-maximized'] }));
const context = await browser.newContext({ viewport: null });
const page = await context.newPage();
const wait = (ms = PAUSE) => page.waitForTimeout(ms);

// A banner for the video only: aria-hidden, so Narrator never reads it.
async function banner(text) {
  console.log(`STEP: ${text}`);
  await page.evaluate((t) => {
    let b = document.getElementById('tour-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'tour-banner';
      b.setAttribute('aria-hidden', 'true');
      Object.assign(b.style, { position: 'fixed', insetInline: '0', bottom: '0', zIndex: '2147483647', padding: '12px 20px',
        background: '#1a1a6e', color: '#fff', font: '600 22px system-ui, sans-serif', pointerEvents: 'none' });
      document.documentElement.append(b);
    }
    b.textContent = t;
  }, text);
}

/** Move keyboard focus to an element the way Tab would, then press a key. */
async function go(locator, key, note) {
  await locator.scrollIntoViewIfNeeded();
  await locator.focus();
  await wait(PAUSE);
  if (key) { await page.keyboard.press(key); await wait(PAUSE); }
  if (note) console.log(`   ok: ${note}`);
}

try {
  // ---- Lesson page ----
  await page.goto(`${BASE}/demo/savanna-mock/`);
  await page.locator('fidel-player .fidel-panel').waitFor({ timeout: 20000 });
  await banner('Lesson page. Keyboard only, with a screen reader.');
  await wait(1500);
  await page.keyboard.press('Tab'); await wait();               // "Skip to lesson, link"
  await banner('Step 1: skip straight to the lesson');
  await page.keyboard.press('Enter'); await wait();

  const panel = page.locator('fidel-player .fidel-panel');
  await banner('Step 2: Amharic captions');
  await go(panel.getByRole('radio', { name: 'አማርኛ' }).first(), 'Space', 'Amharic captions chosen');

  await banner('Step 3: make the captions bigger');
  const larger = panel.getByRole('button', { name: /Larger captions/ });
  await go(larger, 'Enter');
  await page.keyboard.press('Enter'); await wait();

  await banner('Step 4: show the sign-language window');
  await go(panel.getByRole('button', { name: /Show sign language/ }), 'Enter', 'sign window on');

  await banner('Step 5: play the lesson (K or Space)');
  await go(page.locator('fidel-player .able-control-row').getByRole('button', { name: 'Play' }), 'Enter');
  await wait(PAUSE * 2);
  await page.keyboard.press('k'); await wait();

  await banner('Step 6: search the transcript');
  const search = page.getByRole('searchbox', { name: 'Search the transcript' });
  await go(search);
  await page.keyboard.type('ALX', { delay: DRY ? 0 : 150 });
  await page.keyboard.press('Enter'); await wait(PAUSE * 1.5);
  const result = page.locator('.fidel-result').first();
  await result.waitFor({ timeout: 15000 }).catch(() => {});
  if (await result.count()) await go(result, 'Enter', 'jumped to a search result');
  else console.log('   (no clickable search result found)');

  await banner('Step 7: download the transcript to read offline');
  let offline = page.getByRole('link', { name: /Download lesson for offline use/ }).first();
  if (!(await offline.count())) offline = page.getByRole('button', { name: 'Download the transcript as text (.txt)' });
  if (await offline.count()) await go(offline, null, `offline link: ${await offline.textContent()}`);
  else console.log('   (no offline link found)');

  // ---- Job card ----
  await page.goto(`${BASE}/demo/savanna-mock/jobs.html`);
  await page.locator('fidel-job-card article').first().waitFor({ timeout: 20000 });
  await banner('Step 8: a job card, read by the screen reader');
  await go(page.locator('fidel-job-card').getByRole('heading').first(), null);
  await banner('Step 9: listen to the job summary');
  await go(page.locator('fidel-job-card').getByRole('button', { name: /Listen to summary/ }).first(), 'Enter', 'summary playing');
  await wait(PAUSE * 2);
  await banner('Done: the whole task with the keyboard only.');
  await wait(PAUSE);
} catch (error) {
  console.log('FAILED:', error.message.split('\n')[0]);
}
await browser.close();
