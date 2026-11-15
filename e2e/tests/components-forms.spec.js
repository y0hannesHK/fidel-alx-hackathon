// Fidel form components on demo/inputs.html and the forms section of
// demo/components.html: axe at 100/200/400% zoom in English and Amharic with
// errors and hints showing, no sideways scrolling at 320 px, labels, errors
// in words, the error summary, drafts (never the sensitive field), offline
// sending, the keyboard-language hint, Caps Lock, Listen, the Amharic
// keyboard writing into a <fidel-textarea>, file, select and date.
import { readFileSync, existsSync } from 'node:fs';
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
const VIDEO = '../data/demo/sign.webm';

const ZOOMS = [
  { name: '100%', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  { name: '200%', viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 },
  { name: '400%', viewport: { width: 320, height: 200 }, deviceScaleFactor: 4 },
];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const INPUTS = '/demo/inputs.html';

async function seriousAxeIssues(page, include) {
  let builder = new AxeBuilder({ page }).withTags(TAGS);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  return results.violations
    .filter((v) => ['critical', 'serious'].includes(v.impact))
    .map((v) => `${v.impact} ${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

async function expectNoSidewaysScroll(page) {
  const { pixels, outermost } = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const over = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > width + 1);
    const out = over.filter((e) => !over.includes(e.parentElement)).slice(0, 5)
      .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} (${Math.round(e.getBoundingClientRect().right - width)} px)`);
    return { pixels: document.documentElement.scrollWidth - width, outermost: out };
  });
  expect(pixels, `sideways scrolling; sticking out: ${outermost.join(', ')}`).toBeLessThanOrEqual(1);
}

async function openInputs(page) {
  await page.goto(INPUTS);
  await expect(page.locator('#caption-start input')).toBeVisible({ timeout: 20_000 });
}

/** The text of both live regions of the shared announcer. */
const announced = (page) => page.evaluate(() => [...document.querySelectorAll('.fidel-announcer')].map((e) => e.textContent).join(' | '));

const job = (page) => page.locator('#job-application');
const caption = (page) => page.locator('#caption-correction');

/** Show errors and hints everywhere: empty submit of both forms, a hint, a chosen date. */
async function showMessages(page) {
  await page.getByRole('button', { name: 'ማመልከቻውን ላክ' }).click();
  await page.getByRole('button', { name: 'Save the correction' }).click();
  await caption(page).getByRole('textbox', { name: 'Start' }).fill('abc');
  await caption(page).getByRole('textbox', { name: 'Start' }).press('Tab');
  await job(page).getByRole('textbox', { name: 'ሙሉ ስም' }).fill('selam ');
  await job(page).getByLabel('መጀመር የሚችሉበት ቀን').fill('2026-12-01');
  await expect(page.locator('#job-name .fidel-field-keyboard')).toBeVisible();
  await expect(job(page).locator('fidel-ethiopian-date time')).toBeVisible();
}

for (const zoom of ZOOMS) {
  test.describe(`forms at ${zoom.name} zoom`, () => {
    for (const lang of ['own', 'en', 'am']) {
      test(`inputs page (messages: ${lang}): axe clean and no sideways scrolling, with errors and hints showing`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });
        const page = await context.newPage();
        await openInputs(page);
        if (lang !== 'own') await page.locator('#message-language').getByRole('radio').nth(lang === 'en' ? 1 : 2).check();
        await showMessages(page);
        await page.waitForTimeout(300);
        expect(await seriousAxeIssues(page)).toEqual([]);
        await expectNoSidewaysScroll(page);
        await context.close();
      });
    }

    test('components page forms section: axe clean, with errors showing', async ({ browser }) => {
      const context = await browser.newContext({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });
      const page = await context.newPage();
      await page.goto('/demo/components.html');
      const section = page.locator('#package-forms');
      await section.getByRole('button', { name: 'Send' }).click();
      await expect(section.getByRole('heading', { name: '2 fields need fixing' })).toBeFocused();
      await section.getByRole('textbox', { name: 'Your name in Amharic' }).fill('hello ');
      await expect(section.locator('#forms-name-am .fidel-field-keyboard')).toBeVisible();
      expect(await seriousAxeIssues(page, '#package-forms')).toEqual([]);
      await expectNoSidewaysScroll(page);
      await context.close();
    });
  });
}

