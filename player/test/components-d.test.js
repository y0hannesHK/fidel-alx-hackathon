// Package D pure logic: the Fidel syllable table (D4), "delete one letter",
// gap finding and bracket detection (D3), .ics and the Join window (D5),
// the offline report queue (D2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSONANTS, syllableRow, fidelTable, deleteOneLetter, parseClock,
  loadQueue, queueReport, flushQueue, QUEUE_KEY,
  joinState, durationParts, buildIcs, eventJsonLd, pickRecorderType, megabytes,
} from '../src/components/d/logic.js';
import { hasSoundDescription, countSoundDescriptions, findGaps, insertCue } from '../../studio/js/sound-check.js';

// --- D4 -------------------------------------------------------------------------

const chars = (consonant) => syllableRow(consonant).map((f) => f.char).join(' ');

test('syllable rows match a hand-written list, including the irregular rows', () => {
  const expected = {
    'ለ': 'ለ ሉ ሊ ላ ሌ ል ሎ ሏ',
    'መ': 'መ ሙ ሚ ማ ሜ ም ሞ ሟ',
    'ረ': 'ረ ሩ ሪ ራ ሬ ር ሮ ሯ',
    'በ': 'በ ቡ ቢ ባ ቤ ብ ቦ ቧ',
    'ቨ': 'ቨ ቩ ቪ ቫ ቬ ቭ ቮ ቯ',
    'አ': 'አ ኡ ኢ ኣ ኤ እ ኦ ኧ',
    'ወ': 'ወ ዉ ዊ ዋ ዌ ው ዎ',
    'የ': 'የ ዩ ዪ ያ ዬ ይ ዮ',
    'ሀ': 'ሀ ሁ ሂ ሃ ሄ ህ ሆ',
    'ዐ': 'ዐ ዑ ዒ ዓ ዔ ዕ ዖ',
    'ቀ': 'ቀ ቁ ቂ ቃ ቄ ቅ ቆ ቋ',
    'ገ': 'ገ ጉ ጊ ጋ ጌ ግ ጎ ጓ',
    'ከ': 'ከ ኩ ኪ ካ ኬ ክ ኮ ኳ',
    'ፐ': 'ፐ ፑ ፒ ፓ ፔ ፕ ፖ ፗ',
  };
  for (const [consonant, row] of Object.entries(expected)) assert.equal(chars(consonant), row, consonant);
});

test('the table has 34 consonants, 7 or 8 forms each, no unassigned code points', () => {
  const table = fidelTable();
  assert.equal(table.length, CONSONANTS.length);
  assert.equal(table.length, 34);
  for (const row of table) {
    assert.ok(row.forms.length === 7 || row.forms.length === 8, row.consonant);
    for (const form of row.forms) assert.match(form.char, /^\p{Script=Ethiopic}$/u, `${row.consonant} ${form.char}`);
  }
  assert.ok(!table.flatMap((r) => r.forms.map((f) => f.char)).includes(String.fromCodePoint(0x12d7)));
});

test('accessible readings in Latin letters', () => {
  assert.equal(fidelTable().find((r) => r.consonant === 'ለ').latin, 'le');
  assert.equal(syllableRow('ለ')[1].latin, 'lu');
  assert.equal(syllableRow('ለ')[7].latin, 'lwa');
  assert.equal(syllableRow('ሸ')[3].latin, 'sha');
});

test('delete one letter removes one whole syllable before the cursor', () => {
  assert.deepEqual(deleteOneLetter('ሰላም', 3), { value: 'ሰላ', cursor: 2, removed: 'ም' });
  assert.deepEqual(deleteOneLetter('ሰላም', 1), { value: 'ላም', cursor: 0, removed: 'ሰ' });
  assert.deepEqual(deleteOneLetter('', 0), { value: '', cursor: 0, removed: '' });
  assert.deepEqual(deleteOneLetter('a😀', 3), { value: 'a', cursor: 1, removed: '😀' }); // never half a character
});

// --- D3 -------------------------------------------------------------------------

test('sound descriptions are found in square brackets', () => {
  assert.ok(hasSoundDescription('[music]'));
  assert.ok(hasSoundDescription('Hello [laughter] there'));
  assert.ok(hasSoundDescription('[ሙዚቃ]'));
  assert.ok(!hasSoundDescription('No brackets'));
  assert.ok(!hasSoundDescription('[ ]'));
  assert.equal(countSoundDescriptions([{ text: '[music]' }, { text: 'Hi' }, { text: '[door closes] Come in.' }]), 2);
});

test('silent gaps longer than 3 seconds, with overlaps and the video end', () => {
  const cues = [{ start: 4, end: 6 }, { start: 0.5, end: 2 }, { start: 5, end: 9 }, { start: 11, end: 12 }, { start: 20, end: 21 }];
  assert.deepEqual(findGaps(cues), [{ start: 12, end: 20 }]);
  assert.deepEqual(findGaps(cues, { duration: 30 }), [{ start: 12, end: 20 }, { start: 21, end: 30 }]);
  assert.deepEqual(findGaps([{ start: 5, end: 6 }]), [{ start: 0, end: 5 }]);
  assert.deepEqual(findGaps([]), []);
  assert.deepEqual(findGaps([{ start: 0, end: 2 }, { start: 5, end: 6 }]), []); // exactly 3 s is not "longer"
});

