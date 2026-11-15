// Package E pure logic: lesson formats from a manifest (E1), times and the
// offline question queue (E2), notes storage and export (E5), quiz scoring
// and timer maths (E6), table card labels and sorting (E4), progress (E7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lessonSources, availableFormats, chooseFormat, usesVideo, formatBytes,
  parseMmss, clock, megabytes, pickAudioType, micProblem,
  loadList, queueQuestion, flushList, QUESTION_QUEUE, MAX_QUEUED_MEDIA,
  loadNotes, saveNotes, makeNote, notesToText, noteLabel, sortNotes, NOTES_PREFIX,
  cleanQuestions, isCorrect, quizScore, answerText, timerState, remainingSeconds, extendTimer, minutesSeconds,
  columnLabels, sortKey, sortedOrder, percentWatched,
} from '../src/components/e/logic.js';
import en from '../i18n/components-e.en.json' with { type: 'json' };
import am from '../i18n/components-e.am.json' with { type: 'json' };

/** A tiny localStorage stand-in. */
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    get size() { return data.size; },
  };
}

// --- E1 -------------------------------------------------------------------------

const MANIFEST = {
  video: { mp4: '/f/video.mp4', webm: '/f/video.webm', small_mp4: '/f/video-small.mp4' },
  audio: { opus: '/f/audio.opus' },
  captions: [{ lang: 'en', status: 'reviewed', url: '/c/en' }, { lang: 'am', status: 'draft', url: '/c/am' }],
  sign: '/f/sign.webm',
  documents: { html_en: '/d.html?lang=en', pdf_en: '/d.pdf?lang=en', html_am: '/d.html?lang=am', brf_en: '/b.brf' },
};

test('formats come from the manifest: all five when everything exists', () => {
  const sources = lessonSources({}, MANIFEST, 'en');
  assert.equal(sources.video, '/f/video.mp4');
  assert.equal(sources.audio, '/f/audio.opus');
  assert.deepEqual(sources.captions.map((c) => c.lang), ['en', 'am']);
  assert.deepEqual(sources.document, { html: '/d.html?lang=en', pdf: '/d.pdf?lang=en', brf: '/b.brf' });
  assert.deepEqual(availableFormats(sources, { hasSimple: true }), ['watch', 'listen', 'read', 'sign', 'simple']);
  // The Amharic interface gets the Amharic document, else English.
  const amSources = lessonSources({}, MANIFEST, 'am');
  assert.equal(amSources.document.html, '/d.html?lang=am');
  assert.equal(amSources.document.pdf, '/d.pdf?lang=en');
});

test('only formats that exist are offered', () => {
  // The demo player: video, captions and sign, no audio-only file, no document.
  const attrs = { src: '/media/lesson.mp4', 'captions-en': '/en.vtt', sign: '/media/sign.webm' };
  assert.deepEqual(availableFormats(lessonSources(attrs)), ['watch', 'sign']);
  // A silent lesson: audio without captions is no "Listen" (no transcript).
  assert.deepEqual(availableFormats(lessonSources({}, { ...MANIFEST, captions: [], documents: {} })), ['watch', 'sign']);
  // Attributes on the player win over the manifest.
  assert.equal(lessonSources({ src: '/mine.mp4' }, MANIFEST).video, '/mine.mp4');
  assert.deepEqual(availableFormats(lessonSources({})), []);
});

test('the remembered format is used only if the lesson has it', () => {
  assert.equal(chooseFormat(['watch', 'listen'], 'listen'), 'listen');
  assert.equal(chooseFormat(['watch', 'sign'], 'listen'), 'watch');
  assert.equal(chooseFormat(['watch'], null), 'watch');
  assert.equal(chooseFormat([], 'watch'), null);
  assert.equal(usesVideo('listen'), false);
  assert.equal(usesVideo('read'), false);
  assert.equal(usesVideo('sign'), true);
});

test('download size for each format', () => {
  const sources = lessonSources({}, MANIFEST);
  const sizes = { '/f/video.mp4': 20_000_000, '/f/video-small.mp4': 5_000_000, '/f/audio.opus': 900_000, '/f/sign.webm': 3_000_000 };
  assert.equal(formatBytes('watch', sources, sizes), 20_000_000);
  assert.equal(formatBytes('watch', sources, sizes, { lowData: true }), 5_000_000);
  assert.equal(formatBytes('listen', sources, sizes), 900_000);
  assert.equal(formatBytes('sign', sources, sizes), 23_000_000);
  assert.equal(formatBytes('read', sources, sizes), null); // unknown: no size shown
});

// --- E2 -------------------------------------------------------------------------

