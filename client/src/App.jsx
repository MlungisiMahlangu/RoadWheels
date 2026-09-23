import { Component, Fragment, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, Navigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Icon from './components/Icon';
import ScrollToTop from './components/ScrollToTop';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const BrowseCars = lazy(() => import('./pages/BrowseCars'));
const CarDetail = lazy(() => import('./pages/CarDetail'));
const BookingConfirm = lazy(() => import('./pages/BookingConfirm'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const Contact = lazy(() => import('./pages/Contact'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function RouteLoading({ session = false }) {
  return <div className="page-shell flex items-center justify-center gap-3 py-20" role="status"><span aria-hidden="true" className="size-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" /><p>{session ? 'Checking your session…' : 'Loading your next stop…'}</p></div>;
}

class RouteErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return (
      <div className="page-shell"><div className="empty-state" role="alert">
        <h1 className="page-title">We couldn’t load this page.</h1>
        <p>Please check your connection and reload to get the latest version of RoadWheels.</p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>Reload</button>
        <Link to="/" className="btn-secondary">Back to home</Link>
      </div></div>
    );
    return this.props.children;
  }
}

// This effect commits with the actual lazy page, not its loading fallback.
function Page({ children }) {
  return <>{children}<ScrollToTop /></>;
}

function ProtectedRoute({ children, admin = false }) {
  const { user, sessionStatus, sessionKey } = useAuth();
  const location = useLocation();
  if (sessionStatus === 'validating') return <RouteLoading session />;
  if (sessionStatus === 'error') return null; // The session retry notice remains available above the routes.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  if (!admin && user.role === 'admin') return <Navigate to="/admin" replace />;
  return <Fragment key={sessionKey}>{children}</Fragment>;
}

function App() {
  const { pathname } = useLocation();
  const { sessionStatus, sessionError, retrySession } = useAuth();
  const isAdmin = pathname.startsWith('/admin');
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <a href="#main-content" className="skip-link">Skip to content</a>
      {!isAdmin && <Navbar />}
      <main id="main-content" className="flex-1 min-w-0" tabIndex={-1}>
        {sessionStatus === 'error' && <div className="page-shell"><div className="notice-error" role="alert">
          <p className="font-semibold">We couldn’t verify your session.</p>
          <p className="mt-2">{sessionError} You can still explore cars while we reconnect.</p>
          <div className="mt-4 flex flex-wrap gap-3"><button type="button" className="btn-primary" onClick={retrySession}>Retry session</button><Link to="/browse" className="btn-secondary">Explore cars</Link></div>
        </div></div>}
        <RouteErrorBoundary key={pathname}>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Page><Home /></Page>} />
              <Route path="/login" element={<Page><Login /></Page>} />
              <Route path="/signup" element={<Page><Signup /></Page>} />
              <Route path="/browse" element={<Page><BrowseCars /></Page>} />
              <Route path="/cars/:id" element={<Page><CarDetail /></Page>} />
              <Route path="/book/:id" element={<ProtectedRoute><Page><BookingConfirm /></Page></ProtectedRoute>} />
              <Route path="/my-bookings" element={<ProtectedRoute><Page><MyBookings /></Page></ProtectedRoute>} />
              <Route path="/contact" element={<Page><Contact /></Page>} />
              <Route path="/dashboard" element={<ProtectedRoute><Page><UserDashboard /></Page></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Page><Profile /></Page></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute admin><Page><AdminDashboard /></Page></ProtectedRoute>} />
              <Route path="*" element={<Page><div className="page-shell"><div className="empty-state"><Icon name="pin" size={40} /><p className="eyebrow justify-center">404 · A little off the route</p><h1 className="page-title">Let's get you back on track.</h1><p>This page doesn't exist, but your next journey is still out there.</p><Link to="/" className="btn-primary">Back to home <Icon name="arrow-right" size={16} /></Link></div></div></Page>} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </main>
      {!isAdmin && !isAuthPage && <Footer />}
    </div>
  );
}

export default App;
