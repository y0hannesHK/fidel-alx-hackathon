// <fidel-voice-note label="Record a voice note" max-seconds="120"
//   upload-url="/..." heading-level="3" no-send ui-lang="en|am">
//
// Record a short voice message. The microphone is asked for only after the
// learner presses "Start recording" (getUserMedia({audio: true}) and
// MediaRecorder). While recording: a "Recording" banner with the elapsed
// time and a Stop button. Then: play it back, "Record again", and the size in
// MB before Send. The microphone turns off as soon as recording stops.
// No speech-to-text: the recording is never sent to a cloud service.
//
// No microphone, permission refused or not https: says so in words and
// offers a file picker (accept="audio/*" capture) so the phone's own voice
// recorder can be used.
//
// Send: with upload-url, POST multipart (field "audio"); without it, the
// event fidel-voice-note-ready { blob, mimeType, durationSeconds } for the
// page. no-send hides Send (a parent such as <fidel-question> sends it);
// the recording is then in the .recording property.
import { h, uid } from '../../dom.js';
import { announce } from '../../announce.js';
import { clock, megabytes, micProblem, pickAudioType } from './logic.js';
import { emit, translator, uiLang } from './common.js';

export class FidelVoiceNote extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.lang = uiLang(this);
    this.tt = translator(this.lang, 'voice');
    this.level = Math.min(5, Math.max(2, Number(this.getAttribute('heading-level')) || 3));
    this.maxSeconds = Math.max(5, Number(this.getAttribute('max-seconds')) || 120);
    this.recording = null;
    this.onHidden = () => {
      if (document.visibilityState === 'hidden' && this.recorder?.state === 'recording') this.recorder.stop();
    };
    document.addEventListener('visibilitychange', this.onHidden);
    const labelId = uid('fidel-voice-label');
    this.body = h('div', { class: 'fidel-voice-body' });
    this.status = h('p', { class: 'fidel-voice-status' });
    this.replaceChildren(h('section', { class: 'fidel-voice', lang: this.lang, 'aria-labelledby': labelId },
      h(`h${this.level}`, { id: labelId, class: 'fidel-voice-label' }, this.getAttribute('label') || this.tt('label')),
      h('p', { class: 'fidel-e-hint' }, this.tt('intro')),
      this.body, this.status));
    this.showStart({ focus: false });
  }

  disconnectedCallback() {
    document.removeEventListener('visibilitychange', this.onHidden);
    this.stopEverything();
    this.built = false;
  }

  say(message, options) {
    this.status.textContent = message;
    if (message) announce(message, options);
  }

  step(title, children, { focus = true } = {}) {
    const heading = h(`h${Math.min(6, this.level + 1)}`, { class: 'fidel-voice-step', tabindex: '-1' }, title);
    this.body.replaceChildren(heading, ...children.flat().filter(Boolean));
    if (focus) heading.focus();
  }

  problem() {
    const reason = micProblem({
      secure: window.isSecureContext,
      getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
      recorder: typeof MediaRecorder !== 'undefined' && Boolean(pickAudioType((t) => MediaRecorder.isTypeSupported(t))),
    });
    return reason ? this.tt(`problems.${reason}`) : '';
  }

  showStart({ focus = true } = {}) {
    this.recording = null;
    const problem = this.problem();
    if (problem) return this.showFallback(problem, { focus });
    this.step(this.tt('step1'), [
      h('button', { type: 'button', class: 'fidel-e-button fidel-e-primary', onclick: () => this.start() }, this.tt('start')),
      h('p', { class: 'fidel-e-hint' }, this.tt('maxLength', { time: clock(this.maxSeconds) })),
    ], { focus });
  }

  showFallback(reason, { focus = true } = {}) {
    const id = uid('fidel-voice-file');
    const input = h('input', { type: 'file', id, accept: 'audio/*', capture: '', class: 'fidel-voice-file' });
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      this.say(this.tt('fileChosen', { size: megabytes(file.size) }));
      this.showReview(file, file.type || 'audio/*', null);
    });
    this.step(this.tt('noMic'), [
      h('p', { class: 'fidel-e-error fidel-voice-problem' }, reason),
      h('div', { class: 'fidel-e-field' }, h('label', { for: id }, this.tt('filePicker')), input),
    ], { focus });
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (error) {
      const key = error?.name === 'NotAllowedError' || error?.name === 'SecurityError' ? 'denied'
        : error?.name === 'NotFoundError' ? 'none' : 'other';
      this.say(this.tt('noMic'), { assertive: true });
      return this.showFallback(this.tt(`problems.${key}`));
    }
    this.record();
  }

  stopMic() {
    for (const track of this.stream?.getTracks() || []) track.stop();
    this.stream = null;
  }

  stopEverything() {
    clearInterval(this.ticker);
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.stopMic();
  }

  record() {
    const tt = this.tt;
    const mimeType = pickAudioType((t) => MediaRecorder.isTypeSupported(t));
    const chunks = [];
    this.recorder = new MediaRecorder(this.stream, { mimeType, audioBitsPerSecond: 32000 });
    this.recorder.addEventListener('dataavailable', (e) => e.data.size && chunks.push(e.data));
    this.recorder.addEventListener('stop', () => {
      clearInterval(this.ticker);
      this.stopMic(); // the microphone goes off as soon as recording stops
      const seconds = Math.max(1, Math.round((Date.now() - this.startedAt) / 1000));
      if (!this.isConnected) return;
      this.showReview(new Blob(chunks, { type: mimeType.split(';')[0] }), mimeType, seconds);
    });
    this.startedAt = Date.now();
    this.recorder.start(1000);
    const elapsed = h('span', { class: 'fidel-voice-elapsed' }, clock(0));
    const banner = h('p', { class: 'fidel-voice-banner' }, h('span', { 'aria-hidden': 'true' }, '● '), `${tt('recording')} `, elapsed);
    // The time on screen changes every second; screen readers are not told each second.
    this.ticker = setInterval(() => {
      const seconds = Math.round((Date.now() - this.startedAt) / 1000);
      elapsed.textContent = clock(seconds);
      if (seconds >= this.maxSeconds) this.recorder.stop();
    }, 1000);
    const stop = h('button', { type: 'button', class: 'fidel-e-button fidel-e-primary', onclick: () => this.recorder.stop() }, tt('stop'));
    this.step(tt('step2'), [banner, h('div', { class: 'fidel-e-actions' }, stop)], { focus: false });
    announce(tt('recording'));
    stop.focus();
  }

  showReview(blob, mimeType, durationSeconds) {
    const tt = this.tt;
    URL.revokeObjectURL(this.blobUrl);
    this.blobUrl = URL.createObjectURL(blob);
    this.recording = { blob, mimeType, durationSeconds };
    const size = megabytes(blob.size);
    const audio = h('audio', { class: 'fidel-voice-audio', controls: true, src: this.blobUrl, 'aria-label': tt('yours') });
    const send = !this.hasAttribute('no-send') && h('button', {
      type: 'button', class: 'fidel-e-button fidel-e-primary', onclick: () => this.send(send),
    }, tt('sendSize', { size }));
    this.step(tt('step3'), [
      audio,
      h('p', { class: 'fidel-voice-size' }, tt('size', { size })),
      h('div', { class: 'fidel-e-actions' },
        h('button', { type: 'button', class: 'fidel-e-button', onclick: () => {
          this.say('');
          if (this.problem()) this.showStart();
          else this.start();
        } }, tt('again')),
        send),
    ]);
    emit(this, 'fidel-voice-note-recorded', { mimeType, durationSeconds, size: blob.size });
  }

  async send(button) {
    const { blob, mimeType, durationSeconds } = this.recording;
    const url = this.getAttribute('upload-url');
    if (!url) {
      emit(this, 'fidel-voice-note-ready', { blob, mimeType, durationSeconds });
      return this.say(this.tt('ready'));
    }
    const form = new FormData();
    form.append('audio', blob, `voice-note.${mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm'}`);
    button.disabled = true;
    this.say(this.tt('sending'));
    try {
      const response = await fetch(url, { method: 'POST', body: form });
      if (!response.ok) throw new Error(String(response.status));
      this.say(this.tt('sent'));
    } catch {
      button.disabled = false;
      this.say(this.tt('sendFailed'), { assertive: true });
    }
  }
}
