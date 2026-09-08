import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

const MyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const data = await api.getMyBookings();
        setBookings(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-24 text-center">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-8">My Bookings</h1>

      {bookings.length === 0 ? (
        <div className="text-center py-24 bg-white border border-[var(--color-border)] rounded-2xl">
          <p className="text-[var(--color-text-muted)] mb-4">You haven't booked a car yet.</p>
          <Link to="/browse" className="text-[var(--color-accent)] font-semibold hover:underline">
            Browse cars
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <div key={b._id} className="flex flex-col sm:flex-row gap-4 bg-white border border-[var(--color-border)] rounded-2xl p-4">
              <img
                src={b.car?.images?.[0] || '/placeholder-car.png'}
                alt={b.car?.name}
                className="w-full sm:w-40 aspect-[4/3] object-cover rounded-xl"
              />
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-lg">{b.car?.brand} {b.car?.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[b.status]}`}>
                      {b.status}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    {new Date(b.pickupDate).toLocaleDateString()} → {new Date(b.returnDate).toLocaleDateString()}
                  </p>
                </div>
                <p className="font-semibold mt-2">R{b.totalPrice?.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyBookings;