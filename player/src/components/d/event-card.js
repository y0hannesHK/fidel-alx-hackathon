// <fidel-event-card title="Office hours: how to present"
//   start="2026-11-20T19:00:00+03:00" end="2026-11-20T20:30:00+03:00"
//   join-url="https://..." captions="yes" sign-language="on-request" languages="en,am"
//   recording-url="session.html" request-url="/api/v1/events/ev1/requests"
//   reply-by="email" event-id="ev1" heading-level="3" ui-lang="en|am">
//
// A live session card: date and time in both calendars, length, and an access
// line in words ("Live captions: yes", "Ethiopian Sign Language interpreter:
// on request", "Spoken in: English, Amharic"). "Request access support" opens
// a dialog that asks only which support is needed (never why). "Join" shows
// from 15 minutes before the start until the end; "Add to calendar" downloads
// an .ics file; after the end, "Watch the recording" if recording-url is set.
// Adds schema.org Event JSON-LD to the page (Level 3).
//
// captions: yes | no. sign-language: yes | no | on-request.
// reply-by="email": the host will answer requests by email (only then does
// the card say "The organisers will reply by email").
// Event: fidel-event-request { eventId, needs } (needs: ['sign-language',
// 'captions', 'amharic-interpreter', 'other'], plus other: text if given).
import { h, uid } from '../../dom.js';
import { announce } from '../../announce.js';
import { formatBoth } from '../../ethiopian-calendar.js';
import { emit, text, translator, uiLang } from './common.js';
import { buildIcs, durationParts, eventJsonLd, joinState } from './logic.js';

const NEEDS = [['sign-language', 'needSign'], ['captions', 'needCaptions'], ['amharic-interpreter', 'needAmharic'], ['other', 'needOther']];