test('every field is found by its role and name', async ({ page }) => {
  await openInputs(page);
  const j = job(page);
  for (const name of ['ሙሉ ስም', 'ስልክ ቁጥር', 'ኢሜይል', 'ስለ ራስዎ ይንገሩን']) await expect(j.getByRole('textbox', { name })).toBeVisible();
  await expect(j.getByRole('combobox', { name: 'የሚኖሩበት ክልል' })).toBeVisible();
  await expect(j.getByRole('searchbox', { name: /ዝርዝሩን ፈልግ/ })).toBeVisible();
  await expect(j.getByRole('group', { name: /በቃለ መጠይቁ ላይ የሚያስፈልገኝ ድጋፍ/ })).toBeVisible();
  await expect(j.getByRole('checkbox', { name: 'ተጨማሪ ጊዜ' })).toBeVisible();
  await expect(j.getByLabel('መጀመር የሚችሉበት ቀን')).toHaveAttribute('type', 'date');
  await expect(j.getByLabel('የሥራ ልምድ ማስረጃ (CV)')).toHaveAttribute('type', 'file');
  const c = caption(page);
  for (const name of ['Start', 'End', 'English text', 'Amharic text']) await expect(c.getByRole('textbox', { name })).toBeVisible();
  await expect(page.getByRole('radiogroup').or(page.getByRole('group', { name: /Typing voice/ })).first()).toBeVisible();
});

test('abc in Start + Tab: error in words, aria-invalid, described, announced; fixed says "Fixed"', async ({ page }) => {
  await openInputs(page);
  const start = caption(page).getByRole('textbox', { name: 'Start' });
  await start.fill('1:');
  await expect(start).not.toHaveAttribute('aria-invalid', 'true'); // never while typing
  await start.fill('abc');
  await start.press('Tab');
  await expect(start).toHaveAttribute('aria-invalid', 'true');
  const error = page.locator('#caption-start-field-error');
  await expect(error).toBeVisible();
  await expect(error).toHaveText('⚠ Use minutes:seconds, for example 1:23.5');
  expect((await start.getAttribute('aria-describedby')).split(' ')).toContain('caption-start-field-error');
  await expect.poll(() => announced(page)).toContain('Start: Use minutes:seconds, for example 1:23.5');
  await start.fill('1:23.5');
  await expect(start).not.toHaveAttribute('aria-invalid', 'true');
  await expect(error).toBeHidden();
  await expect.poll(() => announced(page)).toContain('Fixed');
});

test('phone numbers are tidied and wrong ones explained', async ({ page }) => {
  await openInputs(page);
  const phone = job(page).getByRole('textbox', { name: 'ስልክ ቁጥር' });
  await phone.fill('0911 234567');
  await phone.press('Tab');
  await expect(phone).toHaveValue('+251911234567');
  await phone.fill('12345');
  await phone.press('Tab');
  await expect(job(page).locator('#job-phone .fidel-field-error')).toHaveText('⚠ የኢትዮጵያ ሞባይል ቁጥር ይጻፉ፤ ለምሳሌ 0911 234567');
});

test('empty submit: the summary gets focus, its links put you in each field, nothing typed is lost', async ({ page }) => {
  await openInputs(page);
  const c = caption(page);
  await c.getByRole('textbox', { name: 'Amharic text' }).fill('ሰላም');
  await page.getByRole('button', { name: 'Save the correction' }).click();
  const heading = c.getByRole('heading', { name: '3 fields need fixing' });
  await expect(heading).toBeFocused();
  await c.getByRole('link', { name: 'End: Fill in this field.' }).click();
  await expect(c.getByRole('textbox', { name: 'End' })).toBeFocused();
  await expect(c.getByRole('textbox', { name: 'Amharic text' })).toHaveValue('ሰላም');
  await expect(page.locator('#caption-received')).toHaveText('');
  // Fixing a field removes its link.
  await c.getByRole('textbox', { name: 'End' }).fill('1:27');
  await expect(c.getByRole('heading', { name: '2 fields need fixing' })).toBeVisible();
  // The Amharic form says it in Amharic, and its radio-free checkbox group is optional.
  await page.getByRole('button', { name: 'ማመልከቻውን ላክ' }).click();
  await expect(job(page).getByRole('heading', { name: '2 ቦታዎች መስተካከል አለባቸው' })).toBeFocused();
  await job(page).getByRole('link', { name: /ስልክ ቁጥር/ }).click();
  await expect(job(page).getByRole('textbox', { name: 'ስልክ ቁጥር' })).toBeFocused();
});

