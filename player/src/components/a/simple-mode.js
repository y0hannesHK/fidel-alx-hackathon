// <fidel-simple-mode>
//   <div data-version="full">…original lesson text…</div>
//   <div data-version="simple">…short sentences, one idea each…</div>
// </fidel-simple-mode>
//
// A simpler version of the same text, for low-literacy learners and learners
// reading in a second language. A switch-style button "Simple words"
// (aria-pressed) shows one version or the other. The choice is remembered in
// this browser (the shared preference simpleWords in prefs.js), and every
// <fidel-simple-mode> on the page follows it. Announces "Simple version shown".
// Without JavaScript both versions stay visible.
// Attributes: ui-lang. Events: fidel-simple-mode-change { simple }.
import { h } from '../../dom.js';
import { emit } from '../../events.js';
import { announce } from '../../announce.js';
import { loadPrefs, savePrefs } from '../../prefs.js';
import { stringsFor, uiLang } from './common.js';

const SYNC = 'fidel-simple-mode-sync'; // tells the other copies on the page

export class FidelSimpleMode extends HTMLElement {
  connectedCallback() {
    if (!this.built) {
      this.full = this.querySelector(':scope > [data-version="full"]');
      this.simple = this.querySelector(':scope > [data-version="simple"]');
      if (!this.full || !this.simple) return; // nothing to switch: leave the content as it is
      this.built = true;
      const s = stringsFor(this);
      this.strings = s;
      this.button = h('button', {
        type: 'button', class: 'fidel-a-button fidel-simple-mode-switch', 'aria-pressed': 'false',
        lang: uiLang(this) === 'am' ? 'am' : null,
        onclick: () => this.choose(this.button.getAttribute('aria-pressed') !== 'true'),
      }, h('span', { class: 'fidel-simple-mode-track', 'aria-hidden': 'true' }, h('span', { class: 'fidel-simple-mode-thumb' })),
      s.simpleWords,
      this.state = h('span', { class: 'fidel-a-state', 'aria-hidden': 'true' }));
      this.prepend(h('div', { class: 'fidel-simple-mode-bar' }, this.button));
      this.onSync = (event) => { if (event.detail.source !== this) this.apply(event.detail.simple); };
    }
    document.addEventListener(SYNC, this.onSync);
    this.apply(Boolean(loadPrefs().simpleWords));
  }

  disconnectedCallback() {
    if (this.onSync) document.removeEventListener(SYNC, this.onSync);
  }

  apply(simple) {
    this.button.setAttribute('aria-pressed', String(simple));
    this.state.textContent = simple ? this.strings.on : this.strings.off;
    this.simple.hidden = !simple;
    this.full.hidden = simple;
  }

  choose(simple) {
    this.apply(simple);
    savePrefs({ ...loadPrefs(), simpleWords: simple });
    document.dispatchEvent(new CustomEvent(SYNC, { detail: { simple, source: this } }));
    announce(simple ? this.strings.simpleShown : this.strings.fullShown);
    emit(this, 'fidel-simple-mode-change', { simple });
  }
}
