// <fidel-player>: a thin custom element around Able Player.
//
// It reads simple attributes, builds the <video> markup Able Player expects,
// and starts Able Player on it. Able Player does the real work (controls,
// captions, transcript, keyboard support).
//
// Attributes supported in Phase 1:
//   src           video file (MP4)
//   src-webm      optional WebM version (used first if the browser supports it)
//   poster        optional poster image
//   captions-en   English captions (WebVTT)
//   captions-am   Amharic captions (WebVTT)
//   chapters      chapter list (WebVTT)
//   descriptions  audio description text (WebVTT, kind="descriptions")
//   lang          interface language (default "en")
//
// We use the light DOM (no shadow root) on purpose: Able Player is built on
// jQuery and looks up its elements in the normal document.
import AblePlayer from 'ableplayer';

let instanceCount = 0;

export class FidelPlayer extends HTMLElement {
  connectedCallback() {
    // connectedCallback runs again if the element is moved in the page;
    // only build the player once.
    if (this.ablePlayer) return;

    const src = this.getAttribute('src');
    if (!src) {
      this.showError('No video given. Add a src="..." attribute to <fidel-player>.');
      return;
    }

    const video = this.buildVideo();
    this.replaceChildren(video);
    this.ablePlayer = new AblePlayer(video);
  }

  disconnectedCallback() {
    // Clean up only if the element is really removed (not just moved).
    queueMicrotask(() => {
      if (!this.isConnected && this.ablePlayer) {
        this.ablePlayer.dispose();
        this.ablePlayer = null;
      }
    });
  }

  buildVideo() {
    instanceCount += 1;
    const video = document.createElement('video');
    // Able Player needs a unique id for each media element.
    video.id = this.id ? `${this.id}-video` : `fidel-video-${instanceCount}`;
    video.preload = 'metadata';
    video.setAttribute('playsinline', '');
    video.dataset.lang = this.getAttribute('lang') || 'en';

    const poster = this.getAttribute('poster');
    if (poster) video.poster = poster;

    // Order matters: the browser plays the first source it supports.
    this.addSource(video, this.getAttribute('src-webm'), 'video/webm');
    this.addSource(video, this.getAttribute('src'), 'video/mp4');

    this.addTrack(video, 'captions', this.getAttribute('captions-en'), 'en', 'English');
    this.addTrack(video, 'captions', this.getAttribute('captions-am'), 'am', 'አማርኛ');
    this.addTrack(video, 'chapters', this.getAttribute('chapters'), 'en', 'Chapters');
    this.addTrack(video, 'descriptions', this.getAttribute('descriptions'), 'en', 'Audio description');

    return video;
  }

  addSource(video, url, type) {
    if (!url) return;
    const source = document.createElement('source');
    source.src = url;
    source.type = type;
    video.append(source);
  }

  addTrack(video, kind, url, srclang, label) {
    if (!url) return;
    const track = document.createElement('track');
    track.kind = kind;
    track.src = url;
    track.srclang = srclang;
    track.label = label;
    video.append(track);
  }

  showError(message) {
    const p = document.createElement('p');
    p.className = 'fidel-error';
    p.setAttribute('role', 'alert');
    p.textContent = message;
    this.replaceChildren(p);
  }
}