test('a valid form is sent once, success is said in words', async ({ page }) => {
  await openInputs(page);
  const c = caption(page);
  let events = 0;
  await page.exposeFunction('countSubmit', () => { events += 1; });
  await page.evaluate(() => document.addEventListener('fidel-form-submit', () => window.countSubmit()));
  await c.getByRole('textbox', { name: 'Start' }).fill('1:23.5');
  await c.getByRole('textbox', { name: 'End' }).fill('1:27');
  await c.getByRole('textbox', { name: 'English text' }).fill('Welcome to the lesson.');
  await page.getByRole('button', { name: 'Save the correction' }).click();
  await expect(c.locator('.fidel-form-status')).toHaveText('Sent. Thank you.');
  await expect(page.locator('#caption-received')).toContainText('"start":"1:23.5"');
  await expect.poll(() => announced(page)).toContain('Sent. Thank you.');
  expect(events).toBe(1);
  await expect(c.getByRole('textbox', { name: 'Start' })).toHaveValue(''); // emptied after sending
});

test('reload keeps the draft, except the sensitive field', async ({ page }) => {
  await openInputs(page);
  const j = job(page);
  await j.getByRole('textbox', { name: 'ሙሉ ስም' }).fill('ሙከራ ስም');
  await j.getByRole('textbox', { name: 'ስልክ ቁጥር' }).fill('0911234567');
  await j.getByRole('combobox', { name: 'የሚኖሩበት ክልል' }).selectOption('sidama');
  await j.getByRole('checkbox', { name: 'ተጨማሪ ጊዜ' }).check();
  await expect(j.locator('.fidel-form-status')).toHaveText('ረቂቁ ተቀምጧል');
  const stored = await page.evaluate(() => localStorage.getItem('fidel-form-draft:job-application'));
  expect(stored).toContain('ሙከራ ስም');
  expect(stored).not.toContain('support');
  await page.reload();
  await expect(j.getByRole('textbox', { name: 'ሙሉ ስም' })).toHaveValue('ሙከራ ስም');
  await expect(j.getByRole('textbox', { name: 'ስልክ ቁጥር' })).toHaveValue('+251911234567'); // tidied when it was left
  await expect(j.getByRole('combobox', { name: 'የሚኖሩበት ክልል' })).toHaveValue('sidama');
  await expect(j.getByRole('checkbox', { name: 'ተጨማሪ ጊዜ' })).not.toBeChecked();
  await expect(j.locator('.fidel-form-status')).toHaveText('ረቂቅዎ ተመልሷል።');
  await j.getByRole('button', { name: 'ረቂቁን አጥፋ' }).click();
  await expect(j.getByRole('textbox', { name: 'ሙሉ ስም' })).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('fidel-form-draft:job-application'))).toBeNull();
});

test('offline at submit: saved on this phone, sent when back online', async ({ page, context }) => {
  await openInputs(page);
  const c = caption(page);
  await c.getByRole('textbox', { name: 'Start' }).fill('0:05');
  await c.getByRole('textbox', { name: 'End' }).fill('0:09');
  await c.getByRole('textbox', { name: 'English text' }).fill('Offline test.');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Save the correction' }).click();
  await expect(c.locator('.fidel-form-status')).toHaveText('Saved on this phone. It will be sent when you are online.');
  expect(await page.evaluate(() => localStorage.getItem('fidel-form-outbox:caption-correction'))).toContain('Offline test.');
  await expect(page.locator('#caption-received')).toHaveText('');
  await context.setOffline(false);
  await expect(c.locator('.fidel-form-status')).toHaveText('Your saved form was sent.');
  await expect(page.locator('#caption-received')).toContainText('Offline test.');
  expect(await page.evaluate(() => localStorage.getItem('fidel-form-outbox:caption-correction'))).toBeNull();
});

test('keyboard-language hint: for "hello " in an Amharic field, not for "ሰላም HTML "', async ({ page }) => {
  await openInputs(page);
  const name = job(page).getByRole('textbox', { name: 'ሙሉ ስም' });
  const hint = page.locator('#job-name .fidel-field-keyboard');
  await name.pressSequentially('ሰላም HTML ');
  await expect(hint).toBeHidden();
  await name.fill('');
  await name.pressSequentially('hello ');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('Windows + Space');
  expect((await name.getAttribute('aria-describedby')).split(' ')).toContain('job-name-field-kb');
  await expect.poll(() => announced(page)).toContain('Windows + Space');
  await name.pressSequentially('ሰ');
  await expect(hint).toBeHidden();
  // Mirror hint in an English field; "Don't remind me" hides it for this field.
  const english = caption(page).getByRole('textbox', { name: 'English text' });
  await english.fill('ሰላም ');
  const enHint = page.locator('#caption-en .fidel-field-keyboard');
  await expect(enHint).toContainText('To type English');
  await enHint.getByRole('button', { name: "Don't remind me in this field" }).click();
  await expect(enHint).toBeHidden();
  await expect(english).toBeFocused();
  expect(await page.evaluate(() => sessionStorage.getItem('fidel-field-no-keyboard-hint:textEn'))).toBe('1');
});

