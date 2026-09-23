import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { formatDate } from '../services/rentalDates';
import Icon from './Icon';

const ReviewModal = ({ booking, onClose, onSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef(null);
  const inFlight = useRef(false);
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('button')?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape' && !inFlight.current) closeRef.current();
      if (event.key !== 'Tab') return;
      const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), textarea:not(:disabled)')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      previousFocus?.focus();
    };
  }, []);

  const carName = booking?.car ? `${booking.car.brand} ${booking.car.name}` : 'this car';
  const close = () => { if (!inFlight.current) onClose(); };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    if (rating < 1) { setError('Please select a star rating.'); return; }
    inFlight.current = true;
    setSubmitting(true);
    setError('');
    try {
      await api.createReview({ bookingId: booking._id, rating, comment: comment.trim() });
      onSubmitted();
    } catch (err) {
      setError(err.message || 'Unable to submit your review. Please try again.');
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#18221f]/55 p-4 backdrop-blur-sm sm:p-6" onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="review-title" aria-describedby="review-trip" className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="review-title" className="text-2xl font-semibold tracking-tight">How was your journey?</h2>
          <button type="button" onClick={close} disabled={submitting} aria-label="Close review" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-[var(--color-bg)] disabled:opacity-50"><Icon name="close" size={20} /></button>
        </div>
        <p id="review-trip" className="mb-7 text-sm leading-relaxed text-[var(--color-text-muted)]">{carName} · {formatDate(booking.pickupDate)} – {formatDate(booking.returnDate)}</p>
        {error && <p className="notice-error mb-4" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} aria-busy={submitting}>
          <fieldset disabled={submitting} className="min-w-0">
            <legend className="field-label text-center">Your rating</legend>
            <div className="mb-6 flex justify-center gap-2" role="group" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(star)} onMouseEnter={() => setHovered(star)} onMouseLeave={() => setHovered(0)} aria-label={`${star} star${star > 1 ? 's' : ''}`} aria-pressed={rating === star} className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-bg)] ${(hovered || rating) >= star ? 'text-[var(--color-accent)]' : 'text-[var(--color-border)]'}`}>
                  <span aria-hidden="true" className="text-3xl">★</span>
                </button>
              ))}
            </div>
            <label htmlFor="review-comment" className="field-label">Your review (optional)</label>
            <textarea id="review-comment" rows={4} maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Tell us about the car and your experience." className="input-field resize-y" />
            <p className="mt-2 text-right text-xs text-[var(--color-text-muted)]">{comment.length}/500</p>
            <div className="flex gap-3 pt-5">
              <button type="button" onClick={close} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1 disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit review'}</button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>, document.body,
  );
};

export default ReviewModal;
