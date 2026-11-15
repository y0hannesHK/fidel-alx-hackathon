// <fidel-code-block language="python" label="Example: a loop" at="1:23" for="player-id">
//   <pre><code>for i in range(3):
//     print(i)</code></pre>
// </fidel-code-block>
//
// Code a screen reader and a Braille display can read. The code stays real
// text in <pre><code>. Buttons: Copy, Read line by line (a list where each
// line is read as "Line 2 of 3, indent 4 spaces: print open bracket i close
// bracket"), Symbols as words (on/off), and "Play from 1:23" when at="" is
// set and a <fidel-player> is on the page (or for="id").
// Line numbers are shown but hidden from screen readers (not read twice).
// Attributes: language, label, at, for, symbols="off", ui-lang.
// Events: fidel-code-block-copy, fidel-code-block-play { seconds }.
import { h, uid } from '../../dom.js';
import { emit } from '../../events.js';
import { announce } from '../../announce.js';
import { stringsFor, tr, langAttr, findPlayer, playFrom, uiLang } from './common.js';
import { spokenTime, timeNodes } from '../../spoken-time.js';
import { codeLines, describeLine, parseTime, formatTime } from './logic.js';

export class FidelCodeBlock extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    const source = this.querySelector('code') || this.querySelector('pre') || this;
    this.code = codeLines(source.textContent).join('\n');
    this.render();
  }

  /** The player this block plays (for="", or its <fidel-code-snapshots>' for="", or the first on the page). */
  player() {
    const id = this.getAttribute('for') || this.closest('fidel-code-snapshots')?.getAttribute('for');
    return findPlayer(id);
  }

  render() {
    const s = stringsFor(this);
    this.strings = s;
    const lang = langAttr(this);
    const lines = codeLines(this.code);
    const language = this.getAttribute('language');
    const label = this.getAttribute('label') || (language ? `${language} ${s.code}` : s.code);
    const labelId = uid('fidel-code-label');
    const listId = uid('fidel-code-lines');
    const seconds = parseTime(this.getAttribute('at'));
    this.symbolsOn = this.getAttribute('symbols') !== 'off';

    const pre = h('pre', { class: 'fidel-code-block-pre', translate: 'no' },
      h('code', { class: language ? `language-${language}` : null, lang: 'en' },
        lines.flatMap((line, i) => [
          h('span', { class: 'fidel-code-block-num', 'aria-hidden': 'true' }, String(i + 1)),
          line,
          i < lines.length - 1 ? '\n' : '',
        ])));

    const copy = h('button', { type: 'button', class: 'fidel-a-button', onclick: () => this.copy() }, s.copy);
    this.linesButton = h('button', {
      type: 'button', class: 'fidel-a-button', 'aria-expanded': 'false', 'aria-controls': listId,
      onclick: () => this.toggleLines(),
    }, s.readLines);
    this.symbolsState = h('span', { class: 'fidel-a-state', 'aria-hidden': 'true' });
    this.symbolsButton = h('button', {
      type: 'button', class: 'fidel-a-button', 'aria-pressed': String(this.symbolsOn),
      onclick: () => this.toggleSymbols(),
    }, s.symbols, ' ', this.symbolsState);

    const tools = h('div', { class: 'fidel-code-block-tools' }, copy, this.linesButton, this.symbolsButton);
    let at = null;
    if (seconds !== null) {
      const time = formatTime(seconds);
      const lang = uiLang(this);
      at = h('p', { class: 'fidel-code-block-at' }, timeNodes(tr(s, 'fromVideo', { time: '{time}' }), seconds, time, lang));
      if (this.player()) {
        tools.append(h('button', {
          type: 'button', class: 'fidel-a-button fidel-code-block-play',
          onclick: () => {
            if (playFrom(this.player(), seconds)) {
              announce(tr(s, 'playingFrom', { time: spokenTime(seconds, lang) }));
              emit(this, 'fidel-code-block-play', { seconds });
            }
          },
        }, timeNodes(tr(s, 'playFrom', { time: '{time}' }), seconds, time, lang)));
      }
    }

    this.list = h('ol', {
      id: listId, class: 'fidel-code-block-lines', hidden: true,
      'aria-label': tr(s, 'linesLabel', { label }),
      onkeydown: (event) => this.onLineKey(event),
    });
    this.listHelp = h('p', { class: 'fidel-code-block-help', hidden: true }, s.linesHelp);

    this.replaceChildren(h('div', { class: 'fidel-code-block', lang },
      h('p', { class: 'fidel-code-block-label', id: labelId }, label),
      at,
      // A focusable region, so keyboard users can scroll long lines sideways.
      h('div', { class: 'fidel-code-block-scroll', role: 'region', 'aria-labelledby': labelId, tabindex: '0' }, pre),
      tools,
      this.listHelp,
      this.list));
    this.fillLines();
  }

  fillLines() {
    const lines = codeLines(this.code);
    const focused = [...this.list.children].indexOf(document.activeElement);
    const current = Math.max(0, [...this.list.children].findIndex((li) => li.tabIndex === 0));
    this.list.replaceChildren(...lines.map((line, i) => h('li', {
      class: 'fidel-code-block-line',
      tabindex: i === current ? '0' : '-1',
    }, describeLine(line, i + 1, lines.length, this.strings, { symbols: this.symbolsOn }))));
    this.symbolsState.textContent = this.symbolsOn ? this.strings.on : this.strings.off;
    if (focused >= 0) this.list.children[focused]?.focus();
  }

  toggleLines() {
    const open = this.list.hidden;
    this.list.hidden = !open;
    this.listHelp.hidden = !open;
    this.linesButton.setAttribute('aria-expanded', String(open));
    if (open) this.list.querySelector('[tabindex="0"]')?.focus();
  }

  toggleSymbols() {
    this.symbolsOn = !this.symbolsOn;
    this.symbolsButton.setAttribute('aria-pressed', String(this.symbolsOn));
    this.fillLines();
  }

  /** Up/Down/Home/End move between lines (one line in the Tab order). */
  onLineKey(event) {
    const items = [...this.list.children];
    const index = items.indexOf(document.activeElement);
    if (index < 0) return;
    const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }[event.key];
    if (next === undefined || next < 0 || next >= items.length) return;
    event.preventDefault();
    items[index].tabIndex = -1;
    items[next].tabIndex = 0;
    items[next].focus();
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.code);
      announce(this.strings.copied);
      this.flash(this.strings.copied);
      emit(this, 'fidel-code-block-copy', {});
    } catch {
      announce(this.strings.copyFailed);
      this.flash(this.strings.copyFailed);
    }
  }

  /** Visible confirmation next to the buttons (the announcer is only heard). */
  flash(text) {
    let status = this.querySelector('.fidel-code-block-status');
    if (!status) {
      status = h('p', { class: 'fidel-code-block-status' });
      this.querySelector('.fidel-code-block-tools').after(status);
    }
    status.textContent = text;
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => { status.textContent = ''; }, 5000);
  }
}
