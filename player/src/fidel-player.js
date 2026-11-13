// <fidel-player>: the embeddable accessible lesson player.
//
// Layout inside the element:
//   .fidel-stage      the Able Player video + controls, and the sign-language
//                     dock beside it
//   .fidel-status     announces the "machine-generated captions" notice
//   .fidel-panel      Accessibility settings (captions, sign language, language)
//   .fidel-transcript searchable interactive transcript
//
// Attributes:
//   lesson                           URL of a lesson on a Fidel server
//                                    (/api/v1/lessons/ID); fills in the rest
//   src, src-webm, poster            video files
//   captions-en, captions-am         WebVTT captions
//   captions-am-status               "draft" (machine-made) or "reviewed"
//   chapters, descriptions           WebVTT chapters / description text
//   sign                             sign-language video (WebM or MP4)
//   lang                             default interface language ("en" or "am")
//
// We use the light DOM (no shadow root) because Able Player is built on
// jQuery and looks up its elements in the normal document.
import AblePlayer from './able-extensions.js';
import { h } from './dom.js';
import { t } from './strings.js';
import { loadPrefs, savePrefs, clampCaptionSize } from './prefs.js';
import { captionCssVars } from './caption-style.js';
import { currentCaptionLang, selectCaptions, markCaptionLanguage, placeCaptions } from './captions.js';
import { SignWindow } from './sign-window.js';
import { buildPanel } from './panel.js';
import { buildTranscript } from './transcript.js';
import { parseVtt } from './vtt.js';

let instanceCount = 0;

/** Able Player sets up asynchronously and has no "ready" event. */
function whenReady(player, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    (function check() {
      if (player.playerCreated) resolve(player);
      else if (Date.now() - started > timeoutMs) reject(new Error('Able Player did not start'));
      else setTimeout(check, 50);
    })();
  });
}

export class FidelPlayer extends HTMLElement {
  connectedCallback() {
    // connectedCallback runs again if the element is moved; build only once.
    if (this.ablePlayer || this.building) return;
    instanceCount += 1;
    this.idPrefix = this.id || `fidel-${instanceCount}`;
    this.prefs = loadPrefs();
    this.build();
  }

  disconnectedCallback() {
    // Clean up only if the element is really removed (not just moved).
    queueMicrotask(() => {
      if (!this.isConnected) this.destroyPlayer();
    });
  }

  get uiLang() {
    const lang = this.prefs.uiLang || this.getAttribute('lang') || 'en';
    return lang === 'am' ? 'am' : 'en';
  }

  savePrefs(changes) {
    Object.assign(this.prefs, changes);
    savePrefs(this.prefs);
  }

