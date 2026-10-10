import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDateKey, streakFromDates } from './calendar.js';
const now = new Date(2026, 9, 8, 12);
const rows = (...dates) => dates.map((check_in_date) => ({ check_in_date }));
test('a missing yesterday breaks the streak', () => {
  assert.equal(streakFromDates(rows('2026-10-08', '2026-10-06'), now), 1);
});
test('today may be missing, but later gaps cannot be skipped', () => {
  assert.equal(streakFromDates(rows('2026-10-07', '2026-10-06', '2026-10-04'), now), 2);
});
test('duplicates and future check-ins do not inflate the streak', () => {
  assert.equal(streakFromDates(rows('2026-10-09', '2026-10-08', '2026-10-08', '2026-10-07'), now), 2);
});
test('stale and empty histories yield zero', () => {
  assert.equal(streakFromDates(rows('2026-10-06'), now), 0);
  assert.equal(streakFromDates([], now), 0);
});
test('date key follows the device calendar date', () => {
  assert.equal(localDateKey(new Date(2026, 0, 2, 0, 1)), '2026-01-02');
});
