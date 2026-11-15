// Package C: the pure logic (no DOM, no JSON imports), so it can be unit
// tested with node:test (player/test/components-c.test.js).

/** "Your {thing} is {n}" + { thing: 'x', n: 2 } -> "Your x is 2" */
export function fill(text, vars = {}) {
  return String(text).replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/** The interface language: ui-lang, else the page's lang, else English. */
export function pickLang(uiLang, pageLang) {
  const lang = (uiLang || pageLang || 'en').toLowerCase();
  return lang.startsWith('am') ? 'am' : 'en';
}

// ---------------------------------------------------------------------------
// Remembered settings (one localStorage key for the whole package).

export const SETTINGS_KEY = 'fidel-components-c';
export const DEFAULT_SETTINGS = { keepAlerts: true, vibrate: false, neverTimeOut: false };

export function loadSettings(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(SETTINGS_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(changes, storage) {
  const settings = { ...loadSettings(storage), ...changes };
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private mode or storage full: the setting lasts for this page only.
  }
  return settings;
}

// ---------------------------------------------------------------------------
// <fidel-session-keeper> timing (WCAG 2.2.1 Timing Adjustable).

/** The learner always gets at least this long to answer the warning. */
export const MIN_RESPONSE_SECONDS = 20;
/** WCAG 2.2.1: the learner can extend at least 10 times. */
export const MIN_EXTENSIONS = 10;
export const DEFAULT_EXTENSIONS = 20;

/**
 * timeout: seconds until the host ends the session.
 * warnBefore: seconds before that to ask (at least 20, at most the timeout).
 * Returns { timeout, warnBefore, warnAt } in seconds from the start.
 */
export function sessionPlan(timeout, warnBefore) {
  const total = Math.max(MIN_RESPONSE_SECONDS, Number(timeout) || 1800);
  const asked = Number(warnBefore);
  const warn = Math.min(total, Math.max(MIN_RESPONSE_SECONDS, Number.isFinite(asked) && asked > 0 ? asked : 120));
  return { timeout: total, warnBefore: warn, warnAt: total - warn };
}

/** How many extensions are allowed: the attribute, but never fewer than 10. */
export function maxExtensions(attribute) {
  const n = Number(attribute);
  return Math.max(MIN_EXTENSIONS, Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_EXTENSIONS);
}

export function canExtend(used, max) {
  return used < max;
}

/**
 * Words for the time left in the warning, in steps that change at most every
 * 30 seconds (a screen reader is never fed a per-second countdown):
 *   >= 60 s  -> { key: 'minutes'|'minute', n }   (rounded)
 *   31-59 s  -> { key: 'lessThanMinute' }
 *   <= 30 s  -> { key: 'thirtySeconds' }
 */
export function timeLeftPhrase(seconds) {
  const left = Math.max(0, Math.ceil(seconds));
  if (left >= 60) {
    const n = Math.max(1, Math.round(left / 60));
    return n === 1 ? { key: 'minute', n } : { key: 'minutes', n };
  }
  if (left > 30) return { key: 'lessThanMinute' };
  return { key: 'thirtySeconds' };
}

/** A length of time for a sentence: "30 minutes", "1 minute", "40 seconds". */
export function durationPhrase(seconds) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return { key: 'seconds', n: s };
  const n = Math.round(s / 60);
  return n === 1 ? { key: 'minute', n } : { key: 'minutes', n };
}

// ---------------------------------------------------------------------------
// <fidel-lesson-map>

/** The chapter playing at `seconds` (chapters: [{ start, end, text }]). */
export function chapterAt(chapters, seconds) {
  let current = null;
  for (const chapter of chapters) if (chapter.start <= seconds) current = chapter;
  return current;
}

export function clampPercent(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

// ---------------------------------------------------------------------------
// <fidel-help>: the routes the host configured, text first, voice last.

export function helpRoutes({ chat, email, video, phone }) {
  const routes = [];
  if (chat) routes.push({ route: 'chat', href: chat });
  if (email) routes.push({ route: 'email', href: `mailto:${email}`, email });
  if (video) routes.push({ route: 'video', href: video });
  if (phone) routes.push({ route: 'phone', href: `tel:${phone.replace(/[^\d+]/g, '')}`, phone });
  return routes;
}
