// <fidel-lesson-formats for="lesson-player" heading-level="3" ui-lang="en|am">
//
// E1. "How do you want this lesson?": real buttons (aria-pressed) for
//   Watch          video and captions
//   Listen         audio and transcript (low data: no video is loaded)
//   Read           the lesson document (web page, PDF, Braille)
//   Sign language  the video with the sign-language window docked and large
//   Simple words   the video, and every <fidel-simple-mode> on the page on
// Only formats this lesson really has are offered (from the player's
// attributes, and the lesson manifest when the player has lesson="..."),
// each with its download size when the server tells it (HEAD request; the
// same "know the size first" idea as <fidel-data-saver>).
//
// The choice is applied to the existing player and components, remembered in
// this browser (prefs lessonFormat) and announced ("Listen mode: audio and
// transcript"). In Listen and Read the <fidel-player> is taken out of the
// page (a comment marks its place) so no video is downloaded; it is put back,
// at the same place, for Watch, Sign language and Simple words.
//
// Attributes: for (id of the <fidel-player>; default the first one),
//   audio (an audio-only file, if the player's lesson has none),
//   heading-level (2-5, default 3), ui-lang.
// Event: fidel-lesson-format { format } (watch | listen | read | sign | simple).
import { h, uid } from '../../dom.js';
import { announce } from '../../announce.js';
import { loadPrefs, savePrefs } from '../../prefs.js';
import { parseVtt } from '../../vtt.js';
import { currentCaptionLang } from '../../captions.js';
import { emit, translator, uiLang } from './common.js';
import { availableFormats, chooseFormat, clock, formatBytes, formatSize, lessonSources, usesVideo } from './logic.js';

const SIMPLE_SYNC = 'fidel-simple-mode-sync'; // the event <fidel-simple-mode> copies listen to

