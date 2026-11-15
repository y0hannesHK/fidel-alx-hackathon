// Unit tests for Package A's pure logic (player/src/components/a/logic.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fill, parseTime, formatTime, indentOf, spellSymbols, describeLine, codeLines,
  splitSentences, currentIndex, cleanStepState,
} from '../src/components/a/logic.js';

const en = JSON.parse(readFileSync(new URL('../i18n/components-a.en.json', import.meta.url), 'utf8'));
const am = JSON.parse(readFileSync(new URL('../i18n/components-a.am.json', import.meta.url), 'utf8'));

test('language files have the same keys and symbols', () => {
  assert.deepEqual(Object.keys(am).sort(), Object.keys(en).sort());
  assert.deepEqual(Object.keys(am.symbolWords).sort(), Object.keys(en.symbolWords).sort());
});

test('fill puts values into placeholders', () => {
  assert.equal(fill('Line {n} of {total}', { n: 2, total: 3 }), 'Line 2 of 3');
  assert.equal(fill('{missing}!'), '!');
});

test('times: parse and format', () => {
  assert.equal(parseTime('1:23'), 83);
  assert.equal(parseTime('0:45'), 45);
  assert.equal(parseTime('45'), 45);
  assert.equal(parseTime('1:02:03'), 3723);
  assert.equal(parseTime('abc'), null);
  assert.equal(parseTime(''), null);
  assert.equal(parseTime(null), null);
  assert.equal(formatTime(83), '1:23');
  assert.equal(formatTime(5), '0:05');
  assert.equal(formatTime(3723), '1:02:03');
});

test('indent counting', () => {
  assert.deepEqual(indentOf('    print(i)'), { spaces: 4, tabs: 0, rest: 'print(i)' });
  assert.deepEqual(indentOf('\t\tx'), { spaces: 0, tabs: 2, rest: 'x' });
  assert.deepEqual(indentOf('x'), { spaces: 0, tabs: 0, rest: 'x' });
});

test('symbols are spelled in words, longest first', () => {
  assert.equal(spellSymbols('print(i)', en.symbolWords), 'print open bracket i close bracket');
  assert.equal(spellSymbols('if a == b:', en.symbolWords), 'if a double equals b colon');
  assert.equal(spellSymbols('x = 1', en.symbolWords), 'x equals 1');
  assert.equal(spellSymbols('<p>', en.symbolWords), 'less than p greater than');
  assert.equal(spellSymbols('print(i)', am.symbolWords), 'print የመክፈቻ ቅንፍ i የመዝጊያ ቅንፍ');
});

test('a line is described with its number, indent and words', () => {
  assert.equal(describeLine('    print(i)', 2, 3, en), 'Line 2 of 3, indent 4 spaces: print open bracket i close bracket');
  assert.equal(describeLine('    print(i)', 2, 3, en, { symbols: false }), 'Line 2 of 3, indent 4 spaces: print(i)');
  assert.equal(describeLine(' x', 1, 1, en, { symbols: false }), 'Line 1 of 1, indent 1 space: x');
  assert.equal(describeLine('\tx', 1, 1, en, { symbols: false }), 'Line 1 of 1, indent 1 tab: x');
  assert.equal(describeLine('   ', 3, 3, en), 'Line 3 of 3: blank line');
  assert.equal(describeLine('    print(i)', 2, 3, am, { symbols: false }), 'መስመር 2 ከ3, 4 ክፍተት ገብ: print(i)');
});

test('code lines drop the empty first and last lines from markup', () => {
  assert.deepEqual(codeLines('\nfor i in x:\n    y\n  '), ['for i in x:', '    y']);
  assert.deepEqual(codeLines('a\r\n\r\nb'), ['a', '', 'b']);
  assert.deepEqual(codeLines(''), ['']);
});

test('sentences: English and Ethiopic punctuation', () => {
  const text = 'One. Two? Three';
  assert.deepEqual(splitSentences(text).map(([s, e]) => text.slice(s, e)), ['One.', 'Two?', 'Three']);
  const amText = 'ሰላም ነው። እንዴት ነህ፧ ደህና';
  assert.deepEqual(splitSentences(amText).map(([s, e]) => amText.slice(s, e)), ['ሰላም ነው።', 'እንዴት ነህ፧', 'ደህና']);
  assert.deepEqual(splitSentences('   '), []);
});

test('current snapshot at a time', () => {
  const times = [45, 83, 120];
  assert.equal(currentIndex(times, 10), -1);
  assert.equal(currentIndex(times, 45), 0);
  assert.equal(currentIndex(times, 100), 1);
  assert.equal(currentIndex(times, 500), 2);
});

test('saved step progress is cleaned', () => {
  assert.deepEqual(cleanStepState({ current: 2, done: [0, 1, 1, 9, 'x'] }, 3), { current: 2, done: [0, 1] });
  assert.deepEqual(cleanStepState({ current: 7 }, 3), { current: 0, done: [] });
  assert.deepEqual(cleanStepState(null, 3), { current: 0, done: [] });
});