  destroyPlayer() {
    if (this.ablePlayer) {
      this.ablePlayer.dispose();
      this.ablePlayer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Building

  async build({ startTime = 0, focus = null } = {}) {
    this.building = true;
    if (this.getAttribute('lesson') && !this.manifestLoaded) {
      const problem = await this.loadManifest(this.getAttribute('lesson'));
      if (problem) {
        this.showError(problem);
        return;
      }
    }
    if (!this.getAttribute('src')) {
      this.showError('No video given. Add a src="..." or lesson="..." attribute to <fidel-player>.');
      return;
    }
    const lang = this.uiLang;

    this.signDock = h('div', { class: 'fidel-sign-dock' });
    this.statusArea = h('div', { class: 'fidel-status', role: 'status' });
    const playerSlot = h('div', { class: 'fidel-player-slot' });
    this.transcript = buildTranscript({
      lang,
      idPrefix: this.idPrefix,
      headingLevel: 3, // corrected below once Able Player has added its heading
      loadTracks: () => this.loadCaptionText(),
      playFrom: (seconds) => this.playFrom(seconds),
    });

    const video = this.buildVideo(lang, this.transcript.bodyId);
    playerSlot.append(video);
    this.replaceChildren(
      h(
        'div',
        { class: 'fidel', lang },
        h('div', { class: 'fidel-stage' }, playerSlot, this.signDock),
        this.statusArea,
        h('div', { class: 'fidel-panel-slot' }),
        this.transcript.element
      )
    );
    this.applyCaptionStyle();

    this.ablePlayer = new AblePlayer(video);
    try {
      await whenReady(this.ablePlayer);
    } catch (error) {
      console.error('Fidel:', error);
      this.building = false;
      return;
    }
    this.onReady({ startTime, focus });
    this.building = false;
  }

  showError(message) {
    this.building = false;
    this.replaceChildren(h('p', { class: 'fidel-error', role: 'alert' }, message));
  }

  /**
   * lesson="https://HOST/api/v1/lessons/ID": read the lesson manifest from the
   * Fidel server and turn it into the same attributes a page could write by
   * hand. Attributes already on the element win. Returns an error message,
   * or null when all is well.
   */
  async loadManifest(url) {
    let manifest;
    try {
      const response = await fetch(url);
      if (!response.ok) return `This lesson could not be loaded (error ${response.status}).`;
      manifest = await response.json();
    } catch {
      return 'This lesson could not be loaded. Check your internet connection and try again.';
    }
    if (!manifest.video?.mp4 && !manifest.video?.webm) {
      return 'This lesson video is still being prepared. Please try again in a few minutes.';
    }
    const fromManifest = {
      src: manifest.video.mp4 || manifest.video.webm,
      'src-webm': manifest.video.webm,
    };
    for (const track of manifest.captions || []) {
      fromManifest[`captions-${track.lang}`] = track.url;
      fromManifest[`captions-${track.lang}-status`] = track.status;
    }
    for (const [name, value] of Object.entries(fromManifest)) {
      if (value && !this.hasAttribute(name)) this.setAttribute(name, value);
    }
    // Files come from the Fidel server, which may be on another address than
    // this page: ask for them with CORS so caption tracks are allowed to load.
    this.crossOrigin = true;
    this.manifestLoaded = true;
    return null;
  }

  buildVideo(lang, transcriptDivId) {
    const video = h('video', {
      id: `${this.idPrefix}-video`,
      preload: 'metadata',
      playsinline: true,
      crossorigin: this.crossOrigin ? 'anonymous' : null,
      poster: this.getAttribute('poster'),
      'data-lang': lang,
      'data-transcript-div': transcriptDivId,
    });
    const sign = this.getAttribute('sign');
    const addSource = (url, type) => {
      if (url) video.append(h('source', { src: url, type, 'data-sign-src': sign }));
    };
    // Order matters: the browser plays the first source it supports.
    addSource(this.getAttribute('src-webm'), 'video/webm');
    addSource(this.getAttribute('src'), 'video/mp4');

    const addTrack = (kind, url, srclang, label) => {
      if (url) video.append(h('track', { kind, src: url, srclang, label }));
    };
    addTrack('captions', this.getAttribute('captions-en'), 'en', 'English');
    addTrack('captions', this.getAttribute('captions-am'), 'am', 'አማርኛ');
    addTrack('chapters', this.getAttribute('chapters'), 'en', 'Chapters');
    addTrack('descriptions', this.getAttribute('descriptions'), 'en', 'Audio description');
    return video;
  }

  onReady({ startTime, focus }) {
    const player = this.ablePlayer;
    const lang = this.uiLang;

    // Use the same heading level as Able Player's own (hidden) "Media player"
    // heading, so our headings fit the page's outline.
    const ableHeading = this.querySelector('.able-wrapper :is(h1,h2,h3,h4,h5,h6)');
    const headingLevel = ableHeading ? Number(ableHeading.tagName[1]) : 3;
    const transcriptHeading = this.transcript.element.querySelector('.fidel-heading');
    if (ableHeading && transcriptHeading.tagName !== `H${headingLevel}`) {
      const replacement = h(`h${headingLevel}`, { id: transcriptHeading.id, class: 'fidel-heading' }, transcriptHeading.textContent);
      transcriptHeading.replaceWith(replacement);
    }

    // Captions: language, position, look.
    const captionLangs = player.captions.map((track) => track.language);
    const wanted = this.prefs.captionLang;
    if (wanted === 'off' || captionLangs.includes(wanted)) selectCaptions(player, wanted);
    markCaptionLanguage(player);
    placeCaptions(player, this, this.prefs.captionPosition);
    this.updateDraftNotice();

    // Sign language window.
    this.sign = new SignWindow(player, this, this.signDock);
    if (this.sign.available) {
      this.sign.setLayout(this.prefs.signLayout);
      this.sign.setSize(this.prefs.signSize);
      this.sign.setCorner(this.prefs.signCorner);
    }

    // Playback speed (Able Player's Faster/Slower buttons change it).
    const video = player.media;
    if (this.prefs.playbackRate !== 1) video.playbackRate = this.prefs.playbackRate;
    video.addEventListener('ratechange', () => this.savePrefs({ playbackRate: video.playbackRate }));
    if (startTime > 0) player.seekTo(startTime);

    // Settings panel.
    this.panel = buildPanel({
      lang,
      idPrefix: this.idPrefix,
      headingLevel,
      prefs: this.prefs,
      captionLangs,
      captionLang: currentCaptionLang(player),
      hasSign: this.sign.available,
      signVisible: this.sign.visible,
      on: this.panelHandlers(),
    });
    this.querySelector('.fidel-panel-slot').replaceChildren(this.panel.element);

    // Keep the panel in step when the learner uses Able Player's own buttons
    // (CC menu, sign window Close). Checked shortly after any click or key.
    const resync = () => setTimeout(() => this.syncPanel(), 50);
    player.$ableWrapper[0].addEventListener('click', resync);
    player.$ableWrapper[0].addEventListener('keyup', resync);
    this.signDock.addEventListener('click', resync);

    this.setUpFollowAlong();

    if (focus) this.querySelector(focus)?.focus();
  }

  panelHandlers() {
    return {
      uiLang: (lang) => this.switchInterfaceLanguage(lang),
      captionLang: (lang) => {
        selectCaptions(this.ablePlayer, lang);
        this.savePrefs({ captionLang: lang });
        this.updateDraftNotice();
      },
      captionSize: (size) => {
        this.savePrefs({ captionSize: clampCaptionSize(size) });
        this.applyCaptionStyle();
      },
      captionColours: (captionColours) => {
        this.savePrefs({ captionColours });
        this.applyCaptionStyle();
      },
      captionBackground: (captionBackground) => {
        this.savePrefs({ captionBackground });
        this.applyCaptionStyle();
      },
      captionPosition: (captionPosition) => {
        this.savePrefs({ captionPosition });
        placeCaptions(this.ablePlayer, this, captionPosition);
      },
      signVisible: (show) => {
        const toggle = document.activeElement;
        this.sign.setVisible(show);
        this.panel.setSignVisible(this.sign.visible);
        // Able Player moves focus into the sign window; keep it on our button.
        toggle?.focus();
      },
      signLayout: (signLayout) => {
        this.savePrefs({ signLayout });
        this.sign.setLayout(signLayout);
      },
      signSize: (signSize) => {
        this.savePrefs({ signSize });
        this.sign.setSize(signSize);
      },
      signCorner: (signCorner) => {
        this.savePrefs({ signCorner });
        this.sign.setCorner(signCorner);
      },
    };
  }

  syncPanel() {
    if (!this.ablePlayer || !this.panel) return;
    const lang = currentCaptionLang(this.ablePlayer);
    this.panel.setCaptionLang(lang);
    this.panel.setSignVisible(this.sign.visible);
    this.sign.refresh();
    markCaptionLanguage(this.ablePlayer);
    if (lang !== this.prefs.captionLang) this.savePrefs({ captionLang: lang });
    this.updateDraftNotice();
  }

  /** Rebuild the player in another interface language, keeping the position. */
  switchInterfaceLanguage(lang) {
    const time = this.ablePlayer?.media.currentTime || 0;
    this.ablePlayer?.media.pause();
    this.destroyPlayer();
    this.savePrefs({ uiLang: lang });
    this.build({ startTime: time, focus: `[data-fidel-ui-lang="${lang}"]` });
  }

  // ---------------------------------------------------------------------------
  // Captions

  applyCaptionStyle() {
    for (const [name, value] of Object.entries(captionCssVars(this.prefs))) {
      this.style.setProperty(name, value);
    }
  }

  /** Show the "machine-generated" notice while unreviewed Amharic captions are on. */
  updateDraftNotice() {
    const draft = this.getAttribute('captions-am-status') === 'draft';
    const showing = this.ablePlayer && currentCaptionLang(this.ablePlayer) === 'am';
    const hasNotice = this.statusArea.childElementCount > 0;
    if (draft && showing && !hasNotice) {
      this.statusArea.replaceChildren(
        h(
          'div',
          { class: 'fidel-draft-notice' },
          h('p', { lang: 'am' }, t('am', 'draftNotice')),
          h('p', { lang: 'en' }, t('en', 'draftNotice'))
        )
      );
    } else if (!(draft && showing) && hasNotice) {
      this.statusArea.replaceChildren();
    }
  }

  /** Caption text for transcript search (fetched once, then cached). */
  loadCaptionText() {
    if (!this.captionText) {
      const sources = [
        ['en', this.getAttribute('captions-en')],
        ['am', this.getAttribute('captions-am')],
      ].filter(([, url]) => url);
      this.captionText = Promise.all(
        sources.map(async ([lang, url]) => {
          try {
            const response = await fetch(url);
            return { lang, cues: response.ok ? parseVtt(await response.text()) : [] };
          } catch {
            return { lang, cues: [] };
          }
        })
      );
    }
    return this.captionText;
  }

  playFrom(seconds) {
    this.ablePlayer.seekTo(seconds);
    this.ablePlayer.playMedia();
  }

  // ---------------------------------------------------------------------------
  // Transcript

  /**
   * "Follow along" (Able Player's auto-scroll) scrolls the transcript to the
   * current line. That fights a screen reader user who is reading it, so we
   * switch it off as soon as someone moves focus into the transcript text.
   * They can switch it back on with the "Follow along" checkbox.
   */
  setUpFollowAlong() {
    const player = this.ablePlayer;
    const body = this.querySelector('.fidel-transcript-body');
    body?.addEventListener('focusin', (event) => {
      if (!event.target.closest('.able-transcript')) return;
      if (player.autoScrollTranscript) {
        player.handleTranscriptLockToggle(false);
        player.$autoScrollTranscriptCheckbox?.prop('checked', false);
      }
    });
  }
}
