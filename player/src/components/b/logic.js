// Package B: the pure logic (no DOM), so it can be unit-tested with node:test
// (player/test/components-b.test.js). The components import from here.
import { toEthiopian, MONTHS_AM } from '../../ethiopian-calendar.js';

/** fill('Load it ({size})', { size: '45 MB' }) -> 'Load it (45 MB)' */
export function fill(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

/** 'en' or 'am': the ui-lang attribute, else the page's lang, else English. */
export function pickLang(attr, pageLang) {
  const lang = (attr || pageLang || 'en').toLowerCase();
  return lang.startsWith('am') ? 'am' : 'en';
}

// ---------- B1 data saver: sizes ---------------------------------------------

/**
 * Bytes -> the number of megabytes to show, rounded sensibly:
 * under 1 MB one decimal (never 0: at least 0.1), under 10 MB one decimal
 * unless it is whole, from 10 MB whole numbers. Megabytes of 1,000,000
 * bytes, like phone data bundles. Returns null when the size is unknown.
 */
export function megabytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return null;
  const mb = n / 1_000_000;
  if (mb >= 10) return Math.round(mb);
  return Math.max(0.1, Math.round(mb * 10) / 10);
}

/** 45000000 -> '45 MB' (number written for the learner's language). */
export function formatSize(bytes, lang = 'en', template = '{n} MB') {
  const mb = megabytes(bytes);
  if (mb === null) return null;
  const n = new Intl.NumberFormat(lang === 'am' ? 'am-ET' : 'en', { maximumFractionDigits: 1 }).format(mb);
  return fill(template, { n });
}

/** Is this address a video or audio file the browser can play in place? */
export function isMedia(href) {
  return /\.(mp4|webm|ogv|ogg|mp3|m4a|wav)(\?|#|$)/i.test(href || '');
}

// ---------- B3 download later: the queue ------------------------------------

/** Add an item (once per address). Returns a new array. */
export function enqueue(queue, item) {
  const rest = queue.filter((q) => q.href !== item.href);
  return [...rest, { href: item.href, label: item.label, size: item.size || null, wifiOnly: Boolean(item.wifiOnly) }];
}

export function dequeue(queue, href) {
  return queue.filter((q) => q.href !== href);
}

/** The items that may download now. connection: { online, type } (type undefined = unknown). */
export function readyToDownload(queue, { online, type }) {
  if (!online) return [];
  // "Only on Wi-Fi" waits for Wi-Fi (or a cable). If the type cannot be
  // known, the option was never offered, so it cannot be set.
  const onWifi = type === 'wifi' || type === 'ethernet';
  return queue.filter((q) => !q.wifiOnly || onWifi || type === undefined);
}

/** Read the queue from storage, never throwing. */
export function parseQueue(text) {
  try {
    const value = JSON.parse(text || '[]');
    return Array.isArray(value) ? value.filter((q) => q && typeof q.href === 'string') : [];
  } catch {
    return [];
  }
}

// ---------- B4 Ethiopian date --------------------------------------------------

const WEEKDAYS_AM = ['እሑድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ'];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

/** '2026-11-15' (or a longer ISO date-time) -> [2026, 11, 15], or null. */
export function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return [y, m, d];
}

/**
 * The Ethiopian date, from the browser's own Ethiopic calendar when it has
 * one (Intl), otherwise from player/src/ethiopian-calendar.js.
 */
export function ethiopianDate(y, m, d, { useIntl = true } = {}) {
  if (useIntl) {
    try {
      const format = new Intl.DateTimeFormat('en-u-ca-ethiopic', {
        year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC',
      });
      if (format.resolvedOptions().calendar === 'ethiopic') {
        const parts = Object.fromEntries(format.formatToParts(new Date(Date.UTC(y, m - 1, d)))
          .map((p) => [p.type, p.value]));
        const result = { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
        if (result.year && result.month && result.day) return result;
      }
    } catch {
      // No Ethiopic calendar in this browser: use our own conversion below.
    }
  }
  return toEthiopian(y, m, d);
}

/**
 * Both calendars as two pieces, in the order for the interface language.
 * Returns [{ text, lang }, { text, lang }].
 *   en short: 15 Nov 2026 / ህዳር 6 2019
 *   am short: ህዳር 6 2019 / 15 Nov 2026
 *   long adds the weekday, the full month name and ዓ.ም. (Ethiopian era).
 */
export function bothCalendars(iso, { lang = 'en', format = 'short', useIntl = true } = {}) {
  const parsed = parseIsoDate(iso);
  if (!parsed) return null;
  const [y, m, d] = parsed;
  const eth = ethiopianDate(y, m, d, { useIntl });
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const long = format === 'long';
  const gregorian = long
    ? `${WEEKDAYS_EN[weekday]} ${d} ${MONTHS_LONG[m - 1]} ${y}`
    : `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
  const ethiopian = long
    ? `${WEEKDAYS_AM[weekday]} ${MONTHS_AM[eth.month - 1]} ${eth.day} ${eth.year} ዓ.ም.`
    : `${MONTHS_AM[eth.month - 1]} ${eth.day} ${eth.year}`;
  const g = { text: gregorian, lang: 'en' };
  const e = { text: ethiopian, lang: 'am' };
  return lang === 'am' ? [e, g] : [g, e];
}

// ---------- B5 section language ------------------------------------------------

/** Each language's name in its own language (the player uses the same names). */
export const AUTONYMS = {
  en: 'English', am: 'አማርኛ', om: 'Afaan Oromoo', ti: 'ትግርኛ', so: 'Soomaali', ar: 'العربية',
};
export const RTL = new Set(['ar', 'he', 'fa', 'ur']);

/** Which version to show: the remembered one, else the interface language, else the first. */
export function chooseLanguage(available, remembered, uiLang) {
  if (remembered && available.includes(remembered)) return remembered;
  if (uiLang && available.includes(uiLang)) return uiLang;
  return available[0] || null;
}

// ---------- B6 display settings --------------------------------------------------

export const DISPLAY_DEFAULTS = { size: 100, spacing: 'normal', contrast: 'normal', still: false, focus: false };
export const TEXT_SIZES = [100, 125, 150, 200];

/** Saved settings -> clean settings (unknown values fall back to the defaults). */
export function cleanDisplay(saved) {
  const s = { ...DISPLAY_DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
  return {
    size: TEXT_SIZES.includes(Number(s.size)) ? Number(s.size) : 100,
    spacing: s.spacing === 'wide' ? 'wide' : 'normal',
    contrast: ['high', 'yellow'].includes(s.contrast) ? s.contrast : 'normal',
    still: s.still === true,
    focus: s.focus === true,
  };
}

/** Settings -> the classes put on each target (all start with fidel-dp-). */
export function displayClasses(settings) {
  const s = cleanDisplay(settings);
  const classes = [];
  if (s.size !== 100) classes.push(`fidel-dp-size-${s.size}`);
  if (s.spacing === 'wide') classes.push('fidel-dp-wide');
  if (s.contrast !== 'normal') classes.push(`fidel-dp-contrast-${s.contrast}`);
  if (s.still) classes.push('fidel-dp-still');
  if (s.focus) classes.push('fidel-dp-focus');
  return classes;
}
