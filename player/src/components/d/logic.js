// Pure logic for Package D components (no DOM), so it can be unit-tested
// with node --test (player/test/components-d.test.js).

// ---------------------------------------------------------------------------
// D4: the Fidel (Ethiopic syllable) table, built from Unicode.
//
// Each consonant row in the Ethiopic block (U+1200..) is 8 code points:
// base + 0..6 are the seven vowel orders (ä u i a e ə o), and base + 7 is
// usually the labialised "wa" form (ሏ ሟ ሯ ...). Exceptions:
//   - ሀ ወ ዐ የ ፀ: base + 7 is not a "wa" form (ሇ ዏ ዯ ፇ are rare letters
//     for other languages) or is unassigned (U+12D7): no 8th form.
//   - አ: base + 7 is ኧ (glottal wa), used in Amharic.
//   - ቀ ኀ ከ ኸ ገ: base + 7 is a rare "-oa" letter; their "wa" forms live in
//     a separate labiovelar row (ቋ ኋ ኳ ዃ ጓ), so we use those.

export const CONSONANTS = [
  ['ሀ', 'h'], ['ለ', 'l'], ['ሐ', 'h'], ['መ', 'm'], ['ሠ', 's'], ['ረ', 'r'], ['ሰ', 's'], ['ሸ', 'sh'],
  ['ቀ', 'q'], ['በ', 'b'], ['ቨ', 'v'], ['ተ', 't'], ['ቸ', 'ch'], ['ኀ', 'h'], ['ነ', 'n'], ['ኘ', 'ny'],
  ['አ', ''], ['ከ', 'k'], ['ኸ', 'kh'], ['ወ', 'w'], ['ዐ', ''], ['ዘ', 'z'], ['ዠ', 'zh'], ['የ', 'y'],
  ['ደ', 'd'], ['ጀ', 'j'], ['ገ', 'g'], ['ጠ', "t'"], ['ጨ', "ch'"], ['ጰ', "p'"], ['ጸ', "ts'"], ['ፀ', "ts'"],
  ['ፈ', 'f'], ['ፐ', 'p'],
];

const NO_WA = new Set(['ሀ', 'ወ', 'ዐ', 'የ', 'ፀ']);
const LABIOVELAR_WA = { 'ቀ': 0x124b, 'ኀ': 0x128b, 'ከ': 0x12b3, 'ኸ': 0x12c3, 'ገ': 0x1313 };
const VOWELS = ['e', 'u', 'i', 'a', 'ie', '', 'o'];
const GLOTTAL_VOWELS = ['a', 'u', 'i', 'a', 'ie', 'i', 'o']; // አ and ዐ rows

/** The forms of one consonant: [{ char, latin }] (7, or 8 with the "wa" form). */
export function syllableRow(consonant) {
  const entry = CONSONANTS.find(([c]) => c === consonant);
  if (!entry) return [];
  const [, latin] = entry;
  const base = consonant.codePointAt(0);
  const vowels = latin ? VOWELS : GLOTTAL_VOWELS;
  const row = vowels.map((vowel, i) => ({ char: String.fromCodePoint(base + i), latin: latin + vowel || vowel }));
  if (!NO_WA.has(consonant)) {
    const wa = LABIOVELAR_WA[consonant] ?? base + 7;
    row.push({ char: String.fromCodePoint(wa), latin: `${latin}wa` });
  }
  return row;
}

/** The whole table: [{ consonant, latin, forms: [{ char, latin }] }]. */
export function fidelTable() {
  return CONSONANTS.map(([consonant]) => {
    const forms = syllableRow(consonant);
    return { consonant, latin: forms[0].latin, forms };
  });
}

/**
 * "Delete one letter": remove the character (one whole letter, never half of
 * one) just before the cursor. Returns the new value and cursor position,
 * and what was removed ('' if nothing).
 */
export function deleteOneLetter(value, cursor = value.length) {
  const before = value.slice(0, cursor);
  if (!before) return { value, cursor, removed: '' };
  let removed;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const parts = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(before)];
    removed = parts.at(-1).segment;
  } else {
    removed = Array.from(before).at(-1);
  }
  const start = cursor - removed.length;
  return { value: value.slice(0, start) + value.slice(cursor), cursor: start, removed };
}

