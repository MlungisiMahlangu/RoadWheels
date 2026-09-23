import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingCalendar } from '../src/services/bookingCalendar.js';

const trip = { _id: '1234567890abcdef12345678', pickupDate: '2026-10-01T00:00:00.000Z', returnDate: '2026-10-04T00:00:00.000Z', car: { brand: 'BMW', name: 'M4', location: 'Cape Town' } };

test('calendar exports all-day dates with exclusive return and stable booking identity', () => {
  const calendar = bookingCalendar(trip, new Date('2026-09-23T12:30:00.000Z'));
  assert.ok(calendar.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(calendar.endsWith('END:VCALENDAR\r\n'));
  assert.match(calendar, /DTSTART;VALUE=DATE:20261001\r\nDTEND;VALUE=DATE:20261004/);
  assert.match(calendar, /DTSTAMP:20260923T123000Z/);
  assert.match(calendar, /UID:roadwheels-1234567890abcdef12345678/);
  assert.match(calendar, /SUMMARY:RoadWheels: BMW M4/);
});

test('calendar escapes text, blocks property injection, and folds UTF-8 lines at 75 bytes', () => {
  const calendar = bookingCalendar({ ...trip, car: { brand: '車'.repeat(50), name: 'A,B;C\\D', location: 'Town\r\nATTENDEE:someone' } });
  assert.doesNotMatch(calendar, /\r\nATTENDEE:/);
  assert.match(calendar, /Town\\nATTENDEE:someone/);
  const unfolded = calendar.replaceAll('\r\n ', '');
  assert.ok(unfolded.includes('A\\,B\\;C\\\\D'));
  for (const line of calendar.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
});
