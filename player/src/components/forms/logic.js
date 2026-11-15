// Fidel forms: pure logic (no DOM), tested in player/test/components-forms.test.js.
//
//   parseMmss('1:23.5')            -> 83.5     (null if not a time)
//   parsePhoneEt('0911 234567')    -> '+251911234567'  (null if not a phone)
//   isEmail('a@b.org')             -> true
//   checkFormat('mmss', '1:75')    -> 'mmss'   (the error key) or null when fine
//   keyboardHint('selam ', 'am')   -> 'am'     (the keyboard the person needs) or null
//   echoText(...)                  -> what the typing voice should say, or null
//   draftData(data, ['support'])   -> the same data without the sensitive fields

// ---------- Times: minutes:seconds ---------------------------------------------

/**
 * "1:23.5" -> 83.5, "83.5" -> 83.5, "0:05" -> 5, "1:02:03" -> 3723.
 * Seconds after a colon must be below 60. Anything else -> null.
 */
export function parseMmss(text) {
  const value = String(text ?? '').trim();
  if (!value) return null;
  const parts = value.split(':');
  if (parts.length > 3) return null;
  const last = parts.pop();
  if (!/^\d+(\.\d+)?$/.test(last)) return null;
  if (parts.some((p) => !/^\d+$/.test(p))) return null;
  const seconds = Number(last);
  if (parts.length && seconds >= 60) return null;
  if (parts.length === 2 && Number(parts[1]) >= 60) return null;
  return parts.reduce((total, p, i) => total + Number(p) * 60 ** (parts.length - i), 0) + seconds;
}

/** 83.5 -> "1:23.5", 5 -> "0:05". */
export function formatMmss(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const rest = Math.round((total - minutes * 60) * 10) / 10;
  const [whole, tenth] = String(rest).split('.');
  return `${minutes}:${whole.padStart(2, '0')}${tenth ? `.${tenth}` : ''}`;
}

// ---------- Ethiopian phone numbers --------------------------------------------

/**
 * Ethiopian mobile numbers: 09..., 07..., +2519..., 2519..., +2517..., with
 * any spaces, dashes, dots or brackets. Returns "+2519XXXXXXXX" or null.
 */
export function parsePhoneEt(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  if (/[^\d\s\-.()+]/.test(raw) || raw.lastIndexOf('+') > 0) return null;
  const digits = raw.replace(/\D/g, '');
  let local = null;
  if (/^0[79]\d{8}$/.test(digits)) local = digits.slice(1);
  else if (/^251[79]\d{8}$/.test(digits)) local = digits.slice(3);
  else if (/^[79]\d{8}$/.test(digits) && !raw.startsWith('+')) local = digits;
  return local ? `+251${local}` : null;
}

// ---------- Email ---------------------------------------------------------------

/** A practical check: something@something.something, no spaces. */
export function isEmail(text) {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(String(text ?? '').trim());
}

/**
 * Check a value against a format. Returns null when fine (an empty value is
 * fine here: "required" is checked separately), else the error key
 * ('mmss' | 'phone' | 'email' | 'pattern').
 */
export function checkFormat(format, value, pattern) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (format === 'mmss' && parseMmss(text) === null) return 'mmss';
  if (format === 'phone-et' && parsePhoneEt(text) === null) return 'phone';
  if (format === 'email' && !isEmail(text)) return 'email';
  if (pattern) {
    let re = null;
    try { re = new RegExp(`^(?:${pattern})$`, 'u'); } catch { re = null; }
    if (re && !re.test(text)) return 'pattern';
  }
  return null;
}

/** The tidy form of a valid value (phone numbers in +251 form), else the value itself. */
export function normalise(format, value) {
  if (format === 'phone-et') return parsePhoneEt(value) ?? value;
  return value;
}

// ---------- Scripts and the keyboard-language hint -----------------------------

const ETHIOPIC = /[ሀ-፿ᎀ-᎟ⶀ-⷟꬀-꬯]/u;
const ETHIOPIC_LETTER = /[ሀ-ፚᎀ-ᎏⶀ-⷟꬀-꬯]/gu; // not punctuation or numbers
const LATIN_LETTER = /[A-Za-zÀ-ɏ]/g;

/** Number of Ethiopic and Latin letters in a text. */
export function scriptCounts(text) {
  const value = String(text ?? '');
  return {
    ethiopic: (value.match(ETHIOPIC_LETTER) || []).length,
    latin: (value.match(LATIN_LETTER) || []).length,
  };
}

export function hasEthiopic(text) {
  return ETHIOPIC.test(String(text ?? ''));
}

/** Languages written in Ethiopic script, and the one that gets the mirror hint. */
export const ETHIOPIC_LANGS = ['am', 'ti'];
const baseLang = (lang) => String(lang || '').toLowerCase().split('-')[0];

/**
 * Which keyboard the person seems to need, or null.
 *  - Amharic/Tigrinya field: no Ethiopic letters and at least one COMPLETE
 *    Latin word of 3+ letters (followed by a space or punctuation), or 12+
 *    letters of which more than 60% are Latin. Returns the field's language.
 *    One Latin word inside Ethiopic text ("ሰላም HTML ነው") gives no hint.
 *  - English field: the mirror (complete Ethiopic word, no Latin) -> 'en'.
 *  - Any other language (om, so, ar...): never.
 */