test('a new cue is inserted in time order', () => {
  const cues = insertCue([{ start: 0, end: 2, text: 'a' }, { start: 6, end: 8, text: 'b' }], { start: 2, end: 5, text: '[music]' });
  assert.deepEqual(cues.map((c) => c.text), ['a', '[music]', 'b']);
});

// --- D2 -------------------------------------------------------------------------

test('times typed by learners', () => {
  assert.equal(parseClock('1:05'), 65);
  assert.equal(parseClock(' 65 '), 65);
  assert.equal(parseClock('1:02:05'), 3725);
  assert.ok(Number.isNaN(parseClock('1:5')));
  assert.ok(Number.isNaN(parseClock('one')));
});

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
}

test('offline queue: kept while offline, sent later, refused ones dropped', async () => {
  const storage = memoryStorage();
  queueReport({ url: '/r', body: { time: 1 }, lessonId: 'a' }, storage);
  queueReport({ url: '/r', body: { time: 2 }, lessonId: 'a' }, storage);
  assert.equal(loadQueue(storage).length, 2);

  // Still offline: everything stays.
  let result = await flushQueue(async () => { throw new TypeError('offline'); }, storage);
  assert.equal(result.kept.length, 2);
  assert.equal(loadQueue(storage).length, 2);

  // Online: the first is accepted, the second refused (bad input): both leave the queue.
  result = await flushQueue(async (item) => (item.body.time === 1 ? 201 : 400), storage);
  assert.deepEqual([result.sent.length, result.refused.length, result.kept.length], [1, 1, 0]);
  assert.equal(storage.getItem(QUEUE_KEY), null);

  // Too many requests or a server error: tried again later.
  queueReport({ url: '/r', body: { time: 3 } }, storage);
  result = await flushQueue(async () => 429, storage);
  assert.equal(loadQueue(storage).length, 1);
});

test('a broken queue never throws', () => {
  const storage = memoryStorage();
  storage.setItem(QUEUE_KEY, '{not json');
  assert.deepEqual(loadQueue(storage), []);
});

// --- D5 -------------------------------------------------------------------------

const start = new Date('2026-11-20T19:00:00+03:00');
const end = new Date('2026-11-20T20:30:00+03:00');

test('the Join link window opens 15 minutes before the start', () => {
  assert.equal(joinState(new Date('2026-11-20T18:44:00+03:00'), start, end), 'before');
  assert.equal(joinState(new Date('2026-11-20T18:45:00+03:00'), start, end), 'open');
  assert.equal(joinState(new Date('2026-11-20T20:00:00+03:00'), start, end), 'open');
  assert.equal(joinState(new Date('2026-11-20T20:31:00+03:00'), start, end), 'ended');
  assert.deepEqual(durationParts(start, end), { hours: 1, minutes: 30 });
});

test('.ics file: UTC times, escaped text, CRLF lines of at most 75 bytes', () => {
  const ics = buildIcs({
    uid: 'ev1@fidel', title: 'Office hours; how to present, part 1', start, end, url: 'https://meet.example/abc',
    description: 'Live captions: yes. ' + 'የኢትዮጵያ ምልክት ቋንቋ አስተርጓሚ፦ ሲጠየቅ። '.repeat(3), now: new Date('2026-11-15T10:00:00Z'),
  });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /\r\nDTSTART:20261120T160000Z\r\n/);
  assert.match(ics, /\r\nDTEND:20261120T173000Z\r\n/);
  assert.match(ics, /SUMMARY:Office hours\\; how to present\\, part 1/);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  // Unfolding gives back the whole description.
  assert.ok(ics.replace(/\r\n /g, '').includes('ሲጠየቅ።'));
});

test('schema.org Event JSON-LD', () => {
  const data = eventJsonLd({ title: 'Office hours', start, end, joinUrl: 'https://meet.example/abc', languages: ['en', 'am'], description: 'Live captions: yes.' });
  assert.equal(data['@type'], 'Event');
  assert.equal(data.eventAttendanceMode, 'https://schema.org/OnlineEventAttendanceMode');
  assert.deepEqual(data.location, { '@type': 'VirtualLocation', url: 'https://meet.example/abc' });
  assert.equal(data.startDate, '2026-11-20T16:00:00.000Z');
});

// --- D6 -------------------------------------------------------------------------

test('recording type: vp9, then vp8, then mp4', () => {
  assert.equal(pickRecorderType(() => true), 'video/webm;codecs=vp9');
  assert.equal(pickRecorderType((t) => t !== 'video/webm;codecs=vp9'), 'video/webm;codecs=vp8');
  assert.equal(pickRecorderType((t) => t === 'video/mp4'), 'video/mp4');
  assert.equal(pickRecorderType(() => false), '');
  assert.equal(megabytes(1572864), '1.5');
  assert.equal(megabytes(10), '0.1');
});
