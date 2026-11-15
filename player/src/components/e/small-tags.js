// E7. Small tags.
//
// <fidel-progress for="lesson-player" label="Lesson 3" ui-lang="en|am">
//   A <progress> and the text "40% watched", from the player's fidel-progress
//   events (and 100% on fidel-complete). Changes are NOT announced by
//   themselves; "Say my progress" announces them on request.
//
// <fidel-mark-complete lesson-id="html-basics" for="lesson-player" manual ui-lang="en|am">
//   A real toggle button "Mark as complete" (aria-pressed). It can be used
//   once the player sends fidel-complete (the video reached the end), or at
//   any time with the manual attribute. Remembered in this browser
//   (localStorage "fidel-complete:<lesson-id>"). Announces "Lesson marked
//   complete". Event fidel-mark-complete { done }.
//
// <fidel-skip-link target="#lesson" label="Skip to the lesson">
//   A link, hidden until it has keyboard focus; put it first in the page so
//   it is the first Tab stop. It moves focus to the target (tabindex="-1" is
//   added to the target if it cannot take focus).
//
// <fidel-toggletip label="What is a transcript?">Short explanation.</fidel-toggletip>
//   An info button that opens the explanation on click, tap, Enter or Space
//   (never on hover only). Escape or a click elsewhere closes it. The text is
//   put into a live region when it opens, so screen readers read it.
import { h, uid } from '../../dom.js';
import { announce } from '../../announce.js';
import { emit, findPlayer, translator, uiLang } from './common.js';
import { COMPLETE_PREFIX } from './logic.js';

/** Listen to an event from the player named in for="..." (or any player). */
function onPlayerEvent(element, name, handler) {
  const listener = (event) => {
    const id = element.getAttribute('for');
    if (id && event.target?.id !== id) return;
    handler(event);
  };
  document.addEventListener(name, listener);
  return () => document.removeEventListener(name, listener);
}

export class FidelProgress extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.lang = uiLang(this);
    this.tt = translator(this.lang, 'progress');
    this.percent = 0;
    const labelId = uid('fidel-progress-label');
    const label = this.getAttribute('label') || this.tt('label');
    this.bar = h('progress', { max: '100', value: '0', 'aria-labelledby': labelId, class: 'fidel-progress-bar' });
    this.words = h('span', { class: 'fidel-progress-words' });
    this.replaceChildren(h('div', { class: 'fidel-progress', lang: this.lang },
      h('p', { class: 'fidel-progress-line' }, h('span', { id: labelId, class: 'fidel-progress-label' }, label), ': ', this.words),
      this.bar,
      h('button', { type: 'button', class: 'fidel-e-button fidel-e-small', onclick: () => announce(`${label}: ${this.words.textContent}`) },
        this.tt('say'))));
    this.show(0);
    this.off = [
      onPlayerEvent(this, 'fidel-progress', (e) => this.show(Math.max(this.percent, Number(e.detail?.percent) || 0))),
      onPlayerEvent(this, 'fidel-complete', () => this.show(100)),
    ];
  }

  disconnectedCallback() {
    this.off?.forEach((stop) => stop());
    this.built = false;
  }

  show(percent) {
    this.percent = Math.min(100, Math.max(0, Math.round(percent)));
    this.bar.value = this.percent;
    this.words.textContent = this.tt('watched', { percent: this.percent });
  }
}

