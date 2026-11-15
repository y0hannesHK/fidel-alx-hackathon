// <fidel-question for="lesson-player" api="/api/v1" lesson="ID" ui-lang="en|am">
//
// E2. "Ask about this moment": a button under the player that opens a
// dialog with the current video time (editable, minutes:seconds, a
// <fidel-input format="mmss">) and the caption shown at that time. Three
// ways to ask, chosen with radio buttons (<fidel-choice>), not tabs:
//   Write          a <fidel-textarea>
//   Voice note     a <fidel-voice-note> (microphone only after Start; no speech-to-text)
//   Sign language  a <fidel-sign-answer> (camera only after Start camera)
// The video pauses while the dialog is open and plays on after (only if it
// was playing). Escape or Cancel closes it; focus returns to the button.
//
// Send: with api="...", POST multipart to {api}/lessons/{id}/questions
// (time, kind, text, caption, media). Without api, the event
// fidel-question-ready { time, kind, text | blob, mimeType } for the page.
// Offline: kept on this phone (localStorage "fidel-question-queue"; a
// recording only up to about 2 MB) and sent on the browser's "online" event:
// "Saved on this phone. It will be sent when you are online."
// Events: fidel-question-ready, fidel-question-sent { lessonId, time, kind }.
import { h, uid } from '../../dom.js';
import { announce } from '../../announce.js';
import { currentCaptionLang } from '../../captions.js';
import { emit, findPlayer, mediaOf, text, translator, uiLang } from './common.js';
import { QUESTION_QUEUE, clock, flushList, loadList, parseMmss, queueQuestion } from './logic.js';

const KINDS = ['text', 'voice', 'sign'];

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});
const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();

function questionForm({ time, kind, text: words, caption, blob, mimeType }) {
  const form = new FormData();
  form.append('time', String(time));
  form.append('kind', kind);
  if (words) form.append('text', words);
  if (caption) form.append('caption', caption);
  if (blob) {
    const type = mimeType || blob.type || '';
    const ext = type.includes('mp4') ? (kind === 'voice' ? 'm4a' : 'mp4') : type.includes('ogg') ? 'ogg' : 'webm';
    form.append('media', blob, `${kind}-question.${ext}`);
  }
  return form;
}

// One "online" listener for the page: sends saved questions once.
let flushing = null;
function sendSaved() {
  if (flushing || !loadList(QUESTION_QUEUE).length) return flushing;
  flushing = flushList(QUESTION_QUEUE, async (item) => {
    const blob = item.media ? await dataUrlToBlob(item.media) : null;
    const response = await fetch(item.url, { method: 'POST', body: questionForm({ ...item.body, blob, mimeType: item.mimeType }) });
    return response.status;
  }).then((result) => {
    flushing = null;
    for (const item of result.sent) {
      document.dispatchEvent(new CustomEvent('fidel-question-sent', {
        bubbles: true, composed: true, detail: { lessonId: item.lessonId, time: item.body.time, kind: item.body.kind },
      }));
    }
    if (result.sent.length) {
      for (const el of document.querySelectorAll('fidel-question')) el.showMessage?.(text(uiLang(el), 'question', 'sentLater'));
    }
    return result;
  });
  return flushing;
}
let listening = false;