test('Caps Lock: shown and said only when it changes, and not in Amharic fields', async ({ page }) => {
  await openInputs(page);
  const caps = (selector, on) => page.locator(selector).evaluate((input, on) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true, modifierCapsLock: on }));
  }, on);
  await caps('#caption-en textarea', true);
  const message = page.locator('#caption-en .fidel-field-caps');
  await expect(message).toHaveText('Caps Lock is on');
  await expect.poll(() => announced(page)).toContain('Caps Lock is on');
  await caps('#caption-en textarea', false);
  await expect(message).toBeHidden();
  await expect.poll(() => announced(page)).toContain('Caps Lock is off');
  await caps('#caption-am textarea', true);
  await expect(page.locator('#caption-am .fidel-field-caps')).toBeHidden();
});

test('Listen reads the field in its language, Escape stops it; no voice means no button', async ({ page }) => {
  // A fake English browser voice (headless browsers have none); no Amharic voice.
  await page.addInitScript(() => {
    const spoken = [];
    let current = null;
    window.spoken = spoken;
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    const synth = {
      getVoices: () => [{ lang: 'en-US', name: 'Fake English' }],
      speak(u) { current = u; spoken.push({ text: u.text, lang: u.lang }); },
      cancel() { const u = current; current = null; u?.onend?.(); },
      addEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  });
  await openInputs(page);
  const c = caption(page);
  const listen = c.getByRole('button', { name: /^Listen\s*: English text$/ });
  await listen.click();
  await expect(c.locator('#caption-en .fidel-field-status')).toHaveText('The field is empty');
  await c.getByRole('textbox', { name: 'English text' }).fill('Hello there');
  await listen.click();
  await expect(c.getByRole('button', { name: /^Stop\s*: English text$/ })).toBeVisible();
  expect(await page.evaluate(() => window.spoken)).toEqual([{ text: 'Hello there', lang: 'en-US' }]);
  await page.keyboard.press('Escape');
  await expect(c.getByRole('button', { name: /^Listen\s*: English text$/ })).toBeVisible();
  await expect(c.locator('#caption-en .fidel-field-voice')).toHaveText('Computer voice');
  // Amharic: no browser voice and the server has no voice engine -> no button.
  await expect(page.locator('#caption-am .fidel-field-buttons')).toBeHidden();
  await expect(page.locator('#job-about .fidel-field-buttons button')).toHaveCount(0);
});

test('the speak endpoint says in words that there is no voice engine', async ({ request }) => {
  expect(await (await request.get('/api/v1/speak')).json()).toEqual({ languages: [] });
  const answer = await request.post('/api/v1/speak', { data: { text: 'ሰላም', lang: 'am' } });
  expect(answer.status()).toBe(409);
  expect((await answer.json()).detail).toContain('No voice engine');
});

test('typing voice says finished words when chosen, and nothing by default', async ({ page }) => {
  await page.addInitScript(() => {
    window.spoken = [];
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { getVoices: () => [{ lang: 'en-GB', name: 'Fake' }], speak(u) { window.spoken.push(u.text); }, cancel() {}, addEventListener() {} },
    });
  });
  await openInputs(page);
  const english = caption(page).getByRole('textbox', { name: 'English text' });
  await english.pressSequentially('one two ');
  expect(await page.evaluate(() => window.spoken)).toEqual([]);
  await page.locator('#typing-voice').getByRole('radio', { name: 'Words' }).check();
  await english.pressSequentially('three four ');
  expect(await page.evaluate(() => window.spoken)).toEqual(['three', 'four']);
  await page.locator('#typing-voice').getByRole('radio', { name: 'Off' }).check();
});

