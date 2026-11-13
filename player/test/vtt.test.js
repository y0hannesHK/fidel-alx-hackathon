import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVtt, parseTimestamp, formatTime } from '../src/vtt.js';

test('parseTimestamp handles hours and short forms', () => {
  assert.equal(parseTimestamp('00:01:33.500'), 93.5);
  assert.equal(parseTimestamp('01:33.500'), 93.5);
  assert.equal(parseTimestamp('01:00:00.000'), 3600);
});

test('parseVtt reads cues, joins lines and skips NOTE blocks', () => {
  const vtt = `WEBVTT

NOTE
This is a comment
00:00:01.000 --> 00:00:02.000 (inside a NOTE, so not a cue)

1
00:00:03.000 --> 00:00:05.500 align:start
First line
<i>second</i> line

00:01:00.000 --> 00:01:02.000
ሰላም ለሁሉም
`;
  const cues = parseVtt(vtt);
  assert.deepEqual(cues.at(-2), { start: 3, end: 5.5, text: 'First line\nsecond line' });
  assert.deepEqual(cues.at(-1), { start: 60, end: 62, text: 'ሰላም ለሁሉም' });
});

test('parseVtt accepts Windows line endings', () => {
  const cues = parseVtt('WEBVTT\r\n\r\n00:00:01.000 --> 00:00:02.000\r\nHello\r\n');
  assert.deepEqual(cues, [{ start: 1, end: 2, text: 'Hello' }]);
});

test('formatTime gives m:ss or h:mm:ss', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(93.9), '1:33');
  assert.equal(formatTime(3725), '1:02:05');
});
