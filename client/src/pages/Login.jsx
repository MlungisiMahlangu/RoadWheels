import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, isSessionCurrent } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AuthLayout, { PasswordField } from '../components/AuthLayout';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, sessionSnapshot, sessionStatus } = useAuth();
  const mounted = useRef(false);
  const inFlight = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [form, setForm] = useState({ email: '', password: '' });
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
    inFlight.current = true;
    setError('');
    setLoading(true);
    try {
      const data = await api.login(form);
      if (!mounted.current || !login(data.user, data.token, sessionSnapshot)) return;
      const destination = data.user.role === 'admin' ? '/admin' : from || '/dashboard';
      setAuthDestination(destination);
      navigate(destination, { replace: true });
    } catch (err) {
      if (mounted.current && isSessionCurrent(sessionSnapshot)) setError(err.message || 'Unable to log in. Please try again.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  if (user) return <Navigate to={authDestination || (user.role === 'admin' ? '/admin' : '/dashboard')} replace />;

  return (
    <AuthLayout
      eyebrow="Your next chapter"
      title="Welcome back."
      intro={from ? 'Log in to pick up where you left off.' : 'Your next drive starts here. Log in to your RoadWheels account.'}
      visualTitle="Good to have you along."
      visualDescription="City streets or the scenic route. Find a car for wherever life takes you next."
    >
      <form onSubmit={handleSubmit} aria-busy={busy}>
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          <div>
            <label htmlFor="login-email" className="field-label">Email address</label>
            <input
              id="login-email"
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
            id="login-password"
            label="Password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {error && <p className="notice-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
            {sessionStatus === 'validating' ? 'Checking session…' : loading ? 'Logging in...' : 'Log in'}
          </button>
        </fieldset>
      </form>
      <p className="mt-7 border-t border-[#e4e6df] pt-6 text-center text-sm text-[#64716a]">
        New to RoadWheels?{' '}
        <Link to="/signup" state={from ? { from } : undefined} className="font-semibold text-[#bc4c2a] underline-offset-4 hover:text-[#a43c1e] hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;
