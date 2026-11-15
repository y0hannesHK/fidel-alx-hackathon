// <fidel-ethiopian-date datetime="2026-11-15" ui-lang="am" format="short|long">
//
// B4. Every date in both calendars, inside a real <time datetime>:
//   English page:  15 Nov 2026 / ህዳር 6 2019
//   Amharic page:  ህዳር 6 2019 / 15 Nov 2026
//   format="long": Sunday 15 November 2026 / እሑድ ህዳር 6 2019 ዓ.ም.
// The Ethiopian date comes from the browser's Ethiopic calendar (Intl) when it
// has one, otherwise from player/src/ethiopian-calendar.js. Each part has its
// own lang, so a screen reader reads each in the right language.
// Attributes: datetime (YYYY-MM-DD), ui-lang (en | am), format (short | long)
import { h } from '../../dom.js';
import { bothCalendars } from './logic.js';
import { langOf, translator } from './strings.js';

export class FidelEthiopianDate extends HTMLElement {
  static get observedAttributes() { return ['datetime', 'ui-lang', 'format']; }

  connectedCallback() { this.render(); }

  attributeChangedCallback() { if (this.isConnected) this.render(); }

  render() {
    const iso = this.getAttribute('datetime');
    const lang = langOf(this);
    const parts = bothCalendars(iso, { lang, format: this.getAttribute('format') === 'long' ? 'long' : 'short' });
    if (!parts) {
      // Not a date we understand: leave the host's own text (if any) untouched.
      console.warn('<fidel-ethiopian-date>: datetime must be YYYY-MM-DD, got', iso);
      return;
    }
    const [first, second] = parts;
    this.replaceChildren(
      h('time', { class: 'fidel-ethiopian-date', datetime: iso.slice(0, 10), lang },
        h('span', { lang: first.lang }, first.text),
        h('span', { class: 'fidel-ethiopian-date-sep' }, translator(lang)('dateSeparator')),
        h('span', { lang: second.lang }, second.text))
    );
  }
}
