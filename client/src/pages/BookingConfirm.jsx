import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';

const BookingConfirm = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { pickupDate, returnDate } = location.state || {};

  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!pickupDate || !returnDate) {
      navigate(`/cars/${id}`);
      return;
    }
    const fetchCar = async () => {
      try {
        const data = await api.getCar(id);
        setCar(data);
      } catch (err) {
        setError('Could not load car details.');
      } finally {
        setLoading(false);
      }
    };
    fetchCar();
  }, [id]);

  const days = Math.max(1, Math.ceil((new Date(returnDate) - new Date(pickupDate)) / (1000 * 60 * 60 * 24)));
  const total = car ? days * car.pricePerDay : 0;

  const handleConfirm = async () => {
    setShowConfirm(false);
    setSubmitting(true);
    setError('');
    try {
      await api.createBooking({ carId: id, pickupDate, returnDate });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto px-6 py-24 text-center">Loading...</div>;

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-3">Booking confirmed!</h1>
        <p className="text-[var(--color-text-muted)] mb-8">
          Your {car.brand} {car.name} is booked from {new Date(pickupDate).toLocaleDateString()} to {new Date(returnDate).toLocaleDateString()}.
        </p>
        <button
          onClick={() => navigate('/my-bookings')}
          className="px-8 py-3.5 rounded-full bg-[var(--color-accent)] text-white font-semibold hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          View My Bookings
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold mb-8">Confirm your booking</h1>

      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden mb-6">
        <img src={car.images?.[0]} alt={car.name} className="w-full aspect-[16/9] object-cover" />
        <div className="p-5">
          <h2 className="font-semibold text-lg">{car.brand} {car.name}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{car.year} · {car.transmission} · {car.location}</p>
        </div>
      </div>

      <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5 mb-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Pickup</span>
          <span className="font-medium">{new Date(pickupDate).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Return</span>
          <span className="font-medium">{new Date(returnDate).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between text-sm pt-3 border-t border-[var(--color-border)]">
          <span className="text-[var(--color-text-muted)]">{days} day{days > 1 ? 's' : ''} × R{car.pricePerDay}</span>
          <span className="font-bold text-lg">R{total.toLocaleString()}</span>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <button
        onClick={() => setShowConfirm(true)}
        disabled={submitting}
        className="w-full py-3.5 rounded-full bg-[var(--color-accent)] text-white font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
      >
        {submitting ? 'Processing...' : `Confirm Booking · R${total.toLocaleString()}`}
      </button>

      <button
        onClick={() => navigate(`/cars/${id}`)}
        className="w-full mt-3 py-3 rounded-full border border-[var(--color-border)] font-medium text-sm hover:bg-gray-50 transition-colors"
      >
        Go back
      </button>

      <ConfirmDialog
        open={showConfirm}
        title="Confirm Booking"
        message={`Book ${car.brand} ${car.name} for ${days} day${days > 1 ? 's' : ''} at R${total.toLocaleString()} total? This will create a reservation for ${pickupDate} to ${returnDate}.`}
        confirmLabel="Confirm"
        cancelLabel="Go back"
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};

export default BookingConfirm;
