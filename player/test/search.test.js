import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchCues, splitMatches } from '../src/search.js';

const tracks = [
  { lang: 'en', cues: [
    { start: 10, end: 12, text: 'Tech education is the ultimate equalizer' },
    { start: 2, end: 4, text: 'People with DISABILITY and refugees' },
  ] },
  { lang: 'am', cues: [{ start: 5, end: 8, text: 'አካል ጉዳተኞችን እና ስደተኞችን' }] },
];

test('search ignores case and returns results sorted by time', () => {
  const results = searchCues(tracks, 'disability');
  assert.equal(results.length, 1);
  assert.equal(results[0].start, 2);
  assert.equal(results[0].lang, 'en');
});

test('search finds Amharic text', () => {
  const results = searchCues(tracks, 'ስደተኞችን');
  assert.deepEqual(results.map((r) => [r.lang, r.start]), [['am', 5]]);
});

test('empty or blank search returns nothing', () => {
  assert.deepEqual(searchCues(tracks, '   '), []);
});

test('splitMatches marks every match and keeps the original case', () => {
  assert.deepEqual(splitMatches('Tech and tech', 'TECH'), [
    { text: 'Tech', match: true },
    { text: ' and ', match: false },
    { text: 'tech', match: true },
  ]);
});
