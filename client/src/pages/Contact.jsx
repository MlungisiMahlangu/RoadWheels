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
    if (submitting) return;
    setError('');
    if (!form.name.trim() || !form.message.trim()) {
      setError('Please enter your name and a message before sending.');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmSend = async () => {
    if (submitting) return;
    setShowConfirm(false);
    setSubmitting(true);
    setError('');
    try {
      await api.sendContactMessage({
        name: form.name.trim(),
        email: user?.email || form.email.trim(),
        message: form.message.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Your message could not be sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#f7f7f2] text-[#18221f]">
      <div className="page-shell">
        <header className="mb-10 max-w-2xl sm:mb-12">
          <p className="eyebrow mb-4">A real conversation</p>
          <h1 className="page-title">Let's talk about<br className="hidden sm:block" /> the road ahead.</h1>
          <p className="page-intro mt-5">A question about a car, an upcoming trip, or your account? You're in the right place.</p>
        </header>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <section className="panel min-w-0 p-6 sm:p-7">
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.15em] text-[#64716a]">01 / Write to us</p>
            <h2 className="mb-2 text-lg font-semibold">An inbox for your questions.</h2>
            <a href="mailto:support@roadwheels.com" className="break-words text-sm font-medium text-[#bc4c2a] underline-offset-4 hover:text-[#a43c1e] hover:underline">support@roadwheels.com</a>
          </section>
          <section className="panel p-6 sm:p-7">
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.15em] text-[#64716a]">02 / Opening hours</p>
            <h2 className="mb-2 text-lg font-semibold">Monday to Friday</h2>
            <p className="text-sm text-[#64716a]">07:00–18:00</p>
          </section>
          <section className="panel p-6 sm:p-7">
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.15em] text-[#64716a]">03 / Find us</p>
            <h2 className="mb-2 text-lg font-semibold">Johannesburg, South Africa</h2>
            <p className="text-sm text-[#64716a]">Our head office</p>
          </section>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr] lg:gap-8">
          <section aria-labelledby="contact-form-title" className="panel min-w-0 p-6 sm:p-9">
            <p className="eyebrow mb-3">We're listening</p>
            <h2 id="contact-form-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">Send us a message.</h2>
            {submitted ? (
              <div className="py-10">
                <div className="notice-success" role="status">
                  <p className="font-semibold">Message sent.</p>
                  <p className="mt-2 text-sm leading-relaxed">Thank you for getting in touch. Your message has been sent to the RoadWheels team.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForm((current) => ({ ...current, message: '' }));
                    setSubmitted(false);
                  }}
                  className="btn-secondary mt-6"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <p className="mt-3 mb-7 text-sm leading-relaxed text-[#64716a]">Tell us a little about what you need. All fields are required.</p>
                <form onSubmit={handleSubmit} aria-busy={submitting}>
                  <fieldset disabled={submitting} className="min-w-0 space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="min-w-0">
                        <label htmlFor="contact-name" className="field-label">Full name</label>
                        <input
                          id="contact-name"
                          name="name"
                          required
                          autoComplete="name"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          className="input-field"
                          placeholder="Your full name"
                        />
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="contact-email" className="field-label">Email address</label>
                        <input
                          id="contact-email"
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                          value={user?.email || form.email}
                          disabled={Boolean(user)}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          aria-describedby={user ? 'contact-email-hint' : undefined}
                          className="input-field disabled:cursor-not-allowed disabled:bg-[#f7f7f2] disabled:text-[#64716a]"
                          placeholder="you@example.com"
                        />
                        {user && <p id="contact-email-hint" className="mt-2 text-xs text-[#64716a]">Using your account email.</p>}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="contact-message" className="field-label">How can we help?</label>
                      <textarea
                        id="contact-message"
                        name="message"
                        required
                        rows={6}
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        aria-describedby="contact-message-hint"
                        className="input-field resize-y"
                        placeholder="Tell us about your question or your trip..."
                      />
                      <p id="contact-message-hint" className="mt-2 text-xs leading-relaxed text-[#64716a]">Please don't include passwords or payment details.</p>
                    </div>
                    {error && <p className="notice-error" role="alert">{error}</p>}
                    <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-50">
                      {submitting ? 'Sending...' : 'Send message'}
                    </button>
                  </fieldset>
                </form>
              </>
            )}
          </section>

          <aside className="rounded-[24px] bg-[#18221f] p-7 text-white sm:p-9">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.18em] text-[#e9b299]">A helpful starting point</p>
            <h2 className="max-w-xs text-3xl font-semibold leading-tight tracking-tight">Your question might already have an answer.</h2>
            <p className="mt-5 text-sm leading-relaxed text-white/70">Explore our frequently asked questions for more about booking and renting with RoadWheels.</p>
            <Link to="/#faq" className="mt-7 inline-flex items-center gap-4 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#18221f] transition-colors hover:bg-[#eeeae0] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              Explore the FAQs <span aria-hidden="true">↗</span>
            </Link>
            <div className="mt-9 border-t border-white/15 pt-7">
              <h3 className="text-base font-semibold">Getting in touch about a booking?</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/70">Include your booking reference and travel dates so we can understand your question.</p>
              <Link to={user ? '/my-bookings' : '/login'} state={user ? undefined : { from: '/my-bookings' }} className="mt-5 inline-block text-sm font-medium text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
                {user ? 'View my bookings' : 'Log in to view your bookings'}
              </Link>
            </div>
          </aside>
        </div>

        <ConfirmDialog
          open={showConfirm}
          title="Send message"
          message="Send this message to the RoadWheels team?"
          confirmLabel="Yes, send"
          cancelLabel="Not yet"
          onConfirm={handleConfirmSend}
          onCancel={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
};

export default Contact;
