// <fidel-callout type="tip|warning|example|note" heading="Save your work" heading-level="3" ui-lang="en|am">
//   <p>Content: any HTML (the children stay as they are).</p>
// </fidel-callout>
//
// E3. A box with a real heading. The type is said in words before the
// heading ("Warning: Save your work"), the icon is decorative (aria-hidden),
// and each type has a border style and a background, so the type is never
// shown by colour alone (WCAG 1.4.1). Without JavaScript the content shows
// as it is. No events.
import { h } from '../../dom.js';
import { translator, uiLang } from './common.js';

const TYPES = ['tip', 'warning', 'example', 'note'];
const ICONS = { tip: '💡', warning: '⚠', example: '✎', note: 'ℹ' };

export class FidelCallout extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    const lang = uiLang(this);
    const tt = translator(lang, 'callout');
    const type = TYPES.includes(this.getAttribute('type')) ? this.getAttribute('type') : 'note';
    const level = Math.min(6, Math.max(2, Number(this.getAttribute('heading-level')) || 3));
    const heading = this.getAttribute('heading') || '';
    const body = h('div', { class: 'fidel-callout-body' });
    body.append(...this.childNodes);
    this.replaceChildren(h('div', { class: `fidel-callout fidel-callout-${type}` },
      h(`h${level}`, { class: 'fidel-callout-heading' },
        h('span', { class: 'fidel-callout-icon', 'aria-hidden': 'true' }, ICONS[type]),
        h('span', { class: 'fidel-callout-type', lang }, tt(`types.${type}`)),
        heading ? ` ${heading}` : ''),
      body));
  }
}
