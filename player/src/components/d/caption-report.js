// <fidel-caption-report for="lesson-player" api="/api/v1" ui-lang="en|am">
//
// "Report a caption problem": a button under the player that opens a dialog
// with the current video time, the caption language and the caption shown
// at that moment, a "What is wrong?" choice and an optional correction.
// Sends POST {api}/lessons/{id}/caption-reports. No name, no account.
//
// Attributes:
//   for      id of the <fidel-player> (default: the first one on the page)
//   api      API address (default: from the player's lesson="..." URL, else /api/v1)
//   lesson   lesson id (default: from the player's lesson="..." URL)
//   ui-lang  en | am
// Event: fidel-caption-report-sent { lessonId, time, lang } (also when a
// report saved offline is sent later).
//
// Offline: the report is kept in localStorage and sent on the "online" event.
// The video pauses while the dialog is open and plays on when it closes (only
// if it was playing).
import { h, uid } from '../../dom.js';
import { announce } from '../../announce.js';
import { currentCaptionLang } from '../../captions.js';
import { formatTime } from '../../vtt.js';
import { emit, text, translator, uiLang } from './common.js';
import { flushQueue, loadQueue, parseClock, queueReport } from './logic.js';

const KINDS = ['wrong_words', 'wrong_time', 'missing_caption', 'missing_sound', 'other'];

// One "online" listener for the whole page: sends saved reports once.
let flushing = null;
function sendSavedReports() {
  if (flushing || !loadQueue().length) return flushing;
  flushing = flushQueue(async (item) => {
    const response = await fetch(item.url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item.body),
    });
    return response.status;
  }).then((result) => {
    flushing = null;
    for (const item of result.sent) {
      document.dispatchEvent(new CustomEvent('fidel-caption-report-sent', {
        bubbles: true, composed: true, detail: { lessonId: item.lessonId, time: item.body.time, lang: item.body.lang },
      }));
    }
    if (result.sent.length) {
      for (const report of document.querySelectorAll('fidel-caption-report')) report.showMessage?.(text(uiLang(report), 'report', 'sentLater'));
    }
    return result;
  });
  return flushing;
}
let listening = false;
function listenForOnline() {
  if (listening) return;
  listening = true;
  window.addEventListener('online', sendSavedReports);
}

