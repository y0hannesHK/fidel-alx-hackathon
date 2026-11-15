// <fidel-visual-alert id="alerts"></fidel-visual-alert>
//   document.getElementById('alerts').notify('Your lesson finished downloading');
//   // or, from any component or script:
//   document.dispatchEvent(new CustomEvent('fidel-visual-alert', { detail: { message: '...' } }));
//
// Sounds you can see (and feel), for Deaf and hard-of-hearing learners.
// Each message shows as a banner (icon + text) that stays until the learner
// closes it, or closes itself after 15 seconds if the learner chose that in
// "Alert settings". Optional vibration (the learner turns it on). No flashing:
// the banner simply appears once. Screen readers hear it politely.
//
// Attributes: ui-lang. Method: notify(message). Events: fidel-visual-alert-shown { message }.
// Settings remembered in localStorage "fidel-components-c" (keepAlerts, vibrate).
import { announce } from '../../announce.js';
import { emit } from '../../events.js';
import { h, langOf, translator, settings, nextId, textLang } from './shared.js';

const TIMED_MS = 15000;
const MAX_BANNERS = 5;

export class FidelVisualAlert extends HTMLElement {
  connectedCallback() {
    if (!this.built) this.build();
    this.onDocumentAlert = (event) => {
      if (event.fidelHandled || event.target === this) return;
      event.fidelHandled = true; // one banner per message, even with two alert areas
      this.notify(event.detail?.message);
    };
    document.addEventListener('fidel-visual-alert', this.onDocumentAlert);
  }

  disconnectedCallback() {
    document.removeEventListener('fidel-visual-alert', this.onDocumentAlert);
  }

  build() {
    this.built = true;
    this.lang_ = langOf(this);
    const tr = translator(this.lang_);
    this.tr = tr;
    const saved = settings.load();
    this.list = h('div', { class: 'fidel-visual-alert-list' });

    const check = (key, label, onChange) => {
      const id = nextId('fidel-visual-alert-setting');
      return h('div', { class: 'fidel-c-check' },
        h('input', {
          type: 'checkbox', id, checked: Boolean(saved[key]),
          onchange: (event) => { settings.save({ [key]: event.target.checked }); onChange?.(event.target.checked); },
        }),
        h('label', { for: id }, label));
    };
    const timedNote = h('p', { class: 'fidel-c-note', hidden: saved.keepAlerts }, tr('alertKeepOff'));
    const canVibrate = typeof navigator.vibrate === 'function';
    this.replaceChildren(
      h('div', { class: 'fidel-visual-alert', lang: this.lang_ },
        this.list,
        h('details', { class: 'fidel-visual-alert-settings' },
          h('summary', {}, tr('alertSettings')),
          check('keepAlerts', tr('alertKeep'), (on) => { timedNote.hidden = on; }),
          timedNote,
          canVibrate && check('vibrate', tr('alertVibrate')))));
  }

  /** Show a message. Returns the banner element. */
  notify(message) {
    if (!message) return null;
    if (!this.built) this.build();
    const tr = this.tr;
    const text = String(message);
    const close = h('button', { type: 'button', class: 'fidel-c-button' },
      tr('alertClose'));
    const textId = nextId('fidel-visual-alert-text');
    close.setAttribute('aria-describedby', textId);
    const banner = h('div', { class: 'fidel-visual-alert-banner' },
      h('span', { class: 'fidel-visual-alert-icon', 'aria-hidden': 'true' }, '🔔'),
      h('p', { class: 'fidel-visual-alert-text', id: textId, lang: textLang(text, this.lang_) },
        h('span', { class: 'fidel-c-hidden' }, `${tr('alertLabel')}: `), text),
      close);
    let timer = null;
    const remove = () => {
      clearTimeout(timer);
      const hadFocus = banner.contains(document.activeElement);
      banner.remove();
      // Focus never falls to the top of the page: go to the next alert's
      // Close button, or the settings.
      if (hadFocus) (this.list.querySelector('button') || this.querySelector('summary'))?.focus();
    };
    close.addEventListener('click', remove);
    // While the learner is on the banner, it never closes by itself.
    banner.addEventListener('focusin', () => clearTimeout(timer));

    this.list.prepend(banner);
    while (this.list.children.length > MAX_BANNERS) this.list.lastElementChild.remove();

    const prefs = settings.load();
    if (!prefs.keepAlerts) timer = setTimeout(remove, TIMED_MS);
    if (prefs.vibrate && typeof navigator.vibrate === 'function') navigator.vibrate(200);
    announce(`${tr('alertLabel')}: ${text}`);
    emit(this, 'fidel-visual-alert-shown', { message: text });
    return banner;
  }
}