// ---------------------------------------------------------------------------
// D2: times typed by learners, and the offline queue of caption reports.

/** "1:05" -> 65, "65" -> 65, "1:02:05" -> 3725; NaN if it is not a time. */
export function parseClock(textValue) {
  const textTrim = String(textValue).trim();
  if (/^\d+$/.test(textTrim)) return Number(textTrim);
  if (!/^\d{1,3}(:[0-5]\d){1,2}$/.test(textTrim)) return NaN;
  return textTrim.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

export const QUEUE_KEY = 'fidel-caption-report-queue';

/** Reports saved on this device while offline (never throws). */
export function loadQueue(storage = globalThis.localStorage) {
  try {
    const items = JSON.parse(storage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function saveQueue(items, storage = globalThis.localStorage) {
  try {
    if (items.length) storage.setItem(QUEUE_KEY, JSON.stringify(items));
    else storage.removeItem(QUEUE_KEY);
    return true;
  } catch {
    return false; // storage full or blocked
  }
}

/** Add { url, body, lessonId } to the queue. Returns false if it could not be saved. */
export function queueReport(item, storage = globalThis.localStorage) {
  return saveQueue([...loadQueue(storage), { ...item, savedAt: Date.now() }], storage);
}

/**
 * Send every saved report. send(item) resolves to the HTTP status, or
 * throws if there is no connection. Sent (2xx) and refused (4xx: will never
 * be accepted) reports leave the queue; the rest stay for next time.
 * Returns { sent: [items], refused: [items], kept: [items] }.
 */
export async function flushQueue(send, storage = globalThis.localStorage) {
  const result = { sent: [], refused: [], kept: [] };
  for (const item of loadQueue(storage)) {
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
  saveQueue(result.kept, storage);
  return result;
}

// ---------------------------------------------------------------------------
// D5: live events.

export const JOIN_MINUTES_BEFORE = 15;

/** 'before' | 'open' | 'ended': the Join link shows only while 'open'. */
export function joinState(now, start, end, minutesBefore = JOIN_MINUTES_BEFORE) {
  const t = now.getTime();
  if (t < start.getTime() - minutesBefore * 60000) return 'before';
  if (t > end.getTime()) return 'ended';
  return 'open';
}

/** Length in whole hours and minutes: { hours, minutes }. */
export function durationParts(start, end) {
  const total = Math.max(0, Math.round((end - start) / 60000));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

const icsTime = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEscape = (value) => String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Fold lines longer than 75 bytes (RFC 5545), never splitting a letter. */
function fold(line) {
  const encoder = new TextEncoder();
  const out = [];
  let current = '';
  for (const char of line) {
    if (encoder.encode(current + char).length > (out.length ? 74 : 75)) {
      out.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.join('\r\n ');
}

/** An iCalendar (.ics) file for one event. */
export function buildIcs({ uid, title, start, end, url, description, now = new Date() }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fidel//Event card//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsTime(now)}`,
    `DTSTART:${icsTime(start)}`,
    `DTEND:${icsTime(end)}`,
    `SUMMARY:${icsEscape(title)}`,
    description && `DESCRIPTION:${icsEscape(description)}`,
    url && `URL:${url}`,
    url && `LOCATION:${icsEscape(url)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** A schema.org Event (JSON-LD, Level 3) for an online session. */
export function eventJsonLd({ title, start, end, joinUrl, languages, description }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: title,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'VirtualLocation', ...(joinUrl ? { url: joinUrl } : {}) },
    inLanguage: languages,
    description,
  };
}

// ---------------------------------------------------------------------------
// D6: sign-language answers.

/** The first recording type this browser supports (smallest files first). */
export function pickRecorderType(isTypeSupported) {
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  return types.find((type) => {
    try {
      return isTypeSupported(type);
    } catch {
      return false;
    }
  }) || '';
}

/** 1234567 -> "1.2" (MB, one decimal; at least 0.1). */
export function megabytes(bytes) {
  return Math.max(0.1, Math.round(bytes / 104857.6) / 10).toFixed(1);
}
