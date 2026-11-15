// Reading a field aloud ("Listen") and the typing voice.
//
// Voices, in this order:
//   1. the browser's own voice for the field's language (speechSynthesis);
//   2. for "Listen" only: the server's optional voice engine, if the field has
//      voice-api="/api/v1" and GET {voice-api}/speak lists the language.
// No voice for the language -> no "Listen" button (and no typing voice).
// Only one thing is spoken at a time: starting new speech stops the old.
import { baseLang } from './common.js';

const synth = () => globalThis.speechSynthesis;
let audio = null; // the server voice's <audio>, while it plays
let stopCurrent = null; // calls the "ended" callback of whatever is speaking

/** Resolves when the browser has listed its voices (or after 1.5 s). */
export function voicesReady() {
  const s = synth();
  if (!s) return Promise.resolve([]);
  if (s.getVoices().length) return Promise.resolve(s.getVoices());
  return new Promise((resolve) => {
    const done = () => resolve(s.getVoices());
    s.addEventListener?.('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

/** The browser's voice for a language ("am" matches "am-ET"), else null. */
export function browserVoice(lang) {
  const want = baseLang(lang);
  if (!want || !synth()) return null;
  return synth().getVoices().find((v) => baseLang(v.lang) === want) || null;
}

const serverLanguages = new Map(); // api -> Promise<string[]>

/** Languages the server's voice engine reads ([] when it has none). Asked once per page. */
export function serverVoiceLanguages(api) {
  if (!api) return Promise.resolve([]);
  if (!serverLanguages.has(api)) {
    serverLanguages.set(api, fetch(`${api}/speak`)
      .then((r) => (r.ok ? r.json() : { languages: [] }))
      .then((body) => (Array.isArray(body.languages) ? body.languages : []))
      .catch(() => []));
  }
  return serverLanguages.get(api);
}

/** Stop whatever is being spoken. */
export function stopSpeaking() {
  synth()?.cancel();
  if (audio) {
    audio.pause();
    URL.revokeObjectURL(audio.src);
    audio = null;
  }
  const callback = stopCurrent;
  stopCurrent = null;
  callback?.();
}

/** Speak with the browser voice. onEnd runs once, when it ends or is stopped. */
export function speakWithBrowser(words, voice, { onEnd, rate = 1 } = {}) {
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(words);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = rate;
  let finished = false;
  const end = () => {
    if (finished) return;
    finished = true;
    if (stopCurrent === end) stopCurrent = null;
    onEnd?.();
  };
  utterance.onend = end;
  utterance.onerror = end;
  stopCurrent = end;
  synth().speak(utterance);
}

/** Speak with the server's voice engine. Rejects with the server's words if it cannot. */
export async function speakWithServer(api, words, lang, { onEnd } = {}) {
  stopSpeaking();
  let finished = false;
  const end = () => {
    if (finished) return;
    finished = true;
    if (stopCurrent === end) stopCurrent = null;
    onEnd?.();
  };
  stopCurrent = end;
  const response = await fetch(`${api}/speak`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: words, lang: baseLang(lang) }),
  });
  if (finished) return; // stopped while waiting
  if (!response.ok) {
    end();
    throw new Error((await response.json().catch(() => ({}))).detail || `HTTP ${response.status}`);
  }
  const blob = await response.blob();
  if (finished) return;
  audio = new Audio(URL.createObjectURL(blob));
  audio.onended = () => stopSpeaking();
  audio.onerror = () => stopSpeaking();
  await audio.play().catch(() => stopSpeaking());
}
