import assert from 'node:assert/strict';
import test from 'node:test';
import { SignSyncController } from '../src/sign-sync.js';

class Media extends EventTarget {
  constructor() {
    super();
    this.currentTime = 0;
    this.duration = 120;
    this.readyState = 2;
    this.playbackRate = 1;
    this.paused = true;
    this.seeking = false;
    this.ended = false;
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  emit(type) {
    this.dispatchEvent(new Event(type));
  }
}

test('mirrors play, pause, seeking and playback-rate changes', () => {
  const main = new Media();
  const sign = new Media();
  const controller = new SignSyncController(main, sign);

  main.currentTime = 12;
  main.playbackRate = 1.5;
  main.paused = false;
  main.emit('play');
  assert.equal(sign.currentTime, 12);
  assert.equal(sign.playbackRate, 1.5);
  assert.equal(sign.paused, false);

  main.emit('pause');
  assert.equal(sign.paused, true);

  main.seeking = true;
  main.emit('seeking');
  assert.equal(sign.paused, true);
  main.currentTime = 37;
  main.seeking = false;
  main.emit('seeked');
  assert.equal(sign.currentTime, 37);
  assert.equal(sign.paused, false);

  controller.destroy();
});

test('corrects significant drift on timeupdate and pauses through buffering', () => {
  const main = new Media();
  const sign = new Media();
  const controller = new SignSyncController(main, sign);

  main.paused = false;
  sign.paused = false;
  main.currentTime = 8;
  sign.currentTime = 7.8;
  main.emit('timeupdate');
  assert.equal(sign.currentTime, 7.8);

  sign.currentTime = 7;
  main.emit('timeupdate');
  assert.equal(sign.currentTime, 8);

  main.emit('waiting');
  assert.equal(sign.paused, true);
  main.emit('playing');
  assert.equal(sign.paused, false);
  controller.destroy();
});

test('waits for sign metadata before seeking to the current lesson time', () => {
  const main = new Media();
  const sign = new Media();
  const controller = new SignSyncController(main, sign);

  main.currentTime = 19;
  main.paused = false;
  sign.readyState = 0;
  main.emit('play');
  assert.equal(sign.currentTime, 0);

  sign.readyState = 1;
  sign.emit('loadedmetadata');
  assert.equal(sign.currentTime, 19);
  assert.equal(sign.paused, false);
  controller.destroy();
});

test('keeps hidden sign media paused, and stops it when the lesson ends', () => {
  const main = new Media();
  const sign = new Media();
  let visible = false;
  const controller = new SignSyncController(main, sign, { enabled: () => visible });

  main.paused = false;
  main.emit('play');
  assert.equal(sign.paused, true);

  visible = true;
  controller.sync();
  assert.equal(sign.paused, false);

  main.currentTime = 120;
  main.ended = true;
  main.emit('ended');
  assert.equal(sign.currentTime, 120);
  assert.equal(sign.paused, true);
  controller.destroy();
});

test('reports sign-media errors and removes listeners on destroy', () => {
  const main = new Media();
  const sign = new Media();
  const states = [];
  const controller = new SignSyncController(main, sign, { onState: (state) => states.push(state.type) });

  sign.emit('error');
  assert.deepEqual(states, ['error']);

  controller.destroy();
  main.paused = false;
  main.emit('play');
  assert.equal(sign.paused, true);
});