export function keyboardHint(text, lang) {
  const value = String(text ?? '');
  const field = baseLang(lang);
  const { ethiopic, latin } = scriptCounts(value);
  if (ETHIOPIC_LANGS.includes(field)) {
    const letters = ethiopic + latin;
    if (letters >= 12 && latin / letters > 0.6) return field;
    if (ethiopic === 0 && /[A-Za-z]{3,}[^A-Za-z]/.test(value)) return field;
    return null;
  }
  if (field === 'en') {
    const letters = ethiopic + latin;
    if (letters >= 12 && ethiopic / letters > 0.6) return 'en';
    if (latin === 0 && /[ሀ-ፚ]{2,}[^ሀ-ፚ]/u.test(value)) return 'en';
  }
  return null;
}

/** Caps Lock warning by default only for Latin-script fields. */
export function capsWarningDefault(lang) {
  return !ETHIOPIC_LANGS.includes(baseLang(lang));
}

// ---------- Typing echo ---------------------------------------------------------

/**
 * What the typing voice says after an input.
 *   mode 'characters': the letters just typed (inserted).
 *   mode 'words': the last word, once a space or punctuation ends it.
 * value is the whole field text after the input, cursor the caret position.
 */
export function echoText(mode, { inserted, value = '', cursor = value.length }) {
  if (mode === 'characters' || mode === 'letters') {
    if (!inserted) return null;
    return inserted === ' ' ? null : inserted;
  }
  if (mode === 'words') {
    if (!inserted || !/[\s.,;:!?።፣፤፥፦፧፨]$/u.test(inserted)) return null;
    const before = value.slice(0, Math.max(0, cursor - 1));
    const word = before.split(/[\s.,;:!?።፣፤፥፦፧፨]+/u).pop();
    return word || null;
  }
  return null;
}

// ---------- Files ---------------------------------------------------------------

/** "50MB", "500 kB", "2GB" or a number of bytes -> bytes (null if unreadable). */
export function parseSize(text) {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?\s*$/i.exec(String(text ?? ''));
  if (!match) return null;
  const unit = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9 }[(match[2] || 'b').toLowerCase()];
  return Math.round(Number(match[1]) * unit);
}

/** Bytes -> { value, unit } for "1.2 MB", "350 KB". */
export function sizeParts(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n >= 1e9) return { value: round(n / 1e9), unit: 'GB' };
  if (n >= 1e6) return { value: round(n / 1e6), unit: 'MB' };
  if (n >= 1e3) return { value: Math.round(n / 1e3), unit: 'KB' };
  return { value: n, unit: 'B' };
}
const round = (n) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);

export function sizeText(bytes) {
  const { value, unit } = sizeParts(bytes);
  return `${value} ${unit}`;
}

/** Does a file (name, type) match an accept list such as "video/*,.pdf"? Empty accept = anything. */
export function fileAccepted(accept, { name = '', type = '' }) {
  const rules = String(accept || '').split(',').map((r) => r.trim().toLowerCase()).filter(Boolean);
  if (!rules.length) return true;
  const lowerName = name.toLowerCase();
  const lowerType = type.toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith('.')) return lowerName.endsWith(rule);
    if (rule.endsWith('/*')) return lowerType.startsWith(rule.slice(0, -1));
    return lowerType === rule;
  });
}

/** Words for an accept list: ['video', 'pdf'] keys for the text files (unknown ones as written). */
export function acceptKinds(accept) {
  const kinds = [];
  for (const rule of String(accept || '').split(',').map((r) => r.trim().toLowerCase()).filter(Boolean)) {
    let kind = rule;
    if (rule.startsWith('video/')) kind = 'video';
    else if (rule.startsWith('audio/')) kind = 'audio';
    else if (rule.startsWith('image/')) kind = 'image';
    else if (['.pdf', 'application/pdf'].includes(rule)) kind = 'pdf';
    else if (['.doc', '.docx', '.odt', 'application/msword'].includes(rule) || rule.includes('wordprocessingml')) kind = 'word';
    else if (['.txt', 'text/plain'].includes(rule)) kind = 'text';
    if (!kinds.includes(kind)) kinds.push(kind);
  }
  return kinds;
}

/** The file extension, for messages ("a .exe file"). */
export function extensionOf(name) {
  const match = /\.([a-z0-9]{1,8})$/i.exec(String(name || ''));
  return match ? `.${match[1].toLowerCase()}` : '';
}

// ---------- Drafts and the offline queue -----------------------------------------

export const DRAFT_PREFIX = 'fidel-form-draft:';
export const OUTBOX_PREFIX = 'fidel-form-outbox:';

/** "a, b ,c" -> ['a', 'b', 'c'] */
export function nameList(text) {
  return String(text || '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** A copy of the data without the sensitive fields (never stored). */
export function draftData(data, sensitive = []) {
  const copy = {};
  for (const [name, value] of Object.entries(data || {})) {
    if (!sensitive.includes(name)) copy[name] = value;
  }
  return copy;
}

/**
 * Form entries ([name, value] pairs, as from FormData) -> a plain object.
 * A name used twice (checkboxes) becomes an array; files are left out.
 * multiple: names that are always arrays (checkbox groups), even with one value.
 */
export function entriesToObject(entries, multiple = []) {
  const data = {};
  for (const name of multiple) data[name] = [];
  for (const [name, value] of entries) {
    if (typeof value !== 'string') continue; // a File: never in JSON or drafts
    if (Array.isArray(data[name])) data[name].push(value);
    else if (name in data) data[name] = [data[name], value];
    else data[name] = value;
  }
  return data;
}

/** Read a JSON value from storage; null if missing, broken or blocked. */
export function readStored(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Write a JSON value (or remove it when value is null). False if storage is blocked or full. */
export function writeStored(storage, key, value) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
