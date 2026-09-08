import { useState, useEffect } from 'react';
import { api } from '../services/api';
import CarCard from '../components/CarCard';

const FILTER_OPTIONS = {
  category: ['Economy','Sedan', 'SUV','Hatchback','Bakkies','Minivan(MPV)','Truck','Luxury'],
  transmission: ['Manual', 'Automatic'],
  fuelType: ['Petrol', 'Diesel', 'Electric', 'Hybrid'],
};

const Browse = () => {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ category: '', transmission: '', fuelType: '' });

  useEffect(() => {
    const fetchCars = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams(
          Object.entries(filters).filter(([_, v]) => v)
        ).toString();
        const data = await api.getCars(params);
        setCars(data);
      } catch (err) {
        console.error('Fetch cars error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCars();
  }, [filters]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? '' : value }));
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-8">Browse Cars</h1>

      <div className="grid md:grid-cols-[240px_1fr] gap-10">
        {/* Filters sidebar */}
        <aside className="space-y-8">
          {Object.entries(FILTER_OPTIONS).map(([key, options]) => (
            <div key={key}>
              <h3 className="font-semibold mb-3 capitalize">{key === 'fuelType' ? 'Fuel Type' : key}</h3>
              <div className="space-y-2">
                {options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => updateFilter(key, opt)}
                    className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      filters[key] === opt
                        ? 'bg-[var(--color-accent)] text-white font-medium'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* Car grid */}
        <div>
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-2xl aspect-[4/3] animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-24">
              <p className="text-red-500 mb-2">Failed to load cars</p>
              <p className="text-sm text-[var(--color-text-muted)]">{error}</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">
                Make sure the server is running on port 5000.
              </p>
            </div>
          ) : cars.length === 0 ? (
            <div className="text-center py-24 text-[var(--color-text-muted)]">
              No cars match your filters. Try adjusting them.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cars.map((car) => (
                <CarCard key={car._id} car={car} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Browse;