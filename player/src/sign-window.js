import { h } from './dom.js';
import { t } from './strings.js';
import { KozhaSignSyncController } from './kozha-sign-sync.js';
import { SignSyncController } from './sign-sync.js';

// Recorded sign-language video and optional experimental Kozha BSL avatar.
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
  /**
   * fullSrc, fullTimingUrl: an optional second sign video that signs every word
   * on its own, longer timeline, and its timing file ("Wait for the signer":
   * the lesson pauses until the signer finishes each caption).
   */
  constructor(player, host, dock, { provider = 'video', kozhaOrigin, parentOrigin, fullSrc, fullTimingUrl } = {}) {
    this.player = player;
    this.host = host; // <fidel-player>
    this.dock = dock; // container beside the video for docked layout
    this.provider = provider;
    this.status = null;
    this.fullSrc = fullSrc || null;
    this.fullTimingUrl = fullTimingUrl || null;
    this.waitMode = false;
    if (provider === 'kozha-bsl') {
      this.createKozhaWindow(kozhaOrigin, parentOrigin);
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

  setCues(cues, options = {}) {
    if (this.provider !== 'kozha-bsl') return;
    const tracks = Array.isArray(cues) ? cues : [];
    this.syncController?.setCues(tracks, options);
    if (!tracks.length) {
      this.updateStatus({
        type: 'no-captions',
        message: options.unavailableMessage || t(this.host.uiLang, 'signNoEnglishCaptions'),
      });
    }
  }

  /** Can the learner choose "Wait for the signer"? */
  get canWait() {
    return this.provider === 'video' && Boolean(this.win && this.fullSrc && this.fullTimingUrl && this.player.signVideo);
  }

  /** Switch between the normal sign video (same timeline as the lesson) and the
   *  "every word" sign video, for which the lesson waits for the signer. */
  async setWaitMode(on) {
    if (!this.canWait || Boolean(on) === this.waitMode) return true;
    const video = this.player.signVideo;
    if (on) {
      try {
        if (!this.fullTiming) {
          const response = await fetch(this.fullTimingUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          this.fullTiming = await response.json();
        }
      } catch {
        this.updateStatus({ type: 'error' });
        return false;
      }
      // Able Player moves the sign video to the lesson's time on seek and pauses
      // it with the lesson. With its own timeline, the controller does both.
      this.ableSyncSignVideo ??= this.player.syncSignVideo;
      this.player.syncSignVideo = () => {};
      this.waitMode = true;
      this.syncController?.setTiming(this.fullTiming);
      video.src = this.fullSrc;
    } else {
      this.waitMode = false;
      this.syncController?.setTiming(null);
      if (this.ableSyncSignVideo) this.player.syncSignVideo = this.ableSyncSignVideo;
      // Back to the <source> elements Able Player made.
      video.removeAttribute('src');
    }
    video.load(); // 'loadedmetadata' then moves it to the right place
    return true;
  }

  updateStatus(state) {
    if (this.provider === 'kozha-bsl') {
      if (!this.status) return;
      // The avatar frame answered: the service is running, even if the avatar
      // itself is still loading (it only draws while on screen).
      if (state.type === 'alive' || state.type === 'status') this.frameResponded = true;
      if (state.type === 'alive') return;
      if (state.type === 'ready') {
        clearTimeout(this.loadTimeout);
        this.loadTimeout = null;
      }
      const message = state.message || {
        ready: 'Experimental BSL avatar ready. Sign accuracy and timing are not human-verified.',
        error: 'The local BSL avatar could not be loaded.',
      }[state.type];
      if (message) this.status.textContent = message;
      this.status.setAttribute('role', state.type === 'error' ? 'alert' : 'status');
      return;
    }
    if (state.type === 'ready') {
      this.status?.remove();
      this.status = null;
      return;
    }
    if (state.type !== 'error' && (!['loading', 'waiting'].includes(state.type) || !this.visible)) return;
    if (!this.status) {
      this.status = h('p', { class: 'fidel-sign-status', role: 'status', 'aria-live': 'polite' });
      this.host.querySelector('.fidel-status')?.append(this.status);
    }
    if (state.type === 'waiting') {
      this.status.setAttribute('role', 'status');
      this.status.textContent = t(this.host.uiLang, 'signWaiting');
    } else if (state.type === 'error') {
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
    if (this.provider === 'kozha-bsl') this.frame?.removeAttribute('src');
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
    if (this.provider === 'kozha-bsl') {
      this.win.style.display = show ? '' : 'none';
      if (show) {
        if (this.frame && !this.frame.hasAttribute('src')) {
          this.updateStatus({ type: 'loading', message: 'Connecting to the self-hosted Kozha BSL service…' });
          this.frame.src = this.frameUrl.href;
          this.loadTimeout = setTimeout(() => {
            if (!this.frameResponded && !this.syncController?.ready && this.status?.getAttribute('role') !== 'alert') {
              this.updateStatus({
                type: 'error',
                message: 'The self-hosted Kozha BSL service did not become ready. Check Docker and port 8001.',
              });
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
      if (this.provider === 'kozha-bsl') {
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
