import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { today, nextDate, rentalDays, validRentalDates, formatDate } from '../services/rentalDates';
import Icon from '../components/Icon';

export default function CarDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [car, setCar] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [pickupDate, setPickupDate] = useState(params.get('pickupDate') || '');
  const [returnDate, setReturnDate] = useState(params.get('returnDate') || '');
  const [bookedRanges, setBookedRanges] = useState([]);
  const [availabilityState, setAvailabilityState] = useState('loading');
  const [reviews, setReviews] = useState([]);
  const [reviewError, setReviewError] = useState(false);
  const query = params.toString();

  useEffect(() => {
    const current = new URLSearchParams(query);
    setPickupDate(current.get('pickupDate') || '');
    setReturnDate(current.get('returnDate') || '');
  }, [id, query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setCar(null);
    setActiveImage(0);
    setBookedRanges([]);
    setReviews([]);
    setReviewError(false);
    setAvailabilityState('loading');
    api.getCar(id).then((data) => { if (active) setCar(data); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    api.getCarAvailability(id).then((data) => { if (active) { setBookedRanges(data); setAvailabilityState('ready'); } })
      .catch(() => { if (active) setAvailabilityState('error'); });
    api.getCarReviews(id).then((data) => { if (active) setReviews(data); })
      .catch(() => { if (active) setReviewError(true); });
    return () => { active = false; };
  }, [id, retry]);

  const days = rentalDays(pickupDate, returnDate);
  const valid = validRentalDates(pickupDate, returnDate);
  const available = valid && !bookedRanges.some((booking) => new Date(pickupDate) < new Date(booking.returnDate) && new Date(returnDate) > new Date(booking.pickupDate));
  const total = days * (car?.pricePerDay || 0);
  const selection = new URLSearchParams({ pickupDate, returnDate });
  const canBook = valid && available && availabilityState === 'ready' && car?.isAvailable !== false && user?.role !== 'admin';
  const handleBook = (event) => {
    event.preventDefault();
    if (canBook) navigate(`/book/${id}?${selection}`);
  };

  if (loading) return <div className="page-shell" role="status" aria-label="Loading car details"><div className="skeleton mb-7 h-12 w-2/3" /><div className="grid lg:grid-cols-[1.5fr_1fr] gap-8"><div className="skeleton h-96" /><div className="skeleton h-96" /></div></div>;
  if (error || !car) return <div className="page-shell"><div className="empty-state" role="alert"><Icon name="car" size={40} /><h1 className="page-title !text-3xl">We couldn't find this drive.</h1><p>{error || 'This car may no longer be listed.'}</p><div className="flex flex-wrap justify-center gap-3"><button className="btn-secondary" onClick={() => setRetry(retry + 1)}>Try again</button><Link to="/browse" className="btn-primary">Explore other cars</Link></div></div></div>;

  return (
    <div className="page-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to={`/browse${valid ? `?${selection}` : ''}`}>The collection</Link><span>/</span><span className="text-[var(--color-text)]">{car.brand} {car.name}</span></nav>
      <div className="mb-8"><p className="eyebrow">{car.category} · {car.year}</p><h1 className="page-title !mb-3">{car.brand} {car.name}</h1><div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-muted)]"><span className="inline-flex items-center gap-1.5"><Icon name="pin" size={14} />{car.location}</span><span>{car.transmission} transmission</span>{car.rating > 0 && <a href="#car-reviews" className="inline-flex items-center gap-1.5"><Icon name="star" size={14} className="text-[var(--color-accent)]" />{car.rating.toFixed(1)}<span>· {reviews.length} review{reviews.length !== 1 ? 's' : ''}</span></a>}</div></div>
      <div className="detail-layout">
        <div className="min-w-0">
          <div className="relative mb-3 overflow-hidden rounded-3xl bg-[var(--color-soft)] aspect-[16/11]"><img src={car.images?.[activeImage] || '/placeholder-car.svg'} alt={`${car.brand} ${car.name}, view ${activeImage + 1}`} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder-car.svg'; }} className="h-full w-full object-cover" /><span className="car-badge">Your next adventure</span></div>
          {car.images?.length > 1 && <div className="flex gap-3 overflow-x-auto pb-2 mb-7">{car.images.map((image, index) => <button key={index} onClick={() => setActiveImage(index)} aria-label={`View photo ${index + 1}`} aria-pressed={activeImage === index} className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 ${activeImage === index ? 'border-[var(--color-accent)]' : 'border-transparent'}`}><img src={image} alt="" className="w-full h-full object-cover" /></button>)}</div>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-7">{[['settings', 'Transmission', car.transmission], ['fuel', 'Fuel type', car.fuelType], ['users', 'Seats', `${car.seats} people`], ['car', 'Colour', car.color || 'Not specified']].map(([icon, label, value]) => <div className="panel !rounded-2xl p-4" key={label}><Icon name={icon} size={19} className="mb-3 text-[var(--color-accent)]" /><p className="text-[10px] text-[var(--color-text-muted)] mb-1.5">{label}</p><p className="font-medium text-xs">{value}</p></div>)}</div>
          <section className="py-5"><h2 className="text-2xl font-semibold mb-4">A little about your drive.</h2><p className="text-sm leading-8 text-[var(--color-text-muted)]">{car.description || `Explore ${car.location} and beyond in the ${car.brand} ${car.name}. Choose your dates to plan your rental.`}</p>{car.mileage != null && <p className="text-xs text-[var(--color-text-muted)] mt-4">Odometer · {car.mileage.toLocaleString('en-ZA')} km</p>}</section>
          {car.features?.length > 0 && <section className="py-6 border-t border-[var(--color-border)] mt-4"><h2 className="text-xl font-semibold mb-5">The good details.</h2><div className="grid sm:grid-cols-2 gap-4">{car.features.map((feature) => <span key={feature} className="flex items-center gap-3 text-xs"><Icon name="check" size={15} className="text-[var(--color-accent)]" />{feature}</span>)}</div></section>}
          <section id="car-reviews" className="border-t border-[var(--color-border)] mt-6 pt-7"><h2 className="text-xl font-semibold mb-5">From the driver's seat.{reviews.length > 0 && <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">({reviews.length})</span>}</h2>{reviewError ? <p className="text-sm text-[var(--color-text-muted)]">Reviews couldn't be loaded. <button className="underline" onClick={() => setRetry(retry + 1)}>Try again</button></p> : !reviews.length ? <p className="text-sm leading-7 text-[var(--color-text-muted)]">No reviews yet. Renters can share their experience after a completed trip.</p> : <div className="space-y-4">{reviews.map((review) => <article key={review._id} className="panel p-5"><div className="flex items-center justify-between gap-3 mb-3"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-full bg-[var(--color-soft)] font-medium text-xs">{review.user?.name?.[0]?.toUpperCase() || 'R'}</div><div><p className="text-xs font-semibold">{review.user?.name || 'RoadWheels renter'}</p><p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{formatDate(review.createdAt)}</p></div></div><span className="flex items-center gap-1 text-xs text-[var(--color-accent)]" aria-label={`${review.rating} out of 5 stars`}><Icon name="star" size={14} />{review.rating}/5</span></div>{review.comment && <p className="text-xs leading-7 text-[var(--color-text-muted)]">{review.comment}</p>}</article>)}</div>}</section>
        </div>

        <aside className="panel booking-panel" aria-label="Reserve this car">
          <p className="eyebrow !text-[9px] !mb-4">Your next drive starts here</p>
          <p className="text-4xl font-semibold tracking-tight">R{car.pricePerDay.toLocaleString('en-ZA')}<span className="ml-2 text-xs font-normal tracking-normal text-[var(--color-text-muted)]">/ day</span></p>
          <p className="mt-3 mb-7 text-xs text-[var(--color-text-muted)]">Choose your dates. Make it a journey.</p>
          {car.isAvailable === false ? <div className="notice-error">This car is currently unavailable.<Link to="/browse" className="block underline mt-2">Explore other cars</Link></div> : user?.role === 'admin' ? <div className="panel bg-[var(--color-soft)] p-5 text-sm leading-7">Admin accounts manage the fleet and cannot make reservations.<Link to="/admin" className="block mt-3 text-[var(--color-accent)]">Go to your dashboard</Link></div> : <form onSubmit={handleBook}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4"><div><label className="field-label" htmlFor="detail-pickup">Pick-up date</label><input id="detail-pickup" className="input-field !text-xs" type="date" required min={today()} value={pickupDate} onChange={(e) => { setPickupDate(e.target.value); if (returnDate && returnDate <= e.target.value) setReturnDate(''); }} /></div><div><label className="field-label" htmlFor="detail-return">Return date</label><input id="detail-return" className="input-field !text-xs" type="date" required min={nextDate(pickupDate || today())} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></div></div>
            <div className="mt-5 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]"><Icon name="pin" size={15} />Pick up in {car.location}</div>
            {valid && <div className="my-6 border-y border-[var(--color-border)] py-5"><div className="flex justify-between gap-3 text-xs text-[var(--color-text-muted)]"><span>R{car.pricePerDay.toLocaleString('en-ZA')} × {days} day{days !== 1 ? 's' : ''}</span><span>R{total.toLocaleString('en-ZA')}</span></div><div className="mt-5 flex justify-between font-semibold text-sm"><span>Rental total</span><span>R{total.toLocaleString('en-ZA')}</span></div></div>}
            {pickupDate && returnDate && !valid && <p className="notice-error mt-4" role="alert">Pick-up must be today or later. Return must be at least one day after pick-up.</p>}
            {valid && !available && availabilityState === 'ready' && <p className="notice-error mt-4" role="alert">This car is already reserved for some of these dates. Please choose a different date range.</p>}
            {availabilityState === 'error' && <div className="notice-error mt-4" role="alert">We couldn't check availability. <button type="button" className="underline font-medium" onClick={() => setRetry(retry + 1)}>Try again</button></div>}
            <button type="submit" disabled={!canBook} className="btn-primary mt-6 w-full">{availabilityState === 'loading' ? 'Checking availability…' : user ? 'Review my booking' : 'Continue to sign in'}<Icon name="arrow-right" size={16} /></button>
            <p className="mt-4 text-center text-[10px] leading-6 text-[var(--color-text-muted)]">{user ? 'Your request will be reviewed by our team.' : 'Sign in to continue. We’ll keep your selected dates.'}<br />No payment is collected on this website.</p>
          </form>}
          <div className="mt-6 border-t border-[var(--color-border)] pt-5 flex items-start gap-3"><Icon name="mail" size={17} className="text-[var(--color-accent)]" /><p className="text-[11px] leading-6 text-[var(--color-text-muted)]">A question before you book?<br /><Link to="/contact" className="font-medium text-[var(--color-text)] underline underline-offset-4">We're happy to help.</Link></p></div>
        </aside>
      </div>
    </div>
  );
}
