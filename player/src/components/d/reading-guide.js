// <fidel-reading-guide target="#lesson-text" ui-lang="en|am">
//
// Keep your place when zoomed in. A "Reading guide" toggle (aria-pressed)
// and a choice "Highlight the line" / "Dim the rest". When on, the text block
// (paragraph, list item, heading...) inside the target that is under the
// pointer, holds the text cursor, or contains keyboard focus gets a thick
// outline and a tinted background; "Dim the rest" also lays a light veil over
// the other blocks of the target (text stays above 4.5:1). "Next line" /
// "Previous line" move the highlight block by block and scroll it to the
// middle of the screen (so no sticky bar covers it).
//
// The host's text is never changed: the highlight and veil are separate
// overlay boxes with pointer-events: none, drawn over the page. Off by
// default; the choice is remembered in the learner's preferences
// (prefs.readingGuide = { on, mode }), in this browser only.
import { h, uid } from '../../dom.js';
import { announce } from '../../announce.js';
import { loadPrefs, savePrefs } from '../../prefs.js';
import { translator, uiLang } from './common.js';

const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, dt, dd, figcaption, td, th';

export class FidelReadingGuide extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.lang = uiLang(this);
    this.tt = translator(this.lang, 'guide');
    const saved = loadPrefs().readingGuide || {};
    this.mode = saved.mode === 'dim' ? 'dim' : 'highlight';
    this.build();
    if (saved.on) queueMicrotask(() => this.setOn(true, { quiet: true }));
  }

  disconnectedCallback() {
    this.setOn(false, { quiet: true, remember: false });
    this.built = false;
  }

  get target() {
    try {
      return document.querySelector(this.getAttribute('target') || '');
    } catch {
      return null;
    }
  }

  /** Text blocks inside the target (innermost only: a <li> holding a <p> counts once). */
  blocks() {
    const target = this.target;
    if (!target) return [];
    return [...target.querySelectorAll(BLOCKS)].filter((el) => !el.querySelector(BLOCKS) && el.getClientRects().length);
  }

  build() {
    const tt = this.tt;
    this.toggle = h('button', { type: 'button', class: 'fidel-d-button', 'aria-pressed': 'false', onclick: () => this.setOn(!this.on) }, tt('toggle'));
    const name = uid('guide-mode');
    this.modes = h('fieldset', { class: 'fidel-d-fieldset fidel-guide-modes' },
      h('legend', {}, tt('mode')),
      ['highlight', 'dim'].map((mode) => {
        const id = uid('guide-mode');
        return h('div', { class: 'fidel-d-choice' },
          h('input', { type: 'radio', id, name, value: mode, checked: mode === this.mode, onchange: () => this.setMode(mode) }),
          h('label', { for: id }, tt(mode)));
      }));
    this.nav = h('div', { class: 'fidel-d-actions' },
      h('button', { type: 'button', class: 'fidel-d-button', onclick: () => this.move(-1) }, tt('previous')),
      h('button', { type: 'button', class: 'fidel-d-button', onclick: () => this.move(1) }, tt('next')));
    this.controls = h('div', { class: 'fidel-guide-controls', hidden: true }, this.modes, this.nav);
    this.status = h('p', { class: 'fidel-d-status' });
    this.box = h('div', { class: 'fidel-guide-box', 'aria-hidden': 'true', hidden: true });
    this.veils = [0, 1, 2, 3].map(() => h('div', { class: 'fidel-guide-veil', 'aria-hidden': 'true', hidden: true }));
    this.replaceChildren(h('div', { class: 'fidel-guide', lang: this.lang },
      h('div', { class: 'fidel-d-actions' }, this.toggle), this.controls, this.status, this.box, ...this.veils));

    // Follow the pointer only when the learner really moves it: when the page
    // scrolls under a still pointer (after "Next line"), the highlight stays.
    this.onPointer = (event) => {
      if (!event.movementX && !event.movementY) return;
      if (Date.now() - (this.movedAt || 0) < 1000) return;
      this.follow(event.target);
    };
    this.onFocus = (event) => this.follow(event.target);
    this.onSelection = () => {
      const node = document.getSelection()?.anchorNode;
      if (node) this.follow(node.nodeType === 1 ? node : node.parentElement);
    };
    this.onLayout = () => {
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => this.draw());
    };
  }

  remember(on) {
    const prefs = loadPrefs();
    savePrefs({ ...prefs, readingGuide: { on, mode: this.mode } });
  }

  setOn(on, { quiet = false, remember = true } = {}) {
    const target = this.target;
    if (on && !target) {
      this.status.textContent = this.tt('noTarget');
      return;
    }
    this.on = on;
    this.toggle.setAttribute('aria-pressed', String(on));
    this.controls.hidden = !on;
    const listeners = [
      [target, 'pointermove', this.onPointer], [target, 'focusin', this.onFocus],
      [document, 'selectionchange', this.onSelection], [window, 'scroll', this.onLayout], [window, 'resize', this.onLayout],
    ];
    for (const [where, type, fn] of listeners) {
      if (!where) continue;
      if (on) where.addEventListener(type, fn, { passive: true, capture: type === 'scroll' });
      else where.removeEventListener(type, fn, { capture: type === 'scroll' });
    }
    if (on) {
      // Start at the focused block, else the first block on screen.
      const blocks = this.blocks();
      this.current = blocks.find((b) => b.contains(document.activeElement))
        || blocks.find((b) => b.getBoundingClientRect().bottom > 0) || blocks[0] || null;
    } else {
      this.current = null;
    }
    this.draw();
    if (remember) this.remember(on);
    if (!quiet) {
      this.status.textContent = '';
      announce(on ? this.tt('on') : this.tt('off'));
    }
  }

  setMode(mode) {
    this.mode = mode;
    this.remember(this.on);
    this.draw();
  }

  /** Highlight the block holding this element (if it is inside the target). */
  follow(element) {
    if (!this.on || !element) return;
    const block = element.closest?.(BLOCKS);
    if (!block || !this.target?.contains(block) || block.querySelector(BLOCKS)) return;
    if (block === this.current) return;
    this.current = block;
    this.draw();
  }

  move(step) {
    const blocks = this.blocks();
    if (!blocks.length) return;
    const index = blocks.indexOf(this.current);
    const next = index === -1 ? 0 : index + step;
    if (next < 0 || next >= blocks.length) {
      this.status.textContent = next < 0 ? this.tt('first') : this.tt('last');
      announce(this.status.textContent);
      return;
    }
    this.status.textContent = '';
    this.movedAt = Date.now();
    this.current = blocks[next];
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The middle of the screen: never under a sticky header or footer.
    this.current.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
    this.draw();
  }

  /** Place the highlight box over the current block, and the veil around it. */
  draw() {
    const block = this.on ? this.current : null;
    this.box.hidden = !block;
    for (const veil of this.veils) veil.hidden = true;
    if (!block) return;
    const r = block.getBoundingClientRect();
    const pad = 4;
    Object.assign(this.box.style, {
      top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px`,
    });
    if (this.mode !== 'dim') return;
    const t = this.target.getBoundingClientRect();
    const rects = [
      [t.left, t.top, t.width, r.top - pad - t.top], // above
      [t.left, r.bottom + pad, t.width, t.bottom - r.bottom - pad], // below
      [t.left, r.top - pad, r.left - pad - t.left, r.height + 2 * pad], // left
      [r.right + pad, r.top - pad, t.right - r.right - pad, r.height + 2 * pad], // right
    ];
    rects.forEach(([left, top, width, height], i) => {
      if (width <= 0 || height <= 0) return;
      Object.assign(this.veils[i].style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
      this.veils[i].hidden = false;
    });
  }
}
