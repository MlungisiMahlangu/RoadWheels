import { Routes, Route, useLocation, Navigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Icon from './components/Icon';
import ScrollToTop from './components/ScrollToTop';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import BrowseCars from './pages/BrowseCars';
import CarDetail from './pages/CarDetail';
import BookingConfirm from './pages/BookingConfirm';
import MyBookings from './pages/MyBookings';
import Contact from './pages/Contact';
import UserDashboard from './pages/UserDashboard';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';

function ProtectedRoute({ children, admin = false }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  if (!admin && user.role === 'admin') return <Navigate to="/admin" replace />;
  return children;
}

function App() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <ScrollToTop />
      <a href="#main-content" className="skip-link">Skip to content</a>
      {!isAdmin && <Navbar />}
      <main id="main-content" className="flex-1 min-w-0" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/browse" element={<BrowseCars />} />
          <Route path="/cars/:id" element={<CarDetail />} />
          <Route path="/book/:id" element={<ProtectedRoute><BookingConfirm /></ProtectedRoute>} />
          <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute admin><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<div className="page-shell"><div className="empty-state"><Icon name="pin" size={40} /><p className="eyebrow justify-center">404 · A little off the route</p><h1 className="page-title">Let's get you back on track.</h1><p>This page doesn't exist, but your next journey is still out there.</p><Link to="/" className="btn-primary">Back to home <Icon name="arrow-right" size={16} /></Link></div></div>} />
        </Routes>
      </main>
      {!isAdmin && !isAuthPage && <Footer />}
    </div>
  );
}

export default App;
