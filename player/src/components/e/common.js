// Shared helpers for Package E components: interface text (en/am from
// player/i18n/components-e.*.json), the interface language, events, and
// the video a component follows.
import en from '../../../i18n/components-e.en.json';
import am from '../../../i18n/components-e.am.json';

const TEXT = { en, am };

/** ui-lang="en|am" on the element; else the nearest lang; else English. */
export function uiLang(element) {
  const lang = element.getAttribute('ui-lang') || element.closest('[lang]')?.getAttribute('lang') || 'en';
  return lang.toLowerCase().startsWith('am') ? 'am' : 'en';
}

/** text('am', 'notes', 'add', { time: '1:23' }); English if the Amharic is missing. */
export function text(lang, section, key, values = {}) {
  const find = (strings) => key.split('.').reduce((node, part) => node?.[part], strings?.[section]);
  const found = find(TEXT[lang]) ?? find(TEXT.en) ?? key;
  return String(found).replace(/\{(\w+)\}/g, (match, name) => (name in values ? values[name] : match));
}

/** A translator bound to one language and section: tt('add', { time }). */
export function translator(lang, section) {
  return (key, values) => text(lang, section, key, values);
}

/** Dispatch a bubbling, composed fidel-... event. */
export function emit(element, name, detail = {}) {
  element.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

/** The player a component follows: for="id", else the first <fidel-player>. */
export function findPlayer(element) {
  const id = element.getAttribute('for');
  return id ? document.getElementById(id) : document.querySelector('fidel-player');
}

/** The <video>/<audio> inside a player (or the element itself if it is one). */
export function mediaOf(player) {
  if (!player) return null;
  if (player instanceof HTMLMediaElement) return player;
  return player.ablePlayer?.media || player.querySelector('video, audio');
}

/** Seek and play (a <fidel-player> or plain media). */
export function playFrom(player, seconds) {
  if (player?.ablePlayer && typeof player.playFrom === 'function') {
    player.playFrom(seconds);
    return true;
  }
  const media = mediaOf(player);
  if (!media) return false;
  media.currentTime = seconds;
  media.play()?.catch?.(() => {});
  return true;
}

/** Ethiopic text needs lang="am" on its element: pass it through when the UI is Amharic. */
export const langAttr = (lang) => (lang === 'am' ? 'am' : 'en');
