const DRIFT_TOLERANCE = 0.35;

/** Keep a companion sign-language video aligned with its lesson video. */
export class SignSyncController {
  constructor(main, sign, { enabled = () => true, onState = () => {} } = {}) {
    this.main = main;
    this.sign = sign;
    this.enabled = enabled;
    this.onState = onState;
    this.listeners = [];

    this.listen(main, 'play', () => this.sync());
    this.listen(main, 'playing', () => this.sync());
    this.listen(main, 'pause', () => this.pause());
    this.listen(main, 'seeking', () => this.pause());
    this.listen(main, 'seeked', () => this.sync());
    this.listen(main, 'ratechange', () => this.syncRate());
    this.listen(main, 'timeupdate', () => this.correctDrift());
    this.listen(main, 'waiting', () => this.pause());
    this.listen(main, 'stalled', () => this.pause());
    this.listen(main, 'ended', () => this.finish());
    this.listen(main, 'error', () => {
      this.pause();
      this.onState({ type: 'main-error' });
    });

    this.listen(sign, 'loadedmetadata', () => this.sync());
    this.listen(sign, 'canplay', () => {
      this.onState({ type: 'ready' });
      this.sync();
    });
    this.listen(sign, 'playing', () => this.onState({ type: 'ready' }));
    this.listen(sign, 'waiting', () => this.onState({ type: 'loading' }));
    this.listen(sign, 'stalled', () => this.onState({ type: 'loading' }));
    this.listen(sign, 'error', () => {
      this.pause();
      this.onState({ type: 'error', error: sign.error });
    });
  }

  listen(target, type, callback) {
    target.addEventListener(type, callback);
    this.listeners.push([target, type, callback]);
  }

  syncPosition(force = true) {
    if (this.sign.readyState < 1 || !Number.isFinite(this.main.currentTime)) return;
    const duration = Number.isFinite(this.sign.duration) ? this.sign.duration : Infinity;
    const target = Math.min(this.main.currentTime, duration);
    if (force || Math.abs(this.sign.currentTime - target) > DRIFT_TOLERANCE) {
      this.sign.currentTime = target;
    }
  }

  syncRate() {
    if (this.sign.playbackRate !== this.main.playbackRate) {
      this.sign.playbackRate = this.main.playbackRate;
    }
  }

  sync() {
    if (!this.enabled()) {
      this.pause();
      return;
    }
    this.syncPosition();
    this.syncRate();
    if (this.main.paused || this.main.ended || this.main.seeking) {
      this.pause();
      return;
    }
    this.sign.play().catch((error) => this.onState({ type: 'error', error }));
  }

  correctDrift() {
    if (!this.enabled() || this.main.paused || this.main.seeking) return;
    this.syncRate();
    this.syncPosition(false);
  }

  pause() {
    if (!this.sign.paused) this.sign.pause();
  }

  finish() {
    this.pause();
    this.syncPosition();
  }

  destroy() {
    this.pause();
    for (const [target, type, callback] of this.listeners) {
      target.removeEventListener(type, callback);
    }
    this.listeners = [];
  }
}
