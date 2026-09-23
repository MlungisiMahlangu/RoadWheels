import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, isSessionCurrent, isStrongPassword, PASSWORD_REQUIREMENTS } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AuthLayout, { PasswordField } from '../components/AuthLayout';

const Signup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, sessionSnapshot, sessionStatus } = useAuth();
  const mounted = useRef(false);
  const inFlight = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authDestination, setAuthDestination] = useState(null);
  const requestedFrom = location.state?.from;
  const from = typeof requestedFrom === 'string' && requestedFrom.startsWith('/')
    && !requestedFrom.startsWith('//') && !/[\\\p{Cc}]/u.test(requestedFrom)
    ? requestedFrom : null;

  const busy = loading || sessionStatus === 'validating';
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy || inFlight.current || !isSessionCurrent(sessionSnapshot)) return;
    setError('');

    if (!form.name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!isStrongPassword(form.password)) {
      setError(PASSWORD_REQUIREMENTS);
      return;
    }

    inFlight.current = true;
    setLoading(true);
    try {
      const data = await api.signup({ ...form, name: form.name.trim() });
      if (!mounted.current || !login(data.user, data.token, sessionSnapshot)) return;
      const destination = data.user.role === 'admin' ? '/admin' : from || '/dashboard';
      setAuthDestination(destination);
      navigate(destination, { replace: true });
    } catch (err) {
      if (mounted.current && isSessionCurrent(sessionSnapshot)) setError(err.message || 'Unable to create your account. Please try again.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  if (user) return <Navigate to={authDestination || (user.role === 'admin' ? '/admin' : '/dashboard')} replace />;

  return (
    <AuthLayout
      eyebrow="Make room for adventure"
      title="Let's get you moving."
      intro={from ? 'Create an account to continue where you left off.' : 'Create your account to book a car and keep your trips in one place.'}
      visualTitle="More road. More possibility."
      visualDescription="From everyday plans to a change of scenery. Your next journey is yours to choose."
    >
      <form onSubmit={handleSubmit} aria-busy={busy}>
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          <div>
            <label htmlFor="signup-name" className="field-label">Full name</label>
            <input
              id="signup-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label htmlFor="signup-email" className="field-label">Email address</label>
            <input
              id="signup-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-field"
              placeholder="you@example.com"
            />
          </div>
          <PasswordField
            id="signup-password"
            label="Password"
            autoComplete="new-password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            description={PASSWORD_REQUIREMENTS}
          />
          <PasswordField
            id="signup-confirm-password"
            label="Confirm password"
            autoComplete="new-password"
            minLength={8}
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          />
          {error && <p className="notice-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
            {sessionStatus === 'validating' ? 'Checking session…' : loading ? 'Creating account...' : 'Create account'}
          </button>
        </fieldset>
      </form>
      <p className="mt-7 border-t border-[#e4e6df] pt-6 text-center text-sm text-[#64716a]">
        Already have an account?{' '}
        <Link to="/login" state={from ? { from } : undefined} className="font-semibold text-[#bc4c2a] underline-offset-4 hover:text-[#a43c1e] hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Signup;