test('the Amharic keyboard writes into a <fidel-textarea> and its input event fires', async ({ page }) => {
  await openInputs(page);
  const c = caption(page);
  await c.getByRole('button', { name: 'Show Amharic keyboard' }).click();
  await c.locator('fidel-amharic-keyboard button[data-char="ለ"]').click();
  await c.locator('fidel-amharic-keyboard button[data-char="ሉ"]').click();
  await expect(c.getByRole('textbox', { name: 'Amharic text' })).toHaveValue('ሉ');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('fidel-form-draft:caption-correction'))).toContain('ሉ');
});

test('file: type and size in words, chosen file shown, wrong file refused, Remove', async ({ page }) => {
  await openInputs(page);
  const field = page.locator('#job-cv');
  await expect(field.locator('.fidel-field-hint')).toHaveText('PDF ወይም የWord ሰነድ፣ እስከ 5 MB');
  const input = field.locator('input[type=file]');
  await input.setInputFiles({ name: 'run.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('x') });
  await expect(field.locator('.fidel-field-error')).toHaveText('⚠ ይህ .exe ፋይል ነው። ይምረጡ፦ PDF ወይም የWord ሰነድ።');
  await input.setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(6_000_000) });
  await expect(field.locator('.fidel-field-error')).toHaveText('⚠ ይህ ፋይል 6 MB ነው። እስከ 5 MB የሆነ ፋይል ይምረጡ።');
  await input.setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(1_200_000) });
  await expect(field.locator('.fidel-field-error')).toBeHidden();
  await expect(field.locator('.fidel-field-chosen')).toHaveText('የተመረጠ፦ cv.pdf፣ 1.2 MB');
  await expect.poll(() => announced(page)).toContain('cv.pdf');
  await field.getByRole('button', { name: /አስወግድ/ }).click();
  await expect(field.locator('.fidel-field-chosen')).toBeHidden();
  await expect(input).toBeFocused();
});

test('select: "Search the list" keeps matching options and says how many', async ({ page }) => {
  await openInputs(page);
  const j = job(page);
  await j.getByRole('searchbox', { name: /ዝርዝሩን ፈልግ/ }).fill('ኢትዮጵያ');
  await expect(page.locator('#job-region .fidel-field-count')).toHaveText('3 አማራጮች ተገኝተዋል');
  await expect(j.getByRole('combobox', { name: 'የሚኖሩበት ክልል' }).locator('option')).toHaveCount(4); // + "Choose…"
  await j.getByRole('searchbox', { name: /ዝርዝሩን ፈልግ/ }).fill('');
  await expect(j.getByRole('combobox', { name: 'የሚኖሩበት ክልል' }).locator('option')).toHaveCount(15);
});

test('date: the Ethiopian calendar date under it, out-of-range explained', async ({ page }) => {
  await openInputs(page);
  const date = job(page).getByLabel('መጀመር የሚችሉበት ቀን');
  await date.fill('2026-12-01');
  const ethiopian = page.locator('#job-start .fidel-field-ethiopian');
  await expect(ethiopian).toContainText('በኢትዮጵያ አቆጣጠር፦');
  await expect(ethiopian.locator('time')).toHaveAttribute('datetime', '2026-12-01');
  expect((await date.getAttribute('aria-describedby')).split(' ')).toContain('job-start-field-ethiopian');
  await date.fill('2026-01-01');
  await date.blur(); // (Tab inside a date field moves between day, month and year)
  await expect(page.locator('#job-start .fidel-field-error')).toContainText('ወይም ከዚያ በኋላ ይምረጡ።');
});

test('messages switch language with ui-lang', async ({ page }) => {
  await openInputs(page);
  await page.getByRole('button', { name: 'ማመልከቻውን ላክ' }).click();
  await page.locator('#message-language').getByRole('radio', { name: 'English' }).check();
  await expect(job(page).getByRole('heading', { name: '2 fields need fixing' })).toBeVisible();
  await expect(page.locator('#job-name .fidel-field-error')).toHaveText('⚠ Fill in this field.');
  await page.locator('#message-language').getByRole('radio', { name: 'አማርኛ' }).check();
  await expect(caption(page).getByRole('button', { name: 'ረቂቁን አጥፋ' }).or(caption(page).locator('.fidel-field-required').first())).toBeVisible();
  await expect(caption(page).locator('#caption-start .fidel-field-required')).toHaveText('(ግዴታ)');
});

