// <fidel-amharic-keyboard for="answer" ui-lang="en|am">
//
// Type Amharic without an Amharic keyboard installed: the Fidel table in two
// steps. Step 1: choose the consonant (34 buttons). Step 2: choose its vowel
// form (7 or 8 buttons). The letter is inserted at the cursor of the target
// field (an <input> or <textarea>, or the field inside a <fidel-input> /
// <fidel-textarea>) with setRangeText, and an "input" event is fired so the
// host's own listeners see the change.
//
// Keyboard: Tab reaches the letters as one stop; arrow keys move between
// letters, Home/End jump to the first/last, Enter/Space choose; Escape in
// step 2 goes back to step 1. Focus stays in the keyboard while typing;
// "Back to the text" puts focus in the field with the cursor at the end.
// Event: none needed (the field's own "input" event).
import { h, uid } from '../../dom.js';
import { announce } from '../../announce.js';
import { translator, uiLang } from './common.js';
import { deleteOneLetter, fidelTable } from './logic.js';

const PUNCTUATION = [['።', 'fullStop'], ['፣', 'comma'], ['፤', 'semicolon'], ['፧', 'question']];

export class FidelAmharicKeyboard extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.lang = uiLang(this);
    this.tt = translator(this.lang, 'keyboard');
    this.table = fidelTable();
    this.build();
  }

  /** The text field to write into. */
  get field() {
    const target = document.getElementById(this.getAttribute('for') || '');
    if (!target) return null;
    return target.matches('input, textarea') ? target : target.querySelector('input, textarea');
  }

  build() {
    const tt = this.tt;
    const ids = { panel: uid('kb-panel'), title: uid('kb-title'), step1: uid('kb-step1'), step2: uid('kb-step2'), hint: uid('kb-hint') };
    this.toggle = h('button', {
      type: 'button', class: 'fidel-d-button', 'aria-expanded': 'false', 'aria-controls': ids.panel,
      onclick: () => this.setOpen(this.panel.hidden),
    }, tt('show'));

    this.letters = h('div', { class: 'fidel-kb-grid', role: 'group', 'aria-labelledby': ids.step1 },
      this.table.map((row, i) => this.letterButton(row.consonant, row.latin, i === 0, () => this.showForms(i))));
    this.forms = h('div', { class: 'fidel-kb-grid', role: 'group', 'aria-labelledby': ids.step2 });
    this.step2Title = h('p', { id: ids.step2, class: 'fidel-kb-step' });
    this.step2 = h('div', { class: 'fidel-kb-step2', hidden: true },
      this.step2Title, this.forms,
      h('button', { type: 'button', class: 'fidel-d-button fidel-kb-back', onclick: () => this.showLetters() }, tt('back')));
    this.step1 = h('div', { class: 'fidel-kb-step1' }, h('p', { id: ids.step1, class: 'fidel-kb-step' }, tt('step1')), this.letters);
    for (const grid of [this.letters, this.forms]) grid.addEventListener('keydown', (event) => this.moveFocus(event, grid));
    this.step2.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.showLetters();
      }
    });

    const key = (label, name, onclick, extra = {}) => h('button', { type: 'button', class: 'fidel-d-button', onclick, ...extra }, label, name);
    const keys = h('div', { class: 'fidel-kb-keys' },
      key(tt('space'), null, () => this.insert(' ', tt('spaceAdded'))),
      key(tt('delete'), null, () => this.deleteLetter()),
      PUNCTUATION.map(([mark, name]) => key(
        h('span', { lang: 'am', 'aria-hidden': 'true' }, mark), h('span', { class: 'fidel-kb-sr' }, `${mark}, ${tt(name)}`),
        () => this.insert(mark, tt('inserted', { letter: tt(name) })))),
      key(tt('backToText'), null, () => this.backToText()),
      key(tt('hide'), null, () => {
        this.setOpen(false);
        this.toggle.focus();
      }));

    this.message = h('p', { class: 'fidel-d-error', hidden: true });
    this.panel = h('div', { id: ids.panel, class: 'fidel-kb-panel', role: 'group', 'aria-labelledby': ids.title, 'aria-describedby': ids.hint, hidden: true },
      h('p', { id: ids.title, class: 'fidel-kb-title' }, tt('label')),
      h('p', { id: ids.hint, class: 'fidel-d-hint' }, tt('hint')),
      this.step1, this.step2, keys, this.message);
    this.replaceChildren(h('div', { class: 'fidel-kb', lang: this.lang }, this.toggle, this.panel));
  }

  letterButton(char, latin, tabbable, onclick) {
    return h('button', { type: 'button', class: 'fidel-kb-key', tabindex: tabbable ? '0' : '-1', 'data-char': char, onclick },
      h('span', { lang: 'am', 'aria-hidden': 'true' }, char),
      h('span', { class: 'fidel-kb-sr' }, `${char}, ${latin}`));
  }

  setOpen(open) {
    this.panel.hidden = !open;
    this.toggle.setAttribute('aria-expanded', String(open));
    this.toggle.textContent = open ? this.tt('hide') : this.tt('show');
    if (open) this.showLetters({ focus: false });
  }

  showForms(index) {
    const row = this.table[index];
    this.chosen = index;
    this.step2Title.textContent = this.tt('step2', { letter: row.consonant });
    this.forms.replaceChildren(...row.forms.map((form, i) =>
      this.letterButton(form.char, form.latin, i === 0, () => this.insert(form.char, this.tt('inserted', { letter: `${form.char}, ${form.latin}` }), true))));
    this.step1.hidden = true;
    this.step2.hidden = false;
    this.forms.querySelector('button').focus();
  }

  showLetters({ focus = true } = {}) {
    this.step2.hidden = true;
    this.step1.hidden = false;
    if (!focus) return;
    const buttons = [...this.letters.querySelectorAll('button')];
    const target = buttons[this.chosen ?? 0];
    for (const b of buttons) b.tabIndex = b === target ? 0 : -1;
    target.focus();
  }

  /** Arrow keys, Home and End move between the letter buttons (roving tabindex). */
  moveFocus(event, grid) {
    const buttons = [...grid.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    if (index === -1) return;
    // Buttons per row, from the layout (the grid wraps on narrow screens).
    const columns = Math.max(1, buttons.filter((b) => b.offsetTop === buttons[0].offsetTop).length);
    const rtl = getComputedStyle(grid).direction === 'rtl';
    const moves = {
      ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, ArrowDown: columns, ArrowUp: -columns,
      Home: -Infinity, End: Infinity,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = Math.min(buttons.length - 1, Math.max(0, index + moves[event.key]));
    buttons[index].tabIndex = -1;
    buttons[next].tabIndex = 0;
    buttons[next].focus();
  }

  showProblem(message) {
    this.message.textContent = message;
    this.message.hidden = !message;
    if (message) announce(message, { assertive: true });
  }

  insert(textValue, message, backToStep1 = false) {
    const field = this.field;
    if (!field) return this.showProblem(this.tt('noField'));
    this.showProblem('');
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    field.setRangeText(textValue, start, end, 'end');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    announce(message);
    if (backToStep1) this.showLetters();
  }

  deleteLetter() {
    const field = this.field;
    if (!field) return this.showProblem(this.tt('noField'));
    this.showProblem('');
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    if (start !== end) {
      field.setRangeText('', start, end, 'end');
    } else {
      const { cursor, removed } = deleteOneLetter(field.value, start);
      if (!removed) return announce(this.tt('nothingToDelete'));
      field.setRangeText('', cursor, start, 'end');
      announce(this.tt('deleted', { letter: removed === ' ' ? this.tt('space') : removed }));
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  backToText() {
    const field = this.field;
    if (!field) return this.showProblem(this.tt('noField'));
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }
}
