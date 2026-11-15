// Fidel forms: pure logic. Times (mm:ss), Ethiopian phone numbers, email,
// the keyboard-language hint, typing echo, files, drafts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMmss, formatMmss, parsePhoneEt, isEmail, checkFormat, normalise,
  scriptCounts, keyboardHint, capsWarningDefault, echoText,
  parseSize, sizeText, fileAccepted, acceptKinds, extensionOf,
  nameList, draftData, entriesToObject, readStored, writeStored,
} from '../src/components/forms/logic.js';

test('parseMmss reads minutes:seconds and plain seconds', () => {
  assert.equal(parseMmss('1:23.5'), 83.5);
  assert.equal(parseMmss('83.5'), 83.5);
  assert.equal(parseMmss('0:05'), 5);
  assert.equal(parseMmss(' 2:00 '), 120);
  assert.equal(parseMmss('1:02:03'), 3723);
});

test('parseMmss refuses what is not a time', () => {
  for (const bad of ['abc', '1:75', '-1', '', '   ', '1:', ':5', '1:2:3:4', '1,5', null, undefined]) {
    assert.equal(parseMmss(bad), null, String(bad));
  }
});

test('formatMmss writes times back', () => {
  assert.equal(formatMmss(83.5), '1:23.5');
  assert.equal(formatMmss(5), '0:05');
  assert.equal(formatMmss(600), '10:00');
});

test('Ethiopian phone numbers in every common form are normalised', () => {
  for (const ok of ['0911234567', '0711234567', '+251911234567', '251911234567', '0911 234 567', '+251 91 123 4567', '(0911) 23-45-67']) {
    assert.match(parsePhoneEt(ok), /^\+251[79]\d{8}$/, ok);
  }
  assert.equal(parsePhoneEt('0911 234567'), '+251911234567');
  assert.equal(parsePhoneEt('0711234567'), '+251711234567');
  assert.equal(parsePhoneEt('251 711 234 567'), '+251711234567');
});

test('wrong phone numbers are refused', () => {
  for (const bad of ['12345', '0811234567', '091123456', '09112345678', '+1 911 234 5678', 'abc', '', '09-11-ab-cd', '+251+911234567']) {
    assert.equal(parsePhoneEt(bad), null, bad);
  }
});

test('email check', () => {
  assert.ok(isEmail('name@example.com'));
  assert.ok(isEmail(' a.b@mail.example.org '));
  for (const bad of ['name', 'name@', '@example.com', 'name@example', 'a b@example.com', '']) assert.ok(!isEmail(bad), bad);
});

test('checkFormat gives the error key, and an empty value is never a format error', () => {
  assert.equal(checkFormat('mmss', 'abc'), 'mmss');
  assert.equal(checkFormat('mmss', '1:23.5'), null);
  assert.equal(checkFormat('mmss', '1:'), 'mmss');
  assert.equal(checkFormat('phone-et', '12345'), 'phone');
  assert.equal(checkFormat('email', 'x@'), 'email');
  assert.equal(checkFormat('email', ''), null);
  assert.equal(checkFormat(null, 'AB12', '[A-Z]{2}\\d{2}'), null);
  assert.equal(checkFormat(null, 'AB1', '[A-Z]{2}\\d{2}'), 'pattern');
  assert.equal(checkFormat(null, 'x', '(broken'), null); // a broken pattern never blocks the form
  assert.equal(normalise('phone-et', '0911 234567'), '+251911234567');
  assert.equal(normalise('phone-et', 'abc'), 'abc');
});

test('script counts', () => {
  assert.deepEqual(scriptCounts('ሰላም HTML'), { ethiopic: 3, latin: 4 });
  assert.deepEqual(scriptCounts('፣ ። 123'), { ethiopic: 0, latin: 0 });
});

test('keyboard hint: Latin letters in an Amharic field', () => {
  assert.equal(keyboardHint('selam ', 'am'), 'am');
  assert.equal(keyboardHint('hello ', 'am'), 'am');
  assert.equal(keyboardHint('selam', 'am'), null, 'the word is not finished yet');
  assert.equal(keyboardHint('ok ', 'am'), null, 'two letters is not a word');
  assert.equal(keyboardHint('selam ', 'ti'), 'ti');
  assert.equal(keyboardHint('selamnew', 'am-ET'), null);
  assert.equal(keyboardHint('selamnewdehna', 'am'), 'am', '12+ letters, all Latin');
});

