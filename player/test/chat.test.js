import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseZoomChat, anonymize } from '../src/chat.js';

// Same shape as a real Zoom export (Windows line endings, multi-line reply, reaction).
const SAMPLE = [
  '00:19:32\tNaod:\tSound is not clear',
  '00:19:50\tHeaven Y:\tReplying to "why frontend and bac..."',
  '',
  'It might come in a better module in 2027',
  '00:22:58\tLelisa:\tReacted to "It might come in a..." with 👍',
  '01:00:24\tEthel:\tdo we need to prepare a presentation?',
].join('\r\n');

test('parses times, names and multi-line messages; skips reactions', () => {
  const messages = parseZoomChat(SAMPLE);
  assert.equal(messages.length, 3);
  assert.deepEqual(messages[0], { time: 1172, name: 'Naod', text: 'Sound is not clear' });
  assert.equal(messages[1].text, 'Replying to "why frontend and bac..."\nIt might come in a better module in 2027');
  assert.equal(messages[2].time, 3624);
});

test('anonymize gives each person the same number every time', () => {
  const messages = anonymize([
    { time: 1, name: 'Abebe', text: 'a' },
    { time: 2, name: 'Sara', text: 'b' },
    { time: 3, name: 'Abebe', text: 'c' },
  ]);
  assert.deepEqual(messages.map((m) => m.name), ['Participant 1', 'Participant 2', 'Participant 1']);
});
