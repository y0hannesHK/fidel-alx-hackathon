// <fidel-download-later href="/api/v1/lessons/ID/offline.html" label="Lesson 3" size="3100000">
//
// B3. "Download when I'm online": the lesson goes into a queue (kept in this
// browser) and is downloaded as soon as the phone is online, into the same
// cache as the player's "Save for offline" (see offline-store.js). Then it
// shows and announces "Lesson 3 is ready offline".
// Where the browser can tell Wi-Fi from mobile data (Android Chrome), an
// "Only on Wi-Fi" checkbox is offered; elsewhere it is not shown.
//
// Attributes: href, label, size (bytes, shown on the button), ui-lang (en | am)
// Event: fidel-download-ready { href, label }
import { h, uid } from '../../dom.js';
import { emit } from '../../events.js';
import { announce } from '../../announce.js';
import { formatSize } from './logic.js';
import { addToQueue, cacheUrl, changes, hasCache, isCached, loadQueue, removeFromQueue, state, watchConnection } from './offline-store.js';
import { langOf, translator } from './strings.js';

const canTellWifi = () => Boolean(navigator.connection && 'type' in navigator.connection);

export class FidelDownloadLater extends HTMLElement {
  connectedCallback() {
    if (this.listeners) return;
    this.href = new URL(this.getAttribute('href') || '', location.href).href;
    this.label = this.getAttribute('label') || this.getAttribute('href');
    const mine = (e) => e.detail?.href === this.href;
    this.listeners = {
      queue: () => this.render(),
      state: (e) => mine(e) && this.render(),
      ready: (e) => {
        if (!mine(e)) return;
        this.render().then(() => {
          announce(this.tr('ready', { label: this.label }));
          emit(this, 'fidel-download-ready', { href: this.getAttribute('href'), label: this.label });
        });
      },
    };
    for (const [name, fn] of Object.entries(this.listeners)) changes.addEventListener(name, fn);
    this.render();
    watchConnection();
  }

  disconnectedCallback() {
    if (!this.listeners) return;
    for (const [name, fn] of Object.entries(this.listeners)) changes.removeEventListener(name, fn);
    this.listeners = null;
  }

  async render() {
    const lang = langOf(this);
    const tr = translator(lang);
    this.tr = tr;
    const label = this.label;
    const hadFocus = this.contains(document.activeElement);
    const status = h('p', { class: 'fidel-download-later-status' });
    const parts = [];

    if (!hasCache()) {
      status.textContent = tr('cannotSave'); // no button that cannot work
    } else if (await isCached(this.href)) {
      status.textContent = tr('ready', { label });
      parts.push(h('a', { href: cacheUrl(this.href) }, tr('open', { label })));
    } else {
      const queued = loadQueue().find((q) => q.href === this.href);
      if (queued) {
        const now = state.get(this.href);
        status.textContent = now === 'downloading' ? tr('downloading', { label })
          : now === 'failed' ? tr('failed', { label })
            : tr(queued.wifiOnly ? 'waitingWifi' : 'waiting', { label });
        parts.push(h('button', {
          type: 'button', class: 'fidel-button',
          onclick: () => {
            removeFromQueue(this.href);
            announce(tr('removed', { label }));
          },
        }, tr('cancel', { label })));
      } else {
        const size = formatSize(this.getAttribute('size'), lang, tr('mb'));
        const wifiId = uid('fidel-wifi');
        const wifi = canTellWifi() && h('div', { class: 'fidel-download-later-wifi' },
          h('input', { type: 'checkbox', id: wifiId }),
          h('label', { for: wifiId }, tr('wifiOnly')));
        parts.push(h('button', {
          type: 'button', class: 'fidel-button',
          onclick: () => {
            const wifiOnly = Boolean(wifi && wifi.querySelector('input').checked);
            addToQueue({ href: this.href, label, size: this.getAttribute('size'), wifiOnly });
            announce(tr(wifiOnly ? 'waitingWifi' : 'waiting', { label }));
          },
        }, size ? `${tr('downloadLater')} (${label}, ${size})` : `${tr('downloadLater')} (${label})`), wifi);
      }
    }
    this.replaceChildren(h('div', { class: 'fidel-download-later', lang }, status, parts));
    if (hadFocus) this.querySelector('button, a')?.focus();
  }
}