export class FidelEventCard extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.lang = uiLang(this);
    this.tt = translator(this.lang, 'event');
    this.build();
  }

  disconnectedCallback() {
    clearInterval(this.timer);
    this.built = false;
  }

  get eventId() {
    return this.getAttribute('event-id')
      || (this.getAttribute('request-url') || '').match(/events\/([^/]+)/)?.[1]
      || (this.getAttribute('title') || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  /** The access line, in words: ["Live captions: yes", ...]. */
  accessLines() {
    const tt = this.tt;
    const value = (attr) => {
      const v = (this.getAttribute(attr) || 'no').toLowerCase();
      return v === 'yes' ? tt('yes') : v === 'on-request' ? tt('onRequest') : tt('no');
    };
    const languages = this.languages.map((code) => text(this.lang, 'common', `langNames.${code}`));
    return [
      tt('captions', { value: value('captions') }),
      tt('sign', { value: value('sign-language') }),
      languages.length ? tt('languages', { value: languages.join(', ') }) : null,
    ].filter(Boolean);
  }

  get languages() {
    return (this.getAttribute('languages') || '').split(',').map((l) => l.trim()).filter(Boolean);
  }

  build() {
    const tt = this.tt;
    const start = new Date(this.getAttribute('start') || '');
    const endAttr = new Date(this.getAttribute('end') || '');
    const title = this.getAttribute('title') || '';
    const level = Math.min(6, Math.max(2, Number(this.getAttribute('heading-level')) || 3));
    const headingId = uid('event-heading');
    const heading = h(`h${level}`, { id: headingId, class: 'fidel-event-title', lang: /[ሀ-፿]/.test(title) ? 'am' : null }, title);
    if (Number.isNaN(start.getTime())) {
      this.replaceChildren(h('article', { class: 'fidel-event', lang: this.lang, 'aria-labelledby': headingId },
        heading, h('p', { class: 'fidel-d-error' }, tt('badDate'))));
      return;
    }
    const end = Number.isNaN(endAttr.getTime()) || endAttr <= start ? new Date(start.getTime() + 3600000) : endAttr;
    this.start = start;
    this.end = end;

    // Date and time in the learner's time zone, plus the Ethiopian date (Addis Ababa).
    const locale = this.lang === 'am' ? 'am-ET' : 'en-GB';
    const dateFormat = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    const addisDate = new Date(start.getTime() + 3 * 3600000).toISOString().slice(0, 10);
    const both = formatBoth(addisDate);
    const { hours, minutes } = durationParts(start, end);
    const length = [hours && tt('hours', { n: hours }), minutes && tt('minutes', { n: minutes })].filter(Boolean).join(' ');
    const access = this.accessLines();

    this.actions = h('div', { class: 'fidel-d-actions' });
    this.state = h('p', { class: 'fidel-event-state' });
    this.message = h('p', { class: 'fidel-report-message', hidden: true });
    const jsonld = h('script', { type: 'application/ld+json' });
    jsonld.textContent = JSON.stringify(eventJsonLd({
      title, start, end, joinUrl: this.getAttribute('join-url'), languages: this.languages,
      description: `${this.accessLinesIn('en').join('. ')}.`,
    }));

    this.replaceChildren(h('article', { class: 'fidel-event', lang: this.lang, 'aria-labelledby': headingId },
      heading,
      h('dl', { class: 'fidel-event-facts' },
        h('dt', {}, tt('when')),
        h('dd', {},
          h('time', { datetime: start.toISOString() }, `${dateFormat.format(start)}, ${timeFormat.format(start)} – ${timeFormat.format(end)}`),
          h('br'),
          h('span', {}, `${tt('ethiopian')}: `),
          h('span', { lang: 'am' }, both.ethiopian),
          this.lang === 'en' ? ` (${both.ethiopianEn})` : null),
        h('dt', {}, tt('length')),
        h('dd', {}, length),
        h('dt', {}, tt('access')),
        h('dd', {}, h('ul', { class: 'fidel-event-access' }, access.map((line) => h('li', {}, line))))),
      this.state, this.actions, this.message, jsonld));
    this.renderActions();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.renderActions(), 30000);
  }

  accessLinesIn(lang) {
    const saved = [this.lang, this.tt];
    [this.lang, this.tt] = [lang, translator(lang, 'event')];
    const lines = this.accessLines();
    [this.lang, this.tt] = saved;
    return lines;
  }

  /** Join (from 15 minutes before), Add to calendar, Request support, Recording (after). */
  renderActions() {
    const tt = this.tt;
    const state = joinState(new Date(), this.start, this.end);
    if (state === this.shownState) return;
    const hadFocus = this.actions.contains(document.activeElement) ? document.activeElement.dataset.action : null;
    this.shownState = state;
    const joinUrl = this.getAttribute('join-url');
    const recording = this.getAttribute('recording-url');
    const hintId = uid('event-calendar-hint');
    this.state.textContent = state === 'before' ? (joinUrl ? tt('joinLater') : '')
      : state === 'open' ? (this.start <= new Date() ? tt('live') : '') : tt('ended');
    this.state.hidden = !this.state.textContent;
    this.actions.replaceChildren(
      state === 'open' && joinUrl && h('a', { class: 'fidel-d-button fidel-d-primary', href: joinUrl, 'data-action': 'join' }, tt('join')),
      state === 'ended' && recording && h('a', { class: 'fidel-d-button', href: recording, 'data-action': 'recording' }, tt('recording')),
      state !== 'ended' && h('button', { type: 'button', class: 'fidel-d-button', 'data-action': 'request', onclick: () => this.openRequest() }, tt('request')),
      state !== 'ended' && h('button', {
        type: 'button', class: 'fidel-d-button', 'data-action': 'calendar', 'aria-describedby': hintId, onclick: () => this.downloadIcs(),
      }, tt('calendar')),
      state !== 'ended' && h('p', { id: hintId, class: 'fidel-d-hint fidel-event-hint' }, tt('calendarHint')));
    if (hadFocus) (this.actions.querySelector(`[data-action="${hadFocus}"]`) || this.actions.querySelector('a, button'))?.focus();
  }

  downloadIcs() {
    const ics = buildIcs({
      uid: `${this.eventId}@fidel`, title: this.getAttribute('title') || '', start: this.start, end: this.end,
      url: this.getAttribute('join-url'), description: this.accessLinesIn(this.lang).join('. '),
    });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const link = h('a', { href: url, download: `${this.eventId || 'event'}.ics`, hidden: true });
    this.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  openRequest() {
    const tt = this.tt;
    const common = translator(this.lang, 'common');
    const ids = { heading: uid('event-request-heading'), other: uid('event-other'), error: uid('event-needs-error'), otherError: uid('event-other-error') };
    const error = h('p', { id: ids.error, class: 'fidel-d-error', hidden: true });
    const otherError = h('p', { id: ids.otherError, class: 'fidel-d-error', hidden: true });
    const otherInput = h('input', { id: ids.other, type: 'text', class: 'fidel-d-input', maxlength: 200, 'aria-describedby': ids.otherError });
    const status = h('p', { class: 'fidel-d-status' });
    const sendButton = h('button', { type: 'submit', class: 'fidel-d-button fidel-d-primary' }, common('send'));
    const fieldset = h('fieldset', { class: 'fidel-d-fieldset', 'aria-describedby': ids.error },
      h('legend', {}, tt('needs')),
      NEEDS.map(([value, key]) => {
        const id = uid('event-need');
        return h('div', { class: 'fidel-d-choice' },
          h('input', { type: 'checkbox', id, name: 'need', value }),
          h('label', { for: id }, tt(key)));
      }),
      error);
    const form = h('form', { novalidate: true },
      fieldset,
      h('div', { class: 'fidel-d-field' }, h('label', { for: ids.other }, tt('otherText')), otherInput, otherError),
      status,
      h('div', { class: 'fidel-d-actions' }, sendButton,
        h('button', { type: 'button', class: 'fidel-d-button', onclick: () => dialog.close() }, common('cancel'))));
    const dialog = h('dialog', { class: 'fidel-d-dialog fidel-event-dialog', 'aria-labelledby': ids.heading, lang: this.lang },
      h('h2', { id: ids.heading, class: 'fidel-d-dialog-heading' }, tt('requestHeading')),
      h('p', {}, tt('requestIntro')),
      form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const needs = [...form.querySelectorAll('input[name="need"]:checked')].map((box) => box.value);
      const other = otherInput.value.trim();
      error.textContent = needs.length ? '' : tt('needsError');
      error.hidden = Boolean(needs.length);
      const otherMissing = needs.includes('other') && !other;
      otherError.textContent = otherMissing ? tt('otherError') : '';
      otherError.hidden = !otherMissing;
      if (otherMissing) otherInput.setAttribute('aria-invalid', 'true');
      else otherInput.removeAttribute('aria-invalid');
      if (!needs.length) return form.querySelector('input[name="need"]').focus();
      if (otherMissing) return otherInput.focus();

      const detail = { eventId: this.eventId, needs, ...(needs.includes('other') ? { other } : {}) };
      const url = this.getAttribute('request-url');
      if (url) {
        sendButton.disabled = true;
        status.textContent = common('sending');
        try {
          const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(detail) });
          if (!response.ok) throw new Error(String(response.status));
        } catch {
          sendButton.disabled = false;
          status.textContent = tt('requestFailed');
          announce(status.textContent, { assertive: true });
          return;
        }
      }
      emit(this, 'fidel-event-request', detail);
      dialog.close();
      this.message.textContent = this.getAttribute('reply-by') === 'email' ? tt('requestSentEmail') : tt('requestSent');
      this.message.hidden = false;
      announce(this.message.textContent);
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      this.actions.querySelector('[data-action="request"]')?.focus();
    });
    this.append(dialog);
    dialog.showModal();
  }
}