test('times reuse the form fields parser (mm:ss)', () => {
  assert.equal(parseMmss('1:23'), 83);
  assert.equal(parseMmss('83'), 83);
  assert.equal(parseMmss('1:75'), null);
  assert.equal(clock(83.9), '1:23');
  assert.equal(clock(0), '0:00');
  assert.equal(clock(3725), '62:05');
});

test('sizes in MB and recorder choice', () => {
  assert.equal(megabytes(1_234_567), '1.2');
  assert.equal(megabytes(10), '0.1');
  assert.equal(pickAudioType((t) => t === 'audio/mp4'), 'audio/mp4');
  assert.equal(pickAudioType((t) => t.startsWith('audio/webm')), 'audio/webm;codecs=opus');
  assert.equal(pickAudioType(() => { throw new Error('no'); }), '');
  assert.equal(micProblem({ secure: false, getUserMedia: true, recorder: true }), 'insecure');
  assert.equal(micProblem({ secure: true, getUserMedia: false, recorder: true }), 'none');
  assert.equal(micProblem({ secure: true, getUserMedia: true, recorder: false }), 'recorder');
  assert.equal(micProblem({ secure: true, getUserMedia: true, recorder: true }), '');
});

test('offline question queue: kept, sent when online, refused ones dropped', async () => {
  const storage = memoryStorage();
  assert.equal(queueQuestion({ url: '/q', body: { time: 1, kind: 'text', text: 'Why?' } }, storage), true);
  assert.equal(queueQuestion({ url: '/q', body: { time: 2, kind: 'voice' }, media: 'data:audio/webm;base64,AAAA' }, storage), true);
  assert.equal(queueQuestion({ url: '/q', body: { time: 3, kind: 'text', text: 'Bad' } }, storage), true);
  // Too big to keep on the phone.
  assert.equal(queueQuestion({ url: '/q', body: {}, media: 'x'.repeat(MAX_QUEUED_MEDIA + 1) }, storage), false);
  assert.equal(loadList(QUESTION_QUEUE, storage).length, 3);

  // Still offline: everything stays.
  let result = await flushList(QUESTION_QUEUE, async () => { throw new Error('offline'); }, storage);
  assert.equal(result.kept.length, 3);
  // Online: 201, 503 (try again later), 400 (never accepted).
  const statuses = { 1: 201, 2: 503, 3: 400 };
  result = await flushList(QUESTION_QUEUE, async (item) => statuses[item.body.time], storage);
  assert.deepEqual([result.sent, result.kept, result.refused].map((l) => l.map((i) => i.body.time)), [[1], [2], [3]]);
  assert.deepEqual(loadList(QUESTION_QUEUE, storage).map((i) => i.body.time), [2]);
  await flushList(QUESTION_QUEUE, async () => 201, storage);
  assert.equal(storage.getItem(QUESTION_QUEUE), null);
  // Bad JSON is not fatal.
  storage.setItem(QUESTION_QUEUE, '{oops');
  assert.deepEqual(loadList(QUESTION_QUEUE, storage), []);
});

// --- E5 -------------------------------------------------------------------------

test('notes are saved per lesson, sorted by time, and exported as text', () => {
  const storage = memoryStorage();
  const late = makeNote(83.4, '  Second idea  ');
  const early = makeNote(5, 'First\nidea');
  assert.equal(late.time, 83);
  assert.equal(late.text, 'Second idea');
  assert.equal(saveNotes('lesson-1', [late, early], storage), true);
  assert.ok(storage.getItem(`${NOTES_PREFIX}lesson-1`));
  assert.deepEqual(loadNotes('lesson-1', storage).map((n) => n.time), [5, 83]);
  assert.deepEqual(loadNotes('lesson-2', storage), []);
  assert.equal(notesToText(loadNotes('lesson-1', storage), 'My notes'), 'My notes\r\n\r\n0:05  First idea\r\n1:23  Second idea\r\n');
  saveNotes('lesson-1', [], storage);
  assert.equal(storage.getItem(`${NOTES_PREFIX}lesson-1`), null);
  assert.equal(makeNote(1, 'x'.repeat(1500)).text.length, 1000);
});

test('note labels: "Play from 1:23: …", cut at about 60 letters, never mid-letter', () => {
  assert.equal(noteLabel({ time: 83, text: 'Check the loop' }), 'Play from 1:23: Check the loop');
  const long = noteLabel({ time: 0, text: 'ሀ'.repeat(80) });
  assert.ok(long.endsWith('…'));
  assert.equal(Array.from(long.replace('Play from 0:00: ', '')).length, 58);
  assert.equal(noteLabel({ time: 5, text: 'Hi' }, 'ከ{time} ጀምሮ አጫውት፦ {text}'), 'ከ0:05 ጀምሮ አጫውት፦ Hi');
  assert.deepEqual(sortNotes([{ id: 'b', time: 2 }, { id: 'a', time: 2 }, { id: 'c', time: 1 }]).map((n) => n.id), ['c', 'a', 'b']);
});

