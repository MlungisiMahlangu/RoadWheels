const escapeText = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const calendarDate = (value) => value.slice(0, 10).replaceAll('-', '');

const foldLine = (line) => {
  const encoder = new TextEncoder();
  let result = '';
  let bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) { result += '\r\n '; bytes = 1; }
    result += character;
    bytes += length;
  }
  return result;
};

export function bookingCalendar(booking, now = new Date()) {
  const name = booking.car ? `${booking.car.brand} ${booking.car.name}` : 'Rental car';
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RoadWheels//Rental bookings//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:roadwheels-${escapeText(booking._id)}`,
    `DTSTAMP:${timestamp}`,
    `DTSTART;VALUE=DATE:${calendarDate(booking.pickupDate)}`,
    `DTEND;VALUE=DATE:${calendarDate(booking.returnDate)}`,
    `SUMMARY:${escapeText(`RoadWheels: ${name}`)}`,
    `LOCATION:${escapeText(booking.car?.location)}`,
    `DESCRIPTION:${escapeText(`Booking RW-${booking._id.slice(-8).toUpperCase()}. Return date: ${booking.returnDate.slice(0, 10)}. Confirm pickup and return times with RoadWheels. This calendar file does not update automatically; check My bookings for current details.`)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(foldLine).join('\r\n') + '\r\n';
}
