// <fidel-sign-answer label="Ask your question in sign language"
//   upload-url="/api/v1/..." max-seconds="120" heading-level="3" ui-lang="en|am">
//
// Answer in sign language: (1) Start camera (only now is the camera asked
// for, video only, no sound) -> live preview marked "Camera on" with Stop
// camera -> (2) Record, after a 3-2-1 countdown in text; "Recording" banner
// with the time in words (updated every 10 s at most) and Stop recording ->
// (3) Watch your answer (with Slower 0.5x), Record again or Send (the size in
// MB is shown first). Each step has a heading and focus moves to it.
//
// Send: with upload-url, POST multipart (field "video") and say whether it
// worked; without, dispatch fidel-sign-answer-ready { blob, durationSeconds,
// mimeType } for the host. Nothing is uploaded before Send. The camera turns
// off as soon as recording stops, on Stop camera, and when the page is hidden
// or the element is removed.
//
// No camera, permission refused or not https: says so in words and offers a
// file picker (accept="video/*" capture="user") so the phone's own camera app
// can record the answer.
import { h, uid } from '../../dom.js';
import { announce } from '../../announce.js';
import { emit, text, translator, uiLang } from './common.js';
import { megabytes, pickRecorderType } from './logic.js';

export class FidelSignAnswer extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.lang = uiLang(this);
    this.tt = translator(this.lang, 'sign');
    this.level = Math.min(5, Math.max(2, Number(this.getAttribute('heading-level')) || 3));
    this.maxSeconds = Math.max(5, Number(this.getAttribute('max-seconds')) || 120);
    this.onHidden = () => {
      if (document.visibilityState === 'hidden') this.stopEverything();
    };
    document.addEventListener('visibilitychange', this.onHidden);
    const labelId = uid('sign-label');
    this.body = h('div', { class: 'fidel-sign-body' });
    this.status = h('p', { class: 'fidel-sign-status' });
    this.replaceChildren(h('section', { class: 'fidel-sign', lang: this.lang, 'aria-labelledby': labelId },
      h(`h${this.level}`, { id: labelId, class: 'fidel-sign-label' }, this.getAttribute('label') || ''),
      h('p', {}, this.tt('intro')),
      this.body, this.status));
    this.showStart();
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

  /** Show a step: its heading gets focus (unless focus=false). */
  step(title, children, { focus = true } = {}) {
    const heading = h(`h${this.level + 1}`, { class: 'fidel-sign-step', tabindex: '-1' }, title);
    this.body.replaceChildren(heading, ...children.flat().filter(Boolean));
    if (focus) heading.focus();
  }

  /** Why the camera cannot be used here ('' if it can). */
  cameraProblem() {
    if (!window.isSecureContext) return this.tt('insecure');
    if (!navigator.mediaDevices?.getUserMedia) return this.tt('notFound');
    if (typeof MediaRecorder === 'undefined' || !pickRecorderType((t) => MediaRecorder.isTypeSupported(t))) return this.tt('noRecorder');
    return '';
  }

  showStart({ focus = false } = {}) {
    const problem = this.cameraProblem();
    if (problem) return this.showFallback(problem, { focus });
    this.step(this.tt('step1'), [
      h('button', { type: 'button', class: 'fidel-d-button fidel-d-primary', onclick: () => this.startCamera() }, this.tt('startCamera')),
    ], { focus });
  }

  showFallback(reason, { focus = true } = {}) {
    const id = uid('sign-file');
    const input = h('input', { type: 'file', id, accept: 'video/*', capture: 'user', class: 'fidel-sign-file' });
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      this.say(this.tt('fileChosen', { size: megabytes(file.size) }));
      this.showReview(file, file.type || 'video/*', null);
    });
    this.step(this.tt('noCamera'), [
      h('p', { class: 'fidel-d-error fidel-sign-problem' }, reason),
      h('div', { class: 'fidel-d-field' }, h('label', { for: id }, this.tt('filePicker')), input),
    ], { focus });
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 360 }, facingMode: 'user' }, audio: false,
      });
    } catch (error) {
      const reason = error?.name === 'NotAllowedError' || error?.name === 'SecurityError' ? this.tt('denied')
        : error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError' ? this.tt('notFound') : this.tt('noCamera');
      this.say(this.tt('noCamera'), { assertive: true });
      return this.showFallback(reason);
    }
    this.say('');
    this.showCamera();
  }

  stopCamera() {
    for (const track of this.stream?.getTracks() || []) track.stop();
    this.stream = null;
  }

  stopEverything() {
    clearInterval(this.ticker);
    clearTimeout(this.countdownTimer);
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.stopCamera();
  }

  showCamera() {
    const tt = this.tt;
    const preview = h('video', { class: 'fidel-sign-video', muted: true, autoplay: true, playsinline: true, 'aria-label': tt('preview') });
    preview.muted = true;
    preview.srcObject = this.stream;
    this.banner = h('p', { class: 'fidel-sign-banner' }, h('span', { 'aria-hidden': 'true' }, '● '), tt('cameraOn'));
    this.countdown = h('p', { class: 'fidel-sign-countdown', hidden: true });
    this.controls = h('div', { class: 'fidel-d-actions' },
      h('button', { type: 'button', class: 'fidel-d-button fidel-d-primary', onclick: () => this.startCountdown() }, tt('record')),
      h('button', { type: 'button', class: 'fidel-d-button', onclick: () => {
        this.stopEverything();
        this.say(tt('cameraOff'));
        this.showStart({ focus: true });
      } }, tt('stopCamera')));
    this.step(tt('step2'), [this.banner, preview, h('p', { class: 'fidel-d-hint' }, tt('maxLength', { n: this.maxSeconds })), this.countdown, this.controls]);
  }

  startCountdown() {
    let n = 3;
    for (const button of this.controls.querySelectorAll('button')) button.disabled = true;
    this.countdown.hidden = false;
    const tick = () => {
      if (!this.stream) return;
      if (n === 0) {
        this.countdown.hidden = true;
        return this.startRecording();
      }
      this.countdown.textContent = this.tt('countdown', { n });
      if (n === 3) announce(this.countdown.textContent);
      n -= 1;
      this.countdownTimer = setTimeout(tick, 1000);
    };
    tick();
  }

  startRecording() {
    const tt = this.tt;
    const mimeType = pickRecorderType((t) => MediaRecorder.isTypeSupported(t));
    const chunks = [];
    this.recorder = new MediaRecorder(this.stream, { mimeType, videoBitsPerSecond: 400000 });
    this.recorder.addEventListener('dataavailable', (e) => e.data.size && chunks.push(e.data));
    this.recorder.addEventListener('stop', () => {
      clearInterval(this.ticker);
      this.stopCamera(); // the camera goes off as soon as recording stops
      const seconds = Math.round((Date.now() - this.startedAt) / 1000);
      this.showReview(new Blob(chunks, { type: mimeType.split(';')[0] }), mimeType, seconds);
    });
    this.startedAt = Date.now();
    this.recorder.start(1000);
    const elapsed = h('span', {}, '');
    this.banner.replaceChildren(h('span', { 'aria-hidden': 'true' }, '● '), `${tt('recording')}. `, elapsed);
    this.banner.classList.add('fidel-sign-recording');
    announce(tt('recording'));
    // Time in words, at most every 10 seconds (not every second: screen readers and Braille).
    this.ticker = setInterval(() => {
      const seconds = Math.round((Date.now() - this.startedAt) / 1000);
      if (seconds >= this.maxSeconds) return this.recorder.stop();
      if (seconds % 10 === 0) elapsed.textContent = tt('elapsed', { n: seconds });
    }, 1000);
    const stop = h('button', { type: 'button', class: 'fidel-d-button fidel-d-primary', onclick: () => this.recorder.stop() }, tt('stopRecording'));
    this.controls.replaceChildren(stop);
    stop.focus();
  }

  showReview(blob, mimeType, durationSeconds) {
    const tt = this.tt;
    URL.revokeObjectURL(this.blobUrl);
    this.blobUrl = URL.createObjectURL(blob);
    const video = h('video', { class: 'fidel-sign-video', controls: true, playsinline: true, src: this.blobUrl, 'aria-label': tt('answer') });
    const slower = h('button', { type: 'button', class: 'fidel-d-button', 'aria-pressed': 'false', onclick: () => {
      const on = slower.getAttribute('aria-pressed') !== 'true';
      video.playbackRate = on ? 0.5 : 1;
      slower.setAttribute('aria-pressed', String(on));
    } }, tt('slower'));
    const send = h('button', { type: 'button', class: 'fidel-d-button fidel-d-primary', onclick: () => this.send(blob, mimeType, durationSeconds ?? (Math.round(video.duration) || null), send) },
      tt('sendSize', { size: megabytes(blob.size) }));
    this.step(tt('step3'), [
      video,
      h('div', { class: 'fidel-d-actions' }, slower,
        h('button', { type: 'button', class: 'fidel-d-button', onclick: () => {
          this.say('');
          if (this.cameraProblem()) this.showStart({ focus: true });
          else this.startCamera();
        } }, tt('again')),
        send),
    ]);
  }

  async send(blob, mimeType, durationSeconds, button) {
    const url = this.getAttribute('upload-url');
    if (!url) {
      emit(this, 'fidel-sign-answer-ready', { blob, durationSeconds, mimeType });
      return this.say(this.tt('ready'));
    }
    const form = new FormData();
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
    form.append('video', blob, `sign-answer.${extension}`);
    button.disabled = true;
    this.say(text(this.lang, 'common', 'sending'));
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
