import assert from 'node:assert/strict';
import test from 'node:test';
import { KozhaSignSyncController } from '../src/kozha-sign-sync.js';

class Media extends EventTarget {
  constructor() {
    super();
    this.currentTime = 0;
    this.playbackRate = 1;
    this.paused = true;
    this.seeking = false;
    this.ended = false;
  }

  emit(type) {
    this.dispatchEvent(new Event(type));
  }
}

class MessageTarget extends EventTarget {
  sendMessage(data, origin, source) {
    const event = new Event('message');
    Object.defineProperties(event, {
      data: { value: data },
      origin: { value: origin },
      source: { value: source },
    });
    this.dispatchEvent(event);
  }
}

test('sends matching English caption cues and playback events to the ready local frame', () => {
  const main = new Media();
  const window = new MessageTarget();
  const sent = [];
  const frame = { postMessage: (message, origin) => sent.push({ message, origin }) };
  const controller = new KozhaSignSyncController(main, frame, 'http://localhost:8001', {
    eventTarget: window,
  });
  controller.setCues([
    { start: 0, end: 2, text: 'First caption' },
    { start: 2, end: 4, text: 'Second caption' },
  ]);
  window.sendMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, 'http://localhost:8001', frame);

  assert.equal(sent[0].message.type, 'init');
  assert.equal(sent[1].message.type, 'cue');
  assert.equal(sent[1].message.text, 'First caption');
  assert.equal(sent[1].message.playing, false);

  main.currentTime = 2.5;
  main.paused = false;
  main.emit('play');
  const afterPlay = sent.length;
  main.emit('playing');
  assert.equal(sent.length, afterPlay);
  main.emit('timeupdate');
  assert.equal(sent.at(-1).message.text, 'Second caption');
  assert.equal(sent.at(-1).message.playing, true);

  main.playbackRate = 1.5;
  main.emit('ratechange');
  assert.equal(sent.at(-1).message.type, 'rate');
  assert.equal(sent.at(-1).message.playbackRate, 1.5);

  main.emit('pause');
  assert.equal(sent.at(-1).message.type, 'pause');
  controller.destroy();
});

test('seeking, hiding, resuming and ending update the frame without a playback timer', () => {
  const main = new Media();
  const window = new MessageTarget();
  const sent = [];
  const frame = { postMessage: (message) => sent.push(message) };
  let visible = true;
  const controller = new KozhaSignSyncController(main, frame, 'http://localhost:8001', {
    enabled: () => visible,
    eventTarget: window,
  });
  controller.setCues([{ start: 5, end: 8, text: 'Current caption' }]);
  window.sendMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, 'http://localhost:8001', frame);

  main.currentTime = 6;
  main.seeking = true;
  main.emit('seeking');
  assert.equal(sent.at(-1).type, 'pause');

  main.seeking = false;
  main.paused = false;
  main.emit('seeked');
  assert.equal(sent.at(-1).type, 'cue');
  assert.equal(sent.at(-1).text, 'Current caption');

  visible = false;
  controller.setEnabled(false);
  assert.equal(sent.at(-1).type, 'pause');

  visible = true;
  controller.setEnabled(true);
  assert.equal(sent.at(-1).type, 'cue');
  main.ended = true;
  main.emit('ended');
  assert.equal(sent.at(-1).type, 'ended');

  controller.destroy();
  const count = sent.length;
  main.emit('play');
  assert.equal(sent.length, count);
});

test('ignores messages from other frames and origins', () => {
  const main = new Media();
  const window = new MessageTarget();
  const frame = { postMessage() {} };
  const otherFrame = {};
  const states = [];
  const controller = new KozhaSignSyncController(main, frame, 'http://localhost:8001', {
    eventTarget: window,
    onState: (state) => states.push(state),
  });

  window.sendMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, 'http://localhost:8001', otherFrame);
  window.sendMessage({ channel: 'fidel-kozha', type: 'kozha-state', state: 'error' }, 'http://evil.example', frame);
  assert.equal(controller.ready, false);
  assert.deepEqual(states, []);
  controller.destroy();
});

test('never sends Amharic caption text to the English-only BSL avatar', () => {
  const main = new Media();
  const window = new MessageTarget();
  const sent = [];
  const frame = { postMessage: (message) => sent.push(message) };
  const controller = new KozhaSignSyncController(main, frame, 'http://localhost:8001', {
    eventTarget: window,
  });
  controller.setCues([], {
    language: 'am',
    unavailableMessage: 'Amharic sign output is unavailable.',
  });
  window.sendMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, 'http://localhost:8001', frame);

  assert.equal(sent.find((message) => message.type === 'init').language, 'am');
  assert.equal(sent.find((message) => message.type === 'cue').language, 'am');
  assert.equal(sent.find((message) => message.type === 'cue').text, '');

  controller.setCues([{ start: 0, end: 2, text: 'English caption' }], { language: 'en' });
  const englishCue = sent.filter((message) => message.type === 'cue').at(-1);
  assert.equal(englishCue.language, 'en');
  assert.equal(englishCue.text, 'English caption');
  controller.destroy();
});
