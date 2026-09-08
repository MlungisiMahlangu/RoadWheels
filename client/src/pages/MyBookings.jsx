import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import ReviewModal from '../components/ReviewModal';

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

const STATUS_TABS = ['all', 'pending', 'confirmed', 'active', 'completed', 'cancelled'];

const MyBookings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([api.getMyBookings(), api.getMyReviews().catch(() => [])])
      .then(([b, r]) => {
        setBookings(b);
        setMyReviews(r);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  const fetchBookings = async () => {
    try {
      const [b, r] = await Promise.all([api.getMyBookings(), api.getMyReviews().catch(() => [])]);
      setBookings(b);
      setMyReviews(r);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await api.cancelBooking(cancelTarget);
      setCancelTarget(null);
      fetchBookings();
    } catch (err) {
      setError(err.message);
      setCancelTarget(null);
    }
  };

  const isReviewed = (bookingId) => myReviews.some((r) => r.booking === bookingId);

  const visible = bookings.filter((b) => statusFilter === 'all' || b.status === statusFilter);

  const cancelTargetBooking = bookings.find((b) => b._id === cancelTarget);

  if (loading) return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-24 text-center">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">My Bookings</h1>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {STATUS_TABS.map((tab) => {
          const count = tab === 'all' ? bookings.length : bookings.filter((b) => b.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${
                statusFilter === tab
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                  : 'border-[var(--color-border)] hover:bg-gray-100'
              }`}
            >
              {tab === 'all' ? 'All' : <span className="capitalize">{tab}</span>}
              {count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-24 bg-white border border-[var(--color-border)] rounded-2xl">
          <p className="text-[var(--color-text-muted)] mb-4">You haven't booked a car yet.</p>
          <Link to="/browse" className="text-[var(--color-accent)] font-semibold hover:underline">
            Browse cars
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[var(--color-border)] rounded-2xl text-[var(--color-text-muted)]">
          No {statusFilter} bookings.
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((b) => (
            <div key={b._id} className="flex flex-col sm:flex-row gap-4 bg-white border border-[var(--color-border)] rounded-2xl p-4">
              <img
                src={b.car?.images?.[0] || '/placeholder-car.png'}
                alt={b.car?.name}
                className="w-full sm:w-40 aspect-[4/3] object-cover rounded-xl"
              />
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-lg">{b.car?.brand} {b.car?.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[b.status]}`}>
                      {b.status}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    {new Date(b.pickupDate).toLocaleDateString()} → {new Date(b.returnDate).toLocaleDateString()}
                    <span className="mx-1.5">·</span>
                    <span className="font-mono text-xs">RW-{b._id.slice(-8).toUpperCase()}</span>
                  </p>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3 mt-2">
                  <p className="font-semibold">R{b.totalPrice?.toLocaleString()}</p>
                  <div className="flex gap-2">
                    {['pending', 'confirmed'].includes(b.status) && (
                      <button
                        onClick={() => setCancelTarget(b._id)}
                        className="px-4 py-1.5 text-sm font-medium rounded-full text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    {b.status === 'completed' && !isReviewed(b._id) && (
                      <button
                        onClick={() => setReviewTarget(b)}
                        className="px-4 py-1.5 text-sm font-medium rounded-full bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                      >
                        Leave a Review
                      </button>
                    )}
                    {b.status === 'completed' && isReviewed(b._id) && (
                      <span className="px-4 py-1.5 text-sm text-[var(--color-text-muted)]">✓ Reviewed</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Booking"
        message={
          cancelTargetBooking
            ? `Cancel your ${cancelTargetBooking.car?.brand} ${cancelTargetBooking.car?.name} booking (${new Date(cancelTargetBooking.pickupDate).toLocaleDateString()} → ${new Date(cancelTargetBooking.returnDate).toLocaleDateString()})? This can't be undone.`
            : ''
        }
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep booking"
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />

      {reviewTarget && (
        <ReviewModal
          booking={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmitted={() => {
            setReviewTarget(null);
            fetchBookings();
          }}
        />
      )}
    </div>
  );
};

export default MyBookings;
