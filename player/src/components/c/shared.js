// Package C: small helpers every component in this package uses:
// the text in the learner's language, remembered settings, and a modal
// <dialog> that returns focus to the button that opened it.
import { h } from '../../dom.js';
import { fill, pickLang, loadSettings, saveSettings } from './logic.js';
import en from '../../../i18n/components-c.en.json';
import am from '../../../i18n/components-c.am.json';

const TEXT = { en, am };

/** The interface language of a component: ui-lang, else the page's lang. */
export function langOf(element) {
  return pickLang(element.getAttribute('ui-lang'), document.documentElement.lang);
}

/** tr('am')('navPosition', { n: 3, total: 8 }) -> "ትምህርት 3 ከ8" */
export function translator(lang) {
  return (key, vars) => fill(TEXT[lang]?.[key] ?? TEXT.en[key] ?? key, vars);
}

export function storage() {
  try {
    return window.localStorage;
  } catch {
    return null; // storage blocked: settings last for this page only
  }
}

export const settings = {
  load: () => loadSettings(storage()),
  save: (changes) => saveSettings(changes, storage()),
};

/** Ethiopic text? (to set lang="am" on words that came from attributes) */
export function textLang(text, fallback) {
  return /[ሀ-᎟ⶀ-⷟]/.test(text || '') ? 'am' : fallback;
}

let count = 0;
export function nextId(prefix) {
  count += 1;
  return `${prefix}-${count}`;
}

/**
 * A native modal <dialog> with a heading, the given body and a Close button.
 * Escape closes it (the browser does that); focus goes back to the opener.
 * Returns { dialog, open(opener), close() }.
 */
export function makeDialog({ className, lang, title, titleLang, body, closeLabel, onClose }) {
  const titleId = nextId('fidel-c-dialog');
  const close = h('button', { type: 'button', class: 'fidel-c-button', onclick: () => dialog.close() }, closeLabel);
  const heading = h('h2', { id: titleId, class: 'fidel-c-dialog-title', lang: titleLang }, title);
  const dialog = h('dialog', { class: `fidel-c-dialog ${className}`, lang, 'aria-labelledby': titleId },
    heading, body, h('div', { class: 'fidel-c-row' }, close));
  let opener = null;
  dialog.addEventListener('close', () => {
    onClose?.();
    if (opener?.isConnected) opener.focus();
    opener = null;
  });
  return {
    dialog,
    heading,
    open(from) {
      opener = from || document.activeElement;
      if (!dialog.open) dialog.showModal();
    },
    close: () => dialog.open && dialog.close(),
  };
}

export { h };
