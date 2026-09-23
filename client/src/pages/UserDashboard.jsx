import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CarCard from '../components/CarCard';
import AccountNav from '../components/AccountNav';
import Icon from '../components/Icon';
import { today as businessToday, formatDate } from '../services/rentalDates';

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-800',
  confirmed: 'bg-blue-50 text-blue-800',
  active: 'bg-emerald-50 text-emerald-800',
  completed: 'bg-stone-100 text-stone-600',
  cancelled: 'bg-red-50 text-red-700',
};

const carName = (car) => car ? `${car.brand} ${car.name}` : 'Your rental';
const imageFallback = (event) => {
  if (!event.currentTarget.src.endsWith('/placeholder-car.svg')) event.currentTarget.src = '/placeholder-car.svg';
};

const UserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [featuredCars, setFeaturedCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [carsLoading, setCarsLoading] = useState(true);
  const [bookingError, setBookingError] = useState('');
  const [carsError, setCarsError] = useState('');
  const [bookingAttempt, setBookingAttempt] = useState(0);
  const [carsAttempt, setCarsAttempt] = useState(0);

  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    let current = true;
    api.getMyBookings()
      .then((data) => { if (current) setBookings(data); })
      .catch((err) => { if (current) setBookingError(err.message || 'Please try again.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [user, bookingAttempt]);

  // Recommendations are independent: a fleet error must never hide a customer's trips.
  useEffect(() => {
    if (!user) return;
    let current = true;
    api.getCars()
      .then((data) => { if (current) setFeaturedCars(data.slice(0, 3)); })
      .catch((err) => { if (current) setCarsError(err.message || 'Please try again.'); })
      .finally(() => { if (current) setCarsLoading(false); });
    return () => { current = false; };
  }, [user, carsAttempt]);

  const today = businessToday();
  const upcoming = bookings
    .filter((booking) => ['pending', 'confirmed'].includes(booking.status) && booking.pickupDate.slice(0, 10) >= today)
    .sort((a, b) => new Date(a.pickupDate) - new Date(b.pickupDate))[0];
  const active = bookings
    .filter((booking) => booking.status === 'active')
    .sort((a, b) => new Date(a.returnDate) - new Date(b.returnDate))[0];
  const totalTrips = bookings.filter((booking) => booking.status === 'completed').length;
  const highlight = active || upcoming;

  if (!user) return null;

  return (
    <div className="page-shell pb-20 pt-6 sm:pt-8">
      <AccountNav />
      <header className="flex flex-col items-start justify-between gap-6 py-9 sm:flex-row sm:items-end sm:py-12">
        <div>
          <p className="eyebrow mb-3">Your personal pit stop</p>
          <h1 className="page-title">Welcome back{user.name ? `, ${user.name.trim().split(' ')[0]}` : ''}.</h1>
          <p className="page-intro mt-4">Your journeys, all in one place. Where will you go next?</p>
        </div>
        <Link to="/browse" className="btn-primary inline-flex shrink-0 items-center gap-3">Find a car <Icon name="arrow-right" size={18} /></Link>
      </header>

      {loading ? (
        <div className="panel mb-10 p-12 text-center text-[var(--color-text-muted)]" role="status">Loading your journeys…</div>
      ) : bookingError ? (
        <div className="notice-error mb-10 flex flex-wrap items-center justify-between gap-4" role="alert">
          <div><p className="font-semibold">We couldn’t load your bookings.</p><p className="mt-1 text-sm">{bookingError}</p></div>
          <button type="button" onClick={() => { setLoading(true); setBookingError(''); setBookingAttempt((attempt) => attempt + 1); }} className="btn-secondary">Retry bookings</button>
        </div>
      ) : (
        <>
          <section aria-label="Your rental summary" className="mb-8 grid gap-4 sm:grid-cols-3">
            {[
              { label: 'On the road', value: active ? carName(active.car) : 'No active rental', detail: active ? `Return by ${formatDate(active.returnDate)}` : 'Your next adventure is waiting', icon: 'car' },
              { label: 'Next departure', value: upcoming ? formatDate(upcoming.pickupDate) : 'An open itinerary', detail: upcoming ? carName(upcoming.car) : 'Make room for something new', icon: 'calendar' },
              { label: 'Journeys completed', value: String(totalTrips).padStart(2, '0'), detail: totalTrips === 1 ? 'One good trip. Many more to come.' : 'Every trip has a story', icon: 'check' },
            ].map((stat) => (
              <div key={stat.label} className="panel p-6 sm:p-7">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <p className="text-sm text-[var(--color-text-muted)]">{stat.label}</p>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-accent)]"><Icon name={stat.icon} size={19} /></span>
                </div>
                <p className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{stat.value}</p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">{stat.detail}</p>
              </div>
            ))}
          </section>

          {highlight ? (
            <section aria-labelledby="next-trip-title" className="mb-10 overflow-hidden rounded-[28px] bg-[#18221f] text-white">
              <div className="grid md:grid-cols-[0.9fr_1.1fr]">
                <div className="relative min-h-56 bg-white/5">
                  <img src={highlight.car?.images?.[0] || '/placeholder-car.svg'} onError={imageFallback} alt={carName(highlight.car)} className="h-64 w-full object-cover md:absolute md:h-full" />
                </div>
                <div className="p-7 sm:p-9">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">{active ? 'Your current journey' : 'Next on your itinerary'}</p>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${STATUS_STYLES[highlight.status]}`}>{highlight.status}</span>
                  </div>
                  <h2 id="next-trip-title" className="text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{carName(highlight.car)}</h2>
                  <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3 text-sm text-white/75">
                    <p className="flex items-center gap-2"><Icon name="calendar" size={17} />{formatDate(highlight.pickupDate)} – {formatDate(highlight.returnDate)}</p>
                    <p className="flex items-center gap-2"><Icon name="pin" size={17} />{highlight.car?.location || 'Location not listed'}</p>
                  </div>
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-6">
                    <p className="text-xs text-white/60">{active ? 'Enjoy the journey. We’ll keep the details here.' : highlight.status === 'pending' ? 'Your booking is awaiting confirmation.' : 'Your car is reserved. Let the planning begin.'}</p>
                    <Link to="/my-bookings" className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:underline">Trip details <Icon name="arrow-right" size={17} /></Link>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="mb-10 flex flex-col items-start justify-between gap-6 rounded-[28px] bg-[#18221f] p-8 text-white sm:flex-row sm:items-center sm:p-10">
              <div>
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/60">A little room for adventure</p>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Your next chapter starts here.</h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/70">No upcoming trips just yet. Find a car that fits your plans, from everyday errands to the long way home.</p>
              </div>
              <Link to="/browse" className="btn-primary inline-flex shrink-0 items-center gap-3">Explore the fleet <Icon name="arrow-right" size={18} /></Link>
            </section>
          )}
        </>
      )}

      <nav aria-label="Account shortcuts" className="mb-14 grid gap-4 sm:grid-cols-3">
        {[
          { to: '/browse', icon: 'car', title: 'Find your next ride', detail: 'A car for every kind of day.' },
          { to: '/my-bookings', icon: 'calendar', title: 'Your bookings', detail: 'The details of every journey.' },
          { to: '/profile', icon: 'user', title: 'Make it personal', detail: 'Keep your account up to date.' },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="panel group flex items-center gap-4 p-5 transition-colors hover:border-[var(--color-accent)]">
            <Icon name={item.icon} className="shrink-0 text-[var(--color-accent)]" />
            <div className="flex-1"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.detail}</p></div>
            <Icon name="arrow-right" size={16} className="shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </nav>

      <section aria-labelledby="recommended-title">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow mb-2">A little inspiration</p><h2 id="recommended-title" className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Made for your next move.</h2></div>
          <Link to="/browse" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-accent)] hover:underline">View all cars <Icon name="arrow-right" size={17} /></Link>
        </div>
        {carsLoading ? (
          <div className="panel p-10 text-center text-sm text-[var(--color-text-muted)]" role="status">Finding a little inspiration…</div>
        ) : carsError ? (
          <div className="notice-error flex flex-wrap items-center justify-between gap-4" role="alert">
            <div><p className="font-semibold">Recommendations are unavailable.</p><p className="mt-1 text-sm">{carsError}</p></div>
            <button type="button" onClick={() => { setCarsLoading(true); setCarsError(''); setCarsAttempt((attempt) => attempt + 1); }} className="btn-secondary">Retry recommendations</button>
          </div>
        ) : featuredCars.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{featuredCars.map((car) => <CarCard key={car._id} car={car} />)}</div>
        ) : (
          <div className="panel p-8 text-sm text-[var(--color-text-muted)]">No recommendations right now. <Link to="/browse" className="font-semibold text-[var(--color-accent)] hover:underline">Explore the fleet</Link> to see what’s available.</div>
        )}
      </section>
    </div>
  );
};

export default UserDashboard;
