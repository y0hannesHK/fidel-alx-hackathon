// Pure logic for Package E components (no DOM), so it can be unit-tested
// with node --test (player/test/components-e.test.js).
//
// Times typed by learners reuse the form fields' parser (format="mmss"):
// parseMmss('1:23') -> 83, formatMmss(83) -> '1:23'.
import { formatMmss, parseMmss } from '../forms/logic.js';
import { formatSize } from '../b/logic.js';

export { formatMmss, parseMmss, formatSize };

/** 83.6 -> "1:23" (whole seconds, for labels such as "Play from 1:23"). */
export function clock(seconds) {
  return formatMmss(Math.floor(Math.max(0, Number(seconds) || 0)));
}

// ---------------------------------------------------------------------------
// E1: lesson formats.

export const FORMATS = ['watch', 'listen', 'read', 'sign', 'simple'];

/**
 * What a lesson offers, from the player's attributes (attrs: name -> value)
 * and, if there is one, the lesson manifest from the Fidel server.
 * lang: the interface language (the lesson document in that language, else English).
 * Returns { video, smallVideo, audio, captions: [{lang, url}], document: {html, pdf, brf}, sign }.
 */
export function lessonSources(attrs = {}, manifest = null, lang = 'en') {
  const get = (name) => attrs[name] || null;
  const m = manifest || {};
  const captions = [];
  for (const code of ['en', 'am', 'om']) {
    const url = get(`captions-${code}`) || (m.captions || []).find((c) => c.lang === code)?.url;
    if (url) captions.push({ lang: code, url });
  }
  const doc = (kind) => get(`document-${kind}-${lang}`) || get(`document-${kind}-en`)
    || m.documents?.[`${kind}_${lang}`] || m.documents?.[`${kind}_en`] || null;
  return {
    video: get('src') || m.video?.mp4 || m.video?.webm || null,
    smallVideo: get('src-small') || m.video?.small_mp4 || null,
    audio: get('audio') || m.audio?.opus || null,
    captions,
    document: { html: doc('html'), pdf: doc('pdf'), brf: doc('brf') },
    sign: get('sign') || m.sign || null,
  };
}

/**
 * The formats this lesson really has, in the order they are offered.
 * Listen needs an audio-only file AND captions (the transcript); Read needs
 * the lesson document; Sign language needs the sign video; Simple words
 * needs a <fidel-simple-mode> on the page (hasSimple).
 */
export function availableFormats(sources, { hasSimple = false } = {}) {
  const list = [];
  if (sources.video) list.push('watch');
  if (sources.audio && sources.captions.length) list.push('listen');
  if (sources.document.html || sources.document.pdf) list.push('read');
  if (sources.video && sources.sign) list.push('sign');
  if (hasSimple) list.push('simple');
  return list;
}

/** The format to use: the remembered one if this lesson has it, else the first. */
export function chooseFormat(available, remembered) {
  if (remembered && available.includes(remembered)) return remembered;
  return available[0] || null;
}

/** Formats that need the video player on the page (the others load no video). */
export const usesVideo = (format) => ['watch', 'sign', 'simple'].includes(format);

/** Bytes to download for each format (null where unknown). sizes: url -> bytes. */
export function formatBytes(format, sources, sizes, { lowData = false } = {}) {
  const of = (url) => (url ? sizes[url] ?? null : null);
  const video = of(lowData && sources.smallVideo ? sources.smallVideo : sources.video);
  if (format === 'watch' || format === 'simple') return video;
  if (format === 'listen') return of(sources.audio);
  if (format === 'read') return of(sources.document.html || sources.document.pdf);
  if (format === 'sign') {
    const sign = of(sources.sign);
    return video !== null && sign !== null ? video + sign : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// E2 and offline queues: things saved on this phone until they can be sent.

/** Items saved under a localStorage key (never throws). */
export function loadList(key, storage = globalThis.localStorage) {
  try {
    const items = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

/** Save items (an empty list removes the key). False if storage is full or blocked. */
export function saveList(key, items, storage = globalThis.localStorage) {
  try {
    if (items.length) storage.setItem(key, JSON.stringify(items));
    else storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export const QUESTION_QUEUE = 'fidel-question-queue';
/** A recording bigger than this (as base64 text) is not kept on the phone. */
export const MAX_QUEUED_MEDIA = 3_000_000;

/** Add a question to the offline queue. False if it could not be saved. */
export function queueQuestion(item, storage = globalThis.localStorage) {
  if (item.media && item.media.length > MAX_QUEUED_MEDIA) return false;
  return saveList(QUESTION_QUEUE, [...loadList(QUESTION_QUEUE, storage), { ...item, savedAt: Date.now() }], storage);
}

/**
 * Send every queued item. send(item) resolves to the HTTP status (or throws
 * with no connection). 2xx: sent; 4xx (except 408 and 429): refused, will
 * never be accepted; the rest stay for next time.
 */
export async function flushList(key, send, storage = globalThis.localStorage) {
  const result = { sent: [], refused: [], kept: [] };
  for (const item of loadList(key, storage)) {
    let status;
    try {
      status = await send(item);
    } catch {
      status = 0;
    }
    if (status >= 200 && status < 300) result.sent.push(item);
    else if (status >= 400 && status < 500 && status !== 408 && status !== 429) result.refused.push(item);
    else result.kept.push(item);
  }
  saveList(key, result.kept, storage);
  return result;
}

/** 1234567 bytes -> "1.2" (MB, one decimal, at least 0.1). */
export function megabytes(bytes) {
  return Math.max(0.1, Math.round((Number(bytes) || 0) / 100_000) / 10).toFixed(1);
}

/** The first audio recording type this browser supports ('' if none). */
export function pickAudioType(isTypeSupported) {
  const types = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];
  return types.find((type) => {
    try {
      return isTypeSupported(type);
    } catch {
      return false;
    }
  }) || '';
}

/** Why a microphone cannot be used: 'insecure' | 'none' | 'recorder' | ''. */
export function micProblem({ secure, getUserMedia, recorder }) {
  if (!secure) return 'insecure';
  if (!getUserMedia) return 'none';
  if (!recorder) return 'recorder';
  return '';
}

// ---------------------------------------------------------------------------
// E5: notes, saved only in this browser.

export const NOTES_PREFIX = 'fidel-notes:';
export const MAX_NOTE = 1000;

export function loadNotes(lessonId, storage = globalThis.localStorage) {
  return loadList(NOTES_PREFIX + lessonId, storage)
    .filter((n) => n && typeof n.text === 'string' && Number.isFinite(n.time))
    .sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}

export function saveNotes(lessonId, notes, storage = globalThis.localStorage) {
  return saveList(NOTES_PREFIX + lessonId, notes, storage);
}

let noteCounter = 0;
/** A new note (time in seconds, text trimmed and cut to MAX_NOTE). */
export function makeNote(time, text, now = Date.now()) {
  noteCounter += 1;
  return { id: `${now.toString(36)}-${noteCounter}`, time: Math.max(0, Math.round(time)), text: String(text).trim().slice(0, MAX_NOTE) };
}

/** Notes sorted by time. */
export function sortNotes(notes) {
  return [...notes].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}

/** The notes as a plain-text file: a title line, then "1:23  text" per note. */
export function notesToText(notes, title = 'Notes') {
  const lines = sortNotes(notes).map((n) => `${clock(n.time)}  ${n.text.replace(/\r?\n/g, ' ')}`);
  return `${title}\r\n\r\n${lines.join('\r\n')}\r\n`;
}

/** "Play from 1:23: first words…" (text cut to about 60 letters, never mid-letter). */
export function noteLabel(note, template = 'Play from {time}: {text}') {
  const letters = Array.from(note.text.replace(/\s+/g, ' '));
  const short = letters.length > 60 ? `${letters.slice(0, 57).join('').trimEnd()}…` : letters.join('');
  return template.replace('{time}', clock(note.time)).replace('{text}', short);
}

// ---------------------------------------------------------------------------
// E6: quiz.

/**
 * Clean questions from JSON: [{ question, options: [..], answer: 0 | [0, 2],
 * explanation, lang, ownWay }]. An answer that is a list means "choose all
 * that apply" (checkboxes). Bad questions are dropped.
 */
export function cleanQuestions(list) {
  if (!Array.isArray(list)) return [];
  return list.flatMap((q) => {
    if (!q || typeof q.question !== 'string' || !Array.isArray(q.options) || q.options.length < 2) return [];
    const options = q.options.map(String);
    const answers = (Array.isArray(q.answer) ? q.answer : [q.answer]).map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0 && n < options.length);
    if (!answers.length) return [];
    return [{
      question: q.question, options, answers: [...new Set(answers)].sort((a, b) => a - b),
      multiple: Array.isArray(q.answer), explanation: q.explanation ? String(q.explanation) : '',
      lang: q.lang || null, ownWay: Boolean(q.ownWay),
    }];
  });
}

/** Is this choice (a list of option indexes) exactly right? */
export function isCorrect(question, chosen) {
  const picked = [...new Set((chosen || []).map(Number))].sort((a, b) => a - b);
  return picked.length === question.answers.length && picked.every((n, i) => n === question.answers[i]);
}

/** results: one of true | false | null (not answered) per question. */
export function quizScore(results) {
  const score = results.filter((r) => r === true).length;
  const total = results.length;
  return { score, total, percent: total ? Math.round((score / total) * 100) : 0 };
}

/** The right answer(s) in words: "B" or "A and C" (and = the word for "and"). */
export function answerText(question, and = 'and') {
  const words = question.answers.map((i) => question.options[i]);
  if (words.length <= 1) return words[0] || '';
  return `${words.slice(0, -1).join(', ')} ${and} ${words.at(-1)}`;
}

// Timer (WCAG 2.2.1): a warning 1 minute before the end; the learner can
// add time (extend) or switch the timer off.
export const WARN_SECONDS = 60;

/** 'off' | 'running' | 'warning' | 'over' for a timer with `remaining` seconds. */
export function timerState(remaining, { on = true, warnAt = WARN_SECONDS } = {}) {
  if (!on) return 'off';
  if (remaining <= 0) return 'over';
  if (remaining <= warnAt) return 'warning';
  return 'running';
}

/** Seconds left at `now` for a timer that ends at `endsAt` (ms), whole seconds, never below 0. */
export function remainingSeconds(endsAt, now) {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** Add time: the new end, from the later of now and the old end. */
export function extendTimer(endsAt, now, seconds) {
  return Math.max(endsAt, now) + seconds * 1000;
}

/** 125 -> { minutes: 2, seconds: 5 } for "2 minutes 5 seconds left". */
export function minutesSeconds(total) {
  const s = Math.max(0, Math.round(total));
  return { minutes: Math.floor(s / 60), seconds: s % 60 };
}

// ---------------------------------------------------------------------------
// E4: tables.

/**
 * Header text for each column, from the header rows: rows is a list of rows,
 * each a list of { text, span }. Spanning headers repeat over their columns;
 * several header rows are joined with " – ". Returns one label per column.
 */
export function columnLabels(rows) {
  const columns = [];
  for (const row of rows) {
    let col = 0;
    for (const cell of row) {
      const span = Math.max(1, Number(cell.span) || 1);
      for (let i = 0; i < span; i += 1) {
        const text = String(cell.text || '').trim();
        if (text) columns[col] = columns[col] && columns[col] !== text ? `${columns[col]} – ${text}` : text;
        else columns[col] = columns[col] || '';
        col += 1;
      }
    }
  }
  return columns.map((c) => c || '');
}

/** The value of a cell for sorting: a number when the text is a number, else lower-case text. */
export function sortKey(text) {
  const clean = String(text).trim().replace(/[\s,]/g, '').replace(/%$/, '');
  if (/^-?\d+(\.\d+)?$/.test(clean)) return { n: Number(clean) };
  const time = parseMmss(String(text).trim());
  if (time !== null && /:/.test(text)) return { n: time };
  return { s: String(text).trim().toLocaleLowerCase() };
}

/** Compare two sort keys (numbers before text). */
export function compareKeys(a, b) {
  if ('n' in a && 'n' in b) return a.n - b.n;
  if ('n' in a) return -1;
  if ('n' in b) return 1;
  return a.s.localeCompare(b.s);
}

/** Row order for a sort: rows = [[cellText...]], returns indexes. Stable. */
export function sortedOrder(rows, column, direction = 'ascending') {
  const keyed = rows.map((row, i) => ({ i, key: sortKey(row[column] ?? '') }));
  keyed.sort((a, b) => compareKeys(a.key, b.key) * (direction === 'descending' ? -1 : 1) || a.i - b.i);
  return keyed.map((k) => k.i);
}

// ---------------------------------------------------------------------------
// E7: progress.

/** Percent watched (0-100, whole) from seconds and duration. */
export function percentWatched(seconds, duration) {
  if (!(duration > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((seconds / duration) * 100)));
}

export const COMPLETE_PREFIX = 'fidel-complete:';
