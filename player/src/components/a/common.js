// Package A: small helpers shared by the Package A components.
// Text lives in player/i18n/components-a.en.json and .am.json.
import en from '../../../i18n/components-a.en.json';
import am from '../../../i18n/components-a.am.json';
import { fill } from './logic.js';

const TABLES = { en, am };

/** The interface language of a component: ui-lang="en|am", else the page's lang, else English. */
export function uiLang(element) {
  const lang = element.getAttribute('ui-lang') || document.documentElement.lang || 'en';
  return lang.toLowerCase().startsWith('am') ? 'am' : 'en';
}

/** The language table for an element's interface language (English fills gaps). */
export function stringsFor(element) {
  const lang = uiLang(element);
  return { ...en, ...TABLES[lang], symbolWords: { ...en.symbolWords, ...TABLES[lang].symbolWords } };
}

/** tr(strings, 'playFrom', { time: '1:23' }) -> 'Play from 1:23'. */
export function tr(strings, key, values) {
  return fill(strings[key] ?? en[key] ?? key, values);
}

/** Ethiopic text needs lang="am" on the element (font and line height follow it in CSS). */
export function langAttr(element) {
  return uiLang(element) === 'am' ? 'am' : null;
}

/**
 * The video a component follows: for="id" (a <fidel-player>, <video> or
 * <audio>), else the first <fidel-player> on the page. Null if there is none.
 */
export function findPlayer(id) {
  if (id) return document.getElementById(id);
  return document.querySelector('fidel-player');
}

/** Seek a <fidel-player> (or a plain <video>/<audio>) and play. True if it worked. */
export function playFrom(player, seconds) {
  if (!player) return false;
  if (typeof player.playFrom === 'function' && player.ablePlayer) {
    player.playFrom(seconds);
    return true;
  }
  const media = player instanceof HTMLMediaElement ? player : player.querySelector('video, audio');
  if (!media) return false;
  media.currentTime = seconds;
  media.play()?.catch?.(() => {});
  return true;
}

/** A browser voice for a language ('en', 'am', 'om'), or null. */
export function voiceFor(lang) {
  if (!('speechSynthesis' in window) || !lang) return null;
  const want = lang.toLowerCase().split('-')[0];
  const voices = window.speechSynthesis.getVoices() || [];
  return voices.find((v) => (v.lang || '').toLowerCase().replace('_', '-').split('-')[0] === want) || null;
}
