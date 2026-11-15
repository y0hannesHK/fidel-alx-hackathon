function findCue(cues, time) {
  let low = 0;
  let high = cues.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const cue = cues[middle];
    if (time < cue.start) high = middle - 1;
    else if (time >= cue.end) low = middle + 1;
    else return middle;
  }
  return -1;
}

/** Send English caption cues and playback events to the local Kozha BSL frame. */
export class KozhaSignSyncController {
  constructor(main, frame, targetOrigin, {
    enabled = () => true,
    onState = () => {},
    eventTarget = globalThis.window,
  } = {}) {
    this.main = main;
    this.frame = frame;
    this.targetOrigin = targetOrigin;
    this.enabled = enabled;
    this.onState = onState;
    this.eventTarget = eventTarget;
    this.cues = [];
    this.captionLanguage = 'en';
    this.unavailableMessage = '';
    this.currentIndex = null;
    this.ready = false;
    this.wasPlaying = false;
    this.listeners = [];

    this.listen(main, 'play', () => this.sync());
    this.listen(main, 'playing', () => this.sync());
    this.listen(main, 'pause', () => this.pause('paused'));
    this.listen(main, 'seeking', () => this.pause('seeking'));
    this.listen(main, 'seeked', () => this.sync(true));
    this.listen(main, 'ratechange', () => this.syncRate());
    this.listen(main, 'timeupdate', () => this.updateCue());
    this.listen(main, 'waiting', () => this.pause('buffering'));
    this.listen(main, 'stalled', () => this.pause('buffering'));
    this.listen(main, 'ended', () => this.finish());
    this.listen(main, 'error', () => {
      this.pause('video error');
      this.onState({ type: 'error', message: 'The lesson video could not be played.' });
    });

    this.onFrameMessage = (event) => {
      if (event.source !== this.frame || event.origin !== this.targetOrigin) return;
      if (event.data?.channel !== 'fidel-kozha') return;
      if (event.data.type === 'kozha-ready') {
        this.ready = true;
        this.currentIndex = null;
        this.onState({ type: 'ready' });
        this.send('init', {
          cueCount: this.cues.length,
          language: this.captionLanguage,
          unavailableMessage: this.unavailableMessage,
        });
        this.sync(true);
      } else if (event.data.type === 'kozha-state') {
        this.onState({ type: event.data.state, message: event.data.message });
      }
    };
    eventTarget?.addEventListener('message', this.onFrameMessage);
  }

  listen(target, type, callback) {
    target.addEventListener(type, callback);
    this.listeners.push([target, type, callback]);
  }

  setCues(cues, { language = 'en', unavailableMessage = '' } = {}) {
    this.cues = Array.isArray(cues) ? cues : [];
    this.captionLanguage = language;
    this.unavailableMessage = unavailableMessage;
    this.currentIndex = null;
    if (!this.ready) return;
    this.send('init', {
      cueCount: this.cues.length,
      language: this.captionLanguage,
      unavailableMessage: this.unavailableMessage,
    });
    this.sync(true);
  }

  setEnabled(enabled) {
    if (enabled) this.sync(true);
    else this.pause('hidden');
  }

  send(type, details = {}) {
    if (!this.ready) return;
    try {
      this.frame.postMessage({ channel: 'fidel-kozha', type, ...details }, this.targetOrigin);
    } catch (error) {
      this.onState({ type: 'error', message: `Could not contact the local Kozha service: ${error.message}` });
    }
  }

  updateCue(force = false) {
    if (!this.ready || !this.enabled()) return;
    const index = findCue(this.cues, this.main.currentTime);
    if (!force && index === this.currentIndex) return;
    this.currentIndex = index;
    const cue = this.cues[index];
    this.send('cue', {
      index,
      text: cue?.text || '',
      language: this.captionLanguage,
      start: cue?.start ?? 0,
      end: cue?.end ?? 0,
      currentTime: this.main.currentTime,
      playbackRate: this.main.playbackRate,
      playing: !this.main.paused && !this.main.ended && !this.main.seeking,
    });
    this.wasPlaying = !this.main.paused && !this.main.ended && !this.main.seeking;
  }

  sync(forceCue = false) {
    if (!this.enabled()) {
      this.pause('hidden');
      return;
    }
    const index = findCue(this.cues, this.main.currentTime);
    const changed = forceCue || index !== this.currentIndex;
    if (changed) this.updateCue(true);
    const shouldPlay = !this.main.paused && !this.main.ended && !this.main.seeking;
    if (!shouldPlay) {
      this.pause(this.main.ended ? 'ended' : 'paused');
    } else if (!changed && !this.wasPlaying && index >= 0) {
      this.send('play', {
        currentTime: this.main.currentTime,
        playbackRate: this.main.playbackRate,
      });
      this.wasPlaying = true;
    }
  }

  syncRate() {
    this.send('rate', {
      currentTime: this.main.currentTime,
      playbackRate: this.main.playbackRate,
    });
  }

  pause(reason) {
    this.send('pause', { currentTime: this.main.currentTime, reason });
    this.wasPlaying = false;
  }

  finish() {
    this.send('ended', { currentTime: this.main.currentTime });
    this.wasPlaying = false;
  }

  destroy() {
    this.pause('destroyed');
    for (const [target, type, callback] of this.listeners) {
      target.removeEventListener(type, callback);
    }
    this.eventTarget?.removeEventListener('message', this.onFrameMessage);
    this.listeners = [];
  }
}
