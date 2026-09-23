import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { today, nextDate, validRentalDates } from '../services/rentalDates';
import CarCard from '../components/CarCard';
import Icon from '../components/Icon';

const categories = ['Economy', 'Sedan', 'SUV', 'Hatchback', 'Bakkies', 'Minivan (MPV)', 'Truck', 'Luxury'];
const filterOptions = { transmission: ['Manual', 'Automatic'], fuelType: ['Petrol', 'Diesel', 'Electric', 'Hybrid'] };
const sortOptions = [['newest', 'Newest additions'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['rating', 'Highest rated']];
const queryKeys = ['category', 'transmission', 'fuelType', 'location', 'search', 'sort', 'pickupDate', 'returnDate'];

export default function BrowseCars() {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(params.get('search') || '');
  const [pickupDate, setPickupDate] = useState(params.get('pickupDate') || '');
  const [returnDate, setReturnDate] = useState(params.get('returnDate') || '');
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    const current = new URLSearchParams(query);
    setSearchInput(current.get('search') || '');
    setPickupDate(current.get('pickupDate') || '');
    setReturnDate(current.get('returnDate') || '');
    setDateError('');
    const pickup = current.get('pickupDate');
    const end = current.get('returnDate');
    if ((pickup || end) && !validRentalDates(pickup, end)) {
      setError('These rental dates are not valid. Choose a pickup from today and a later return date, or clear the filters.');
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    const apiParams = new URLSearchParams();
    queryKeys.forEach((key) => { if (current.get(key)) apiParams.set(key, current.get(key)); });
    api.getCars(apiParams.toString()).then((data) => { if (active) setCars(data); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, retry]);

  const update = (values) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    return next;
  });
  const submitSearch = (e) => {
    e.preventDefault();
    if ((pickupDate || returnDate) && !validRentalDates(pickupDate, returnDate)) {
      setDateError('Choose a pickup from today and return at least one day later.');
      return;
    }
    setDateError('');
    update({ search: searchInput.trim(), pickupDate, returnDate });
  };
  const activeCount = queryKeys.filter((key) => key !== 'sort' && params.get(key)).length;
  const bookingParams = new URLSearchParams();
  if (params.get('pickupDate') && params.get('returnDate')) {
    bookingParams.set('pickupDate', params.get('pickupDate'));
    bookingParams.set('returnDate', params.get('returnDate'));
  }
  const bookingSearch = bookingParams.size ? `?${bookingParams}` : '';

  return (
    <div className="page-shell">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">The RoadWheels collection</p><h1 className="page-title">Find your kind of drive.</h1><p className="page-intro">From everyday plans to out-of-the-ordinary weekends.<br className="hidden sm:block" /> Your next journey starts with the right set of keys.</p></div><span className="hidden lg:flex items-center gap-2 pb-1 text-[11px] text-[var(--color-text-muted)]"><Icon name="pin" size={16} />Made for South African roads</span></div>
      <form onSubmit={submitSearch} className="panel mb-7 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr_auto] items-end">
          <div><label className="field-label" htmlFor="fleet-search">Find a car</label><div className="relative"><Icon name="search" size={17} className="absolute top-4 left-3.5 text-[var(--color-text-muted)]" /><input id="fleet-search" className="input-field !pl-10" placeholder="Try a brand or model" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} maxLength={100} /></div></div>
          <div><label className="field-label" htmlFor="fleet-pickup">Pick-up date</label><input id="fleet-pickup" type="date" className="input-field" min={today()} value={pickupDate} onChange={(e) => { setPickupDate(e.target.value); if (returnDate && returnDate <= e.target.value) setReturnDate(''); }} /></div>
          <div><label className="field-label" htmlFor="fleet-return">Return date</label><input id="fleet-return" type="date" className="input-field" min={nextDate(pickupDate || today())} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></div>
          <button className="btn-primary !rounded-xl" type="submit"><Icon name="search" size={16} />Search</button>
        </div>
        {dateError && <p className="notice-error mt-3" role="alert">{dateError}</p>}
      </form>

      <div className="mb-8 flex gap-2 overflow-x-auto pb-2" aria-label="Car categories">
        {['All cars', ...categories].map((category) => { const value = category === 'All cars' ? '' : category; return <button key={category} className={`filter-chip ${params.get('category') === value || (!params.get('category') && !value) ? 'active' : ''}`} aria-pressed={(params.get('category') || '') === value} onClick={() => update({ category: value })}>{category === 'All cars' && <Icon name="grid" size={13} />}{category === 'Minivan (MPV)' ? 'Minivan' : category}</button>; })}
      </div>

      <div className="browse-layout">
        <div>
          <button className="btn-secondary w-full md:!hidden !justify-between" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-controls="fleet-filters"><span className="flex items-center gap-2"><Icon name="sliders" size={16} />Refine your search{activeCount > 0 ? ` (${activeCount})` : ''}</span><Icon name="chevron-down" size={16} /></button>
          <aside id="fleet-filters" className={`panel filter-panel browse-filters mt-3 md:mt-0 ${filtersOpen ? 'is-open' : ''}`} aria-label="Refine cars">
            <div className="mb-6 flex items-center justify-between gap-2"><h2 className="font-semibold text-base !tracking-tight flex items-center gap-2"><Icon name="sliders" size={17} />Filters</h2>{activeCount > 0 && <button className="text-[10px] font-medium text-[var(--color-accent)]" onClick={() => setParams({})}>Reset all</button>}</div>
            <div className="mb-6"><label className="field-label" htmlFor="fleet-location">Pick-up location</label><select id="fleet-location" className="input-field !text-xs !px-3" value={params.get('location') || ''} onChange={(e) => update({ location: e.target.value })}><option value="">All locations</option>{['Johannesburg', 'Pretoria', 'Cape Town', 'Durban'].map((city) => <option key={city}>{city}</option>)}</select></div>
            {Object.entries(filterOptions).map(([key, options]) => <fieldset key={key} className="filter-group"><legend>{key === 'fuelType' ? 'Fuel type' : 'Transmission'}</legend><div>{options.map((option) => <label key={option} className="filter-option"><input type="checkbox" checked={params.get(key) === option} onChange={() => update({ [key]: params.get(key) === option ? '' : option })} />{option}</label>)}</div></fieldset>)}
          </aside>
          <div className="hidden md:block px-3 py-7"><Icon name="mail" size={21} className="text-[var(--color-accent)] mb-3" /><h3 className="text-sm font-semibold mb-2">Need a little guidance?</h3><p className="text-[11px] leading-6 text-[var(--color-text-muted)] mb-3">We'll help you find the right car for your plans.</p><a className="text-link !text-[11px]" href="mailto:support@roadwheels.com">Talk to our team <Icon name="arrow-up-right" size={13} /></a></div>
        </div>
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--color-text-muted)]" role="status">{loading ? 'Finding your next drive…' : error ? 'Collection unavailable' : <><strong className="text-[var(--color-text)]">{cars.length}</strong> car{cars.length !== 1 ? 's' : ''} {bookingSearch ? 'available for your dates' : 'to explore'}</>}</p>
            <label className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">Sort by<select className="bg-transparent font-medium text-[var(--color-text)] py-2 max-w-40" value={params.get('sort') || 'newest'} onChange={(e) => update({ sort: e.target.value })}>{sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          {loading ? <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5" aria-label="Loading cars">{[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="skeleton h-80" />)}</div> : error ? <div className="empty-state" role="alert"><Icon name="car" size={34} /><h2>A short pit stop.</h2><p>{error}</p><div className="flex flex-wrap justify-center gap-3"><button className="btn-primary" onClick={() => setRetry(retry + 1)}>Try again</button>{activeCount > 0 && <button className="btn-secondary" onClick={() => setParams({})}>Clear filters</button>}</div></div> : cars.length === 0 ? <div className="empty-state"><Icon name="search" size={34} /><h2>No matches. Plenty of possibilities.</h2><p>Try a different location, category or set of dates to find your next drive.</p>{activeCount > 0 && <button className="btn-primary" onClick={() => setParams({})}>Clear all filters <Icon name="arrow-right" size={16} /></button>}</div> : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{cars.map((car) => <CarCard key={car._id} car={car} search={bookingSearch} />)}</div>}
        </div>
      </div>
    </div>
  );
}
