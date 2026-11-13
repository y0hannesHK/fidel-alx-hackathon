import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toEthiopian, formatBoth } from '../src/ethiopian-calendar.js';

// Same dates as server/tests/test_ethiopian_calendar.py
const KNOWN = [
  [[2026, 11, 13], [2019, 3, 4]], // from the official site (brief)
  [[2026, 11, 14], [2019, 3, 5]],
  [[2026, 11, 15], [2019, 3, 6]],
  [[2026, 9, 10], [2018, 13, 5]], // Pagume 5
  [[2026, 9, 11], [2019, 1, 1]], // New Year on 11 September
  [[2027, 9, 11], [2019, 13, 6]], // Pagume 6 (leap year)
  [[2027, 9, 12], [2020, 1, 1]], // New Year on 12 September (before Gregorian leap year 2028)
  [[2023, 9, 12], [2016, 1, 1]],
  [[2027, 1, 7], [2019, 4, 29]], // Genna
  [[2027, 1, 19], [2019, 5, 11]], // Timket
];

test('known Gregorian -> Ethiopian dates', () => {
  for (const [[y, m, d], [ey, em, ed]] of KNOWN) {
    assert.deepEqual(toEthiopian(y, m, d), { year: ey, month: em, day: ed }, `${y}-${m}-${d}`);
  }
});

test('every day for twelve years follows the previous one', () => {
  let date = new Date(Date.UTC(2020, 0, 1));
  const eth = (dt) => toEthiopian(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  let prev = eth(new Date(date.getTime() - 86400000));
  while (date.getUTCFullYear() < 2032) {
    const now = eth(date);
    const pagume = prev.year % 4 === 3 ? 6 : 5;
    let expected;
    if ((prev.month < 13 && prev.day < 30) || (prev.month === 13 && prev.day < pagume)) expected = { ...prev, day: prev.day + 1 };
    else if (prev.month < 13) expected = { year: prev.year, month: prev.month + 1, day: 1 };
    else expected = { year: prev.year + 1, month: 1, day: 1 };
    assert.deepEqual(now, expected, date.toISOString());
    prev = now;
    date = new Date(date.getTime() + 86400000);
  }
});

test('formats a date in both calendars', () => {
  assert.deepEqual(formatBoth('2026-11-15'), {
    gregorian: '15 Nov 2026', ethiopian: 'ህዳር 6 2019', ethiopianEn: 'Hidar 6, 2019',
  });
});
