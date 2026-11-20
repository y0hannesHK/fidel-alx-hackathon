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

test('clears "loading" once the sign video is moving again after a short wait', () => {
  const main = new Media();
  const sign = new Media();
  const states = [];
  new SignSyncController(main, sign, { onState: (state) => states.push(state.type) });

  sign.paused = false;
  sign.emit('waiting');
  assert.deepEqual(states, ['loading']);

  // Paused or at the start: not proof that it plays.
  sign.paused = true;
  sign.currentTime = 4;
  sign.emit('timeupdate');
  assert.deepEqual(states, ['loading']);

  sign.paused = false;
  sign.emit('timeupdate');
  assert.deepEqual(states, ['loading', 'ready']);
});

test('canplay on the sign video does not jump it again when it is already in step (no seek loop)', () => {
  const main = new Media();
  const sign = new Media();
  new SignSyncController(main, sign);
  main.paused = false;
  main.currentTime = 30;
  sign.paused = false;
  sign.currentTime = 30.1;

  let seeks = 0;
  const realSign = sign;
  let time = realSign.currentTime;
  Object.defineProperty(realSign, 'currentTime', {
    get: () => time,
    set: (value) => { seeks += 1; time = value; },
  });
  for (let i = 0; i < 10; i += 1) sign.emit('canplay');
  assert.equal(seeks, 0);

  time = 25; // drifted: one correction
  sign.emit('canplay');
  assert.equal(seeks, 1);
  assert.equal(time, 30);
});

// "Wait for the signer": caption 1 (0-5 s) takes 9 s to sign; caption 2 fits.
const WAIT_TIMING = {
  cues: [
    { start: 0, next: 5, signStart: 0, signEnd: 9 },
    { start: 5, next: 10, signStart: 9, signEnd: 11 },
  ],
};

function waitSetup() {
  const main = new Media();
  const sign = new Media();
  const states = [];
  const controller = new SignSyncController(main, sign, { timing: WAIT_TIMING, onState: (s) => states.push(s.type) });
  main.paused = false;
  sign.paused = false;
  return { main, sign, states, controller };
}

test('wait mode: maps lesson time to the sign video\'s own timeline', () => {
  const { controller } = waitSetup();
  assert.equal(controller.signTimeFor(2), 2);
  assert.equal(controller.signTimeFor(6), 10); // caption 2 starts at sign time 9
});

test('wait mode: pauses the lesson before the next caption while the signer is still signing, then goes on', () => {
  const { main, sign, states } = waitSetup();
  main.currentTime = 4.8;
  sign.currentTime = 4.8;
  main.emit('timeupdate');
  assert.equal(main.paused, true, 'lesson waits');
  assert.ok(states.includes('waiting'));

  main.emit('pause'); // the lesson's own pause event must not stop the signer
  assert.equal(sign.paused, false);

  sign.currentTime = 7;
  sign.emit('timeupdate');
  assert.equal(main.paused, true, 'still signing caption 1');

  sign.currentTime = 9;
  sign.emit('timeupdate');
  assert.equal(main.currentTime, 5, 'lesson moves to caption 2');
  assert.equal(main.paused, false, 'and plays on');
  assert.equal(states.at(-1), 'ready');
});

test('wait mode: no wait when the signing fits in the caption\'s time', () => {
  const { main, sign, states } = waitSetup();
  main.currentTime = 9.8;
  sign.currentTime = 13.8;
  main.emit('timeupdate');
  assert.equal(main.paused, false);
  assert.ok(!states.includes('waiting'));
});

test('wait mode: Play during the wait skips to the next caption, signer included', () => {
  const { main, sign } = waitSetup();
  main.currentTime = 4.8;
  sign.currentTime = 5;
  main.emit('timeupdate');
  assert.equal(main.paused, true);

  main.paused = false; // the learner presses Play
  main.emit('play');
  assert.equal(main.currentTime, 5);
  main.emit('seeked');
  assert.equal(sign.currentTime, 9, 'signer jumps to caption 2');
});

test('wait mode: turning timing off goes back to the shared timeline', () => {
  const { controller } = waitSetup();
  controller.setTiming(null);
  assert.equal(controller.signTimeFor(6), 6);
});
