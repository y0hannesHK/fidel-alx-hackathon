import { h } from './dom.js';
import { t } from './strings.js';
import { KozhaSignSyncController } from './kozha-sign-sync.js';
import { SignSyncController } from './sign-sync.js';

// Recorded sign-language video and optional experimental Kozha BSL avatar,
// or Ethiopian Sign Language (EthSL/AmSL) avatar for Amharic captions.
//
// Able Player creates the sign video window. Fidel's SignSyncController keeps
// its media aligned with the lesson using playback events (no timer). Fidel adds:
//   - "docked" layout: the window sits beside the video (default), so the
//     signer never covers the slides. On narrow screens it wraps below.
//   - "floating" layout: the window sits over the video, in a corner chosen
//     with buttons (no dragging needed, WCAG 2.5.7).
//   - three sizes, chosen with buttons.

// Big enough to read hands and face (the guide: the sign window is the real
// access route for many Deaf learners). Never wider than its container.
export const SIGN_SIZES = { small: 200, medium: 320, large: 480 };
export const SIGN_CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

export class SignWindow {
  constructor(player, host, dock, { provider = 'video', kozhaOrigin, ethaslOrigin, parentOrigin } = {}) {
    this.player = player;
    this.host = host; // <fidel-player>
    this.dock = dock; // container beside the video for docked layout
    this.provider = provider;
    this.status = null;
    this.activeSub = null; // for 'both' provider: 'bsl' or 'ethasl'
    if (provider === 'kozha-bsl') {
      this.createKozhaWindow(kozhaOrigin, parentOrigin);
    } else if (provider === 'ethasl') {
      this.createEthASLWindow(ethaslOrigin, parentOrigin);
    } else if (provider === 'both') {
      // Combined BSL (English) + EthSL (Amharic) window
      this.createBothWindow(kozhaOrigin, ethaslOrigin, parentOrigin);
    } else {
      this.win = player.hasSignLanguage ? player.$signWindow?.[0] : null;
    }
    if (this.win && provider === 'video') {
      // Able Player marks the window as a dialog, but it is not modal and
      // does not trap focus, so "region" describes it better.
      this.win.setAttribute('role', 'region');
      this.syncController = new SignSyncController(player.media, player.signVideo, {
        enabled: () => this.visible,
        onState: (state) => this.updateStatus(state),
      });
    }
  }

