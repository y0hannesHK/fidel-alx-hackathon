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
//   captions-en, captions-am, captions-om   WebVTT captions (English, Amharic, Afaan Oromo)
//   captions-am-status, captions-om-status  "draft" (machine-made) or "reviewed"
//   chapters-en, chapters-am         WebVTT chapter titles ("chapters" = English)
//   descriptions-en, descriptions-am audio description text ("descriptions" = English)
//   sign                             sign-language video (WebM or MP4)
//   sign-provider="kozha-bsl"        experimental BSL avatar for English captions
//   sign-visible="true"              show the configured sign window on startup
//   kozha-origin                     self-hosted Kozha base URL, e.g. http://localhost:8001
//   src-small                        small video for low-data mode
//   offline-page, offline-page-video one-page offline lesson (audio + text / + video)
//   offline-pack                     offline pack (.zip)
//   document-html-en/-am, document-pdf-en/-am, document-brf-en/-am   lesson document, Braille
//   description-recordings           JSON: recorded descriptions, e.g.
//                                    {"am":[{"start":12.5,"url":"d1.opus"}]}
//   lang                             default interface language ("en" or "am")
//
// Events sent to the page: fidel-ready, fidel-progress, fidel-ended, fidel-complete,
// fidel-prefs, fidel-captions-change,
// fidel-language-change, fidel-low-data-change, fidel-offline-saved, fidel-error.
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
import { emit } from './events.js';
import { setUpPlayerKeys } from './keyboard.js';

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
  static get observedAttributes() {
    return ['sign-visible'];
  }

  connectedCallback() {
    // connectedCallback runs again if the element is moved; build only once.
    if (this.ablePlayer || this.building) return;
    instanceCount += 1;
    this.idPrefix = this.id || `fidel-${instanceCount}`;
    this.prefs = loadPrefs();
    this.build();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name !== 'sign-visible' || oldValue === newValue || !this.sign?.available) return;
    this.sign.setVisible(newValue === 'true');
    this.panel?.setSignVisible(this.sign.visible);
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
    // Tell the host what the learner chose (display settings only, no personal data).
    emit(this, 'fidel-prefs', {
      captionSize: this.prefs.captionSize,
      captionColor: this.prefs.captionColours,
      captionLanguage: this.prefs.captionLang,
      signPosition: this.prefs.signLayout === 'docked' ? 'beside' : this.prefs.signCorner,
      signSize: this.prefs.signSize,
      lowData: this.prefs.lowData,
      language: this.prefs.uiLang,
    });
  }

  destroyPlayer() {
    this.sign?.stop();
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
    this.mediaStatus = null;
    const playerSlot = h('div', { class: 'fidel-player-slot' });
    this.transcript = buildTranscript({
      lang,
      idPrefix: this.idPrefix,
      headingLevel: 3, // corrected below once Able Player has added its heading
      loadTracks: () => this.loadCaptionText(),
      playFrom: (seconds) => this.playFrom(seconds),
      transcriptLang: () => this.ablePlayer?.transcriptLang || currentCaptionLang(this.ablePlayer || {}) || 'en',
    });

    this.failedCaptionLanguages = new Set();
    const video = this.buildVideo(lang, this.transcript.bodyId);
    this.bindVideoStatus(video, lang);
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
    emit(this, 'fidel-error', { message });
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
      'src-small': manifest.video.small_mp4,
      'offline-page': manifest.offline?.page,
      'offline-page-video': manifest.offline?.page_with_video,
      'offline-pack': manifest.offline?.pack,
      'offline-page-size': manifest.offline_sizes?.page,
      'offline-page-video-size': manifest.offline_sizes?.page_with_video,
      'offline-pack-size': manifest.offline_sizes?.pack,
    };
    for (const track of manifest.captions || []) {
      fromManifest[`captions-${track.lang}`] = track.url;
      fromManifest[`captions-${track.lang}-status`] = track.status;
    }
    for (const [lang, url] of Object.entries(manifest.chapters || {})) fromManifest[`chapters-${lang}`] = url;
    for (const [lang, url] of Object.entries(manifest.descriptions || {})) fromManifest[`descriptions-${lang}`] = url;
    fromManifest.sign = manifest.sign;
    for (const [key, url] of Object.entries(manifest.documents || {})) {
      const [kind, docLang] = key.split('_'); // e.g. html_am
      fromManifest[`document-${kind}-${docLang}`] = url;
    }
    if (Object.keys(manifest.description_recordings || {}).length) {
      fromManifest['description-recordings'] = JSON.stringify(manifest.description_recordings);
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
      'data-seek-interval': '10', // Back / Forward buttons move 10 seconds
    });
    const sign = this.getAttribute('sign');
    const addSource = (url, type) => {
      if (url) video.append(h('source', { src: url, type, 'data-sign-src': sign }));
    };
    // Order matters: the browser plays the first source it supports.
    if (this.prefs.lowData && this.getAttribute('src-small')) {
      addSource(this.getAttribute('src-small'), 'video/mp4'); // low-data mode
    } else {
      addSource(this.getAttribute('src-webm'), 'video/webm');
      addSource(this.getAttribute('src'), 'video/mp4');
    }

    const addTrack = (kind, url, srclang, label) => {
      if (!url) return;
      const track = h('track', { kind, src: url, srclang, label });
      if (kind === 'captions') {
        track.addEventListener('error', () => {
          this.failedCaptionLanguages.add(srclang);
          this.updateCaptionLoadError();
        });
        track.addEventListener('load', () => {
          this.failedCaptionLanguages.delete(srclang);
          this.updateCaptionLoadError();
        });
      }
      video.append(track);
    };
    addTrack('captions', this.getAttribute('captions-en'), 'en', 'English');
    addTrack('captions', this.getAttribute('captions-am'), 'am', 'አማርኛ');
    addTrack('captions', this.getAttribute('captions-om'), 'om', 'Afaan Oromoo');
    // "chapters" / "descriptions" are short for the English ones.
    const en = (kind) => this.getAttribute(`${kind}-en`) || this.getAttribute(kind);
    addTrack('chapters', en('chapters'), 'en', 'Chapters');
    addTrack('chapters', this.getAttribute('chapters-am'), 'am', 'ምዕራፎች');
    addTrack('descriptions', en('descriptions'), 'en', 'Audio description');
    addTrack('descriptions', this.getAttribute('descriptions-am'), 'am', 'የድምፅ መግለጫ');
    return video;
  }

  bindVideoStatus(video, lang) {
    let failed = false;
    const showError = () => {
      if (failed) return;
      failed = true;
      this.ensureMediaStatus();
      const lowDataHint = this.getAttribute('src-small') && !this.prefs.lowData ? ` ${t(lang, 'videoErrorLowData')}` : '';
      this.mediaStatus.classList.add('fidel-error', 'fidel-video-error');
      this.mediaStatus.setAttribute('role', 'alert');
      this.mediaStatus.textContent = t(lang, 'videoError') + lowDataHint;
      emit(this, 'fidel-error', { message: 'video could not be loaded' });
    };
    const loading = () => {
      this.ensureMediaStatus();
      this.mediaStatus.classList.remove('fidel-error');
      this.mediaStatus.setAttribute('role', 'status');
      this.mediaStatus.textContent = t(lang, 'videoLoading');
    };
    const ready = () => {
      this.mediaStatus?.remove();
      this.mediaStatus = null;
    };
    video.addEventListener('loadstart', loading);
    video.addEventListener('waiting', loading);
    video.addEventListener('stalled', loading);
    video.addEventListener('seeking', loading);
    video.addEventListener('canplay', ready);
    video.addEventListener('playing', ready);
    video.addEventListener('seeked', ready);
    video.addEventListener('error', showError);

    const sources = [...video.querySelectorAll('source')];
    const failedSources = new Set();
    for (const source of sources) {
      source.addEventListener('error', () => {
        failedSources.add(source);
        if (failedSources.size === sources.length) showError();
      });
    }
  }

  ensureMediaStatus() {
    if (this.mediaStatus) return;
    this.mediaStatus = h('p', { class: 'fidel-media-status', role: 'status', 'aria-live': 'polite' });
    this.statusArea.append(this.mediaStatus);
  }

  updateCaptionLoadError() {
    const lang = currentCaptionLang(this.ablePlayer || {});
    const selected = lang === 'off' ? this.prefs.captionLang : lang;
    const failed = selected && selected !== 'off' && this.failedCaptionLanguages.has(selected);
    let message = this.statusArea?.querySelector('.fidel-caption-error');
    if (!failed) {
      message?.remove();
      return;
    }
    if (!message) {
      message = h('p', { class: 'fidel-error fidel-caption-error', role: 'alert' });
      this.statusArea.append(message);
    }
    message.lang = this.uiLang;
    message.textContent = t(this.uiLang, 'captionLoadError');
  }

  /**
   * Chapter titles must be read in their real language (WCAG 3.1.2). If the
   * transcript is in Amharic but there are only English chapters, Able Player
   * shows the English titles inside Amharic text; we mark them lang="en" so
   * screen readers switch voice. Runs whenever Able Player redraws.
   */
  /** Transcript lines (captions and descriptions) seek when activated. Able
   *  Player builds them as focusable <span>s; role="button" makes screen
   *  readers announce them as buttons, and Able Player then also activates
   *  them with Enter and Space. (Real <button>s would break Able Player's
   *  highlighting and click handling: see player/patches/README.md.) */
  markTranscriptButtons() {
    for (const line of this.querySelectorAll('.able-transcript-caption, .able-transcript-desc .able-transcript-seekpoint')) {
      if (line.getAttribute('role') !== 'button') line.setAttribute('role', 'button');
    }
  }

  markChapterLanguages() {
    const player = this.ablePlayer;
    if (!player?.chapters?.length) return;
    const chapterLangs = player.chapters.map((track) => track.language);
    const langFor = (wanted) => (chapterLangs.includes(wanted) ? wanted : chapterLangs[0]);
    const transcriptLang = langFor(player.transcriptLang || player.captionLang || 'en');
    for (const heading of this.querySelectorAll('.able-transcript-chapter-heading')) {
      if (heading.getAttribute('lang') !== transcriptLang) heading.setAttribute('lang', transcriptLang);
    }
    const menuLang = langFor(player.captionLang || 'en');
    for (const item of this.querySelectorAll('.able-popup-chapters li, .able-chapters-div li')) {
      if (item.getAttribute('lang') !== menuLang) item.setAttribute('lang', menuLang);
    }
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
    this.updateCaptionLoadError();

    // Recorded audio descriptions (see able-extensions.js).
    try {
      player.fidelRecordings = JSON.parse(this.getAttribute('description-recordings') || '{}');
    } catch {
      player.fidelRecordings = {};
    }

    // Sign language window.
    const signProvider = this.getAttribute('sign-provider');
    this.sign = new SignWindow(player, this, this.signDock, signProvider === 'kozha-bsl'
      ? {
          provider: 'kozha-bsl',
          kozhaOrigin: this.getAttribute('kozha-origin'),
          parentOrigin: window.location.origin,
        }
      : undefined);
    if (signProvider === 'kozha-bsl') {
      this.updateSignCues();
    }
    if (this.sign.available) {
      this.sign.setLayout(this.prefs.signLayout);
      this.sign.setSize(this.prefs.signSize);
      this.sign.setCorner(this.prefs.signCorner);
      if (this.getAttribute('sign-visible') === 'true') this.sign.setVisible(true);
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
      muted: player.media.muted,
      captionLangs,
      captionLang: currentCaptionLang(player),
      hasSign: this.sign.available,
      signVisible: this.sign.visible,
      hasSmallVideo: Boolean(this.getAttribute('src-small')),
      offline: {
        page: this.getAttribute('offline-page'),
        pageVideo: this.getAttribute('offline-page-video'),
        pack: this.getAttribute('offline-pack'),
        sizes: {
          page: Number(this.getAttribute('offline-page-size')) || 0,
          pageVideo: Number(this.getAttribute('offline-page-video-size')) || 0,
          pack: Number(this.getAttribute('offline-pack-size')) || 0,
        },
        // The lesson document in the interface language, else English.
        documentHtml: this.getAttribute(`document-html-${lang}`) || this.getAttribute('document-html-en'),
        documentPdf: this.getAttribute(`document-pdf-${lang}`) || this.getAttribute('document-pdf-en'),
        documentBrf: this.getAttribute(`document-brf-${lang}`) || this.getAttribute('document-brf-en'),
      },
      on: this.panelHandlers(),
    });
    this.querySelector('.fidel-panel-slot').replaceChildren(this.panel.element);
    video.addEventListener('volumechange', () => this.panel?.setMuted(video.muted));

    // Keep the panel in step when the learner uses Able Player's own buttons
    // (CC menu, sign window Close). Checked shortly after any click or key.
    const resync = () => setTimeout(() => this.syncPanel(), 50);
    player.$ableWrapper[0].addEventListener('click', resync);
    player.$ableWrapper[0].addEventListener('keyup', resync);
    this.signDock.addEventListener('click', resync);

    this.setUpFollowAlong();
    setUpPlayerKeys(player);

    // Able Player redraws the transcript and chapter menu when the language
    // changes; re-mark chapter languages each time (attribute changes do not
    // trigger this observer, so it cannot loop).
    this.markChapterLanguages();
    this.markTranscriptButtons();
    this.chapterObserver?.disconnect();
    this.chapterObserver = new MutationObserver(() => {
      this.markChapterLanguages();
      this.markTranscriptButtons();
    });
    this.chapterObserver.observe(this, { childList: true, subtree: true });

    if (focus) this.querySelector(focus)?.focus();

    // Events for the host page (see events.js).
    video.addEventListener('ended', () => {
      emit(this, 'fidel-ended', { duration: video.duration });
      emit(this, 'fidel-complete', {}); // the name used in the hackathon's data contract
    });
    // Progress for the host (e.g. "62% watched"), at most every 5 seconds of playback.
    let lastProgress = -Infinity;
    video.addEventListener('timeupdate', () => {
      if (Math.abs(video.currentTime - lastProgress) < 5 || !video.duration) return;
      lastProgress = video.currentTime;
      emit(this, 'fidel-progress', {
        seconds: Math.round(video.currentTime),
        percent: Math.round((video.currentTime / video.duration) * 100),
      });
    });
    emit(this, 'fidel-ready', {
      lang,
      captionLanguages: captionLangs,
      hasSignLanguage: this.sign.available,
    });
  }

  panelHandlers() {
    return {
      uiLang: (lang) => this.switchInterfaceLanguage(lang),
      muted: (muted) => {
        this.ablePlayer.media.muted = muted;
      },
      lowData: (lowData) => {
        emit(this, 'fidel-low-data-change', { lowData });
        this.savePrefs({ lowData });
        this.rebuild('[data-fidel-low-data]');
      },
      captionLang: (lang) => {
        selectCaptions(this.ablePlayer, lang);
        emit(this, 'fidel-captions-change', { lang });
        this.savePrefs({ captionLang: lang });
        this.updateSignCues(lang);
        this.updateDraftNotice();
        this.updateCaptionLoadError();
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
    if (lang !== this.prefs.captionLang) {
      this.savePrefs({ captionLang: lang });
      emit(this, 'fidel-captions-change', { lang });
      this.updateSignCues(lang);
    }
    this.updateDraftNotice();
    this.updateCaptionLoadError();
  }

  /** Rebuild the player in another interface language, keeping the position. */
  switchInterfaceLanguage(lang) {
    const previousUiLang = this.uiLang;
    const captionLangs = this.ablePlayer?.captions?.map((track) => track.language) || [];
    const changes = { uiLang: lang };
    const hasCaptionTrack = captionLangs.includes(lang);
    if (hasCaptionTrack) changes.captionLang = lang;
    this.savePrefs(changes);
    emit(this, 'fidel-language-change', { lang });
    if (previousUiLang === lang) {
      if (hasCaptionTrack && currentCaptionLang(this.ablePlayer) !== lang) {
        selectCaptions(this.ablePlayer, lang);
        this.panel?.setCaptionLang(lang);
        emit(this, 'fidel-captions-change', { lang });
        this.updateSignCues(lang);
        this.updateDraftNotice();
        this.updateCaptionLoadError();
      }
      return;
    }
    this.rebuild(`[data-fidel-ui-lang="${lang}"]`);
  }

  /** Build the player again (new language or video size), keeping the
   *  playback position and putting focus back on the control just used. */
  rebuild(focusSelector) {
    const time = this.ablePlayer?.media.currentTime || 0;
    this.ablePlayer?.media.pause();
    this.destroyPlayer();
    this.build({ startTime: time, focus: focusSelector });
  }

  // ---------------------------------------------------------------------------
  // Captions

  applyCaptionStyle() {
    for (const [name, value] of Object.entries(captionCssVars(this.prefs))) {
      this.style.setProperty(name, value);
    }
  }

  /** Show the "machine-generated" notice while unreviewed translated captions
   *  (Amharic, Afaan Oromo) are on. Removes only itself from the status area. */
  updateDraftNotice() {
    const lang = this.ablePlayer ? currentCaptionLang(this.ablePlayer) : 'off';
    const draft = lang !== 'off' && lang !== 'en' && this.getAttribute(`captions-${lang}-status`) === 'draft';
    const existing = this.statusArea.querySelector('.fidel-draft-notice');
    if (existing && existing.dataset.lang === lang && draft) return;
    existing?.remove();
    if (!draft) return;
    // Amharic: the notice in Amharic and English. Afaan Oromo: English (and
    // Amharic if that is the interface language) until a speaker writes it in Oromo.
    const key = lang === 'om' ? 'draftNoticeOm' : 'draftNotice';
    const lines = [[this.uiLang, t(this.uiLang, key)]];
    this.statusArea.append(
      h('div', { class: 'fidel-draft-notice', 'data-lang': lang }, lines.map(([l, text]) => h('p', { lang: l }, text)))
    );
  }

  /** Caption text for transcript search (fetched once, then cached). */
  loadCaptionText() {
    if (!this.captionText) {
      const sources = [
        ['en', this.getAttribute('captions-en')],
        ['am', this.getAttribute('captions-am')],
        ['om', this.getAttribute('captions-om')],
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

  updateSignCues(language = currentCaptionLang(this.ablePlayer || {})) {
    if (this.sign?.provider !== 'kozha-bsl') return;
    const signWindow = this.sign;
    const requestId = (this.signCueRequest || 0) + 1;
    this.signCueRequest = requestId;
    this.loadCaptionText()
      .then((tracks) => {
        if (this.sign !== signWindow || requestId !== this.signCueRequest) return;
        if (language === 'en') {
          const english = tracks.find((track) => track.lang === 'en');
          signWindow.setCues(english?.cues || [], {
            language: 'en',
            unavailableMessage: t(this.uiLang, 'signNoEnglishCaptions'),
          });
          return;
        }
        signWindow.setCues([], {
          language,
          unavailableMessage: t(this.uiLang, language === 'off' ? 'signNeedsCaptions' : 'signEnglishOnly'),
        });
      })
      .catch((error) => {
        if (this.sign === signWindow && requestId === this.signCueRequest) {
          signWindow.updateStatus({
            type: 'error',
            message: `Caption cues for the sign avatar could not be loaded: ${error.message}`,
          });
        }
      });
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
