// Shared helpers for the Fidel form components: interface text (en/am from
// player/i18n/components-forms.*.json), the interface language, events.
// To change a word, edit the JSON file and rebuild (npm run build).
import { h } from '../../dom.js';
import en from '../../../i18n/components-forms.en.json';
import am from '../../../i18n/components-forms.am.json';

const TEXT = { en, am };

/** Every Fidel form field tag (the error summary and <fidel-form> look for these). */
export const FIELD_TAGS = ['fidel-input', 'fidel-textarea', 'fidel-choice', 'fidel-select', 'fidel-file', 'fidel-date'];

/**
 * The language of OUR messages: ui-lang on the element or any ancestor
 * (e.g. on <fidel-form>), else the page's <html lang>, else English.
 * Not the element's own lang: that is the language of the CONTENT.
 */
export function uiLang(element) {
  const lang = element.closest('[ui-lang]')?.getAttribute('ui-lang') || document.documentElement.lang || 'en';
  return lang.toLowerCase().startsWith('am') ? 'am' : 'en';
}

/** text('am', 'field.errors.mmss') or text('en', 'summary.many', { count: 2 }). English if missing. */
export function text(lang, key, values = {}) {
  const find = (strings) => key.split('.').reduce((node, part) => node?.[part], strings);
  const found = find(TEXT[lang]) ?? find(TEXT.en) ?? key;
  return String(found).replace(/\{(\w+)\}/g, (match, name) => (name in values ? values[name] : match));
}

/** Dispatch a bubbling, composed event. Returns false if a listener called preventDefault(). */
export function emit(element, name, detail = {}, { cancelable = false } = {}) {
  return element.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable }));
}

/** Text only for screen readers (e.g. which field a "Listen" button reads). */
export function srOnly(words) {
  return h('span', { class: 'fidel-field-sr' }, words);
}

/** The base language code: "am-ET" -> "am". */
export function baseLang(lang) {
  return String(lang || '').toLowerCase().split('-')[0];
}
