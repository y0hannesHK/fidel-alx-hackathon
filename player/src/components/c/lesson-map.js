// <fidel-lesson-map for="lesson-player" chapters="chapters.vtt"></fidel-lesson-map>
//
// Where am I, and jump anywhere. A <nav aria-label="This lesson"> with jump
// links to the parts of the lesson that exist on this page (video,
// transcript, notes, code, next lesson), the chapters as "Play from 0:59 ..."
// buttons when there is a player, and "You have watched 40%" (a <progress>
// plus text). The progress is never announced by itself: the "Where am I?"
// button says it when the learner asks.
//
// What it links to (only if it is on the page):
//   Video        the <fidel-player> named in `for` (else the first one with an id)
//   Transcript   that player's transcript heading, or an element with id="transcript"
//   Notes        id="notes" (or the id in notes-id)
//   Code         id="code" (or the id in code-id), or the first <fidel-code-snapshots>/<fidel-code-block> with an id
//   Next lesson  next-href / next-label, or the next-href of a <fidel-step-nav> on the page
// Attributes: for, chapters (WebVTT; default: the player's chapters / chapters-am),
//   next-href, next-label, notes-id, code-id, ui-lang.
// Event: fidel-lesson-map-play { seconds } (when a chapter button is used).
import { announce } from '../../announce.js';
import { emit } from '../../events.js';
import { parseVtt, formatTime } from '../../vtt.js';
import { h, langOf, translator, nextId, textLang } from './shared.js';
import { chapterAt, clampPercent } from './logic.js';

export class FidelLessonMap extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.lang_ = langOf(this);
    this.tr = translator(this.lang_);
    this.percent = 0;
    this.seconds = 0;
    this.chapters = [];
    this.renderShell();
    // Fidel players build themselves after the page loads: look again then.
    this.onReady = (event) => {
      if (!this.player() || event.target === this.player()) this.refresh();
    };
    this.onProgress = (event) => {
      const player = this.player();
      if (player && event.target !== player) return;
      this.setProgress(event.detail?.percent, event.detail?.seconds);
    };
    document.addEventListener('fidel-ready', this.onReady);
    document.addEventListener('fidel-progress', this.onProgress);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => this.refresh(), { once: true });
    else this.refresh();
  }

  disconnectedCallback() {
    document.removeEventListener('fidel-ready', this.onReady);
    document.removeEventListener('fidel-progress', this.onProgress);
    this.built = false;
  }

  player() {
    const id = this.getAttribute('for');
    const el = id ? document.getElementById(id) : document.querySelector('fidel-player[id]');
    return el && el.localName === 'fidel-player' ? el : null;
  }

  renderShell() {
    const tr = this.tr;
    const labelId = nextId('fidel-lesson-map-label');
    this.links = h('ul', { class: 'fidel-lesson-map-links' });
    this.chapterBox = h('div', { hidden: true });
    this.progress = h('progress', { max: '100', value: '0', 'aria-labelledby': labelId });
    this.progressText = h('span', { id: labelId }, tr('mapWatched', { n: 0 }));
    this.progressBox = h('div', { class: 'fidel-lesson-map-progress', hidden: true },
      this.progress, this.progressText,
      h('button', { type: 'button', class: 'fidel-c-button', onclick: () => this.whereAmI() }, tr('mapWhere')));
    this.replaceChildren(
      h('nav', { class: 'fidel-lesson-map', lang: this.lang_, 'aria-label': tr('mapLabel') },
        h('p', { class: 'fidel-lesson-map-label', 'aria-hidden': 'true' }, tr('mapLabel')),
        this.links, this.chapterBox, this.progressBox));
  }

  /** The jump-link targets that exist right now: [{ key, href, label }]. */
  targets() {
    const tr = this.tr;
    const found = [];
    const player = this.player();
    const byId = (id) => document.getElementById(id);
    if (player?.id) found.push({ href: `#${player.id}`, label: tr('mapVideo') });
    const transcript = player?.querySelector('.fidel-transcript [id].fidel-heading') || byId('transcript');
    if (transcript?.id) found.push({ href: `#${transcript.id}`, label: tr('mapTranscript') });
    const notes = byId(this.getAttribute('notes-id') || 'notes');
    if (notes) found.push({ href: `#${notes.id}`, label: tr('mapNotes') });
    const code = byId(this.getAttribute('code-id') || 'code') || document.querySelector('fidel-code-snapshots[id], fidel-code-block[id]');
    if (code) found.push({ href: `#${code.id}`, label: tr('mapCode') });
    const stepNav = document.querySelector('fidel-step-nav[next-href]');
    const nextHref = this.getAttribute('next-href') || stepNav?.getAttribute('next-href');
    const nextLabel = this.getAttribute('next-label') || (stepNav && !this.getAttribute('next-href') ? stepNav.getAttribute('next-label') : null);
    if (nextHref) found.push({ href: nextHref, label: nextLabel ? tr('mapNextNamed', { label: nextLabel }) : tr('mapNext') });
    return found;
  }

  refresh() {
    const targets = this.targets();
    this.links.replaceChildren(...targets.map((t) => h('li', {}, h('a', { href: t.href, lang: textLang(t.label, this.lang_) }, t.label))));
    this.links.hidden = targets.length === 0;
    const player = this.player();
    this.progressBox.hidden = !player;
    if (player) this.loadChapters(player);
  }

  async loadChapters(player) {
    const url = this.getAttribute('chapters')
      || (this.lang_ === 'am' && player.getAttribute('chapters-am'))
      || player.getAttribute('chapters') || player.getAttribute('chapters-en');
    if (!url || this.chaptersUrl === url) return;
    this.chaptersUrl = url;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
      this.chapters = parseVtt(await response.text());
    } catch {
      this.chapters = []; // no chapters: no chapter list (never a broken one)
    }
    this.renderChapters();
  }

  renderChapters() {
    const tr = this.tr;
    const headingId = nextId('fidel-lesson-map-chapters');
    this.chapterBox.hidden = this.chapters.length === 0;
    this.chapterBox.replaceChildren(
      h('p', { class: 'fidel-lesson-map-sub', id: headingId }, tr('mapChapters')),
      h('ul', { class: 'fidel-lesson-map-chapters', 'aria-labelledby': headingId },
        this.chapters.map((chapter) => h('li', {},
          h('button', { type: 'button', class: 'fidel-c-button', onclick: () => this.playFrom(chapter.start) },
            tr('mapPlayFrom', { time: formatTime(chapter.start) }), ' ',
            h('span', { lang: textLang(chapter.text, 'en') }, chapter.text))))));
  }

  playFrom(seconds) {
    const player = this.player();
    if (!player?.playFrom || !player.ablePlayer) return;
    player.playFrom(seconds);
    announce(this.tr('mapPlayingFrom', { time: formatTime(seconds) }));
    emit(this, 'fidel-lesson-map-play', { seconds });
  }

  setProgress(percent, seconds) {
    this.percent = clampPercent(percent);
    if (Number.isFinite(seconds)) this.seconds = seconds;
    this.progress.value = this.percent;
    // Visible text only: no live region, so nothing is read out by itself.
    this.progressText.textContent = this.tr('mapWatched', { n: this.percent });
  }

  whereAmI() {
    const chapter = chapterAt(this.chapters, this.seconds);
    const parts = [`${this.tr('mapWatched', { n: this.percent })}.`];
    if (chapter) parts.push(this.tr('mapChapterNow', { title: chapter.text }));
    announce(parts.join(' '));
  }
}
