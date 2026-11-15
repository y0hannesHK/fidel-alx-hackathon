// <fidel-data-saver href="video.mp4" size="45000000"
//                   alt-href="lesson.html" alt-size="3100000" alt-label="audio and text version">
//
// B1. Know the size before you download. Shows "This video is 45 MB" and two
// real choices: "Load it (45 MB)" and "Use the audio and text version instead
// (3.1 MB)". Nothing big is downloaded until the learner chooses.
//
// Attributes:
//   href         the big file (a video or audio file plays here; anything else is a link)
//   size         its size in bytes; if missing, asked from the server (HEAD, Content-Length)
//   alt-href     the smaller version (a link), optional
//   alt-size     its size in bytes (or asked with HEAD)
//   alt-label    what the smaller version is, e.g. "audio and text version"
//   captions     optional WebVTT captions for the video, captions-lang (default en)
//   ui-lang      en | am (default: the page's lang)
// Event: fidel-data-saver-choice { choice: "full" | "light" }
import { h } from '../../dom.js';
import { emit } from '../../events.js';
import { announce } from '../../announce.js';
import { formatSize, isMedia } from './logic.js';
import { langOf, translator } from './strings.js';

/** Ask the server for a file's size without downloading it. */
async function headSize(href) {
  if (!href) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(href, { method: 'HEAD', signal: controller.signal });
    if (!response.ok) return null;
    return Number(response.headers.get('Content-Length')) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export class FidelDataSaver extends HTMLElement {
  async connectedCallback() {
    if (this.started) return;
    this.started = true;
    const href = this.getAttribute('href');
    const altHref = this.getAttribute('alt-href');
    const [size, altSize] = await Promise.all([
      Number(this.getAttribute('size')) || headSize(href),
      altHref ? Number(this.getAttribute('alt-size')) || headSize(altHref) : null,
    ]);
    this.render(href, size, altHref, altSize);
  }

  render(href, size, altHref, altSize) {
    const lang = langOf(this);
    const tr = translator(lang);
    const sizeText = formatSize(size, lang, tr('mb'));
    const altSizeText = formatSize(altSize, lang, tr('mb'));
    const media = isMedia(href);
    const saveData = Boolean(navigator.connection?.saveData);
    const altLabel = this.getAttribute('alt-label') || tr('lightLabel');

    const fullLabel = sizeText ? tr('loadFull', { size: sizeText }) : tr('loadFullNoSize');
    const full = media
      ? h('button', { type: 'button', class: 'fidel-button', onclick: () => this.loadFull(href, tr) }, fullLabel)
      : h('a', { class: 'fidel-button', href, onclick: () => this.choose('full') }, fullLabel);
    const light = altHref && h('a', { class: 'fidel-button', href: altHref, onclick: () => this.choose('light') },
      altSizeText ? tr('useLight', { label: altLabel, size: altSizeText }) : tr('useLightNoSize', { label: altLabel }));

    this.choices = h('div', { class: 'fidel-data-saver-choices' }, saveData ? [light, full] : [full, light]);
    this.replaceChildren(
      h('div', { class: 'fidel-data-saver', lang },
        h('p', { class: 'fidel-data-saver-size' },
          sizeText ? tr(media ? 'sizeVideo' : 'sizeFile', { size: sizeText }) : tr('sizeUnknown')),
        saveData && light && h('p', { class: 'fidel-data-saver-note' }, tr('saveDataFirst')),
        this.choices)
    );
  }

  choose(choice) {
    emit(this, 'fidel-data-saver-choice', { choice });
  }

  /** The learner chose the full video: only now is it loaded. */
  loadFull(href, tr) {
    const captions = this.getAttribute('captions');
    const video = h('video', { class: 'fidel-data-saver-video', controls: true, preload: 'metadata', src: href },
      captions && h('track', {
        kind: 'captions', src: captions, srclang: this.getAttribute('captions-lang') || 'en', default: true,
        label: this.getAttribute('captions-label') || 'Captions',
      }));
    this.choices.replaceWith(video);
    video.focus();
    announce(tr('loading'));
    this.choose('full');
  }
}
