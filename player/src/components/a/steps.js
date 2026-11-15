// <fidel-steps label="Install VS Code">
//   <ol><li>Open the website…</li><li>Download…</li><li>Run the installer…</li></ol>
// </fidel-steps>
//
// Instructions one step at a time, for learners new to computers. Shows one
// step with "Step 2 of 5", Previous / Next buttons and an "I did this step"
// checkbox. On each change focus moves to the step's heading, so a screen
// reader reads where the learner is. "Show all steps" shows the whole list
// (the plain <ol> is also what shows without JavaScript).
// Progress is remembered in this browser (localStorage, per label).
// Attributes: label, heading-level (2–5, default 3: the label's heading;
// steps get the next level), ui-lang.
// Events: fidel-steps-change { step, total, done } (step counts from 1).
import { h, uid } from '../../dom.js';
import { emit } from '../../events.js';
import { announce } from '../../announce.js';
import { stringsFor, tr, uiLang } from './common.js';
import { cleanStepState } from './logic.js';

const STORAGE_PREFIX = 'fidel-steps:';

export class FidelSteps extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    const list = this.querySelector('ol, ul');
    if (!list || !list.children.length) return; // nothing to show step by step: leave the content as it is
    this.built = true;
    this.strings = stringsFor(this);
    this.list = list;
    this.steps = [...list.children].filter((el) => el.tagName === 'LI');
    this.key = STORAGE_PREFIX + (this.getAttribute('label') || this.steps[0].textContent.trim().slice(0, 40));
    this.state = cleanStepState(this.load(), this.steps.length);
    this.render();
    this.show({ focus: false });
  }

  load() {
    try { return JSON.parse(localStorage.getItem(this.key) || 'null'); } catch { return null; }
  }

  save() {
    try { localStorage.setItem(this.key, JSON.stringify(this.state)); } catch { /* not remembered: not fatal */ }
  }

  render() {
    const s = this.strings;
    const level = Math.min(5, Math.max(2, Number(this.getAttribute('heading-level')) || 3));
    const label = this.getAttribute('label');
    const checkId = uid('fidel-steps-done');
    this.heading = h(`h${level + 1}`, { class: 'fidel-steps-heading', tabindex: '-1' });
    this.body = h('div', { class: 'fidel-steps-body' });
    this.check = h('input', { type: 'checkbox', id: checkId, class: 'fidel-steps-check', onchange: () => this.markDone() });
    this.prev = h('button', { type: 'button', class: 'fidel-a-button', onclick: () => this.go(-1) }, s.previous);
    this.next = h('button', { type: 'button', class: 'fidel-a-button', onclick: () => this.go(1) }, s.next);
    this.progress = h('progress', { class: 'fidel-steps-progress', max: String(this.steps.length), 'aria-hidden': 'true' });
    this.progressText = h('p', { class: 'fidel-steps-count' });
    this.allButton = h('button', {
      type: 'button', class: 'fidel-a-button fidel-steps-all', 'aria-pressed': 'false',
      onclick: () => this.toggleAll(),
    }, s.showAll);
    this.single = h('div', { class: 'fidel-steps-one' },
      this.heading,
      this.body,
      h('div', { class: 'fidel-steps-check-row' }, this.check, h('label', { for: checkId }, s.didStep)),
      h('div', { class: 'fidel-steps-nav' }, this.prev, this.next));
    this.list.classList.add('fidel-steps-list');
    this.list.hidden = true;
    this.prepend(h('div', { class: 'fidel-steps-top', lang: uiLang(this) === 'am' ? 'am' : null },
      label ? h(`h${level}`, { class: 'fidel-steps-title' }, label) : null,
      this.progressText, this.progress, this.allButton));
    this.list.before(this.single);
    // Labels inside our controls must be in the interface language.
    for (const el of [this.single.querySelector('label'), this.prev, this.next]) {
      if (uiLang(this) === 'am') el.setAttribute('lang', 'am');
    }
  }

  /** Show the current step; move focus to its heading if the learner changed step. */
  show({ focus }) {
    const s = this.strings;
    const { current, done } = this.state;
    const total = this.steps.length;
    this.heading.textContent = tr(s, 'stepOf', { n: current + 1, total });
    if (uiLang(this) === 'am') this.heading.setAttribute('lang', 'am');
    this.steps.forEach((li, i) => {
      li.querySelector(':scope > .fidel-steps-done')?.remove();
      if (done.includes(i)) li.append(h('span', { class: 'fidel-steps-done', lang: uiLang(this) === 'am' ? 'am' : null }, ` (${s.done})`));
    });
    this.body.replaceChildren(...[...this.steps[current].childNodes].map((n) => n.cloneNode(true)));
    for (const el of this.body.querySelectorAll('[id]')) el.removeAttribute('id');
    this.body.querySelector(':scope > .fidel-steps-done')?.remove(); // the checkbox says it here
    this.check.checked = done.includes(current);
    this.prev.disabled = current === 0;
    this.next.disabled = current === total - 1;
    this.progress.value = done.length;
    this.progressText.textContent = tr(s, 'doneCount', { done: done.length, total });
    if (focus) this.heading.focus();
  }

  go(delta) {
    const target = this.state.current + delta;
    if (target < 0 || target >= this.steps.length) return;
    this.state.current = target;
    this.save();
    this.show({ focus: true });
    this.changed();
  }

  markDone() {
    const { current } = this.state;
    const done = new Set(this.state.done);
    if (this.check.checked) done.add(current); else done.delete(current);
    this.state.done = [...done].sort((a, b) => a - b);
    this.save();
    this.show({ focus: false });
    announce(this.progressText.textContent);
    this.changed();
  }

  toggleAll() {
    const all = this.allButton.getAttribute('aria-pressed') !== 'true';
    this.allButton.setAttribute('aria-pressed', String(all));
    this.list.hidden = !all;
    this.single.hidden = all;
  }

  changed() {
    emit(this, 'fidel-steps-change', { step: this.state.current + 1, total: this.steps.length, done: this.state.done.length });
  }
}
