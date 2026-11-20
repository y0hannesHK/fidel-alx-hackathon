const DRIFT_TOLERANCE = 0.35;
// Pause the lesson this many seconds before the next caption starts, so the
// next caption is not shown while the signer is still on the previous one.
// ('timeupdate' arrives about every 0.25 s.)
const WAIT_LEAD = 0.3;
const WAIT_END_SLACK = 0.05;

/**
 * Keep a companion sign-language video aligned with its lesson video.
 *
 * Without timing, the sign video has the same timeline as the lesson.
 * With timing ("Wait for the signer"), the sign video has its own, longer
 * timeline: timing.cues = [{ start, next, signStart, signEnd }], where start
 * and next are lesson times (this caption, the next caption) and signStart /
 * signEnd say where this caption's signing is in the sign video. When the
 * lesson reaches `next` before the signer reaches `signEnd`, the lesson waits;
 * it goes on by itself when the signer is done. Play during the wait skips it.
 */
export class SignSyncController {
  constructor(main, sign, { enabled = () => true, onState = () => {}, timing = null } = {}) {
    this.main = main;
    this.sign = sign;
    this.enabled = enabled;
    this.onState = onState;
    this.listeners = [];
    this.cues = null;
    this.waiting = null; // index of the cue the lesson is waiting for
    this.resuming = false; // the controller itself is moving and restarting the lesson
    this.setTiming(timing);

    this.listen(main, 'play', () => this.onMainPlay());
    this.listen(main, 'playing', () => {
      const wasResuming = this.resuming;
      this.resuming = false;
      this.sync(!wasResuming);
    });
    this.listen(main, 'pause', () => {
      if (this.waiting === null && !this.resuming) this.pause();
    });
    this.listen(main, 'seeking', () => {
      if (this.resuming) return;
      this.cancelWait();
      this.pause();
    });
    this.listen(main, 'seeked', () => this.sync(!this.resuming));
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
      if (this.waiting === null) this.onState({ type: 'ready' });
      // Only move the sign video if it has drifted. Always moving it here made a
      // loop: every jump fires 'canplay' again (about 80 jumps a second).
      this.sync(false);
    });
    this.listen(sign, 'playing', () => {
      if (this.waiting === null) this.onState({ type: 'ready' });
    });
    // A short 'waiting' can happen while the sign video keeps playing, and no
    // 'playing' event follows. If its time moves on, it is playing: clear "Loading".
    this.listen(sign, 'timeupdate', () => {
      if (this.waiting !== null) {
        this.checkWaitDone();
        return;
      }
      if (!sign.paused && sign.currentTime > 0) this.onState({ type: 'ready' });
    });
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

  /** timing: { cues: [...] } or null (same timeline as the lesson). */
  setTiming(timing) {
    this.cancelWait();
    const cues = Array.isArray(timing?.cues) ? timing.cues : null;
    this.cues = cues && cues.length ? [...cues].sort((a, b) => a.start - b.start) : null;
  }

  /** Index of the caption the lesson time t is in (between its start and the next caption), or -1. */
  cueAt(t) {
    if (!this.cues) return -1;
    let found = -1;
    for (let i = 0; i < this.cues.length; i += 1) {
      if (this.cues[i].start <= t) found = i;
      else break;
    }
    return found;
  }

  /** Where the sign video should be for lesson time t. */
  signTimeFor(t) {
    const i = this.cueAt(t);
    if (i < 0) return t; // before the first caption, both timelines are the same
    const cue = this.cues[i];
    return cue.signStart + (t - cue.start);
  }

  syncPosition(force = true) {
    if (this.sign.readyState < 1 || !Number.isFinite(this.main.currentTime)) return;
    const duration = Number.isFinite(this.sign.duration) ? this.sign.duration : Infinity;
    const target = Math.min(this.signTimeFor(this.main.currentTime), duration);
    if (force || Math.abs(this.sign.currentTime - target) > DRIFT_TOLERANCE) {
      this.sign.currentTime = target;
    }
  }

  syncRate() {
    if (this.sign.playbackRate !== this.main.playbackRate) {
      this.sign.playbackRate = this.main.playbackRate;
    }
  }

  /** Match position, speed and play/pause. force: move the sign video even if
   *  it is already close (after the learner seeks or starts playing). */
  sync(force = true) {
    if (!this.enabled()) {
      this.pause();
      return;
    }
    if (this.waiting !== null) return; // the signer finishes on its own
    this.syncPosition(force);
    this.syncRate();
    if (this.main.paused || this.main.ended || this.main.seeking) {
      this.pause();
      return;
    }
    this.sign.play().catch((error) => this.onState({ type: 'error', error }));
  }

  onMainPlay() {
    if (this.waiting !== null && !this.resuming) {
      // The learner pressed Play during the wait: skip to the next caption.
      this.continueAfterWait({ skipped: true });
      return;
    }
    this.sync(!this.resuming);
  }

  correctDrift() {
    if (!this.enabled() || this.main.paused || this.main.seeking) return;
    this.syncRate();
    if (this.cues && this.waiting === null) {
      const i = this.cueAt(this.main.currentTime);
      const cue = this.cues[i];
      if (cue && cue.signEnd - cue.signStart > cue.next - cue.start + WAIT_END_SLACK
          && this.main.currentTime >= cue.next - WAIT_LEAD
          && this.sign.currentTime < cue.signEnd - WAIT_END_SLACK) {
        this.startWait(i);
        return;
      }
    }
    this.syncPosition(false);
  }

  startWait(index) {
    this.waiting = index;
    this.main.pause();
    if (this.sign.paused) this.sign.play().catch((error) => this.onState({ type: 'error', error }));
    this.onState({ type: 'waiting' });
  }

  checkWaitDone() {
    const cue = this.cues?.[this.waiting];
    if (!cue) return this.cancelWait();
    if (this.sign.currentTime >= cue.signEnd - WAIT_END_SLACK || this.sign.ended) this.continueAfterWait();
  }

  /** Move the lesson to the next caption and play on. The sign video is
   *  already where the next caption's signing begins. */
  continueAfterWait({ skipped = false } = {}) {
    const cue = this.cues?.[this.waiting];
    this.waiting = null;
    if (!cue) return;
    this.resuming = true;
    this.onState({ type: 'ready' });
    this.main.currentTime = cue.next;
    if (skipped) {
      // Bring the signer to the next caption too.
      this.resuming = false;
      this.sync(true);
      return;
    }
    this.main.play()?.catch?.(() => {
      this.resuming = false;
    });
  }

  cancelWait() {
    if (this.waiting === null) return;
    this.waiting = null;
    this.onState({ type: 'ready' });
  }

  pause() {
    if (!this.sign.paused) this.sign.pause();
  }

  finish() {
    this.cancelWait();
    this.pause();
    this.syncPosition();
  }

  destroy() {
    this.cancelWait();
    this.pause();
    for (const [target, type, callback] of this.listeners) {
      target.removeEventListener(type, callback);
    }
    this.listeners = [];
  }
}
