import { useState } from 'react';
import { api } from '../services/api';

const ReviewModal = ({ booking, onClose, onSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const carName = booking?.car ? `${booking.car.brand} ${booking.car.name}` : 'this car';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1) {
      setError('Please select a star rating');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.createReview({ bookingId: booking._id, rating, comment });
      onSubmitted();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold">Rate your rental</h2>
          <button onClick={onClose} className="text-2xl leading-none text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            ×
          </button>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">
          {carName} · {new Date(booking.pickupDate).toLocaleDateString()} → {new Date(booking.returnDate).toLocaleDateString()}
        </p>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="text-3xl leading-none transition-transform hover:scale-110"
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
              >
                <span className={(hovered || rating) >= star ? 'text-yellow-400' : 'text-gray-300'}>★</span>
              </button>
            ))}
          </div>

          <label className="block text-sm font-medium mb-1.5">Your review (optional)</label>
          <textarea
            rows={4}
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="How was the car? Clean? Smooth pickup?"
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />

          <div className="flex gap-3 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-full border border-[var(--color-border)] font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 rounded-full bg-[var(--color-accent)] text-white font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewModal;
