// Shared helpers for Package D components: interface text (en/am) and the
// interface language of a component.
import en from '../../../i18n/components-d.en.json';
import am from '../../../i18n/components-d.am.json';

const TEXT = { en, am };

/** ui-lang="en|am" on the element; else the nearest lang; else English. */
export function uiLang(element) {
  const lang = element.getAttribute('ui-lang') || element.closest('[lang]')?.getAttribute('lang') || 'en';
  return lang.toLowerCase().startsWith('am') ? 'am' : 'en';
}

/**
 * Text for a component: text(lang, 'report', 'thanks') or with a {name}
 * placeholder: text(lang, 'keyboard', 'inserted', { letter: 'ሉ' }).
 * Falls back to English if an Amharic text is missing.
 */
export function text(lang, section, key, values = {}) {
  const path = key.split('.');
  const find = (strings) => path.reduce((node, part) => node?.[part], strings?.[section]);
  const found = find(TEXT[lang]) ?? find(TEXT.en) ?? key;
  return String(found).replace(/\{(\w+)\}/g, (match, name) => (name in values ? values[name] : match));
}

/** A translator bound to one language and section: tt('thanks'). */
export function translator(lang, section) {
  return (key, values) => text(lang, section, key, values);
}

/** Dispatch a bubbling, composed fidel-... event. */
export function emit(element, name, detail = {}) {
  element.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}