export class FidelQuestion extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.lang = uiLang(this);
    this.tt = translator(this.lang, 'question');
    this.message = h('p', { class: 'fidel-question-message', hidden: true });
    this.opener = h('button', { type: 'button', class: 'fidel-e-button', 'aria-haspopup': 'dialog', onclick: () => this.open() }, this.tt('button'));
    this.replaceChildren(h('div', { class: 'fidel-question', lang: this.lang }, this.opener, this.message));
    if (!listening) {
      listening = true;
      window.addEventListener('online', sendSaved);
    }
    if (navigator.onLine) sendSaved();
  }

  showMessage(message) {
    this.message.textContent = message;
    this.message.hidden = false;
    announce(message);
  }

  /** Lesson id and API address (api only if the page asked for sending). */
  target() {
    const lessonUrl = findPlayer(this)?.getAttribute('lesson') || '';
    const match = lessonUrl.match(/^(.*)\/lessons\/([a-f0-9]{12})/);
    const api = this.getAttribute('api');
    return { lessonId: this.getAttribute('lesson') || match?.[2] || '', api: api ? api.replace(/\/$/, '') : '' };
  }

  async captionAt(seconds) {
    const player = findPlayer(this);
    const tracks = (await player?.loadCaptionText?.()) || [];
    if (!tracks.length || !Number.isFinite(seconds)) return null;
    const shown = player.ablePlayer ? currentCaptionLang(player.ablePlayer) : 'off';
    const track = tracks.find((t) => t.lang === shown) || tracks.find((t) => t.lang === this.lang) || tracks[0];
    const cue = track.cues.find((c) => seconds >= c.start && seconds < c.end);
    return cue ? { text: cue.text, lang: track.lang } : null;
  }

  open() {
    this.message.hidden = true;
    const video = mediaOf(findPlayer(this));
    this.video = video;
    this.wasPlaying = Boolean(video && !video.paused);
    video?.pause();
    this.dialog?.remove();
    this.dialog = this.buildDialog(video ? video.currentTime : 0, video?.duration);
    this.append(this.dialog);
    this.dialog.showModal();
  }

  buildDialog(seconds, duration) {
    const tt = this.tt;
    const headingId = uid('fidel-question-heading');
    const base = uid('fidel-question');
    const timeField = h('fidel-input', {
      id: `${base}-time`, name: 'time', format: 'mmss', required: true, inputmode: 'numeric', 'ui-lang': this.lang,
      label: tt('time'), hint: tt('timeHint'), value: clock(seconds),
    });
    const shown = h('p', { class: 'fidel-question-shown' });
    const updateShown = async () => {
      const caption = await this.captionAt(parseMmss(timeField.value));
      shown.replaceChildren(caption ? h('q', { lang: caption.lang }, caption.text) : h('span', {}, tt('noCaption')));
      this.caption = caption?.text || null;
    };
    timeField.addEventListener('fidel-field-change', updateShown);
    timeField.addEventListener('change', updateShown);

    const how = h('fidel-choice', {
      id: `${base}-how`, type: 'radio', name: 'kind', label: tt('how'), 'ui-lang': this.lang, value: 'text',
      options: JSON.stringify(KINDS.map((kind) => ({ value: kind, label: tt(`kinds.${kind}`) }))),
    });
    const writeField = h('fidel-textarea', {
      id: `${base}-text`, name: 'text', rows: 4, maxlength: 2000, 'ui-lang': this.lang, lang: this.lang,
      label: tt('yourQuestion'), hint: tt('textHint'),
    });
    const voice = h('fidel-voice-note', { 'no-send': true, 'heading-level': 3, 'ui-lang': this.lang, label: tt('voiceLabel'), 'max-seconds': 180 });
    const sign = h('fidel-sign-answer', { 'heading-level': 3, 'ui-lang': this.lang, label: tt('signLabel'), 'max-seconds': 120 });
    const panels = {
      text: h('div', { class: 'fidel-question-panel' }, writeField),
      voice: h('div', { class: 'fidel-question-panel', hidden: true }, voice),
      sign: h('div', { class: 'fidel-question-panel', hidden: true }, sign),
    };
    this.signRecording = null;
    // The sign answer's own Send button sends the question.
    sign.addEventListener('fidel-sign-answer-ready', (event) => {
      event.stopPropagation(); // ours, not the page's
      this.signRecording = { blob: event.detail.blob, mimeType: event.detail.mimeType };
      form.requestSubmit();
    });
    const showPanel = (kind) => {
      for (const [name, panel] of Object.entries(panels)) panel.hidden = name !== kind;
    };
    how.addEventListener('fidel-field-change', () => showPanel(how.value || 'text'));
    how.addEventListener('change', () => showPanel(how.value || 'text'));

    const problem = h('p', { class: 'fidel-e-error fidel-question-problem', hidden: true, tabindex: '-1' });
    const status = h('p', { class: 'fidel-e-status' });
    const sendButton = h('button', { type: 'submit', class: 'fidel-e-button fidel-e-primary' }, tt('send'));
    const form = h('form', { class: 'fidel-question-form', novalidate: true },
      timeField,
      h('div', { class: 'fidel-e-field' }, h('p', { class: 'fidel-e-label' }, tt('shown')), shown),
      how,
      Object.values(panels),
      problem,
      status,
      h('div', { class: 'fidel-e-actions' },
        sendButton,
        h('button', { type: 'button', class: 'fidel-e-button', onclick: () => dialog.close() }, tt('cancel'))));
    updateShown();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      problem.hidden = true;
      if (!timeField.checkValidity()) return timeField.focus();
      const time = parseMmss(timeField.value);
      if (duration && time > duration + 1) {
        problem.textContent = tt('timeTooLate', { length: clock(duration) });
        problem.hidden = false;
        return timeField.focus();
      }
      const kind = how.value || 'text';
      const body = { time: Math.round(time * 10) / 10, kind, caption: this.caption };
      let recording = null;
      if (kind === 'text') {
        body.text = writeField.value.trim();
        if (!body.text) {
          problem.textContent = tt('needText');
          problem.hidden = false;
          return writeField.focus();
        }
      } else {
        recording = kind === 'voice' ? voice.recording : this.signRecording;
        if (!recording) {
          problem.textContent = tt(kind === 'voice' ? 'needVoice' : 'needSign');
          problem.hidden = false;
          announce(problem.textContent, { assertive: true });
          return problem.focus();
        }
      }
      await this.send(body, recording, { status, sendButton });
    });

    const dialog = h('dialog', { class: 'fidel-e-dialog fidel-question-dialog', 'aria-labelledby': headingId, lang: this.lang },
      h('h2', { id: headingId, class: 'fidel-e-dialog-heading' }, tt('heading')),
      h('p', {}, tt('intro')),
      form);
    dialog.addEventListener('close', () => {
      this.opener.focus();
      if (this.wasPlaying) this.video?.play()?.catch?.(() => {});
      this.wasPlaying = false;
      // Removing the dialog turns off any microphone or camera still on.
      setTimeout(() => { if (!dialog.open) dialog.remove(); }, 0);
    });
    return dialog;
  }

  async send(body, recording, { status, sendButton }) {
    const tt = this.tt;
    const { lessonId, api } = this.target();
    if (!api || !lessonId) {
      emit(this, 'fidel-question-ready', {
        time: body.time, kind: body.kind, ...(recording ? { blob: recording.blob, mimeType: recording.mimeType } : { text: body.text }),
      });
      this.dialog.close();
      this.showMessage(tt('ready'));
      return;
    }
    const url = `${api}/lessons/${lessonId}/questions`;
    const saveForLater = async () => {
      let media = null;
      try {
        media = recording ? await blobToDataUrl(recording.blob) : null;
      } catch {
        media = null;
      }
      const saved = (!recording || media) && queueQuestion({ url, lessonId, body, media, mimeType: recording?.mimeType || null });
      if (!saved) {
        status.textContent = tt('notSaved');
        announce(status.textContent, { assertive: true });
        return;
      }
      this.dialog.close();
      this.showMessage(tt('savedOffline'));
    };
    if (!navigator.onLine) return saveForLater();
    sendButton.disabled = true;
    status.textContent = tt('sending');
    let response;
    try {
      response = await fetch(url, { method: 'POST', body: questionForm({ ...body, blob: recording?.blob, mimeType: recording?.mimeType }) });
    } catch {
      sendButton.disabled = false;
      return saveForLater();
    }
    sendButton.disabled = false;
    if (response.ok) {
      this.dialog.close();
      this.showMessage(tt('sent'));
      emit(this, 'fidel-question-sent', { lessonId, time: body.time, kind: body.kind });
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
