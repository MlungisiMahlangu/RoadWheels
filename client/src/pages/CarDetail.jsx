import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CarDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [car, setCar] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');

  useEffect(() => {
    const fetchCar = async () => {
      try {
        const data = await api.getCar(id);
        setCar(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCar();
  }, [id]);

  const days = pickupDate && returnDate
    ? Math.max(1, Math.ceil((new Date(returnDate) - new Date(pickupDate)) / (1000 * 60 * 60 * 24)))
    : 0;
  const total = days * (car?.pricePerDay || 0);

  const handleBook = () => {
    if (!user) return navigate('/login');
    if (user.role === 'admin') return; // admins can't book
    navigate(`/book/${car._id}`, { state: { pickupDate, returnDate } });
  };

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-24 text-center">Loading...</div>;
  if (!car) return <div className="max-w-7xl mx-auto px-6 py-24 text-center">Car not found.</div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 grid lg:grid-cols-[1.4fr_1fr] gap-12">
      {/* Left: gallery + details */}
      <div>
        <div className="rounded-2xl overflow-hidden aspect-[16/10] mb-3">
          <img src={car.images?.[activeImage] || '/placeholder-car.png'} alt={car.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex gap-3 mb-8">
          {car.images?.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className={`w-20 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                activeImage === i ? 'border-[var(--color-accent)]' : 'border-transparent'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>

        <h1 className="text-3xl font-bold mb-1">{car.brand} {car.name}</h1>
        <div className="flex items-center gap-3 text-[var(--color-text-muted)] mb-6">
          <span>{car.year} · {car.location}</span>
          <span className="px-2.5 py-0.5 bg-gray-100 rounded-full text-xs font-medium">{car.category}</span>
          {car.rating > 0 && (
            <span className="flex items-center gap-1 text-sm">
              ★ <span className="font-medium text-[var(--color-text)]">{car.rating.toFixed(1)}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Transmission', value: car.transmission },
            { label: 'Fuel Type', value: car.fuelType },
            { label: 'Seats', value: car.seats },
            { label: 'Color', value: car.color },
            { label: 'Mileage', value: `${car.mileage?.toLocaleString() || 0} km` },
          ].map((spec) => (
            <div key={spec.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4 text-center">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">{spec.label}</p>
              <p className="font-semibold">{spec.value}</p>
            </div>
          ))}
        </div>

        <h2 className="font-semibold text-lg mb-3">About this car</h2>
        <p className="text-[var(--color-text-muted)] mb-8">{car.description}</p>

        {car.features?.length > 0 && (
          <>
            <h2 className="font-semibold text-lg mb-3">Features</h2>
            <div className="flex flex-wrap gap-2">
              {car.features.map((f) => (
                <span key={f} className="px-3 py-1.5 bg-gray-100 rounded-full text-sm">{f}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right: sticky booking panel */}
      <div className="lg:sticky lg:top-24 h-fit bg-white border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
        <div className="flex items-baseline gap-1 mb-6">
          <span className="text-3xl font-bold">R{car.pricePerDay}</span>
          <span className="text-[var(--color-text-muted)]">/ day</span>
        </div>

        {user?.role === 'admin' ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--color-text-muted)]">Admin accounts cannot book cars.</p>
            <Link to="/admin" className="text-sm text-[var(--color-accent)] font-medium hover:underline mt-2 inline-block">
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1.5">Pickup date</label>
            <input
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Return date</label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              min={pickupDate}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
        </div>

        {days > 0 && (
          <div className="flex justify-between text-sm mb-4 pb-4 border-b border-[var(--color-border)]">
            <span className="text-[var(--color-text-muted)]">{days} day{days > 1 ? 's' : ''} × R{car.pricePerDay}</span>
            <span className="font-semibold">R{total}</span>
          </div>
        )}

        <button
          onClick={handleBook}
          disabled={!pickupDate || !returnDate}
          className="w-full py-3.5 rounded-full bg-[var(--color-accent)] text-white font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {user ? 'Continue to Book' : 'Log in to Book'}
        </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CarDetail;
