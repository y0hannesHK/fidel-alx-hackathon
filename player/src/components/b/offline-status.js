// <fidel-offline-status></fidel-offline-status>
//
// B2. A small line that is always visible: "Online." or "You are offline.
// 3 lessons are saved on this phone." It counts what the player's "Save for
// offline" button and <fidel-download-later> keep (see offline-store.js), and
// lists the saved lessons as links in a "Saved lessons" <details>.
// Screen readers hear it only when the connection CHANGES (politely).
//
// Attributes: ui-lang (en | am).  Event: fidel-offline-status-change { online }
import { h } from '../../dom.js';
import { emit } from '../../events.js';
import { announce } from '../../announce.js';
import { changes, savedItems } from './offline-store.js';
import { langOf, translator } from './strings.js';

export class FidelOfflineStatus extends HTMLElement {
  connectedCallback() {
    if (this.listeners) return;
    this.listeners = {
      online: () => this.changed(),
      offline: () => this.changed(),
      saved: () => this.update(),
    };
    window.addEventListener('online', this.listeners.online);
    window.addEventListener('offline', this.listeners.offline);
    document.addEventListener('fidel-offline-saved', this.listeners.saved); // the player's Save button
    changes.addEventListener('ready', this.listeners.saved); // <fidel-download-later>
    this.update();
  }

  disconnectedCallback() {
    if (!this.listeners) return;
    window.removeEventListener('online', this.listeners.online);
    window.removeEventListener('offline', this.listeners.offline);
    document.removeEventListener('fidel-offline-saved', this.listeners.saved);
    changes.removeEventListener('ready', this.listeners.saved);
    this.listeners = null;
  }

  async changed() {
    const text = await this.update();
    announce(text);
    emit(this, 'fidel-offline-status-change', { online: navigator.onLine });
  }

  /** Redraw; returns the status line's text. */
  async update() {
    const lang = langOf(this);
    const tr = translator(lang);
    const online = navigator.onLine;
    const items = await savedItems();
    let line = online ? tr('online') : tr('offline');
    if (items) {
      const count = items.length === 1 ? tr('savedOne') : tr('savedCount', { n: items.length });
      // Offline, the count always matters. Online, only when there is something saved.
      if (!online) line += ` ${items.length ? count : tr('savedNone')}`;
      else if (items.length) line += ` ${count}`;
    }
    if (!this.box) {
      this.lineEl = h('p', { class: 'fidel-offline-status-line' });
      this.listEl = h('details', { hidden: true }, h('summary', {}, tr('savedList')), h('ul'));
      this.box = h('div', { class: 'fidel-offline-status', lang }, this.lineEl, this.listEl);
      this.replaceChildren(this.box);
    }
    this.box.dataset.online = String(online);
    this.lineEl.textContent = line;
    // Only the list is rebuilt (the line and the <details> keep focus and open state).
    this.listEl.hidden = !items?.length;
    this.listEl.querySelector('ul').replaceChildren(...(items || []).map((item, i) =>
      h('li', {}, h('a', { href: item.url }, item.title || tr('savedLesson', { n: i + 1 })))));
    return line;
  }
}