// --- E6 -------------------------------------------------------------------------

test('quiz questions are cleaned; scoring single and "all that apply"', () => {
  const questions = cleanQuestions([
    { question: 'One?', options: ['a', 'b', 'c'], answer: 1, explanation: 'Because.' },
    { question: 'Many?', options: ['a', 'b', 'c'], answer: [2, 0] },
    { question: 'Broken', options: ['only one'], answer: 0 },
    { question: 'Bad answer', options: ['a', 'b'], answer: 7 },
    null,
  ]);
  assert.equal(questions.length, 2);
  assert.deepEqual(questions[1].answers, [0, 2]);
  assert.equal(questions[1].multiple, true);
  assert.equal(isCorrect(questions[0], [1]), true);
  assert.equal(isCorrect(questions[0], [0]), false);
  assert.equal(isCorrect(questions[1], [2, 0]), true);
  assert.equal(isCorrect(questions[1], [0]), false);
  assert.equal(isCorrect(questions[1], [0, 1, 2]), false);
  assert.equal(answerText(questions[0]), 'b');
  assert.equal(answerText(questions[1], 'and'), 'a and c');
  assert.deepEqual(quizScore([true, false, true, null]), { score: 2, total: 4, percent: 50 });
  assert.deepEqual(quizScore([]), { score: 0, total: 0, percent: 0 });
});

test('timer maths: warning 1 minute before the end, extend, off', () => {
  assert.equal(timerState(600), 'running');
  assert.equal(timerState(60), 'warning');
  assert.equal(timerState(1), 'warning');
  assert.equal(timerState(0), 'over');
  assert.equal(timerState(10, { on: false }), 'off');
  assert.equal(remainingSeconds(10_500, 0), 11);
  assert.equal(remainingSeconds(0, 5000), 0);
  // Extending adds to the later of now and the old end.
  assert.equal(extendTimer(60_000, 30_000, 300), 360_000);
  assert.equal(extendTimer(10_000, 30_000, 300), 330_000);
  assert.deepEqual(minutesSeconds(125), { minutes: 2, seconds: 5 });
});

// --- E4 -------------------------------------------------------------------------

test('table card labels from the header rows, with spans', () => {
  assert.deepEqual(columnLabels([[{ text: 'Lesson' }, { text: 'Length' }]]), ['Lesson', 'Length']);
  assert.deepEqual(columnLabels([
    [{ text: '' }, { text: 'Size', span: 2 }],
    [{ text: 'Lesson' }, { text: 'Video' }, { text: 'Audio' }],
  ]), ['Lesson', 'Size – Video', 'Size – Audio']);
  assert.deepEqual(columnLabels([]), []);
});

test('sorting: numbers and times as numbers, text by letters, stable', () => {
  assert.deepEqual(sortKey('12:30'), { n: 750 });
  assert.deepEqual(sortKey('1,200'), { n: 1200 });
  assert.deepEqual(sortKey(' Yes '), { s: 'yes' });
  const rows = [['HTML', '12:30'], ['CSS', '8:05'], ['Forms', '15:40'], ['Again', '8:05']];
  assert.deepEqual(sortedOrder(rows, 1), [1, 3, 0, 2]);
  assert.deepEqual(sortedOrder(rows, 1, 'descending'), [2, 0, 1, 3]);
  assert.deepEqual(sortedOrder(rows, 0), [3, 1, 2, 0]);
});

// --- E7 -------------------------------------------------------------------------

test('percent watched', () => {
  assert.equal(percentWatched(30, 120), 25);
  assert.equal(percentWatched(130, 120), 100);
  assert.equal(percentWatched(5, 0), 0);
});

// --- Text -----------------------------------------------------------------------

test('every English text has an Amharic one, with the same {placeholders}', () => {
  const walk = (node, path = []) => Object.entries(node).flatMap(([k, v]) =>
    (typeof v === 'object' ? walk(v, [...path, k]) : [[[...path, k].join('.'), v]]));
  const amText = Object.fromEntries(walk(am));
  for (const [key, value] of walk(en)) {
    assert.ok(key in amText, `missing Amharic: ${key}`);
    const names = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(names(amText[key]), names(value), `placeholders differ: ${key}`);
  }
});
