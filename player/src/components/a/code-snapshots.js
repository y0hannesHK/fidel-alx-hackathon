// <fidel-code-snapshots for="lesson-player">
//   <fidel-code-block at="0:45" language="html" label="Step 1">…</fidel-code-block>
//   <fidel-code-block at="1:23" language="html" label="Step 2">…</fidel-code-block>
// </fidel-code-snapshots>
//
// Code in sync with the video. Lists the code snapshots in time order. While
// the player plays, the current one is marked (highlight PLUS the visible word
// "Now") and announced politely, "Code for 1:23 is ready", at most once per
// snapshot and never while the learner is seeking. Each snapshot has its own
// "Play from 1:23" button (from <fidel-code-block>).
// Attributes: for (id of a <fidel-player>, <video> or <audio>; default: the
// first <fidel-player> on the page), ui-lang.
// Events: fidel-code-snapshots-change { index, seconds }.
import { h } from '../../dom.js';
import { emit } from '../../events.js';
import { announce } from '../../announce.js';
import { stringsFor, tr, langAttr, findPlayer } from './common.js';
import { parseTime, formatTime, currentIndex } from './logic.js';

export class FidelCodeSnapshots extends HTMLElement {
  connectedCallback() {
    if (!this.built) {
      this.built = true;
      this.render();
    }
    this.listen();
  }

  disconnectedCallback() {
    for (const [type, handler] of this.handlers || []) document.removeEventListener(type, handler, true);
    this.handlers = null;
  }

  render() {
    const s = stringsFor(this);
    this.strings = s;
    const blocks = [...this.querySelectorAll(':scope > fidel-code-block')]
      .map((block) => ({ block, seconds: parseTime(block.getAttribute('at')) ?? 0 }))
      .sort((a, b) => a.seconds - b.seconds);
    this.times = blocks.map((b) => b.seconds);
    this.items = blocks.map(({ block, seconds }) => h('li', { class: 'fidel-code-snapshots-item', 'data-seconds': seconds },
      h('p', { class: 'fidel-code-snapshots-now', hidden: true, lang: langAttr(this) }, s.now),
      block));
    this.current = -1;
    this.announced = new Set();
    this.replaceChildren(h('ol', { class: 'fidel-code-snapshots-list' }, this.items));
  }

  /**
   * Media events do not bubble, but they can be caught on the way down
   * (capture), so this works whenever the player builds its <video>.
   */
  listen() {
    if (this.handlers) return;
    const fromPlayer = (event) => {
      const player = findPlayer(this.getAttribute('for'));
      return player && (player === event.target || player.contains(event.target)) ? event.target : null;
    };
    this.handlers = [
      ['seeking', (e) => { if (fromPlayer(e)) this.seeking = true; }],
      ['seeked', (e) => {
        const media = fromPlayer(e);
        if (!media) return;
        this.seeking = false;
        // The learner chose this place: mark it quietly, no announcement.
        this.update(media.currentTime, { quiet: true });
      }],
      ['timeupdate', (e) => {
        const media = fromPlayer(e);
        if (!media || this.seeking || media.seeking) return;
        this.update(media.currentTime, { quiet: media.paused });
      }],
    ];
    for (const [type, handler] of this.handlers) document.addEventListener(type, handler, true);
  }

  update(seconds, { quiet }) {
    const index = currentIndex(this.times, seconds);
    if (index === this.current) return;
    this.current = index;
    this.items.forEach((item, i) => {
      const now = i === index;
      item.classList.toggle('fidel-code-snapshots-current', now);
      if (now) item.setAttribute('aria-current', 'time');
      else item.removeAttribute('aria-current');
      item.querySelector('.fidel-code-snapshots-now').hidden = !now;
    });
    if (index < 0) return;
    const time = formatTime(this.times[index]);
    if (quiet) this.announced.add(index);
    if (!this.announced.has(index)) {
      this.announced.add(index);
      announce(tr(this.strings, 'codeReady', { time }));
    }
    emit(this, 'fidel-code-snapshots-change', { index, seconds: this.times[index] });
  }
}
