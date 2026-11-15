// <fidel-described-image src="request-flow.png" alt="How a web request travels"
//                        long-description-id="flow-desc"></fidel-described-image>
// <div id="flow-desc" hidden><p>The browser sends a request to the server…</p></div>
//
// A diagram with a real description: <figure> with <img alt>, a <figcaption>,
// and <details><summary>Full description</summary>…</details> holding the long
// description (copied from the element named by long-description-id, or from
// the description="" attribute). The image is lazy-loaded.
// If alt is missing: console.warn, and a visible warning when the page asks
// for one with show-warnings (demo pages only).
// Attributes: src, alt, caption (default: the alt text), long-description-id,
// description, width, height, show-warnings, ui-lang.
import { h } from '../../dom.js';
import { stringsFor, langAttr } from './common.js';

export class FidelDescribedImage extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    const s = stringsFor(this);
    const alt = this.getAttribute('alt');
    const caption = this.getAttribute('caption') || alt;
    const warning = alt === null ? s.missingAlt : null;
    if (warning) console.warn(`<fidel-described-image src="${(this.getAttribute('src') || '').slice(0, 80)}">: no alt text.`);

    const figure = h('figure', { class: 'fidel-described-image' },
      h('img', {
        src: this.getAttribute('src'),
        alt: alt ?? '', // never leave alt off: a screen reader would read the file name
        loading: 'lazy',
        decoding: 'async',
        width: this.getAttribute('width'),
        height: this.getAttribute('height'),
        class: 'fidel-described-image-img',
      }),
      caption ? h('figcaption', { class: 'fidel-described-image-caption' }, caption) : null);

    const description = this.description();
    if (description) {
      figure.append(h('details', { class: 'fidel-described-image-details' },
        h('summary', { class: 'fidel-described-image-summary', lang: langAttr(this) }, s.fullDescription),
        h('div', { class: 'fidel-described-image-text', lang: this.descriptionLang }, description)));
    }
    if (warning && this.hasAttribute('show-warnings')) {
      figure.append(h('p', { class: 'fidel-described-image-warning', lang: langAttr(this) }, warning));
    }
    this.replaceChildren(figure);
  }

  /** The long description as nodes: a copy of the referenced element's content, or the attribute's text. */
  description() {
    const source = document.getElementById(this.getAttribute('long-description-id') || '');
    if (source) {
      this.descriptionLang = source.getAttribute('lang');
      const copy = source.cloneNode(true);
      // Copied ids would be duplicates on the page.
      for (const el of [copy, ...copy.querySelectorAll('[id]')]) el.removeAttribute('id');
      return [...copy.childNodes];
    }
    const text = this.getAttribute('description');
    return text ? [h('p', {}, text)] : null;
  }
}
