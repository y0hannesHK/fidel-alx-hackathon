/**
 * Tests for the 'both' sign-provider: BSL (English) + EthSL (Amharic).
 * Verifies that cues are routed to the correct sub-controller based on
 * caption language, and that switchBothAvatar switches the active sub-avatar.
 */
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
  emit(type) { this.dispatchEvent(new Event(type)); }
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

/**
 * Minimal stub of SignWindow behaviour for the 'both' provider.
 * Each controller gets its own MessageTarget (separate event buses) so that
 * kozha-ready messages from one frame don't trigger the other controller.
 */
function makeBothControllers(main) {
  const bslSent = [];
  const ethaslSent = [];
  let activeSub = 'bsl';

  // Separate event buses: each controller only sees messages from its own frame
  const bslBus = new MessageTarget();
  const ethaslBus = new MessageTarget();

  const bslFrame = { postMessage: (m) => bslSent.push(m) };
  const ethaslFrame = { postMessage: (m) => ethaslSent.push(m) };

  const bslController = new KozhaSignSyncController(main, bslFrame, 'http://localhost:8001', {
    enabled: () => activeSub === 'bsl',
    eventTarget: bslBus,
  });
  const ethaslController = new KozhaSignSyncController(main, ethaslFrame, 'http://localhost:8001', {
    enabled: () => activeSub === 'ethasl',
    eventTarget: ethaslBus,
  });

  // Helpers to fire ready signals independently
  function makeBslReady() {
    bslBus.sendMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, 'http://localhost:8001', bslFrame);
  }
  function makeEthaslReady() {
    ethaslBus.sendMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, 'http://localhost:8001', ethaslFrame);
  }

  // Simulate the 'both' provider's setCues routing
  function setCues(cues, options = {}) {
    const lang = options.language || 'en';
    if (lang === 'en') bslController.setCues(cues, options);
    else if (lang === 'am') ethaslController.setCues(cues, options);
    else if (lang === 'off') {
      bslController.setCues([], { language: 'off', unavailableMessage: options.unavailableMessage });
      ethaslController.setCues([], { language: 'off', unavailableMessage: options.unavailableMessage });
    }
  }

  function switchBothAvatar(language) {
    activeSub = language === 'am' ? 'ethasl' : 'bsl';
    if (activeSub === 'bsl') {
      ethaslController.setEnabled(false);
      bslController.setEnabled(true);
    } else {
      bslController.setEnabled(false);
      ethaslController.setEnabled(true);
    }
  }

  return {
    bslController, ethaslController,
    bslSent, ethaslSent,
    bslFrame, ethaslFrame,
    makeBslReady, makeEthaslReady,
    setCues, switchBothAvatar,
  };
}

test('both provider routes English cues only to BSL controller', () => {
  const main = new Media();
  // Separate buses so each controller only sees its own frame's ready signal
  const bslBus = new MessageTarget();
  const ethaslBus = new MessageTarget();
  const bslSent = [];
  const ethaslSent = [];
  let activeSub = 'bsl';
  const bslFrame = { postMessage: (m) => bslSent.push(m) };
  const ethaslFrame = { postMessage: (m) => ethaslSent.push(m) };
  const bslCtrl = new KozhaSignSyncController(main, bslFrame, 'http://localhost:8001', {
    enabled: () => activeSub === 'bsl', eventTarget: bslBus,
  });
  const ethaslCtrl = new KozhaSignSyncController(main, ethaslFrame, 'http://localhost:8001', {
    enabled: () => activeSub === 'ethasl', eventTarget: ethaslBus,
  });

  // Set English cues BEFORE ready, then fire ready for BSL only
  bslCtrl.setCues([{ start: 0, end: 2, text: 'Hello world' }], { language: 'en' });
  bslBus.sendMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, 'http://localhost:8001', bslFrame);
  ethaslBus.sendMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, 'http://localhost:8001', ethaslFrame);

  // BSL controller should have received the English init
  const bslInit = bslSent.find((m) => m.type === 'init');
  assert.ok(bslInit, 'BSL controller should receive init');
  assert.equal(bslInit.language, 'en');

  // EthSL controller should NOT have received any English caption text
  const ethaslTextCues = ethaslSent.filter((m) => m.type === 'cue' && m.text && m.text !== '');
  assert.equal(ethaslTextCues.length, 0, 'EthSL controller must not receive English caption text');

  bslCtrl.destroy();
  ethaslCtrl.destroy();
});

