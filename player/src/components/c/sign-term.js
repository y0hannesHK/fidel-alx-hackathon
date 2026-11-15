// <fidel-sign-term term="login" sign="login.webm" poster="login.jpg"
//                  meaning-en="..." meaning-am="...">login</fidel-sign-term>
//
// A tech word with its sign (for Deaf learners). The word becomes a real
// button; it opens a dialog with the term, a muted looping video of the sign
// (downloaded only when the dialog opens), Play/Pause and Slower buttons,
// and the meaning in plain English and Amharic.
//
// Attributes: term, sign, poster, meaning-en, meaning-am, ui-lang,
//   sign-placeholder (the clip is a stand-in, say so),
//   glossary (URL of a glossary JSON { terms: [{ en, am, sign, meaning_en, meaning_am }] };
//             attributes win over the glossary).
// Event: fidel-sign-term-open { term }.
import { emit } from '../../events.js';
import { h, langOf, translator, makeDialog, textLang } from './shared.js';

export class FidelSignTerm extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.lang_ = langOf(this);
    this.tr = translator(this.lang_);
    const word = this.textContent.trim() || this.getAttribute('term') || '';
    this.term = this.getAttribute('term') || word;
    this.button = h('button', {
      type: 'button', class: 'fidel-sign-term-word', 'aria-haspopup': 'dialog',
      onclick: () => this.open(),
    },
    h('span', { class: 'fidel-sign-term-text' }, word),
    h('span', { class: 'fidel-sign-term-icon', 'aria-hidden': 'true' }, '✋'),
    h('span', { class: 'fidel-c-hidden', lang: this.lang_ }, ` ${this.tr('signSuffix')}`));
    this.replaceChildren(this.button);
  }

  async loadGlossary() {
    const url = this.getAttribute('glossary');
    if (!url || this.glossaryEntry !== undefined) return this.glossaryEntry;
    this.glossaryEntry = null;
    try {
      const response = await fetch(url);
      if (response.ok) {
        const { terms = [] } = await response.json();
        this.glossaryEntry = terms.find((t) => (t.en || '').toLowerCase() === this.term.toLowerCase()) || null;
      }
    } catch {
      // No glossary: the attributes are all we have.
    }
    return this.glossaryEntry;
  }

  async open() {
    const entry = (await this.loadGlossary()) || {};
    if (!this.ui) this.build(entry);
    this.ui.open(this.button);
    this.startVideo();
    emit(this, 'fidel-sign-term-open', { term: this.term });
  }

  build(entry) {
    const tr = this.tr;
    const sign = this.getAttribute('sign') || entry.sign;
    const meanings = [
      ['en', this.getAttribute('meaning-en') || entry.meaning_en],
      ['am', this.getAttribute('meaning-am') || entry.meaning_am || entry.am],
    ].filter(([, text]) => text);
    if (this.lang_ === 'am') meanings.reverse(); // the learner's language first

    this.noSign = h('p', { class: 'fidel-sign-term-none', hidden: Boolean(sign) }, tr('signNone'));
    const parts = [this.noSign];
    if (sign) {
      this.video = h('video', {
        class: 'fidel-sign-term-video', muted: true, loop: true, playsinline: true, preload: 'none',
        poster: this.getAttribute('poster') || entry.poster,
      });
      this.video.muted = true;
      this.videoSrc = sign;
      this.video.addEventListener('error', () => this.showNoSign());
      this.playButton = h('button', { type: 'button', class: 'fidel-c-button', onclick: () => this.togglePlay() }, tr('signPlay'));
      this.slowButton = h('button', {
        type: 'button', class: 'fidel-c-button', 'aria-pressed': 'false', onclick: () => this.toggleSlow(),
      }, tr('signSlower'));
      this.video.addEventListener('play', () => { this.playButton.textContent = tr('signPause'); });
      this.video.addEventListener('pause', () => { this.playButton.textContent = tr('signPlay'); });
      this.figure = h('figure', { class: 'fidel-sign-term-figure' },
        this.video,
        h('figcaption', {},
          tr('signCaption', { term: this.term }),
          this.hasAttribute('sign-placeholder') && h('strong', { class: 'fidel-sign-term-placeholder' }, ` ${tr('signPlaceholder')}`)),
        h('div', { class: 'fidel-c-row' }, this.playButton, this.slowButton));
      parts.push(this.figure);
    }
    parts.push(h('h3', { class: 'fidel-sign-term-subhead' }, tr('signMeaning')));
    if (meanings.length) {
      for (const [lang, text] of meanings) parts.push(h('p', { lang, class: 'fidel-sign-term-meaning' }, text));
    } else {
      parts.push(h('p', {}, tr('signNoMeaning')));
    }

    this.ui = makeDialog({
      className: 'fidel-sign-term-dialog',
      lang: this.lang_,
      title: this.term,
      titleLang: textLang(this.term, 'en'),
      body: h('div', { class: 'fidel-c-dialog-body' }, parts),
      closeLabel: tr('close'),
      onClose: () => this.video?.pause(),
    });
    this.append(this.ui.dialog);
  }

  startVideo() {
    if (!this.video || this.failed) return;
    if (!this.video.getAttribute('src')) this.video.src = this.videoSrc; // loaded only now
    // A muted sign loops by itself, unless the learner asked for less motion.
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.video.play().catch(() => {});
  }

  togglePlay() {
    if (this.video.paused) this.video.play().catch(() => this.showNoSign());
    else this.video.pause();
  }

  toggleSlow() {
    const slow = this.slowButton.getAttribute('aria-pressed') !== 'true';
    this.slowButton.setAttribute('aria-pressed', String(slow));
    this.video.playbackRate = slow ? 0.5 : 1;
  }

  showNoSign() {
    this.failed = true;
    if (this.figure) this.figure.hidden = true;
    this.noSign.hidden = false;
  }
}
