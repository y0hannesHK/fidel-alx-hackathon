// Package C pure logic: session-keeper timing maths, settings, help routes,
// lesson-map chapters, text helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fill, pickLang, loadSettings, saveSettings, DEFAULT_SETTINGS, SETTINGS_KEY,
  sessionPlan, maxExtensions, canExtend, timeLeftPhrase, durationPhrase,
  MIN_RESPONSE_SECONDS, MIN_EXTENSIONS, chapterAt, clampPercent, helpRoutes,
} from '../src/components/c/logic.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
}

test('fill replaces {names} and leaves unknown ones', () => {
  assert.equal(fill('Lesson {n} of {total}', { n: 3, total: 8 }), 'Lesson 3 of 8');
  assert.equal(fill('Hi {who}', {}), 'Hi {who}');
});

test('pickLang: ui-lang, then the page, then English', () => {
  assert.equal(pickLang('am', 'en'), 'am');
  assert.equal(pickLang(null, 'am-ET'), 'am');
  assert.equal(pickLang(null, ''), 'en');
  assert.equal(pickLang('fr', 'am'), 'en');
});

test('settings: defaults (alerts stay until closed), saved, and broken storage', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.keepAlerts, true);
  saveSettings({ vibrate: true }, storage);
  assert.equal(loadSettings(storage).vibrate, true);
  assert.equal(loadSettings(storage).keepAlerts, true);
  storage.setItem(SETTINGS_KEY, '{not json');
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS);
  const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(loadSettings(throwing), DEFAULT_SETTINGS);
  assert.equal(saveSettings({ vibrate: true }, throwing).vibrate, true);
  assert.deepEqual(loadSettings(null), DEFAULT_SETTINGS);
});

test('sessionPlan: warn time, and always at least 20 s to answer', () => {
  assert.deepEqual(sessionPlan('1800', '120'), { timeout: 1800, warnBefore: 120, warnAt: 1680 });
  assert.deepEqual(sessionPlan('40', '30'), { timeout: 40, warnBefore: 30, warnAt: 10 });
  assert.equal(sessionPlan('600', '5').warnBefore, MIN_RESPONSE_SECONDS); // too short: 20 s
  assert.equal(sessionPlan('600', '5').warnAt, 580);
  assert.deepEqual(sessionPlan('60', '300'), { timeout: 60, warnBefore: 60, warnAt: 0 }); // warn at once
  assert.deepEqual(sessionPlan(null, null), { timeout: 1800, warnBefore: 120, warnAt: 1680 });
  assert.equal(sessionPlan('5', '5').timeout, MIN_RESPONSE_SECONDS);
});

test('extensions: at least 10 allowed (WCAG 2.2.1), default 20', () => {
  assert.equal(maxExtensions(null), 20);
  assert.equal(maxExtensions('3'), MIN_EXTENSIONS);
  assert.equal(maxExtensions('50'), 50);
  const max = maxExtensions('10');
  let used = 0;
  while (canExtend(used, max)) used += 1;
  assert.equal(used, 10);
});

test('timeLeftPhrase changes at most every 30 seconds', () => {
  assert.deepEqual(timeLeftPhrase(120), { key: 'minutes', n: 2 });
  assert.deepEqual(timeLeftPhrase(61), { key: 'minute', n: 1 });
  assert.deepEqual(timeLeftPhrase(59), { key: 'lessThanMinute' });
  assert.deepEqual(timeLeftPhrase(30), { key: 'thirtySeconds' });
  assert.deepEqual(timeLeftPhrase(1), { key: 'thirtySeconds' });
  // Over a 2-minute warning, second by second, the words change only a few times.
  let changes = 0;
  let last = '';
  for (let s = 120; s > 0; s -= 1) {
    const now = JSON.stringify(timeLeftPhrase(s));
    if (now !== last) changes += 1;
    last = now;
  }
  assert.ok(changes <= 4, `changed ${changes} times`);
});

test('durationPhrase', () => {
  assert.deepEqual(durationPhrase(40), { key: 'seconds', n: 40 });
  assert.deepEqual(durationPhrase(60), { key: 'minute', n: 1 });
  assert.deepEqual(durationPhrase(1800), { key: 'minutes', n: 30 });
});

test('chapterAt and clampPercent', () => {
  const chapters = [{ start: 0, text: 'A' }, { start: 59, text: 'B' }, { start: 130, text: 'C' }];
  assert.equal(chapterAt(chapters, 62).text, 'B');
  assert.equal(chapterAt(chapters, 0).text, 'A');
  assert.equal(chapterAt([], 10), null);
  assert.equal(clampPercent(140), 100);
  assert.equal(clampPercent(-3), 0);
  assert.equal(clampPercent('39.6'), 40);
  assert.equal(clampPercent(undefined), 0);
});

test('helpRoutes: only what is given, text first, voice last', () => {
  assert.deepEqual(helpRoutes({ phone: '+251 11 000 0000', chat: 'https://t.me/x' }).map((r) => r.route), ['chat', 'phone']);
  const all = helpRoutes({ chat: 'c', email: 'help@example.org', video: 'v', phone: '+251 11 000 0000' });
  assert.deepEqual(all.map((r) => r.route), ['chat', 'email', 'video', 'phone']);
  assert.equal(all[1].href, 'mailto:help@example.org');
  assert.equal(all[3].href, 'tel:+251110000000');
  assert.deepEqual(helpRoutes({}), []);
});

test('the English and Amharic text files have the same keys', () => {
  const en = JSON.parse(readFileSync(new URL('../i18n/components-c.en.json', import.meta.url), 'utf8'));
  const am = JSON.parse(readFileSync(new URL('../i18n/components-c.am.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(am).sort(), Object.keys(en).sort());
  for (const [key, text] of Object.entries(am)) {
    const vars = (s) => (s.match(/\{\w+\}/g) || []).sort();
    assert.deepEqual(vars(text), vars(en[key]), `placeholders in ${key}`);
  }
});
