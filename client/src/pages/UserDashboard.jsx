import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CarCard from '../components/CarCard';

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

const UserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [featuredCars, setFeaturedCars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    Promise.all([api.getMyBookings(), api.getCars()])
      .then(([b, c]) => {
        setBookings(b);
        setFeaturedCars(c.slice(0, 3));
      })
      .finally(() => setLoading(false));
  }, []);

  const upcoming = bookings.find((b) => ['pending', 'confirmed'].includes(b.status));
  const active = bookings.find((b) => b.status === 'active');
  const totalTrips = bookings.filter((b) => b.status === 'completed').length;

  if (loading) return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 text-center">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-bold mb-1">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
      <p className="text-[var(--color-text-muted)] mb-8">Here's what's happening with your rentals.</p>

      {/* Stat cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5">
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Active Rental</p>
          <p className="text-xl font-bold">{active ? `${active.car?.brand} ${active.car?.name}` : 'None'}</p>
        </div>
        <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5">
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Upcoming Booking</p>
          <p className="text-xl font-bold">{upcoming ? new Date(upcoming.pickupDate).toLocaleDateString() : 'None'}</p>
        </div>
        <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5">
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Completed Trips</p>
          <p className="text-xl font-bold">{totalTrips}</p>
        </div>
      </div>

      {/* Active/upcoming booking highlight */}
      {(active || upcoming) && (
        <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5 mb-10 flex flex-col sm:flex-row gap-4 items-center">
          <img
            src={(active || upcoming).car?.images?.[0]}
            alt=""
            className="w-full sm:w-32 aspect-[4/3] object-cover rounded-xl"
          />
          <div className="flex-1">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium capitalize mb-2 ${STATUS_STYLES[(active || upcoming).status]}`}>
              {(active || upcoming).status}
            </span>
            <h3 className="font-semibold text-lg">{(active || upcoming).car?.brand} {(active || upcoming).car?.name}</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              {new Date((active || upcoming).pickupDate).toLocaleDateString()} → {new Date((active || upcoming).returnDate).toLocaleDateString()}
            </p>
          </div>
          <Link to="/my-bookings" className="text-[var(--color-accent)] font-semibold text-sm hover:underline whitespace-nowrap">
            View details →
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-4 mb-12">
        <Link to="/browse" className="bg-[var(--color-accent)] text-white rounded-2xl p-5 hover:bg-[var(--color-accent-hover)] transition-colors">
          <p className="font-semibold mb-1">Browse Cars</p>
          <p className="text-sm text-white/80">Find your next ride</p>
        </Link>
        <Link to="/my-bookings" className="bg-white border border-[var(--color-border)] rounded-2xl p-5 hover:border-[var(--color-accent)] transition-colors">
          <p className="font-semibold mb-1">My Bookings</p>
          <p className="text-sm text-[var(--color-text-muted)]">View booking history</p>
        </Link>
        <Link to="/profile" className="bg-white border border-[var(--color-border)] rounded-2xl p-5 hover:border-[var(--color-accent)] transition-colors">
          <p className="font-semibold mb-1">My Profile</p>
          <p className="text-sm text-[var(--color-text-muted)]">Manage your details</p>
        </Link>
      </div>

      {/* Recommended cars */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">Recommended for you</h2>
          <Link to="/browse" className="text-[var(--color-accent)] font-medium text-sm hover:underline">View all →</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredCars.map((car) => <CarCard key={car._id} car={car} />)}
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
