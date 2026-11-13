import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPrefs, savePrefs, clampCaptionSize, DEFAULT_PREFS } from '../src/prefs.js';
import { captionCssVars } from '../src/caption-style.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
}

test('loadPrefs returns defaults when nothing is saved', () => {
  assert.deepEqual(loadPrefs(memoryStorage()), DEFAULT_PREFS);
});

test('saved preferences come back, merged with defaults', () => {
  const storage = memoryStorage();
  savePrefs({ ...DEFAULT_PREFS, captionSize: 200, uiLang: 'am' }, storage);
  const prefs = loadPrefs(storage);
  assert.equal(prefs.captionSize, 200);
  assert.equal(prefs.uiLang, 'am');
  assert.equal(prefs.signLayout, 'docked');
});

test('blocked or broken storage never throws', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadPrefs(blocked), DEFAULT_PREFS);
  assert.doesNotThrow(() => savePrefs(DEFAULT_PREFS, blocked));
  const broken = { getItem: () => '{not json', setItem() {} };
  assert.deepEqual(loadPrefs(broken), DEFAULT_PREFS);
});

test('caption size stays between 100% and 250% in 25% steps', () => {
  assert.equal(clampCaptionSize(50), 100);
  assert.equal(clampCaptionSize(260), 250);
  assert.equal(clampCaptionSize(160), 150);
});

test('caption CSS uses the preset colours and background opacity', () => {
  const vars = captionCssVars({ ...DEFAULT_PREFS, captionColours: 'yellow-on-black', captionBackground: 50, captionSize: 175 });
  assert.equal(vars['--fidel-caption-size'], '175%');
  assert.equal(vars['--fidel-caption-color'], '#ffff00');
  assert.equal(vars['--fidel-caption-bg'], 'rgb(0 0 0 / 0.5)');
});
