// <p>We use <fidel-word term="server" meaning-en="A computer that…" meaning-am="…">server</fidel-word> software.</p>
//
// Tap a hard word for its meaning. The word becomes a real <button> (dotted
// underline). It opens a small <dialog> with the term as a heading, a plain
// English meaning, the Amharic meaning (lang="am"), and a Listen button for
// each language only if this device has a voice for it. Escape or Close
// closes the dialog and focus goes back to the word.
// Data: the meaning-en / meaning-am attributes (main path: works with no
// server). If they are missing and glossary="URL" is given, the glossary is
// read ({ terms: [{ en, am, note }] }, the format of /api/v1/glossary: note is
// used as the English meaning, am as the Amharic). That endpoint is for staff,
// so learner pages should use the attributes.
// Attributes: term (default: the word's text), meaning-en, meaning-am, glossary, ui-lang.
// Events: fidel-word-open { term }.
import { h, uid } from '../../dom.js';
import { emit } from '../../events.js';
import { stringsFor, langAttr, voiceFor } from './common.js';

const glossaries = new Map(); // url -> Promise of terms (one request per page)

function loadGlossary(url) {
  if (!glossaries.has(url)) {
    glossaries.set(url, fetch(url, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { terms: [] }))
      .then((data) => (Array.isArray(data?.terms) ? data.terms : []))
      .catch(() => []));
  }
  return glossaries.get(url);
}

export class FidelWord extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.strings = stringsFor(this);
    this.word = this.textContent.trim();
    this.term = this.getAttribute('term') || this.word;
    this.button = h('button', {
      type: 'button', class: 'fidel-word-button', 'aria-haspopup': 'dialog',
      onclick: () => this.open(),
    }, this.word);
    this.replaceChildren(this.button);
  }

  disconnectedCallback() {
    if (this.speaking) speechSynthesis.cancel();
  }

  async meanings() {
    let en = this.getAttribute('meaning-en');
    let am = this.getAttribute('meaning-am');
    const url = this.getAttribute('glossary');
    if ((!en || !am) && url) {
      const terms = await loadGlossary(url);
      const entry = terms.find((t) => (t.en || '').toLowerCase() === this.term.toLowerCase());
      en = en || entry?.note || null;
      am = am || entry?.am || null;
    }
    return { en, am };
  }

  async open() {
    const s = this.strings;
    const { en, am } = await this.meanings();
    const titleId = uid('fidel-word-title');
    const part = (label, text, lang, listenLabel) => {
      const voice = voiceFor(lang);
      return h('div', { class: 'fidel-word-part' },
        h('p', { class: 'fidel-word-label', lang: langAttr(this) }, label),
        h('p', { class: 'fidel-word-meaning', lang }, text),
        voice ? h('button', {
          type: 'button', class: 'fidel-a-button', lang: langAttr(this),
          onclick: () => this.speak(`${lang === 'en' ? `${this.term}. ` : ''}${text}`, voice),
        }, listenLabel) : null);
    };
    const parts = [];
    if (en) parts.push(part(s.meaning, en, 'en', s.listenEn));
    if (am) parts.push(part(s.inAmharic, am, 'am', s.listenAm));
    if (!parts.length) parts.push(h('p', { lang: langAttr(this) }, s.noMeaning));

    const close = h('button', { type: 'button', class: 'fidel-a-button fidel-word-close', lang: langAttr(this), onclick: () => this.dialog.close() }, s.close);
    this.dialog?.remove();
    this.dialog = h('dialog', { class: 'fidel-word-dialog', 'aria-labelledby': titleId },
      h('h2', { id: titleId, class: 'fidel-word-title', lang: 'en' }, this.term),
      parts,
      close);
    this.dialog.addEventListener('close', () => {
      if (this.speaking) speechSynthesis.cancel();
      this.dialog.remove();
      this.dialog = null;
      this.button.focus(); // back to the word
    });
    // Tapping the dark area outside the box closes it too.
    this.dialog.addEventListener('click', (event) => { if (event.target === this.dialog) this.dialog.close(); });
    this.append(this.dialog);
    this.dialog.showModal();
    emit(this, 'fidel-word-open', { term: this.term });
  }

  speak(text, voice) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.onend = () => { this.speaking = false; };
    this.speaking = true;
    speechSynthesis.speak(utterance);
  }
}
