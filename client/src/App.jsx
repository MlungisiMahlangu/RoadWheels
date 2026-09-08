import { Routes, Route, useLocation } from 'react-router-dom';
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

function App() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <ScrollToTop />
      {!isAdmin && <Navbar />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/browse" element={<BrowseCars />} />
          <Route path="/cars/:id" element={<CarDetail />} />
          <Route path="/book/:id" element={<BookingConfirm />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>
      {!isAdmin && !isAuthPage && <Footer />}
    </div>
  );
}

export default App;