export class FidelMarkComplete extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.lang = uiLang(this);
    this.tt = translator(this.lang, 'complete');
    this.key = COMPLETE_PREFIX + (this.getAttribute('lesson-id') || location.pathname);
    this.done = this.read();
    this.available = this.hasAttribute('manual') || this.done;
    this.hint = h('p', { class: 'fidel-e-hint', id: uid('fidel-complete-hint') });
    this.button = h('button', {
      type: 'button', class: 'fidel-e-button fidel-complete-button', 'aria-pressed': String(this.done),
      'aria-describedby': this.hint.id, onclick: () => this.toggle(),
    }, h('span', { class: 'fidel-complete-box', 'aria-hidden': 'true' }), this.tt('button'));
    this.replaceChildren(h('div', { class: 'fidel-complete', lang: this.lang }, this.button, this.hint));
    this.update();
    this.off = onPlayerEvent(this, 'fidel-complete', () => {
      if (this.available) return;
      this.available = true;
      this.update();
      announce(this.tt('nowAvailable'));
    });
  }

  disconnectedCallback() {
    this.off?.();
    this.built = false;
  }

  read() {
    try {
      return localStorage.getItem(this.key) === 'true';
    } catch {
      return false;
    }
  }

  update() {
    this.button.setAttribute('aria-pressed', String(this.done));
    // aria-disabled (not disabled): the button stays in the Tab order and the hint says why.
    if (this.available) this.button.removeAttribute('aria-disabled');
    else this.button.setAttribute('aria-disabled', 'true');
    this.hint.textContent = !this.available ? this.tt('notYet') : this.done ? this.tt('doneHint') : this.tt('readyHint');
  }

  toggle() {
    if (!this.available) {
      announce(this.tt('notYet'));
      return;
    }
    this.done = !this.done;
    try {
      if (this.done) localStorage.setItem(this.key, 'true');
      else localStorage.removeItem(this.key);
    } catch {
      // Not remembered on this device; still shown now.
    }
    this.update();
    announce(this.done ? this.tt('marked') : this.tt('unmarked'));
    emit(this, 'fidel-mark-complete', { done: this.done });
  }
}

export class FidelSkipLink extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    const lang = uiLang(this);
    const target = this.getAttribute('target') || '#main';
    const link = h('a', { class: 'fidel-skip-link', href: target, lang }, this.getAttribute('label') || translator(lang, 'skip')('label'));
    link.addEventListener('click', (event) => {
      let element = null;
      try {
        element = document.querySelector(target);
      } catch {
        element = null;
      }
      if (!element) return; // let the browser follow the link
      event.preventDefault();
      if (!element.matches('a[href], button, input, select, textarea, [tabindex]')) element.setAttribute('tabindex', '-1');
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: 'start' });
    });
    this.replaceChildren(link);
  }
}

export class FidelToggletip extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    const lang = uiLang(this);
    const tt = translator(lang, 'toggletip');
    this.content = [...this.childNodes];
    const label = this.getAttribute('label') || tt('label');
    this.bubble = h('div', { class: 'fidel-toggletip-bubble', role: 'status' }); // live region, empty until opened
    this.button = h('button', {
      type: 'button', class: 'fidel-toggletip-button', 'aria-expanded': 'false', lang,
      onclick: () => (this.isOpen ? this.close() : this.open()),
    }, h('span', { class: 'fidel-toggletip-icon', 'aria-hidden': 'true' }, 'i'), h('span', { lang: null }, label));
    this.replaceChildren(h('span', { class: 'fidel-toggletip' }, this.button, this.bubble));
    this.onKey = (event) => {
      if (event.key === 'Escape' && this.isOpen) {
        event.preventDefault();
        this.close();
        this.button.focus();
      }
    };
    this.onOutside = (event) => {
      if (this.isOpen && !this.contains(event.target)) this.close();
    };
    this.addEventListener('keydown', this.onKey);
    document.addEventListener('click', this.onOutside);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this.onOutside);
    this.built = false;
  }

  get isOpen() {
    return this.button.getAttribute('aria-expanded') === 'true';
  }

  open() {
    this.bubble.replaceChildren();
    this.button.setAttribute('aria-expanded', 'true');
    this.bubble.classList.add('fidel-toggletip-open');
    // A moment later, so screen readers notice the new text in the live region.
    setTimeout(() => {
      if (this.isOpen) this.bubble.replaceChildren(h('span', {}, ...this.content.map((n) => n.cloneNode(true))));
    }, 100);
  }

  close() {
    this.button.setAttribute('aria-expanded', 'false');
    this.bubble.classList.remove('fidel-toggletip-open');
    this.bubble.replaceChildren();
  }
}
