// Times in words for screen readers ("1:23" sounds like a number).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spokenTime } from '../src/spoken-time.js';

test('times in words, English', () => {
  assert.equal(spokenTime(83.5), '1 minute 23 seconds');
  assert.equal(spokenTime(60), '1 minute');
  assert.equal(spokenTime(1), '1 second');
  assert.equal(spokenTime(3723), '1 hour 2 minutes 3 seconds');
  assert.equal(spokenTime(0), '0 seconds');
  assert.equal(spokenTime(-5), '0 seconds');
});

test('times in words, Amharic', () => {
  assert.equal(spokenTime(83, 'am'), '1 ደቂቃ 23 ሰከንድ');
  assert.equal(spokenTime(120, 'am'), '2 ደቂቃ');
});
