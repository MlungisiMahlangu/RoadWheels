import test from 'node:test';
import assert from 'node:assert/strict';
import { today, nextDate, validDate, rentalDays, validRentalDates, formatDate } from '../src/services/rentalDates.js';

test('calendar inputs reject missing, invalid and timestamp dates', () => {
  for (const value of ['', null, 'not-a-date', '2026-02-30', '2026-13-01', '2026-9-01', '2026-09-23T00:00:00Z']) assert.equal(validDate(value), false);
  assert.equal(validDate('2028-02-29'), true);
});

test('rental duration rejects reversed or same-day ranges', () => {
  assert.equal(rentalDays('2026-09-24', '2026-09-27'), 3);
  assert.equal(rentalDays('2026-09-24', '2026-09-24'), 0);
  assert.equal(rentalDays('2026-09-24', '2026-09-23'), 0);
  assert.equal(rentalDays('', ''), 0);
});

test('next day rolls across month, year and leap-day boundaries', () => {
  assert.equal(nextDate('2026-12-31'), '2027-01-01');
  assert.equal(nextDate('2028-02-28'), '2028-02-29');
  assert.equal(nextDate('2028-02-29'), '2028-03-01');
  assert.equal(nextDate('invalid'), '');
});

test('only current or future calendar dates can be booked', () => {
  assert.equal(validRentalDates(today(), nextDate(today())), true);
  assert.equal(validRentalDates('2000-01-01', '2000-01-02'), false);
  assert.equal(validRentalDates(today(), today()), false);
});

test('displayed dates preserve the stored calendar day', () => {
  assert.match(formatDate('2026-09-23T00:00:00.000Z'), /23/);
  assert.match(formatDate('2026-09-23'), /2026/);
});
