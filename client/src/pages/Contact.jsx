import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

const Contact = () => {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', message: '' });
  const [submitted, setSubmitted] = useState(false);

 const [error, setError] = useState('');
const [submitting, setSubmitting] = useState(false);
const [showConfirm, setShowConfirm] = useState(false);

const handleSubmit = (e) => {
  e.preventDefault();
  setError('');
  setShowConfirm(true);
};

const handleConfirmSend = async () => {
  setShowConfirm(false);
  setSubmitting(true);
  setError('');
  try {
    await api.sendContactMessage(form);
    setSubmitted(true);
  } catch (err) {
    setError(err.message);
  } finally {
    setSubmitting(false);
  }
};

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-14">
        <h1 className="text-4xl font-bold mb-3">Get in touch</h1>
        <p className="text-[var(--color-text-muted)] max-w-lg mx-auto">
          Have a question about a booking, a car, or anything else? We're happy to help.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6 mb-14">
        <div className="bg-white border border-[var(--color-border)] rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center text-xl mx-auto mb-3">📞</div>
          <h3 className="font-semibold mb-1">Call Us</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Mon–Fri, 07:00–18:00</p>
          <a href="tel:+27XXXXXXXXX" className="text-[var(--color-accent)] font-medium text-sm hover:underline">+27 XX XXX XXXX</a>
        </div>
        <div className="bg-white border border-[var(--color-border)] rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center text-xl mx-auto mb-3">✉️</div>
          <h3 className="font-semibold mb-1">Email Us</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-1">We reply within 24 hours</p>
          <a href="mailto:support@roadwheels.com" className="text-[var(--color-accent)] font-medium text-sm hover:underline">support@roadwheels.com</a>
        </div>
        <div className="bg-white border border-[var(--color-border)] rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center text-xl mx-auto mb-3">📍</div>
          <h3 className="font-semibold mb-1">Visit Us</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Head office</p>
          <p className="text-[var(--color-accent)] font-medium text-sm">Johannesburg, South Africa</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-10 items-start">
        {/* Form */}
        <div className="bg-white border border-[var(--color-border)] rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-5">Send us a message</h2>
          {submitted ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-3 text-2xl">✓</div>
              <p className="font-medium">Thanks — we'll get back to you soon.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                {user ? (
                  <input
                    type="email"
                    required
                    value={user.email}
                    disabled
                    className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 bg-gray-50 text-[var(--color-text-muted)] cursor-not-allowed"
                  />
                ) : (
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Message</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-full bg-[var(--color-accent)] text-white font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </div>

        {/* FAQ shortcut */}
        <div className="bg-[#111318] text-white rounded-2xl p-8">
          <h2 className="font-bold text-lg mb-3">Looking for a quick answer?</h2>
          <p className="text-white/70 text-sm mb-6">
            Most common questions about bookings, cancellations, and requirements are already answered on our homepage FAQ.
          </p>
          <Link to="/#faq" className="inline-block px-5 py-2.5 rounded-full bg-white text-[#111318] font-medium text-sm hover:bg-white/90 transition-colors">
            View FAQ
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Send Message"
        message="Send this message to the RoadWheels team? We usually reply within 24 hours."
        confirmLabel="Yes, send"
        cancelLabel="Not yet"
        onConfirm={handleConfirmSend}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};

export default Contact;