test('Tab moves through the inputs page and never gets stuck', async ({ page }) => {
  await openInputs(page);
  const seen = [];
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => {
      const el = document.activeElement;
      return el === document.body ? 'body' : `${el.tagName.toLowerCase()}#${el.id}:${el.name || ''}`;
    }));
  }
  const stuck = seen.some((s, i) => i >= 4 && seen.slice(i - 4, i + 1).every((x) => x === s));
  expect(stuck, seen.join(' > ')).toBe(false);
  expect(seen).toContain('input#job-name-field:fullName');
  expect(seen).toContain('textarea#caption-am-field:textAm');
});

test.describe('in Studio and the caption-report dialog', () => {
  test.skip(!TOKEN || !existsSync(VIDEO), 'Needs FIDEL_STAFF_TOKEN and data/demo/sign.webm.');
  let lessonId;

  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000);
    const upload = await request.post('/api/v1/lessons', {
      headers: STAFF,
      multipart: { title: 'Forms test lesson', spoken_language: 'en', video: { name: 'f.webm', mimeType: 'video/webm', buffer: readFileSync(VIDEO) } },
    });
    expect(upload.status()).toBe(201);
    lessonId = (await upload.json()).id;
    await expect.poll(async () => {
      const steps = await (await request.get(`/api/v1/lessons/${lessonId}/status`)).json();
      return Object.values(steps).every((s) => !['pending', 'running'].includes(s.status));
    }, { timeout: 120_000 }).toBe(true);
    for (const [lang, text] of [['en', 'Welcome to the lesson.'], ['am', 'እንኳን ወደ ትምህርቱ በደህና መጡ።']]) {
      const put = await request.put(`/api/v1/lessons/${lessonId}/captions/${lang}`, { headers: STAFF, data: { cues: [{ start: 0, end: 3, text }] } });
      expect(put.status(), await put.text()).toBe(200);
    }
    await request.post(`/api/v1/lessons/${lessonId}/publish`, { headers: STAFF, data: { published: true } });
  });

  test.afterAll(async ({ request }) => {
    if (lessonId) await request.delete(`/api/v1/lessons/${lessonId}`, { headers: STAFF });
  });

  test('caption editor: times explained in words, Amharic box hints the keyboard, Ctrl+Enter still checks', async ({ page }) => {
    await page.goto('/studio/');
    await page.getByLabel('Staff token').fill(TOKEN);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Lessons' })).toBeVisible();
    await page.goto(`/studio/#/lesson/${lessonId}`);
    const editor = page.locator('section', { has: page.getByRole('heading', { name: 'Captions' }) });
    const first = editor.getByRole('group', { name: /Caption 1/ });
    const start = first.getByRole('textbox', { name: 'Start' });
    await expect(start).toHaveValue('0:00.0');
    await start.fill('abc');
    await start.press('Tab');
    await expect(start).toHaveAttribute('aria-invalid', 'true');
    await expect(first.getByText('⚠ Use minutes:seconds, for example 1:23.5')).toBeVisible();
    await start.fill('0:00.0');
    await expect(start).not.toHaveAttribute('aria-invalid', 'true');
    const amharic = first.getByRole('textbox', { name: /Amharic/ });
    await expect(amharic).toHaveValue('እንኳን ወደ ትምህርቱ በደህና መጡ።');
    const describedBy = (await amharic.getAttribute('aria-describedby')).split(' ');
    expect(await first.locator('legend').getAttribute('id')).toBe(describedBy[0]);
    await amharic.fill('selam ');
    await expect(first.getByText(/To type Amharic, switch the keyboard/)).toBeVisible();
    await amharic.press('Control+Enter');
    await expect(editor.locator('.counter')).toContainText('All Amharic captions are checked.');
    await expect(editor.getByText('Keyboard: in a translation box, press Ctrl+Enter')).toBeVisible();
    expect(await seriousAxeIssues(page)).toEqual([]);
  });

  test('caption-report dialog: the correction box is a Fidel field with its hint', async ({ page }) => {
    await page.goto(`/demo/components.html?lesson=${lessonId}`);
    await expect(page.locator('#report-player .fidel-panel')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Report a caption problem' }).click();
    const dialog = page.getByRole('dialog', { name: 'Report a caption problem' });
    const correction = dialog.getByRole('textbox', { name: 'Your correction (optional)' });
    await expect(correction).toBeVisible();
    await dialog.getByLabel('Caption language').selectOption('am');
    await expect(correction).toHaveAttribute('lang', 'am');
    await correction.fill('hello ');
    await expect(dialog.getByText(/To type Amharic, switch the keyboard/)).toBeVisible();
    expect(await seriousAxeIssues(page, 'dialog[open]')).toEqual([]);
  });
});
