import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { rentalDays, validRentalDates, formatDate } from '../services/rentalDates';
import ConfirmDialog from '../components/ConfirmDialog';
import Icon from '../components/Icon';

export default function BookingConfirm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const pickupDate = params.get('pickupDate') || '';
  const returnDate = params.get('returnDate') || '';
  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [retry, setRetry] = useState(0);
  const valid = validRentalDates(pickupDate, returnDate);
  const days = rentalDays(pickupDate, returnDate);
  const total = days * (car?.pricePerDay || 0);
  const detailsLink = `/cars/${id}?${new URLSearchParams({ pickupDate, returnDate })}`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    api.getCar(id).then((data) => { if (active) setCar(data); })
      .catch((err) => { if (active) setLoadError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, retry]);

  const confirm = async () => {
    if (submitting || !valid || !car || car.isAvailable === false || user?.role === 'admin') return;
    setShowConfirm(false);
    setSubmitting(true);
    setError('');
    try { setBooking(await api.createBooking({ carId: id, pickupDate, returnDate })); }
    catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="page-shell" role="status" aria-label="Loading reservation"><div className="skeleton h-14 w-2/3 mb-8" /><div className="skeleton h-96" /></div>;
  if (loadError || !car) return <div className="page-shell"><div className="empty-state" role="alert"><Icon name="car" size={36} /><h1 className="page-title !text-3xl">A short pit stop.</h1><p>{loadError || 'This car is no longer listed.'}</p><div className="flex flex-wrap justify-center gap-3"><button className="btn-secondary" onClick={() => setRetry(retry + 1)}>Try again</button><Link to="/browse" className="btn-primary">Back to the collection</Link></div></div></div>;
  if (booking) return <div className="page-shell !max-w-3xl"><div className="panel p-7 sm:p-12 text-center"><span className="mx-auto mb-7 grid size-16 place-items-center rounded-full bg-[#eaf2e8] text-[#466341]"><Icon name="check" size={30} /></span><p className="eyebrow justify-center">You're one step closer</p><h1 className="page-title !text-4xl">Your request is in.</h1><p className="page-intro mx-auto !text-sm">Your {car.brand} {car.name} reservation has been submitted. Our team will review it, and you can follow its status in My bookings.</p><div className="mt-8 mb-7 rounded-2xl bg-[var(--color-bg)] p-6 text-left"><div className="flex justify-between items-center gap-4 mb-5"><span className="font-mono text-xs">RW-{booking._id.slice(-8).toUpperCase()}</span><span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-semibold text-amber-800">Pending approval</span></div><p className="text-sm font-medium mb-2">{formatDate(pickupDate)} — {formatDate(returnDate)}</p><p className="text-xs text-[var(--color-text-muted)]">{car.location} · {days} day{days === 1 ? '' : 's'} · R{(booking.totalPrice ?? total).toLocaleString('en-ZA')}</p></div><div className="flex flex-wrap justify-center gap-3"><Link to="/my-bookings" className="btn-primary">View my bookings <Icon name="arrow-right" size={16} /></Link><Link to="/dashboard" className="btn-secondary">My dashboard</Link></div></div></div>;
  if (!valid || car.isAvailable === false || user?.role === 'admin') return <div className="page-shell"><div className="empty-state"><Icon name="calendar" size={36} /><h1 className="page-title !text-3xl">Let's check the details.</h1><p>{user?.role === 'admin' ? 'Admin accounts cannot reserve cars.' : car.isAvailable === false ? 'This car is no longer available to book.' : 'Choose a valid pick-up and return date before reviewing your reservation.'}</p><Link to={user?.role === 'admin' ? '/admin' : detailsLink} className="btn-primary">{user?.role === 'admin' ? 'Admin dashboard' : 'Back to the car'}</Link></div></div>;

  return (
    <div className="page-shell !max-w-6xl">
      <nav className="booking-steps" aria-label="Booking progress"><Link to={detailsLink}>01 · Choose your drive</Link><Icon name="arrow-right" size={13} /><span className="current" aria-current="step">02 · Review your booking</span><Icon name="arrow-right" size={13} /><span>03 · Request sent</span></nav>
      <p className="eyebrow">Make it a journey</p><h1 className="page-title">Almost on your way.</h1><p className="page-intro mb-9">Check the details below, then send your booking request.</p>
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-7 items-start">
        <div className="space-y-6">
          <section className="panel overflow-hidden"><img src={car.images?.[0] || '/placeholder-car.svg'} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder-car.svg'; }} alt={`${car.brand} ${car.name}`} className="w-full aspect-[16/9] object-cover bg-[var(--color-soft)]" /><div className="p-6"><p className="eyebrow !text-[9px] !mb-3">Your chosen ride</p><h2 className="text-2xl font-semibold mb-2">{car.brand} {car.name}</h2><p className="text-xs text-[var(--color-text-muted)]">{car.year} · {car.transmission} · {car.seats} seats · {car.fuelType}</p></div></section>
          <section className="panel p-6"><h2 className="text-lg font-semibold mb-5">The person behind the wheel.</h2><div className="flex items-center gap-4"><span className="grid size-11 place-items-center rounded-full bg-[var(--color-soft)] font-medium">{user?.name?.[0]?.toUpperCase()}</span><div className="min-w-0"><p className="text-sm font-medium">{user?.name}</p><p className="mt-1 break-all text-xs text-[var(--color-text-muted)]">{user?.email}</p></div></div><p className="mt-5 text-[11px] leading-6 text-[var(--color-text-muted)]">Bring a valid driver's license and identification to pickup. Contact our team to confirm deposit and vehicle-specific requirements.</p></section>
        </div>
        <section className="panel p-6 sm:p-8 lg:sticky lg:top-28">
          <div className="flex justify-between items-center mb-7"><h2 className="text-xl font-semibold">Your journey, at a glance.</h2><Icon name="calendar" size={21} className="text-[var(--color-accent)]" /></div>
          <div className="space-y-5"><div className="grid grid-cols-2 gap-5"><div><p className="field-label !text-[10px] text-[var(--color-text-muted)]">PICK-UP</p><p className="text-sm font-medium">{formatDate(pickupDate)}</p></div><div><p className="field-label !text-[10px] text-[var(--color-text-muted)]">RETURN</p><p className="text-sm font-medium">{formatDate(returnDate)}</p></div></div><p className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]"><Icon name="pin" size={15} />{car.location}</p><Link to={detailsLink} className="text-[11px] font-medium text-[var(--color-accent)] underline underline-offset-4">Edit dates or view car</Link></div>
          <div className="border-y border-[var(--color-border)] my-6 py-6"><div className="flex justify-between text-xs text-[var(--color-text-muted)]"><span>R{car.pricePerDay.toLocaleString('en-ZA')} × {days} day{days === 1 ? '' : 's'}</span><span>R{total.toLocaleString('en-ZA')}</span></div><div className="mt-6 flex justify-between items-center"><span className="text-sm font-semibold">Rental total</span><span className="text-2xl font-semibold tracking-tight">R{total.toLocaleString('en-ZA')}</span></div></div>
          {error && <p className="notice-error mb-4" role="alert">{error}</p>}
          <button disabled={submitting} onClick={() => setShowConfirm(true)} className="btn-primary w-full">{submitting ? 'Sending your request…' : 'Request this booking'}<Icon name="arrow-right" size={16} /></button>
          <p className="mt-4 text-center text-[10px] leading-6 text-[var(--color-text-muted)]">No payment is collected here.<br />Your booking is subject to confirmation by our team.</p>
          <div className="mt-6 flex items-start gap-3 rounded-xl bg-[var(--color-bg)] p-4"><Icon name="clock" size={18} className="text-[var(--color-accent)]" /><p className="text-[11px] leading-6 text-[var(--color-text-muted)]">Plans change. Pending and confirmed bookings can be cancelled before the pick-up date in My bookings.</p></div>
        </section>
      </div>
      <ConfirmDialog open={showConfirm} title="Ready to send your request?" message={`Request ${car.brand} ${car.name} for ${days} day${days === 1 ? '' : 's'}, from ${formatDate(pickupDate)} to ${formatDate(returnDate)}. Rental total: R${total.toLocaleString('en-ZA')}. Our team will review your booking.`} confirmLabel="Send request" cancelLabel="Keep reviewing" onConfirm={confirm} onCancel={() => setShowConfirm(false)} />
    </div>
  );
}
