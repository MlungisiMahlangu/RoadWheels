import { useState } from 'react';

const AvailabilityModal = ({ car, bookings, onClose }) => {
  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date();
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const carBookings = bookings.filter(
    (b) => b.car?._id === car._id && ['pending', 'confirmed', 'active'].includes(b.status)
  );

  const isBooked = (day) => {
    const date = new Date(year, month, day);
    return carBookings.some((b) => date >= new Date(b.pickupDate) && date < new Date(b.returnDate));
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-lg">{car.brand} {car.name}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-[var(--color-text-muted)]">×</button>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">Availability calendar</p>

        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMonthOffset((m) => m - 1)} className="px-2 py-1 rounded hover:bg-gray-100">‹</button>
          <span className="font-medium text-sm">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setMonthOffset((m) => m + 1)} className="px-2 py-1 rounded hover:bg-gray-100">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--color-text-muted)] mb-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayIndex }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const booked = isBooked(day);
            return (
              <div
                key={day}
                className={`aspect-square flex items-center justify-center rounded-lg text-sm ${
                  booked ? 'bg-red-100 text-red-600 font-medium' : 'bg-green-50 text-green-700'
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 text-xs text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-50 border border-green-200" /> Available</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100" /> Booked</span>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityModal;