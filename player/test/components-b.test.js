// Package B pure logic: sizes, the download queue, Ethiopian dates,
// section language choice, display settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bothCalendars, chooseLanguage, cleanDisplay, dequeue, displayClasses, enqueue, ethiopianDate, fill,
  formatSize, isMedia, megabytes, parseIsoDate, parseQueue, pickLang, readyToDownload,
} from '../src/components/b/logic.js';
import { toEthiopian } from '../src/ethiopian-calendar.js';
import en from '../i18n/components-b.en.json' with { type: 'json' };
import am from '../i18n/components-b.am.json' with { type: 'json' };

test('fill and pickLang', () => {
  assert.equal(fill('Load it ({size})', { size: '45 MB' }), 'Load it (45 MB)');
  assert.equal(fill('{a} and {b}', { a: 1 }), '1 and {b}');
  assert.equal(pickLang('am', 'en'), 'am');
  assert.equal(pickLang(null, 'am-ET'), 'am');
  assert.equal(pickLang(null, ''), 'en');
  assert.equal(pickLang('fr', 'am'), 'en');
});

test('sizes are rounded sensibly', () => {
  assert.equal(megabytes(45_000_000), 45);
  assert.equal(megabytes(800_000), 0.8);
  assert.equal(megabytes(3_100_000), 3.1);
  assert.equal(megabytes(2_208_053), 2.2);
  assert.equal(megabytes(12_600_000), 13);
  assert.equal(megabytes(196), 0.1); // never "0 MB"
  assert.equal(megabytes(null), null);
  assert.equal(megabytes('abc'), null);
  assert.equal(formatSize(45_000_000), '45 MB');
  assert.equal(formatSize(800_000, 'en'), '0.8 MB');
  assert.equal(formatSize(800_000, 'am'), '0.8 MB');
  assert.equal(formatSize(1_234_000_000, 'en'), '1,234 MB');
  assert.equal(formatSize(undefined), null);
});

test('media files play in place; other files are links', () => {
  assert.ok(isMedia('/files/lessons/x/video.mp4'));
  assert.ok(isMedia('/a.webm?x=1'));
  assert.ok(!isMedia('/api/v1/lessons/x/offline.html'));
  assert.ok(!isMedia(null));
});

test('download queue', () => {
  let q = enqueue([], { href: '/a', label: 'A' });
  q = enqueue(q, { href: '/b', label: 'B', wifiOnly: true });
  q = enqueue(q, { href: '/a', label: 'A again' }); // once per address
  assert.equal(q.length, 2);
  assert.equal(q.find((i) => i.href === '/a').label, 'A again');
  assert.deepEqual(readyToDownload(q, { online: false, type: 'wifi' }), []);
  assert.deepEqual(readyToDownload(q, { online: true, type: 'cellular' }).map((i) => i.href), ['/a']);
  assert.deepEqual(readyToDownload(q, { online: true, type: 'wifi' }).map((i) => i.href).sort(), ['/a', '/b']);
  assert.deepEqual(readyToDownload(q, { online: true, type: undefined }).length, 2);
  assert.deepEqual(dequeue(q, '/a').map((i) => i.href), ['/b']);
  assert.deepEqual(parseQueue('not json'), []);
  assert.deepEqual(parseQueue('{"a":1}'), []);
  assert.deepEqual(parseQueue('[{"href":"/x"},null,{"nohref":1}]'), [{ href: '/x' }]);
});

// Known pairs (as in ethiopian-calendar.test.js).
const KNOWN = [
  ['2026-11-13', [2019, 3, 4]],
  ['2026-11-14', [2019, 3, 5]],
  ['2026-11-15', [2019, 3, 6]],
  ['2026-09-11', [2019, 1, 1]], // New Year on 11 September
  ['2027-09-12', [2020, 1, 1]], // New Year on 12 September (before Gregorian leap year 2028)
  ['2026-09-10', [2018, 13, 5]], // Pagume 5
  ['2027-09-11', [2019, 13, 6]], // Pagume 6 (leap year)
];

test('Ethiopian dates: Intl and our own conversion agree with the known pairs', () => {
  for (const [iso, [year, month, day]] of KNOWN) {
    const [y, m, d] = parseIsoDate(iso);
    assert.deepEqual(ethiopianDate(y, m, d), { year, month, day }, `Intl ${iso}`);
    assert.deepEqual(ethiopianDate(y, m, d, { useIntl: false }), { year, month, day }, `own ${iso}`);
  }
});

test('Intl and our conversion agree every day for ten years', () => {
  for (let t = Date.UTC(2022, 0, 1); t < Date.UTC(2032, 0, 1); t += 86_400_000) {
    const date = new Date(t);
    const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
    assert.deepEqual(ethiopianDate(y, m, d), toEthiopian(y, m, d), date.toISOString());
  }
});

test('both calendars, ordered by interface language', () => {
  const text = (parts) => parts.map((p) => `${p.lang}:${p.text}`);
  assert.deepEqual(text(bothCalendars('2026-11-15')), ['en:15 Nov 2026', 'am:ህዳር 6 2019']);
  assert.deepEqual(text(bothCalendars('2026-11-15', { lang: 'am' })), ['am:ህዳር 6 2019', 'en:15 Nov 2026']);
  assert.deepEqual(text(bothCalendars('2026-11-15', { format: 'long' })),
    ['en:Sunday 15 November 2026', 'am:እሑድ ህዳር 6 2019 ዓ.ም.']);
  assert.deepEqual(text(bothCalendars('2026-09-10', { useIntl: false })), ['en:10 Sep 2026', 'am:ጳጉሜ 5 2018']);
  assert.deepEqual(text(bothCalendars('2026-11-13T10:00:00Z')), ['en:13 Nov 2026', 'am:ህዳር 4 2019']);
  assert.equal(bothCalendars('2026-02-30'), null);
  assert.equal(bothCalendars('soon'), null);
});

test('section language: remembered, else interface language, else first', () => {
  assert.equal(chooseLanguage(['en', 'am', 'om'], 'om', 'am'), 'om');
  assert.equal(chooseLanguage(['en', 'am'], 'om', 'am'), 'am');
  assert.equal(chooseLanguage(['am', 'om'], null, 'en'), 'am');
  assert.equal(chooseLanguage([], 'en', 'en'), null);
});

test('display settings: cleaned, and turned into classes', () => {
  assert.deepEqual(cleanDisplay(null), { size: 100, spacing: 'normal', contrast: 'normal', still: false, focus: false });
  assert.deepEqual(cleanDisplay({ size: 300, contrast: 'pink', still: 'yes' }).size, 100);
  assert.deepEqual(displayClasses({}), []);
  assert.deepEqual(displayClasses({ size: 150, spacing: 'wide', contrast: 'yellow', still: true, focus: true }),
    ['fidel-dp-size-150', 'fidel-dp-wide', 'fidel-dp-contrast-yellow', 'fidel-dp-still', 'fidel-dp-focus']);
});

test('the Amharic file has every English key', () => {
  assert.deepEqual(Object.keys(am).sort(), Object.keys(en).sort());
  assert.deepEqual(Object.keys(am.languageNames).sort(), Object.keys(en.languageNames).sort());
});