export class FidelCaptionReport extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.lang = uiLang(this);
    this.tt = translator(this.lang, 'report');
    this.message = h('p', { class: 'fidel-report-message', hidden: true });
    this.opener = h('button', { type: 'button', class: 'fidel-d-button', onclick: () => this.open() }, this.tt('button'));
    this.replaceChildren(h('div', { class: 'fidel-report', lang: this.lang }, this.opener, this.message));
    listenForOnline();
    if (navigator.onLine) sendSavedReports();
  }

  showMessage(message) {
    this.message.textContent = message;
    this.message.hidden = false;
    announce(message);
  }

  get player() {
    const id = this.getAttribute('for');
    return id ? document.getElementById(id) : document.querySelector('fidel-player');
  }

  /** Lesson id and API address, from attributes or the player's lesson URL. */
  target() {
    const lessonUrl = this.player?.getAttribute('lesson') || '';
    const match = lessonUrl.match(/^(.*)\/lessons\/([a-f0-9]{12})/);
    return {
      lessonId: this.getAttribute('lesson') || match?.[2] || '',
      api: (this.getAttribute('api') || match?.[1] || '/api/v1').replace(/\/$/, ''),
    };
  }

  captionLanguages() {
    const player = this.player;
    if (!player) return [];
    return ['en', 'am', 'om'].filter((lang) => player.getAttribute(`captions-${lang}`));
  }

  async captionAt(lang, seconds) {
    const tracks = (await this.player?.loadCaptionText?.()) || [];
    const cues = tracks.find((track) => track.lang === lang)?.cues || [];
    return cues.find((cue) => seconds >= cue.start && seconds < cue.end)?.text || '';
  }

  async open() {
    const { lessonId } = this.target();
    const languages = this.captionLanguages();
    if (!lessonId) return this.showMessage(this.tt('noLesson'));
    if (!languages.length) return this.showMessage(this.tt('noCaptions'));
    this.message.hidden = true;

    const video = this.player?.ablePlayer?.media || this.player?.querySelector('video');
    this.wasPlaying = Boolean(video && !video.paused);
    video?.pause();
    this.video = video;
    const seconds = video ? video.currentTime : 0;
    const shownLang = this.player?.ablePlayer ? currentCaptionLang(this.player.ablePlayer) : 'off';
    const lang = languages.includes(shownLang) ? shownLang : languages[0];

    this.dialog?.remove();
    this.dialog = await this.buildDialog({ seconds, lang, languages, duration: video?.duration });
    this.append(this.dialog);
    this.dialog.showModal();
  }

  async buildDialog({ seconds, lang, languages, duration }) {
    const tt = this.tt;
    const common = translator(this.lang, 'common');
    const ids = { heading: uid('report-heading'), time: uid('report-time'), timeHint: uid('report-time-hint'),
      timeError: uid('report-time-error'), lang: uid('report-lang'), correction: uid('report-correction'),
      correctionHint: uid('report-correction-hint'), kindError: uid('report-kind-error') };

    const timeInput = h('input', {
      id: ids.time, name: 'time', type: 'text', inputmode: 'numeric', autocomplete: 'off', class: 'fidel-d-input fidel-report-time',
      value: formatTime(seconds), 'aria-describedby': `${ids.timeHint} ${ids.timeError}`,
    });
    const timeError = h('p', { id: ids.timeError, class: 'fidel-d-error', hidden: true });
    const langSelect = h('select', { id: ids.lang, name: 'lang', class: 'fidel-d-input' },
      languages.map((code) => h('option', { value: code, selected: code === lang },
        text(this.lang, 'common', `langNames.${code}`))));
    const shown = h('p', { class: 'fidel-report-shown' });
    const updateShown = async () => {
      const at = parseClock(timeInput.value);
      const caption = Number.isFinite(at) ? await this.captionAt(langSelect.value, at) : '';
      shown.replaceChildren(caption
        ? h('q', { lang: langSelect.value }, caption)
        : h('span', {}, tt('noneShown')));
    };
    timeInput.addEventListener('change', updateShown);
    langSelect.addEventListener('change', () => {
      correction.setAttribute('lang', langSelect.value);
      updateShown();
    });
    await updateShown();

    const kindError = h('p', { id: ids.kindError, class: 'fidel-d-error', hidden: true });
    const kinds = h('fieldset', { class: 'fidel-d-fieldset', 'aria-describedby': ids.kindError },
      h('legend', {}, tt('kind')),
      KINDS.map((kind) => {
        const id = uid('report-kind');
        return h('div', { class: 'fidel-d-choice' },
          h('input', { type: 'radio', id, name: 'kind', value: kind }),
          h('label', { for: id }, tt(`kinds.${kind}`)));
      }),
      kindError);
    const correction = h('textarea', {
      id: ids.correction, name: 'correction', rows: 3, maxlength: 500, lang, class: 'fidel-d-input',
      'aria-describedby': ids.correctionHint,
    });
    const status = h('p', { class: 'fidel-d-status' }); // announced with announce()
    const sendButton = h('button', { type: 'submit', class: 'fidel-d-button fidel-d-primary' }, common('send'));

    const form = h('form', { class: 'fidel-report-form', novalidate: true },
      h('div', { class: 'fidel-d-field' },
        h('label', { for: ids.time }, tt('time')),
        h('p', { id: ids.timeHint, class: 'fidel-d-hint' }, tt('timeHint')),
        timeInput, timeError),
      h('div', { class: 'fidel-d-field' }, h('label', { for: ids.lang }, tt('language')), langSelect),
      h('div', { class: 'fidel-d-field' }, h('p', { class: 'fidel-d-label' }, tt('shown')), shown),
      kinds,
      h('div', { class: 'fidel-d-field' },
        h('label', { for: ids.correction }, tt('correction')),
        h('p', { id: ids.correctionHint, class: 'fidel-d-hint' }, tt('correctionHint')),
        correction),
      status,
      h('div', { class: 'fidel-d-actions' },
        sendButton,
        h('button', { type: 'button', class: 'fidel-d-button', onclick: () => dialog.close() }, common('cancel'))));

    const showError = (input, box, message) => {
      box.textContent = message;
      box.hidden = !message;
      if (input) {
        if (message) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      }
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const time = parseClock(timeInput.value);
      let timeProblem = '';
      if (!Number.isFinite(time)) timeProblem = tt('timeError');
      else if (duration && time > duration + 1) timeProblem = tt('timeTooLate', { length: formatTime(duration) });
      showError(timeInput, timeError, timeProblem);
      const kind = form.querySelector('input[name="kind"]:checked')?.value;
      showError(null, kindError, kind ? '' : tt('kindError'));
      if (timeProblem) return timeInput.focus();
      if (!kind) return form.querySelector('input[name="kind"]').focus();

      const caption = shown.querySelector('q')?.textContent || null;
      const body = { time, lang: langSelect.value, kind, correction: correction.value.trim() || null, caption };
      await this.send(body, { status, sendButton });
    });

    const dialog = h('dialog', { class: 'fidel-d-dialog fidel-report-dialog', 'aria-labelledby': ids.heading, lang: this.lang },
      h('h2', { id: ids.heading, class: 'fidel-d-dialog-heading' }, tt('heading')),
      h('p', {}, tt('intro')),
      form);
    dialog.addEventListener('close', () => {
      this.opener.focus(); // back to the button that opened it
      if (this.wasPlaying) this.video?.play().catch(() => {});
      this.wasPlaying = false;
    });
    return dialog;
  }

  async send(body, { status, sendButton }) {
    const tt = this.tt;
    const { lessonId, api } = this.target();
    const url = `${api}/lessons/${lessonId}/caption-reports`;
    const saveForLater = () => {
      queueReport({ url, body, lessonId });
      this.dialog.close();
      this.showMessage(tt('savedOffline'));
    };
    if (!navigator.onLine) return saveForLater();
    sendButton.disabled = true;
    status.textContent = text(this.lang, 'common', 'sending');
    let response;
    try {
      response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      sendButton.disabled = false;
      return saveForLater(); // no connection after all
    }
    sendButton.disabled = false;
    if (response.ok) {
      this.dialog.close();
      this.showMessage(tt('thanks'));
      emit(this, 'fidel-caption-report-sent', { lessonId, time: body.time, lang: body.lang });
      return;
    }
    let reason = `error ${response.status}`;
    try {
      reason = (await response.json()).detail || reason;
    } catch {
      /* not JSON */
    }
    status.textContent = tt('notSent', { reason });
    announce(status.textContent, { assertive: true });
  }
}
