import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import ReviewModal from '../components/ReviewModal';
import AccountNav from '../components/AccountNav';
import Icon from '../components/Icon';
import { today, formatDate } from '../services/rentalDates';
import { bookingCalendar } from '../services/bookingCalendar';

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-800 border-blue-200',
  active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  completed: 'bg-stone-100 text-stone-600 border-stone-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};
const STATUS_TABS = ['all', 'pending', 'confirmed', 'active', 'completed', 'cancelled'];
const STATUS_COPY = {
  pending: 'Awaiting confirmation from our team.',
  confirmed: 'Reserved and ready for your next journey.',
  active: 'You’re on the road. Enjoy the journey.',
  completed: 'Another journey, another good memory.',
  cancelled: 'This booking is cancelled. Ready for a fresh plan?',
};
const carName = (car) => car ? `${car.brand} ${car.name}` : 'Vehicle no longer listed';
const imageFallback = (event) => {
  if (!event.currentTarget.src.endsWith('/placeholder-car.svg')) event.currentTarget.src = '/placeholder-car.svg';
};
const downloadCalendar = (booking) => {
  const url = URL.createObjectURL(new Blob([bookingCalendar(booking)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `roadwheels-${booking._id.slice(-8)}.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
};

const MyBookings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [fetchError, setFetchError] = useState('');
  const [reviewsError, setReviewsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [bookingAttempt, setBookingAttempt] = useState(0);
  const [reviewAttempt, setReviewAttempt] = useState(0);
  const cancelInFlight = useRef(false);

  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    let current = true;
    api.getMyBookings()
      .then((data) => { if (current) setBookings(data); })
      .catch((err) => { if (current) setFetchError(err.message || 'Please try again.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [user, bookingAttempt]);

  useEffect(() => {
    if (!user) return;
    let current = true;
    api.getMyReviews()
      .then((data) => { if (current) setMyReviews(data); })
      .catch((err) => { if (current) setReviewsError(err.message || 'Please try again.'); })
      .finally(() => { if (current) setReviewsLoading(false); });
    return () => { current = false; };
  }, [user, reviewAttempt]);

  const handleCancel = async () => {
    if (!user || !cancelTarget || cancelInFlight.current) return;
    cancelInFlight.current = true;
    setCancelling(true);
    setActionError('');
    setSuccess('');
    try {
      await api.cancelBooking(cancelTarget);
      setBookings((current) => current.map((booking) => booking._id === cancelTarget ? { ...booking, status: 'cancelled' } : booking));
      setSuccess('Your booking has been cancelled. You can make a new reservation whenever you’re ready.');
      setLoading(true);
      setFetchError('');
      setBookingAttempt((attempt) => attempt + 1);
    } catch (err) {
      setActionError(`We couldn’t cancel your booking. ${err.message || 'Please try again.'}`);
    } finally {
      setCancelTarget(null);
      setCancelling(false);
      cancelInFlight.current = false;
    }
  };

  const isReviewed = (bookingId) => myReviews.some((review) => (review.booking?._id || review.booking) === bookingId);
  const visible = bookings
    .filter((booking) => statusFilter === 'all' || booking.status === statusFilter)
    .sort((a, b) => new Date(b.pickupDate) - new Date(a.pickupDate));
  const cancelTargetBooking = bookings.find((booking) => booking._id === cancelTarget);

  if (!user) return null;

  return (
    <div className="page-shell pb-20 pt-6 sm:pt-8">
      <AccountNav />
      <header className="flex flex-col items-start justify-between gap-6 py-9 sm:flex-row sm:items-end sm:py-12">
        <div>
          <p className="eyebrow mb-3">The journey, organised</p>
          <h1 className="page-title">My bookings.</h1>
          <p className="page-intro mt-4">Upcoming adventures and roads already travelled. All right here.</p>
        </div>
        <Link to="/browse" className="btn-primary inline-flex shrink-0 items-center gap-3">Book your next ride <Icon name="arrow-right" size={18} /></Link>
      </header>

      {actionError && <div className="notice-error mb-5" role="alert">{actionError}</div>}
      {success && <div className="notice-success mb-5" role="status">{success}</div>}
      {reviewsError && (
        <div className="notice-error mb-5 flex flex-wrap items-center justify-between gap-3" role="alert">
          <div><p className="font-semibold">Your review history couldn’t be loaded.</p><p className="mt-1 text-sm">{reviewsError} Retry to check which trips you’ve reviewed.</p></div>
          <button type="button" onClick={() => { setReviewsLoading(true); setReviewsError(''); setReviewAttempt((attempt) => attempt + 1); }} className="btn-secondary">Retry reviews</button>
        </div>
      )}

      <div className="mb-7 flex gap-2 overflow-x-auto pb-3" role="group" aria-label="Filter bookings by status">
        {STATUS_TABS.map((tab) => {
          const count = tab === 'all' ? bookings.length : bookings.filter((booking) => booking.status === tab).length;
          return (
            <button
              key={tab}
              type="button"
              aria-pressed={statusFilter === tab}
              onClick={() => setStatusFilter(tab)}
              className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${statusFilter === tab ? 'border-[#18221f] bg-[#18221f] text-white' : 'border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'}`}
            >
              <span className="capitalize">{tab === 'all' ? 'All journeys' : tab}</span>
              {!loading && !fetchError && <span className={`rounded-full px-1.5 text-xs ${statusFilter === tab ? 'bg-white/15 text-white/80' : 'bg-[var(--color-bg)]'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="panel py-20 text-center text-sm text-[var(--color-text-muted)]" role="status">Loading your bookings…</div>
      ) : fetchError ? (
        <div className="panel p-8 text-center sm:py-16" role="alert">
          <Icon name="calendar" size={30} className="mx-auto mb-5 text-[var(--color-accent)]" />
          <h2 className="text-2xl font-semibold tracking-tight">Your bookings are temporarily unavailable.</h2>
          <p className="mx-auto mb-6 mt-3 max-w-lg text-sm text-[var(--color-text-muted)]">{fetchError}</p>
          <button type="button" onClick={() => { setLoading(true); setFetchError(''); setBookingAttempt((attempt) => attempt + 1); }} className="btn-primary">Retry bookings</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="panel px-6 py-16 text-center sm:py-20">
          <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-bg)] text-[var(--color-accent)]"><Icon name="car" size={28} /></span>
          <p className="eyebrow mb-3">{bookings.length === 0 ? 'An open road ahead' : 'All clear here'}</p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{bookings.length === 0 ? 'Your first journey is waiting.' : `No ${statusFilter} bookings.`}</h2>
          <p className="mx-auto mb-7 mt-3 max-w-md text-sm leading-relaxed text-[var(--color-text-muted)]">{bookings.length === 0 ? 'The city, the coast, or somewhere in between. Find the right car and make it a trip to remember.' : 'Try another filter to see your other journeys, or start planning a new one.'}</p>
          {bookings.length === 0 ? <Link to="/browse" className="btn-primary inline-flex items-center gap-3">Find your car <Icon name="arrow-right" size={17} /></Link> : <button type="button" onClick={() => setStatusFilter('all')} className="btn-secondary">View all bookings</button>}
        </div>
      ) : (
        <div className="space-y-6" aria-label="Your bookings">
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-muted)]" role="status">{visible.length} {visible.length === 1 ? 'journey' : 'journeys'} · {statusFilter === 'all' ? 'Your complete itinerary' : statusFilter}</p>
          {visible.map((booking) => (
            <article key={booking._id} className="panel overflow-hidden">
              <div className="grid md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr]">
                <div className="relative min-h-52 bg-[var(--color-bg)]">
                  <img src={booking.car?.images?.[0] || '/placeholder-car.svg'} onError={imageFallback} alt={carName(booking.car)} className={`h-56 w-full object-cover md:absolute md:h-full ${booking.status === 'cancelled' ? 'opacity-75' : ''}`} />
                  <span className="absolute bottom-4 left-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-[#18221f]">{booking.car?.category || 'Your rental'}</span>
                </div>
                <div className="min-w-0 p-6 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Booking RW-{booking._id.slice(-8).toUpperCase()}</p>
                      <h2 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{carName(booking.car)}</h2>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><Icon name="pin" size={14} />{booking.car?.location || 'Location not listed'}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${STATUS_STYLES[booking.status]}`}>{booking.status}</span>
                  </div>
                  <div className="my-6 grid grid-cols-2 gap-4 rounded-2xl bg-[var(--color-bg)] p-4">
                    <div><p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Pick-up</p><p className="text-sm font-medium">{formatDate(booking.pickupDate)}</p></div>
                    <div className="border-l border-[var(--color-border)] pl-4"><p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Return</p><p className="text-sm font-medium">{formatDate(booking.returnDate)}</p></div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div><p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Booking total</p><p className="mt-1 text-2xl font-semibold tracking-tight">R{booking.totalPrice?.toLocaleString('en-ZA')}</p></div>
                    <div className="flex flex-wrap items-center gap-2">
                      {['confirmed', 'active'].includes(booking.status) && <button type="button" onClick={() => downloadCalendar(booking)} className="btn-secondary inline-flex items-center gap-2"><Icon name="calendar" size={16} />Add to calendar</button>}
                      {['pending', 'confirmed'].includes(booking.status) && booking.pickupDate.slice(0, 10) > today() && (
                        <button type="button" disabled={cancelling} onClick={() => { setActionError(''); setCancelTarget(booking._id); }} className="min-h-11 rounded-full border border-red-200 px-5 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-wait disabled:opacity-50">Cancel booking</button>
                      )}
                      {booking.status === 'completed' && (
                        reviewsLoading || reviewsError ? <span className="text-xs text-[var(--color-text-muted)]">{reviewsLoading ? 'Checking review status…' : 'Review status unavailable'}</span> : isReviewed(booking._id) ? <span className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]"><Icon name="check" size={17} />Reviewed</span> : booking.car && <button type="button" onClick={() => setReviewTarget(booking)} className="btn-secondary inline-flex items-center gap-2"><Icon name="star" size={16} />Leave a review</button>
                      )}
                      {booking.status === 'cancelled' && <Link to="/browse" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-accent)] hover:underline">Find another ride <Icon name="arrow-right" size={16} /></Link>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-[var(--color-border)] px-6 py-3 text-xs text-[var(--color-text-muted)] sm:px-7">{STATUS_COPY[booking.status]} {['confirmed', 'active'].includes(booking.status) && 'Calendar files do not update automatically; check here for your latest booking details.'}</div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel this booking?"
        message={cancelTargetBooking ? `Cancel your ${carName(cancelTargetBooking.car)} booking (${formatDate(cancelTargetBooking.pickupDate)} – ${formatDate(cancelTargetBooking.returnDate)})? This can’t be undone.` : ''}
        confirmLabel={cancelling ? 'Cancelling…' : 'Yes, cancel booking'}
        cancelLabel="Keep booking"
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => { if (!cancelInFlight.current) setCancelTarget(null); }}
      />
      {reviewTarget && (
        <ReviewModal
          booking={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmitted={() => {
            setMyReviews((current) => [...current, { booking: reviewTarget._id }]);
            setReviewTarget(null);
            setActionError('');
            setSuccess('Thanks for sharing your journey. Your review has been submitted.');
            setReviewsLoading(true);
            setReviewsError('');
            setReviewAttempt((attempt) => attempt + 1);
          }}
        />
      )}
    </div>
  );
};

export default MyBookings;
