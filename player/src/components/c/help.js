// <fidel-help chat-url="https://t.me/..." email="help@example.org"
//             video-call-url="https://..." phone="+251..."></fidel-help>
//
// Help in the same place, in every form (WCAG 3.2.6 Consistent Help).
// A "Get help" button opens a dialog listing only the routes the host gave,
// text first so Deaf learners are never sent to a phone line:
// Text chat, Email, Video call with a sign-language interpreter, Phone (voice call).
// Each is a real link. It says honestly what happens next.
// Put it in the same spot on every page.
//
// Attributes: chat-url, email, video-call-url, phone, hours (e.g. "Mon-Fri 8:30-17:00"), ui-lang.
// Events: fidel-help-open, fidel-help-choose { route: "chat"|"email"|"video"|"phone" }.
import { emit } from '../../events.js';
import { h, langOf, translator, makeDialog } from './shared.js';
import { helpRoutes } from './logic.js';

export class FidelHelp extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    const lang = langOf(this);
    const tr = translator(lang);
    const routes = helpRoutes({
      chat: this.getAttribute('chat-url'),
      email: this.getAttribute('email'),
      video: this.getAttribute('video-call-url'),
      phone: this.getAttribute('phone'),
    });
    if (routes.length === 0) {
      // Never a button that leads nowhere.
      console.warn('<fidel-help>: give at least one of chat-url, email, video-call-url, phone.');
      return;
    }
    const names = { chat: tr('helpChat'), email: tr('helpEmail'), video: tr('helpVideo'), phone: tr('helpPhone') };
    const notes = {
      chat: tr('helpChatNote'),
      email: tr('helpEmailNote', { email: this.getAttribute('email') }),
      video: tr('helpVideoNote'),
      phone: tr('helpPhoneNote', { phone: this.getAttribute('phone') }),
    };
    const hours = this.getAttribute('hours');
    const button = h('button', {
      type: 'button', class: 'fidel-c-button', 'aria-haspopup': 'dialog',
      onclick: () => { this.ui.open(button); emit(this, 'fidel-help-open', {}); },
    }, tr('helpOpen'));
    this.ui = makeDialog({
      className: 'fidel-help-dialog',
      lang,
      title: tr('helpTitle'),
      body: h('div', {},
        h('p', {}, tr('helpIntro')),
        hours && h('p', {}, tr('helpHours', { hours })),
        h('ul', { class: 'fidel-help-routes' },
          routes.map(({ route, href }) => h('li', {},
            h('a', { href, onclick: () => emit(this, 'fidel-help-choose', { route }) }, names[route]),
            h('p', {}, notes[route]))))),
      closeLabel: tr('close'),
    });
    this.replaceChildren(h('div', { class: 'fidel-help', lang }, button), this.ui.dialog);
  }
}