/** Size of a file without downloading it (null if unknown). */
async function headSize(url) {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    return response.ok ? Number(response.headers.get('Content-Length')) || null : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export class FidelLessonFormats extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.lang = uiLang(this);
    this.tt = translator(this.lang, 'formats');
    this.level = Math.min(5, Math.max(2, Number(this.getAttribute('heading-level')) || 3));
    this.player = this.findPlayer();
    this.buttons = h('div', { class: 'fidel-formats-buttons' });
    this.statusEl = h('p', { class: 'fidel-formats-status' });
    this.view = h('div', { class: 'fidel-formats-view' });
    this.replaceChildren(h('div', { class: 'fidel-formats', lang: this.lang },
      h('fieldset', { class: 'fidel-formats-group' }, h('legend', {}, this.tt('legend')), this.buttons),
      this.statusEl, this.view));
    if (!this.player) {
      this.statusEl.textContent = this.tt('noPlayer');
      return;
    }
    // Remembered Listen or Read: take the player out NOW, before it is built,
    // so the video is never requested. Put back below if this lesson lacks it.
    const remembered = loadPrefs().lessonFormat;
    if (remembered === 'listen' || remembered === 'read') this.detachPlayer();
    this.start(remembered);
  }

  findPlayer() {
    const id = this.getAttribute('for');
    return id ? document.getElementById(id) : document.querySelector('fidel-player');
  }

  attrs() {
    const out = {};
    for (const { name, value } of this.player.attributes) out[name] = value;
    if (this.getAttribute('audio')) out.audio = this.getAttribute('audio');
    return out;
  }

  async start(remembered) {
    let manifest = null;
    const lessonUrl = this.player.getAttribute('lesson');
    if (lessonUrl) {
      try {
        const response = await fetch(lessonUrl);
        if (response.ok) manifest = await response.json();
      } catch {
        manifest = null; // offline: use what the attributes say
      }
    }
    this.sources = lessonSources(this.attrs(), manifest, this.lang);
    this.available = availableFormats(this.sources, { hasSimple: Boolean(document.querySelector('fidel-simple-mode')) });
    this.sizes = {};
    this.renderButtons();
    const format = chooseFormat(this.available, remembered);
    this.apply(format, { quiet: true });
    // Sizes arrive later; the buttons are usable meanwhile.
    const urls = [this.sources.video, this.sources.smallVideo, this.sources.audio, this.sources.sign,
      this.sources.document.html || this.sources.document.pdf].filter(Boolean);
    const sizes = await Promise.all(urls.map(headSize));
    urls.forEach((url, i) => { this.sizes[url] = sizes[i]; });
    this.updateLabels();
  }

  renderButtons() {
    if (!this.available.length) {
      this.statusEl.textContent = this.tt('nothing');
      return;
    }
    this.buttonFor = {};
    for (const format of this.available) {
      const detail = h('span', { class: 'fidel-formats-detail' });
      const button = h('button', {
        type: 'button', class: 'fidel-formats-button', 'aria-pressed': 'false', 'data-format': format,
        onclick: () => this.choose(format),
      }, h('span', { class: 'fidel-formats-name' }, this.tt(`names.${format}`)), detail);
      button.detail = detail;
      this.buttonFor[format] = button;
    }
    this.buttons.replaceChildren(...Object.values(this.buttonFor));
    this.updateLabels();
  }

  updateLabels() {
    const lowData = Boolean(loadPrefs().lowData);
    for (const [format, button] of Object.entries(this.buttonFor || {})) {
      const bytes = formatBytes(format, this.sources, this.sizes, { lowData });
      const size = formatSize(bytes, this.lang, this.tt('mb'));
      const what = this.tt(`what.${format}`);
      button.detail.textContent = size ? this.tt('withSize', { what, size }) : what;
    }
  }

  choose(format) {
    this.apply(format);
    savePrefs({ ...loadPrefs(), lessonFormat: format });
  }

  apply(format, { quiet = false } = {}) {
    if (!format) return;
    const previous = this.format;
    this.format = format;
    for (const [name, button] of Object.entries(this.buttonFor || {})) button.setAttribute('aria-pressed', String(name === format));
    const message = this.tt(`modes.${format}`);
    this.statusEl.textContent = message;
    if (!quiet) announce(message);

    if (usesVideo(format)) {
      this.view.replaceChildren();
      this.attachPlayer();
      this.whenPlayerReady(() => this.setUpPlayer(format, previous, { explicit: !quiet }));
    } else {
      this.detachPlayer();
      this.view.replaceChildren(format === 'listen' ? this.listenView() : this.readView());
    }
    if (format === 'simple' || previous === 'simple') this.setSimple(format === 'simple');
    if (!quiet && previous !== format) emit(this, 'fidel-lesson-format', { format });
  }

  // --- The player: out of the page for Listen and Read, back for the others ---

  detachPlayer() {
    if (!this.player?.isConnected) return;
    const media = this.player.ablePlayer?.media;
    media?.pause();
    this.marker = document.createComment(' fidel-player: hidden by <fidel-lesson-formats> (Listen or Read) ');
    this.player.replaceWith(this.marker);
  }

  attachPlayer() {
    if (this.marker?.parentNode) this.marker.replaceWith(this.player);
    this.marker = null;
  }

  whenPlayerReady(callback) {
    if (this.player.ablePlayer && this.player.panel && !this.player.building) return callback();
    this.player.addEventListener('fidel-ready', () => callback(), { once: true });
  }

  setUpPlayer(format, previous, { explicit }) {
    const player = this.player;
    if (!player.ablePlayer || this.format !== format) return;
    // Captions on (Watch is "video and captions") when the learner chooses a
    // video format and had them off. Not on page load: their saved choice stays.
    const captionLangs = this.sources.captions.map((c) => c.lang);
    if (explicit && captionLangs.length && currentCaptionLang(player.ablePlayer) === 'off') {
      const lang = captionLangs.includes(this.lang) ? this.lang : captionLangs[0];
      player.panelHandlers?.().captionLang(lang);
      player.syncPanel?.();
    }
    if (!player.sign?.available) return;
    if (format === 'sign') {
      player.savePrefs({ signLayout: 'docked', signSize: 'large' });
      player.sign.setLayout('docked');
      player.sign.setSize('large');
      player.sign.setVisible(true);
      player.panel?.setSignVisible(player.sign.visible);
    } else if (previous === 'sign') {
      player.savePrefs({ signSize: 'medium' });
      player.sign.setSize('medium');
      player.sign.setVisible(false);
      player.panel?.setSignVisible(player.sign.visible);
    }
  }

  setSimple(simple) {
    savePrefs({ ...loadPrefs(), simpleWords: simple });
    document.dispatchEvent(new CustomEvent(SIMPLE_SYNC, { detail: { simple, source: this } }));
  }

  // --- Listen: audio and transcript (no video) --------------------------------

  listenView() {
    const tt = this.tt;
    const headingId = uid('fidel-formats-listen');
    const captions = this.sources.captions;
    const track = captions.find((c) => c.lang === this.lang) || captions[0];
    const audio = h('audio', { class: 'fidel-formats-audio', controls: true, preload: 'none', src: this.sources.audio, 'aria-label': tt('audioLabel') });
    const list = h('ol', { class: 'fidel-formats-transcript', lang: track.lang }, h('li', {}, tt('loadingTranscript')));
    const section = h('section', { class: 'fidel-formats-section', 'aria-labelledby': headingId },
      h(`h${this.level}`, { id: headingId, class: 'fidel-formats-heading' }, tt('listenHeading')),
      audio,
      h(`h${Math.min(6, this.level + 1)}`, { class: 'fidel-formats-subheading' }, tt('transcript')),
      list);
    (async () => {
      let cues = [];
      try {
        const response = await fetch(track.url);
        if (response.ok) cues = parseVtt(await response.text());
      } catch {
        cues = [];
      }
      if (!cues.length) {
        list.replaceChildren(h('li', { lang: this.lang }, tt('noTranscript')));
        return;
      }
      list.replaceChildren(...cues.map((cue) => h('li', { class: 'fidel-formats-line' },
        h('button', {
          type: 'button', class: 'fidel-formats-time', lang: this.lang,
          onclick: () => {
            audio.currentTime = cue.start;
            audio.play()?.catch?.(() => {});
          },
        }, h('span', { class: 'fidel-e-sr' }, tt('playFrom')), clock(cue.start)),
        ' ', h('span', {}, cue.text))));
    })();
    return section;
  }

  // --- Read: the lesson document -----------------------------------------------

  readView() {
    const tt = this.tt;
    const headingId = uid('fidel-formats-read');
    const { html, pdf, brf } = this.sources.document;
    const link = (href, label) => href && h('li', {}, h('a', { href, class: 'fidel-formats-link' }, label));
    return h('section', { class: 'fidel-formats-section', 'aria-labelledby': headingId },
      h(`h${this.level}`, { id: headingId, class: 'fidel-formats-heading' }, tt('readHeading')),
      h('p', {}, tt('readIntro')),
      h('ul', { class: 'fidel-formats-links' },
        link(html, tt('openHtml')), link(pdf, tt('openPdf')), link(brf, tt('openBrf'))));
  }
}