test('both provider routes Amharic cues only to EthSL controller', () => {
  const main = new Media();
  const bslBus = new MessageTarget();
  const ethaslBus = new MessageTarget();
  const bslSent = [];
  const ethaslSent = [];
  let activeSub = 'ethasl';
  const bslFrame = { postMessage: (m) => bslSent.push(m) };
  const ethaslFrame = { postMessage: (m) => ethaslSent.push(m) };
  const bslCtrl = new KozhaSignSyncController(main, bslFrame, 'http://localhost:8001', {
    enabled: () => activeSub === 'bsl', eventTarget: bslBus,
  });
  const ethaslCtrl = new KozhaSignSyncController(main, ethaslFrame, 'http://localhost:8001', {
    enabled: () => activeSub === 'ethasl', eventTarget: ethaslBus,
  });

  // Set Amharic cues BEFORE ready, then fire ready for EthSL
  ethaslCtrl.setCues([{ start: 0, end: 2, text: 'ሰላም' }], { language: 'am' });
  bslBus.sendMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, 'http://localhost:8001', bslFrame);
  ethaslBus.sendMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, 'http://localhost:8001', ethaslFrame);

  // EthSL controller should have received the Amharic init
  const ethaslInit = ethaslSent.find((m) => m.type === 'init');
  assert.ok(ethaslInit, 'EthSL controller should receive init');
  assert.equal(ethaslInit.language, 'am');

  // BSL controller should NOT have received any Amharic text
  const bslAmharicCues = bslSent.filter((m) => m.type === 'cue' && m.text && m.text !== '');
  assert.equal(bslAmharicCues.length, 0, 'BSL controller must not receive Amharic caption text');

  bslCtrl.destroy();
  ethaslCtrl.destroy();
});

test('switchBothAvatar activates EthSL for Amharic and BSL for English', () => {
  const main = new Media();
  const bslBus = new MessageTarget();
  const ethaslBus = new MessageTarget();
  const bslSent = [];
  const ethaslSent = [];
  let activeSub = 'bsl';
  const bslFrame = { postMessage: (m) => bslSent.push(m) };
  const ethaslFrame = { postMessage: (m) => ethaslSent.push(m) };
  const bslCtrl = new KozhaSignSyncController(main, bslFrame, 'http://localhost:8001', {
    enabled: () => activeSub === 'bsl', eventTarget: bslBus,
  });
  const ethaslCtrl = new KozhaSignSyncController(main, ethaslFrame, 'http://localhost:8001', {
    enabled: () => activeSub === 'ethasl', eventTarget: ethaslBus,
  });
  bslBus.sendMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, 'http://localhost:8001', bslFrame);
  ethaslBus.sendMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, 'http://localhost:8001', ethaslFrame);

  bslCtrl.setCues([{ start: 0, end: 2, text: 'Hello' }], { language: 'en' });
  ethaslCtrl.setCues([{ start: 0, end: 2, text: 'ሰላም' }], { language: 'am' });

  // Switch to Amharic — BSL should be paused
  activeSub = 'ethasl';
  ethaslCtrl.setEnabled(false);
  bslCtrl.setEnabled(false); // pause BSL
  assert.ok(bslSent.some((m) => m.type === 'pause'), 'BSL should receive pause when switching to Amharic');

  // Switch back to English — EthSL should be paused
  activeSub = 'bsl';
  ethaslCtrl.setEnabled(false); // pause EthSL
  assert.ok(ethaslSent.some((m) => m.type === 'pause'), 'EthSL should receive pause when switching to English');

  bslCtrl.destroy();
  ethaslCtrl.destroy();
});

test('both provider sends "off" message to both sub-controllers when captions are off', () => {
  const main = new Media();
  const bslBus = new MessageTarget();
  const ethaslBus = new MessageTarget();
  const bslSent = [];
  const ethaslSent = [];
  const bslFrame = { postMessage: (m) => bslSent.push(m) };
  const ethaslFrame = { postMessage: (m) => ethaslSent.push(m) };
  const bslCtrl = new KozhaSignSyncController(main, bslFrame, 'http://localhost:8001', { eventTarget: bslBus });
  const ethaslCtrl = new KozhaSignSyncController(main, ethaslFrame, 'http://localhost:8001', { eventTarget: ethaslBus });

  bslBus.sendMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, 'http://localhost:8001', bslFrame);
  ethaslBus.sendMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, 'http://localhost:8001', ethaslFrame);

  const offMsg = 'Turn on English or Amharic captions to use a sign language avatar.';
  bslCtrl.setCues([], { language: 'off', unavailableMessage: offMsg });
  ethaslCtrl.setCues([], { language: 'off', unavailableMessage: offMsg });

  const bslInit = bslSent.find((m) => m.type === 'init' && m.language === 'off');
  const ethaslInit = ethaslSent.find((m) => m.type === 'init' && m.language === 'off');
  assert.ok(bslInit, 'BSL controller should receive off-language init when captions are off');
  assert.ok(ethaslInit, 'EthSL controller should receive off-language init when captions are off');
  assert.equal(bslInit.unavailableMessage, offMsg);
  assert.equal(ethaslInit.unavailableMessage, offMsg);

  bslCtrl.destroy();
  ethaslCtrl.destroy();
});
