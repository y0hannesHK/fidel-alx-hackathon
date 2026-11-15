// Package B text: English and Amharic, from player/i18n/components-b.*.json.
// To change a word, edit the JSON file and rebuild (npm run build).
import en from '../../../i18n/components-b.en.json';
import am from '../../../i18n/components-b.am.json';
import { fill, pickLang } from './logic.js';

const ALL = { en, am };

/** The interface language of a component: its ui-lang, else the page's lang, else English. */
export function langOf(element) {
  return pickLang(element.getAttribute('ui-lang'), document.documentElement.lang);
}

/** A translator for one language: tr('ready', { label }) */
export function translator(lang) {
  const table = ALL[lang] || en;
  return (key, vars) => fill(table[key] ?? en[key] ?? key, vars);
}

/** A whole entry (for objects such as languageNames). */
export function entry(lang, key) {
  return (ALL[lang] || en)[key] ?? en[key];
}
