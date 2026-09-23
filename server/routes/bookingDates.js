const businessDateFormatter = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

// Store calendar dates at UTC midnight, independently of the server's timezone.
const parseDateOnly = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
    return date;
};

const getBusinessToday = () => {
    const parts = Object.fromEntries(
        businessDateFormatter.formatToParts(new Date()).map(({ type, value }) => [type, value])
    );
    return parseDateOnly(`${parts.year}-${parts.month}-${parts.day}`);
};

const validateBookingDates = (pickupDate, returnDate) => {
    const pickup = parseDateOnly(pickupDate);
    const returnD = parseDateOnly(returnDate);
    if (!pickup || !returnD) {
        return { error: 'Pickup and return dates must both be valid calendar dates in YYYY-MM-DD format' };
    }
    if (pickup >= returnD) {
        return { error: 'Return date must be after pickup date' };
    }
    if (pickup < getBusinessToday()) {
        return { error: 'Pickup date cannot be in the past' };
    }
    return { pickup, returnD };
};

// Derive lifecycle state without mutating the stored booking. Passing today keeps
// this helper pure and lets callers use one business date for a whole response.
const effectiveBookingStatus = (booking, today) => {
    if (new Date(booking.returnDate) <= today) {
        if (booking.status === 'pending') return 'cancelled';
        if (['confirmed', 'active'].includes(booking.status)) return 'completed';
    }
    return booking.status;
};

module.exports = { getBusinessToday, validateBookingDates, effectiveBookingStatus };
