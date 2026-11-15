// <fidel-read-aloud lang="am"><p lang="am">…</p></fidel-read-aloud>
//
// A Listen / Stop button for any paragraph, for learners who read with
// difficulty and do not use a screen reader. Nothing speaks by itself: only
// when the learner presses Listen.
// Voice: the browser's own voice for the content's language, if this device
// has one ("Computer voice" is shown next to the button); otherwise the
// recording in audio="" ("Recorded voice"); otherwise no button, and a short
// line says listening is not available.
// While the computer voice reads, the sentence being read is highlighted
// (background AND underline, not colour alone). Escape or Stop stops.
// Attributes: lang (the content's language; default: the content's own lang,
// else the page's), audio, ui-lang.
// Events: fidel-read-aloud-start { lang, voice: "computer" | "recorded" }, fidel-read-aloud-stop.
import { h } from '../../dom.js';
import { emit } from '../../events.js';
import { stringsFor, uiLang, voiceFor } from './common.js';
import { splitSentences } from './logic.js';

const HIGHLIGHT = 'fidel-read-aloud';

export class FidelReadAloud extends HTMLElement {
  connectedCallback() {
    if (!this.built) {
      this.built = true;
      this.strings = stringsFor(this);
      this.content = h('div', { class: 'fidel-read-aloud-content' }, ...this.childNodes);
      this.bar = h('div', { class: 'fidel-read-aloud-bar', lang: uiLang(this) });
      this.replaceChildren(this.bar, this.content);
      this.onKey = (event) => { if (event.key === 'Escape' && this.playing) this.stop(); };
      this.onVoices = () => { if (!this.playing) this.renderBar(); };
    }
    this.renderBar();
    if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', this.onVoices);
  }

  disconnectedCallback() {
    this.stop();
    if ('speechSynthesis' in window) speechSynthesis.removeEventListener('voiceschanged', this.onVoices);
  }

  /** The language of the text: lang on this tag, else on its content, else the page's. */
  contentLang() {
    const own = this.getAttribute('lang') || this.content.querySelector('[lang]')?.getAttribute('lang');
    return (own || this.closest('[lang]')?.getAttribute('lang') || 'en').toLowerCase();
  }

  /** Which voice can read this: 'computer', 'recorded' or null. */
  mode() {
    if (voiceFor(this.contentLang())) return 'computer';
    if (this.getAttribute('audio')) return 'recorded';
    return null;
  }

  renderBar() {
    const s = this.strings;
    const mode = this.mode();
    if (!mode) {
      this.button = null;
      this.bar.replaceChildren(h('p', { class: 'fidel-read-aloud-note' }, s.noVoice));
      return;
    }
    this.button = h('button', {
      type: 'button', class: 'fidel-a-button fidel-read-aloud-button',
      onclick: () => (this.playing ? this.stop() : this.start()),
    }, s.listen);
    this.bar.replaceChildren(this.button,
      h('span', { class: 'fidel-read-aloud-voice' }, mode === 'computer' ? s.computerVoice : s.recordedVoice));
  }

  setPlaying(playing) {
    this.playing = playing;
    if (this.button) this.button.textContent = playing ? this.strings.stop : this.strings.listen;
    this.classList.toggle('fidel-read-aloud-playing', playing);
    if (playing) document.addEventListener('keydown', this.onKey);
    else document.removeEventListener('keydown', this.onKey);
  }

  start() {
    const mode = this.mode();
    if (!mode) return;
    this.setPlaying(true);
    emit(this, 'fidel-read-aloud-start', { lang: this.contentLang(), voice: mode });
    if (mode === 'recorded') this.playRecording();
    else this.speakSentences();
  }

  stop() {
    if (!this.playing) return;
    this.run = (this.run || 0) + 1; // ends the current reading
    this.audio?.pause();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.highlight(null);
    this.setPlaying(false);
    emit(this, 'fidel-read-aloud-stop', {});
  }

  /** The pre-recorded file, loaded only now (the learner asked for it). */
  playRecording() {
    if (!this.audio) {
      this.audio = new Audio(this.getAttribute('audio'));
      this.audio.addEventListener('ended', () => this.stop());
      this.audio.addEventListener('error', () => this.stop());
    }
    this.audio.currentTime = 0;
    this.audio.play()?.catch?.(() => this.stop());
  }

  /** Text nodes of the content, joined, with where each one starts. */
  textMap() {
    const walker = document.createTreeWalker(this.content, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let text = '';
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      nodes.push({ node, start: text.length });
      text += node.data;
    }
    return { text, nodes };
  }

  rangeFor(nodes, start, end) {
    const at = (offset) => {
      let found = nodes[0];
      for (const n of nodes) if (n.start <= offset) found = n;
      return [found.node, Math.min(offset - found.start, found.node.data.length)];
    };
    const range = document.createRange();
    range.setStart(...at(start));
    range.setEnd(...at(end));
    return range;
  }

  /** Highlight a range (CSS Custom Highlight API; no DOM changes). */
  highlight(range) {
    if (!globalThis.CSS?.highlights || typeof Highlight === 'undefined') return;
    if (range) CSS.highlights.set(HIGHLIGHT, new Highlight(range));
    else CSS.highlights.delete(HIGHLIGHT);
  }

  speakSentences() {
    const voice = voiceFor(this.contentLang());
    const { text, nodes } = this.textMap();
    const sentences = splitSentences(text);
    const run = (this.run || 0) + 1;
    this.run = run;
    speechSynthesis.cancel();
    const next = (i) => {
      if (this.run !== run) return;
      if (i >= sentences.length) { this.stop(); return; }
      const [start, end] = sentences[i];
      const utterance = new SpeechSynthesisUtterance(text.slice(start, end));
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.onstart = () => { if (this.run === run) this.highlight(this.rangeFor(nodes, start, end)); };
      utterance.onend = () => next(i + 1);
      utterance.onerror = () => { if (this.run === run) this.stop(); };
      speechSynthesis.speak(utterance);
    };
    next(0);
  }
}
