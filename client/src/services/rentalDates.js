export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function nextDate(value) {
  if (!validDate(value)) return '';
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function rentalDays(pickup, end) {
  if (!validDate(pickup) || !validDate(end) || end <= pickup) return 0;
  return Math.round((new Date(end) - new Date(pickup)) / 86400000);
}

export const validRentalDates = (pickup, end) => rentalDays(pickup, end) > 0 && pickup >= today();

export const formatDate = (value) => new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
