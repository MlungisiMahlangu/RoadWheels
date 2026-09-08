import { useState, useEffect } from 'react';
import { api } from '../services/api';
import CarCard from '../components/CarCard';

const FILTER_OPTIONS = {
  category: ['Economy','Sedan', 'SUV','Hatchback','Bakkies','Minivan(MPV)','Truck','Luxury'],
  transmission: ['Manual', 'Automatic'],
  fuelType: ['Petrol', 'Diesel', 'Electric', 'Hybrid'],
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Highest rated' },
];

const Browse = () => {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ category: '', transmission: '', fuelType: '' });
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [location, setLocation] = useState('');
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    const fetchCars = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams(
          Object.entries({ ...filters, search, location, sort }).filter(([_, v]) => v)
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
  }, [filters, search, location, sort]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? '' : value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const hasActiveFilters = filters.category || filters.transmission || filters.fuelType || search || location;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Browse Cars</h1>

      {/* Search + location + sort bar */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl p-4 mb-6 grid gap-3 md:grid-cols-[1fr_180px_190px]">
        <form onSubmit={handleSearch} className="relative">
          <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by brand or model..."
            className="w-full pl-11 pr-24 border border-[var(--color-border)] rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-full bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            Search
          </button>
        </form>
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="border border-[var(--color-border)] rounded-full px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        >
          <option value="">All locations</option>
          {['Johannesburg', 'Pretoria', 'Cape Town', 'Durban'].map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border border-[var(--color-border)] rounded-full px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Quick filters */}
      <div className="space-y-4 mb-6">
        {Object.entries(FILTER_OPTIONS).map(([key, options]) => (
          <div key={key} className="flex items-start gap-3 flex-wrap">
            <span className="text-sm font-semibold min-w-[92px] pt-1.5">{key === 'fuelType' ? 'Fuel Type' : key}:</span>
            <div className="flex flex-wrap gap-2">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => updateFilter(key, opt)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    filters[key] === opt
                      ? 'bg-[var(--color-accent)] text-white font-medium border-[var(--color-accent)]'
                      : 'border-[var(--color-border)] hover:bg-gray-100'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-[1fr] gap-10">
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
            <div className="text-center py-24">
              <p className="text-[var(--color-text-muted)] mb-3">No cars match your filters. Try adjusting them.</p>
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setFilters({ category: '', transmission: '', fuelType: '' });
                    setSearch('');
                    setSearchInput('');
                    setLocation('');
                  }}
                  className="text-[var(--color-accent)] font-medium text-sm hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                {cars.length} car{cars.length !== 1 ? 's' : ''} found
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {cars.map((car) => (
                  <CarCard key={car._id} car={car} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Browse;