  createKozhaWindow(kozhaOrigin, parentOrigin) {
    this.win = h('div', {
      class: 'fidel-kozha-sign-window',
      role: 'region',
      'aria-label': 'Experimental British Sign Language avatar',
    });
    this.win.style.display = 'none';
    this.warning = h('p', { class: 'fidel-kozha-sign-warning', lang: 'en' });
    this.win.append(this.warning);
    this.status = h('p', { class: 'fidel-sign-status', role: 'status', 'aria-live': 'polite' }, 'Show the sign window to load the experimental BSL avatar.');
    this.win.append(this.status);
    this.dock.append(this.win);

    try {
      const base = new URL(kozhaOrigin);
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
        throw new Error('Use an HTTP(S) URL without credentials.');
      }
      if (base.origin === new URL(parentOrigin).origin) {
        throw new Error('The Kozha frame must use a separate origin from the Fidel player.');
      }
      this.warning.textContent = `Experimental BSL avatar using Kozha, the DictaSign BSL corpus, and CWASA. English captions are sent to ${base.origin}; use a service you control. Output is machine-generated, unverified, and may be inaccurate; it is not a human interpreter. Non-commercial use only.`;
      this.targetOrigin = base.origin;
      this.frameUrl = new URL('/fidel-sign/frame.html', base);
      this.frameUrl.searchParams.set('parent', parentOrigin);
      this.frameUrl.searchParams.set('v', '20261115-4');
      this.frame = h('iframe', {
        class: 'fidel-kozha-sign-frame',
        title: 'Experimental British Sign Language avatar (Kozha)',
        sandbox: 'allow-scripts allow-same-origin',
        referrerpolicy: 'no-referrer',
      });
      this.win.append(this.frame);
      this.syncController = new KozhaSignSyncController(
        this.player.media,
        this.frame.contentWindow,
        this.targetOrigin,
        {
          enabled: () => this.visible,
          onState: (state) => this.updateStatus(state),
        }
      );
      this.frame.addEventListener('load', () => {
        this.updateStatus({ type: 'loading', message: 'Loading the self-hosted Kozha BSL avatar…' });
      });
    } catch (error) {
      this.updateStatus({ type: 'error', message: `Kozha BSL is not configured: ${error.message}` });
    }
  }

  createEthASLWindow(ethaslOrigin, parentOrigin) {
    this.win = h('div', {
      class: 'fidel-kozha-sign-window fidel-ethasl-sign-window',
      role: 'region',
      'aria-label': 'የኢትዮጵያ የምልክት ቋንቋ አቫታር / Ethiopian Sign Language avatar',
      lang: 'am',
    });
    this.win.style.display = 'none';
    this.warning = h('p', { class: 'fidel-kozha-sign-warning', lang: 'am' });
    this.win.append(this.warning);
    this.status = h('p', {
      class: 'fidel-sign-status',
      role: 'status',
      'aria-live': 'polite',
    }, 'Show the sign window to load the Ethiopian Sign Language avatar.');
    this.win.append(this.status);
    this.dock.append(this.win);

    try {
      const base = new URL(ethaslOrigin);
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
        throw new Error('Use an HTTP(S) URL without credentials.');
      }
      if (base.origin === new URL(parentOrigin).origin) {
        throw new Error('The EthSL frame must use a separate origin from the Fidel player.');
      }
      this.warning.textContent = `Experimental Ethiopian Sign Language avatar. Amharic captions are processed locally at ${base.origin}. Output is machine-generated and not human-verified; it is not a human interpreter.`;
      this.targetOrigin = base.origin;
      this.frameUrl = new URL('/fidel-sign/ethasl-frame.html', base);
      this.frameUrl.searchParams.set('parent', parentOrigin);
      this.frameUrl.searchParams.set('v', '20261120-2');
      this.frame = h('iframe', {
        class: 'fidel-kozha-sign-frame fidel-ethasl-sign-frame',
        title: 'Ethiopian Sign Language avatar (EthSL)',
        sandbox: 'allow-scripts allow-same-origin',
        referrerpolicy: 'no-referrer',
      });
      this.win.append(this.frame);
      this.syncController = new KozhaSignSyncController(
        this.player.media,
        this.frame.contentWindow,
        this.targetOrigin,
        {
          enabled: () => this.visible,
          onState: (state) => this.updateStatus(state),
        }
      );
      this.frame.addEventListener('load', () => {
        this.updateStatus({ type: 'loading', message: 'Loading the Ethiopian Sign Language avatar…' });
      });
    } catch (error) {
      this.updateStatus({ type: 'error', message: `EthSL avatar is not configured: ${error.message}` });
    }
  }

  /**
   * Combined BSL + EthSL window.
   * Shows BSL (Kozha) for English captions, EthSL for Amharic captions.
   * Uses two hidden iframes; switches the visible one based on caption language.
   */
  createBothWindow(kozhaOrigin, ethaslOrigin, parentOrigin) {
    this.win = h('div', {
      class: 'fidel-kozha-sign-window fidel-both-sign-window',
      role: 'region',
      'aria-label': 'Sign language avatar',
    });
    this.win.style.display = 'none';
    this.warning = h('p', { class: 'fidel-kozha-sign-warning', lang: 'en' });
    this.win.append(this.warning);
    this.status = h('p', { class: 'fidel-sign-status', role: 'status', 'aria-live': 'polite' },
      'Show the sign window to load the sign language avatars.');
    this.win.append(this.status);
    this.dock.append(this.win);

    // Create the BSL (Kozha) sub-window
    this.bslWin = null;
    this.bslFrame = null;
    this.bslSyncController = null;
    this.bslFrameUrl = null;
    this.bslTargetOrigin = null;

    // Create the EthSL sub-window
    this.ethaslWin = null;
    this.ethaslFrame = null;
    this.ethaslSyncController = null;
    this.ethaslFrameUrl = null;
    this.ethaslTargetOrigin = null;

    // Warn text
    const warnParts = [];

    try {
      const kozhaBase = new URL(kozhaOrigin);
      if (!['http:', 'https:'].includes(kozhaBase.protocol) || kozhaBase.username || kozhaBase.password) {
        throw new Error('Kozha: use an HTTP(S) URL without credentials.');
      }
      if (kozhaBase.origin === new URL(parentOrigin).origin) {
        throw new Error('The Kozha frame must use a separate origin.');
      }
      this.bslTargetOrigin = kozhaBase.origin;
      this.bslFrameUrl = new URL('/fidel-sign/frame.html', kozhaBase);
      this.bslFrameUrl.searchParams.set('parent', parentOrigin);
      this.bslFrameUrl.searchParams.set('v', '20261115-4');
      this.bslFrame = h('iframe', {
        class: 'fidel-kozha-sign-frame fidel-bsl-sign-frame',
        title: 'British Sign Language avatar (BSL)',
        sandbox: 'allow-scripts allow-same-origin',
        referrerpolicy: 'no-referrer',
        style: 'display:none',
      });
      this.win.append(this.bslFrame);
      this.bslSyncController = new KozhaSignSyncController(
        this.player.media,
        this.bslFrame.contentWindow,
        this.bslTargetOrigin,
        { enabled: () => this.visible && this.activeSub === 'bsl', onState: (s) => this.updateStatus(s) }
      );
      this.bslFrame.addEventListener('load', () => {
        if (this.activeSub === 'bsl') {
          this.updateStatus({ type: 'loading', message: 'Loading BSL avatar…' });
        }
      });
      warnParts.push(`English → BSL via Kozha at ${kozhaBase.origin}`);
    } catch (error) {
      console.warn('BSL (Kozha) not configured:', error.message);
    }

    try {
      const ethaslBase = new URL(ethaslOrigin || kozhaOrigin);
      if (!['http:', 'https:'].includes(ethaslBase.protocol) || ethaslBase.username || ethaslBase.password) {
        throw new Error('EthSL: use an HTTP(S) URL without credentials.');
      }
      if (ethaslBase.origin === new URL(parentOrigin).origin) {
        throw new Error('The EthSL frame must use a separate origin.');
      }
      this.ethaslTargetOrigin = ethaslBase.origin;
      this.ethaslFrameUrl = new URL('/fidel-sign/ethasl-frame.html', ethaslBase);
      this.ethaslFrameUrl.searchParams.set('parent', parentOrigin);
      this.ethaslFrameUrl.searchParams.set('v', '20261120-1');
      this.ethaslFrame = h('iframe', {
        class: 'fidel-kozha-sign-frame fidel-ethasl-sign-frame',
        title: 'Ethiopian Sign Language avatar (EthSL)',
        sandbox: 'allow-scripts allow-same-origin',
        referrerpolicy: 'no-referrer',
        style: 'display:none',
      });
      this.win.append(this.ethaslFrame);
      this.ethaslSyncController = new KozhaSignSyncController(
        this.player.media,
        this.ethaslFrame.contentWindow,
        this.ethaslTargetOrigin,
        { enabled: () => this.visible && this.activeSub === 'ethasl', onState: (s) => this.updateStatus(s) }
      );
      this.ethaslFrame.addEventListener('load', () => {
        if (this.activeSub === 'ethasl') {
          this.updateStatus({ type: 'loading', message: 'Loading Amharic Sign Language avatar…' });
        }
      });
      warnParts.push(`Amharic → EthSL at ${ethaslBase.origin}`);
    } catch (error) {
      console.warn('EthSL not configured:', error.message);
    }

    this.warning.textContent = warnParts.length
      ? `Experimental sign language avatars: ${warnParts.join('; ')}. Output is machine-generated and not human-verified.`
      : 'Sign language avatars could not be configured.';

    // Default to BSL (English)
    this.activeSub = 'bsl';
  }

  /**
   * Switch the active sign sub-avatar based on caption language.
   * Called by updateSignCues() when provider === 'both'.
   */
  switchBothAvatar(language) {
    if (this.provider !== 'both') return;
    const newSub = (language === 'am') ? 'ethasl' : 'bsl';
    if (newSub === this.activeSub) return;
    this.activeSub = newSub;

    // Lazy-load the newly active frame on first switch (avoids two CWASA inits at once)
    if (newSub === 'ethasl') {
      if (this.ethaslFrame && !this.ethaslFrame.hasAttribute('src') && this.ethaslFrameUrl) {
        this.ethaslFrame.src = this.ethaslFrameUrl.href;
      }
    } else {
      if (this.bslFrame && !this.bslFrame.hasAttribute('src') && this.bslFrameUrl) {
        this.bslFrame.src = this.bslFrameUrl.href;
      }
    }

    // Show the right iframe, hide the other
    if (this.bslFrame) this.bslFrame.style.display = newSub === 'bsl' ? '' : 'none';
    if (this.ethaslFrame) this.ethaslFrame.style.display = newSub === 'ethasl' ? '' : 'none';

    // Pause the outgoing controller, resume the incoming
    if (newSub === 'bsl') {
      this.ethaslSyncController?.setEnabled(false);
      if (this.visible) this.bslSyncController?.setEnabled(true);
    } else {
      this.bslSyncController?.setEnabled(false);
      if (this.visible) this.ethaslSyncController?.setEnabled(true);
    }
  }

  setCues(cues, options = {}) {
    const tracks = Array.isArray(cues) ? cues : [];
    if (this.provider === 'kozha-bsl' || this.provider === 'ethasl') {
      this.syncController?.setCues(tracks, options);
      if (!tracks.length) {
        this.updateStatus({
          type: 'no-captions',
          message: options.unavailableMessage || t(this.host.uiLang, 'signNoEnglishCaptions'),
        });
      }
      return;
    }
    if (this.provider === 'both') {
      // Route to the right controller based on language
      const lang = options.language || 'en';
      if (lang === 'am') {
        this.ethaslSyncController?.setCues(tracks, options);
      } else if (lang === 'en') {
        this.bslSyncController?.setCues(tracks, options);
      } else if (lang === 'off') {
        // Captions are off — tell both sub-avatars with the "needs captions" message
        this.bslSyncController?.setCues([], { language: 'off', unavailableMessage: options.unavailableMessage });
        this.ethaslSyncController?.setCues([], { language: 'off', unavailableMessage: options.unavailableMessage });
      }
    }
  }

  updateStatus(state) {
    if (this.provider === 'kozha-bsl' || this.provider === 'ethasl') {
      if (!this.status) return;
      if (state.type === 'ready') {
        clearTimeout(this.loadTimeout);
        this.loadTimeout = null;
      }
      const defaultMessages = this.provider === 'ethasl'
        ? { ready: 'Ethiopian Sign Language avatar ready. Output is not human-verified.', error: 'The EthSL avatar could not be loaded.' }
        : { ready: 'Experimental BSL avatar ready. Sign accuracy and timing are not human-verified.', error: 'The local BSL avatar could not be loaded.' };
      const message = state.message || defaultMessages[state.type];
      if (message) this.status.textContent = message;
      this.status.setAttribute('role', state.type === 'error' ? 'alert' : 'status');
      return;
    }
    if (state.type === 'ready') {
      this.status?.remove();
      this.status = null;
      return;
    }
    if (state.type !== 'error' && (state.type !== 'loading' || !this.visible)) return;
    if (!this.status) {
      this.status = h('p', { class: 'fidel-sign-status', role: 'status', 'aria-live': 'polite' });
      this.host.querySelector('.fidel-status')?.append(this.status);
    }
    if (state.type === 'error') {
      this.status.setAttribute('role', 'alert');
      this.status.textContent = t(this.host.uiLang, 'signVideoError');
    } else {
      this.status.setAttribute('role', 'status');
      this.status.textContent = t(this.host.uiLang, 'signVideoLoading');
    }
  }

  stop() {
    clearTimeout(this.loadTimeout);
    this.syncController?.destroy();
    if (this.provider === 'kozha-bsl' || this.provider === 'ethasl') this.frame?.removeAttribute('src');
    if (this.provider === 'both') {
      this.bslSyncController?.destroy();
      this.ethaslSyncController?.destroy();
      this.bslFrame?.removeAttribute('src');
      this.ethaslFrame?.removeAttribute('src');
    }
  }

  get available() {
    return Boolean(this.win);
  }

  get visible() {
    return Boolean(this.win) && this.win.style.display !== 'none';
  }

  /** Show or hide (uses Able Player's toggle so sync and prefs stay right). */
  setVisible(show) {
    if (!this.win || show === this.visible) return;
    if (this.provider === 'kozha-bsl' || this.provider === 'ethasl') {
      this.win.style.display = show ? '' : 'none';
      if (show) {
        if (this.frame && !this.frame.hasAttribute('src')) {
          const loadingMsg = this.provider === 'ethasl'
            ? 'Connecting to the Ethiopian Sign Language service…'
            : 'Connecting to the self-hosted Kozha BSL service…';
          const timeoutMsg = this.provider === 'ethasl'
            ? 'The Ethiopian Sign Language service did not become ready. Check Docker and port 8001.'
            : 'The self-hosted Kozha BSL service did not become ready. Check Docker and port 8001.';
          this.updateStatus({ type: 'loading', message: loadingMsg });
          this.frame.src = this.frameUrl.href;
          this.loadTimeout = setTimeout(() => {
            if (!this.syncController?.ready && this.status?.getAttribute('role') !== 'alert') {
              this.updateStatus({ type: 'error', message: timeoutMsg });
            }
          }, 60000);
        }
        this.syncController?.setEnabled(true);
      } else {
        this.syncController?.setEnabled(false);
      }
      this.refresh();
      return;
    }
    if (this.provider === 'both') {
      this.win.style.display = show ? '' : 'none';
      if (show) {
        const sub = this.activeSub || 'bsl';
        // Lazy-load only the ACTIVE sub-frame on first show.
        // The inactive frame is loaded only when the user actually switches to it
        // (see switchBothAvatar). This prevents two CWASA instances competing at init time.
        if (sub === 'bsl') {
          if (this.bslFrame && !this.bslFrame.hasAttribute('src') && this.bslFrameUrl) {
            this.bslFrame.style.display = '';
            this.bslFrame.src = this.bslFrameUrl.href;
          }
          if (this.ethaslFrame) this.ethaslFrame.style.display = 'none';
          this.bslSyncController?.setEnabled(true);
          this.ethaslSyncController?.setEnabled(false);
        } else {
          if (this.ethaslFrame && !this.ethaslFrame.hasAttribute('src') && this.ethaslFrameUrl) {
            this.ethaslFrame.style.display = '';
            this.ethaslFrame.src = this.ethaslFrameUrl.href;
          }
          if (this.bslFrame) this.bslFrame.style.display = 'none';
          this.ethaslSyncController?.setEnabled(true);
          this.bslSyncController?.setEnabled(false);
        }
        this.updateStatus({ type: 'loading', message: 'Loading sign language avatar…' });
        this.loadTimeout = setTimeout(() => {
          if (this.status?.getAttribute('role') !== 'alert') {
            this.updateStatus({ type: 'error', message: 'Sign language service did not become ready. Check Docker and port 8001.' });
          }
        }, 60000);
      } else {
        this.bslSyncController?.setEnabled(false);
        this.ethaslSyncController?.setEnabled(false);
      }
      this.refresh();
      return;
    }
    this.player.handleSignToggle();
    if (show) this.syncController.sync();
    else this.updateStatus({ type: 'ready' });
    this.refresh();
  }

  /** layout: 'docked' | 'floating' */
  setLayout(layout) {
    if (!this.win) return;
    this.layout = layout;
    this.host.dataset.signLayout = layout;
    const target = layout === 'docked' ? this.dock : this.player.$ableWrapper[0];
    // Moving a playing <video> in one step is allowed: it keeps playing.
    if (this.win.parentElement !== target) target.append(this.win);
    this.refresh();
  }

  /** size: 'small' | 'medium' | 'large' */
  setSize(size) {
    if (!this.win) return;
    this.size = SIGN_SIZES[size] ? size : 'medium';
    this.host.style.setProperty('--fidel-sign-width', `${SIGN_SIZES[this.size]}px`);
    this.refresh();
  }

  /** corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' (floating only) */
  setCorner(corner) {
    if (!this.win) return;
    this.corner = SIGN_CORNERS.includes(corner) ? corner : 'bottom-right';
    this.refresh();
  }

  /** Re-apply size and position (after showing, resizing, or switching layout). */
  refresh() {
    if (!this.win) return;
    this.host.dataset.signVisible = String(this.visible); // fidel.css hides an empty dock
    if (!this.visible) return;
    if (this.layout === 'docked') {
      // fidel.css handles the docked layout; clear Able Player's inline position.
      if (this.provider === 'kozha-bsl' || this.provider === 'ethasl' || this.provider === 'both') {
        for (const property of ['position', 'width', 'height', 'top', 'left']) {
          this.win.style.removeProperty(property);
        }
      } else {
        this.win.style.removeProperty('top');
        this.win.style.removeProperty('left');
      }
      return;
    }
    const wrapper = this.player.$ableWrapper[0];
    const media = wrapper.querySelector('.able-media-container') || wrapper;
    const width = Math.min(SIGN_SIZES[this.size || 'medium'], media.offsetWidth / 2);
    this.win.style.width = `${width}px`;

    // Place the window in the chosen corner of the video picture.
    const w = wrapper.getBoundingClientRect();
    const m = media.getBoundingClientRect();
    const [vertical, horizontal] = (this.corner || 'bottom-right').split('-');
    const top = vertical === 'top' ? m.top - w.top : m.bottom - w.top - this.win.offsetHeight;
    const left = horizontal === 'left' ? m.left - w.left : m.right - w.left - this.win.offsetWidth;
    Object.assign(this.win.style, {
      position: 'absolute',
      top: `${Math.max(0, top)}px`,
      left: `${Math.max(0, left)}px`,
    });
  }
}