test('keyboard hint: never for a Latin word inside Ethiopic text', () => {
  assert.equal(keyboardHint('ሰላም HTML ነው', 'am'), null);
  assert.equal(keyboardHint('ሰላም HTML ', 'am'), null);
  assert.equal(keyboardHint('git ሰላም ', 'am'), null);
  assert.equal(keyboardHint('selam ሰ', 'am'), null, 'cleared once Ethiopic appears');
});

test('keyboard hint: mirror in an English field, none for other languages', () => {
  assert.equal(keyboardHint('ሰላም ', 'en'), 'en');
  assert.equal(keyboardHint('ሰላም', 'en'), null);
  assert.equal(keyboardHint('I said ሰላም ', 'en'), null);
  for (const lang of ['om', 'so', 'ar', '', undefined]) assert.equal(keyboardHint('selam ', lang), null, String(lang));
});

test('Caps Lock warning by default only for Latin-script fields', () => {
  assert.equal(capsWarningDefault('en'), true);
  assert.equal(capsWarningDefault('om'), true);
  assert.equal(capsWarningDefault('am'), false);
  assert.equal(capsWarningDefault('ti'), false);
});

test('typing echo: letters and finished words', () => {
  assert.equal(echoText('characters', { inserted: 'a', value: 'a' }), 'a');
  assert.equal(echoText('characters', { inserted: 'ሰ', value: 'ሰ' }), 'ሰ');
  assert.equal(echoText('characters', { inserted: ' ', value: 'a ' }), null);
  assert.equal(echoText('words', { inserted: 'o', value: 'hello' }), null);
  assert.equal(echoText('words', { inserted: ' ', value: 'say hello ' }), 'hello');
  assert.equal(echoText('words', { inserted: '።', value: 'ሰላም ነው።' }), 'ነው');
  assert.equal(echoText('words', { inserted: ' ', value: 'one two three', cursor: 4 }), 'one');
  assert.equal(echoText('off', { inserted: 'a', value: 'a' }), null);
});

test('file sizes and accepted types', () => {
  assert.equal(parseSize('50MB'), 50_000_000);
  assert.equal(parseSize('500 kB'), 500_000);
  assert.equal(parseSize('1024'), 1024);
  assert.equal(parseSize('big'), null);
  assert.equal(sizeText(1_234_567), '1.2 MB');
  assert.equal(sizeText(62_000_000), '62 MB');
  assert.equal(sizeText(350_000), '350 KB');
  assert.ok(fileAccepted('video/*,.pdf', { name: 'cv.PDF', type: 'application/pdf' }));
  assert.ok(fileAccepted('video/*,.pdf', { name: 'clip.webm', type: 'video/webm' }));
  assert.ok(!fileAccepted('video/*,.pdf', { name: 'run.exe', type: 'application/x-msdownload' }));
  assert.ok(fileAccepted('', { name: 'anything' }));
  assert.deepEqual(acceptKinds('.pdf,.doc,.docx,video/*'), ['pdf', 'word', 'video']);
  assert.equal(extensionOf('Run.EXE'), '.exe');
  assert.equal(extensionOf('noext'), '');
});

test('drafts never keep sensitive fields; entries become an object', () => {
  assert.deepEqual(nameList(' a, b ,,c'), ['a', 'b', 'c']);
  assert.deepEqual(draftData({ name: 'A', support: ['sign'] }, ['support']), { name: 'A' });
  const data = entriesToObject([['name', 'A'], ['support', 'sign'], ['support', 'braille'], ['cv', { size: 1 }]], ['help']);
  assert.deepEqual(data, { help: [], name: 'A', support: ['sign', 'braille'] });
});

test('stored JSON: missing, broken or blocked storage never throws', () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  assert.equal(readStored(storage, 'x'), null);
  assert.ok(writeStored(storage, 'x', { a: 1 }));
  assert.deepEqual(readStored(storage, 'x'), { a: 1 });
  assert.ok(writeStored(storage, 'x', null));
  assert.equal(readStored(storage, 'x'), null);
  data.set('bad', '{not json');
  assert.equal(readStored(storage, 'bad'), null);
  const blocked = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); }, removeItem() { throw new Error('no'); } };
  assert.equal(readStored(blocked, 'x'), null);
  assert.equal(writeStored(blocked, 'x', 1), false);
});
