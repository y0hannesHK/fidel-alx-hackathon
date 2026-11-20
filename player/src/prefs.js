// Learner preferences, saved only in this browser (localStorage).
// Nothing here is ever sent to a server. No account is needed.

const STORAGE_KEY = 'fidel-prefs';

export const DEFAULT_PREFS = {
  uiLang: null, // null = use the page's lang attribute
  captionLang: null, // 'en' | 'am' | 'off'; null = first available
  captionSize: 150, // percent, 100–250
  captionColours: 'white-on-black',
  captionBackground: 100, // background opacity, percent
  captionPosition: 'below', // 'below' | 'over-bottom' | 'over-top'
  signLayout: 'docked', // 'docked' (beside the video) | 'floating' (over it)
  signSize: 'medium', // 'small' | 'medium' | 'large'
  signCorner: 'bottom-right',
  signWait: false, // true = sign every word; the lesson pauses until the signer finishes each caption
  playbackRate: 1,
  lowData: false, // true = play the small video rendition
  simpleWords: false, // <fidel-simple-mode>: show the simple version (Package A)
  sectionLanguage: null, // <fidel-lang>: last chosen section language (Package B)
  typingVoice: 'off', // form fields: say each 'words' or 'characters' as typed (Forms); off by default
  lessonFormat: null, // <fidel-lesson-formats>: watch | listen | read | sign | simple (Package E)
};

export const CAPTION_SIZE = { min: 100, max: 250, step: 25 };

/** Read saved preferences, filling in defaults. Never throws. */
export function loadPrefs(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULT_PREFS, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    // Storage blocked (private mode, strict settings) or bad JSON: use defaults.
    return { ...DEFAULT_PREFS };
  }
}

/** Save preferences. Fails silently if storage is not available. */
export function savePrefs(prefs, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Not fatal: settings just won't be remembered next time.
  }
}

/** Keep a caption size inside the allowed range and on a step. */
export function clampCaptionSize(size) {
  const { min, max, step } = CAPTION_SIZE;
  const stepped = Math.round(size / step) * step;
  return Math.min(max, Math.max(min, stepped));
}
