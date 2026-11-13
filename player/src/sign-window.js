// The Ethiopian Sign Language (EthSL) window.
//
// Able Player creates the sign video window and keeps it in sync with the
// main video (play, pause, seek, speed). Fidel adds:
//   - "docked" layout: the window sits beside the video (default), so the
//     signer never covers the slides. On narrow screens it wraps below.
//   - "floating" layout: the window sits over the video, in a corner chosen
//     with buttons (no dragging needed, WCAG 2.5.7).
//   - three sizes, chosen with buttons.

export const SIGN_SIZES = { small: 160, medium: 240, large: 320 };
export const SIGN_CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

export class SignWindow {
  constructor(player, host, dock) {
    this.player = player;
    this.host = host; // <fidel-player>
    this.dock = dock; // container beside the video for docked layout
    this.win = player.hasSignLanguage ? player.$signWindow?.[0] : null;
    if (this.win) {
      // Able Player marks the window as a dialog, but it is not modal and
      // does not trap focus, so "region" describes it better.
      this.win.setAttribute('role', 'region');
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
    this.player.handleSignToggle();
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
      this.win.style.removeProperty('top');
      this.win.style.removeProperty('left');
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
