// <fidel-step-nav prev-href="lesson-2.html" prev-label="Lesson 2: Forms"
//                 next-href="lesson-4.html" next-label="Lesson 4: Tables"
//                 position="3" total="8"></fidel-step-nav>
//
// Big Previous / Next links at the end of a lesson, for learners with tremor,
// one hand or switch access. Two large links (at least 48px tall, full width
// on phones) that say where they go, and "Lesson 3 of 8". In the normal page
// flow, never fixed or sticky (a sticky bar hides focused items, WCAG 2.4.11).
//
// Attributes: prev-href, prev-label, next-href, next-label, position, total,
//   label (name of the landmark, default "Lesson"), ui-lang.
// Event: fidel-step-nav-go { direction: "previous" | "next" } (when a link is used).
import { emit } from '../../events.js';
import { h, langOf, translator, textLang } from './shared.js';

export class FidelStepNav extends HTMLElement {
  static observedAttributes = ['prev-href', 'prev-label', 'next-href', 'next-label', 'position', 'total', 'label', 'ui-lang'];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  render() {
    const lang = langOf(this);
    const tr = translator(lang);
    const position = Number(this.getAttribute('position'));
    const total = Number(this.getAttribute('total'));
    const link = (direction, arrow) => {
      const href = this.getAttribute(`${direction === 'previous' ? 'prev' : 'next'}-href`);
      if (!href) return null; // first or last lesson: no link that goes nowhere
      const label = this.getAttribute(`${direction === 'previous' ? 'prev' : 'next'}-label`) || href;
      const word = direction === 'previous' ? tr('navPrevious') : tr('navNext');
      return h('li', { class: `fidel-step-nav-${direction === 'previous' ? 'prev' : 'next'}` },
        h('a', {
          class: 'fidel-step-nav-link', href, rel: direction === 'previous' ? 'prev' : 'next',
          onclick: () => emit(this, 'fidel-step-nav-go', { direction }),
        },
        h('span', { class: 'fidel-step-nav-direction' },
          direction === 'previous' && h('span', { 'aria-hidden': 'true' }, '← '),
          word,
          direction === 'next' && h('span', { 'aria-hidden': 'true' }, ' →')),
        h('span', { class: 'fidel-step-nav-dest', lang: textLang(label, lang) }, label)));
    };
    const items = [link('previous'), link('next')].filter(Boolean);
    this.replaceChildren(
      h('nav', { class: 'fidel-step-nav', lang, 'aria-label': this.getAttribute('label') || tr('navLabel') },
        position > 0 && total > 0 && h('p', { class: 'fidel-step-nav-position' }, tr('navPosition', { n: position, total })),
        items.length > 0 && h('ul', { class: 'fidel-step-nav-links' }, items)));
  }
}
