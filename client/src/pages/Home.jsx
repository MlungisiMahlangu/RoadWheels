import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { today, nextDate, validRentalDates } from '../services/rentalDates';
import CarCard from '../components/CarCard';
import Icon from '../components/Icon';

const questions = [
  ['What do I need to rent a car?', 'Bring your valid driver’s license and a form of identification. Contact our team before pickup to confirm any deposit and vehicle-specific requirements.'],
  ['How does booking work?', 'Choose your car and dates, then submit a booking request. Your reservation starts as pending; our team confirms it in your account. You can follow its progress in My bookings.'],
  ['Can I cancel my booking?', 'You can cancel a pending or confirmed booking from My bookings before the pickup date. If your rental has already started, contact our team for help.'],
  ['Where can I collect my car?', 'Each listing shows its pickup city. Filter by Johannesburg, Pretoria, Cape Town or Durban to see the cars currently listed in that location.'],
  ['Have a special request?', 'Need help with pickup arrangements, mileage or a longer rental? Send us a message before you book so our team can help with the details.'],
];

export default function Home() {
  const navigate = useNavigate();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [location, setLocation] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.getCars('sort=rating').then((data) => { if (active) setCars(data.slice(0, 3)); })
      .catch(() => { if (active) setError('We couldn’t load the collection just now. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  const search = (event) => {
    event.preventDefault();
    if ((pickupDate || returnDate) && !validRentalDates(pickupDate, returnDate)) {
      setDateError('Choose a pickup date from today and a return date at least one day later.');
      return;
    }
    const params = new URLSearchParams();
    if (location) params.set('location', location);
    if (pickupDate) { params.set('pickupDate', pickupDate); params.set('returnDate', returnDate); }
    navigate(`/browse${params.size ? `?${params}` : ''}`);
  };

  return (
    <div>
      <section className="home-hero" aria-labelledby="hero-heading">
        <img src="/hero-car-1536.webp" srcSet="/hero-car-768.webp 768w, /hero-car-1280.webp 1280w, /hero-car-1536.webp 1536w" sizes="100vw" width="1536" height="1024" alt="BMW overlooking Cape Town and Table Mountain at sunset" className="hero-image" fetchPriority="high" />
        <div className="hero-shade" />
        <div className="hero-content">
          <p className="hero-kicker">South Africa, on your terms</p>
          <h1 id="hero-heading" className="hero-title">Drive something<br /><span>worth remembering.</span></h1>
          <p className="hero-copy">The city, the coast, the long way home. Find the right car for wherever life takes you next.</p>
          <div className="hero-actions"><Link to="/browse" className="btn-primary">Browse cars <Icon name="arrow-up-right" size={17} /></Link><Link to="/#how-it-works" className="text-link !text-xs">How it works <Icon name="arrow-right" size={15} /></Link></div>
        </div>
        <div className="hero-caption"><strong>A different kind of daily drive.</strong>Cape Town, South Africa</div>
      </section>

      <section className="search-wrap" aria-label="Find a rental car">
        <form className="home-search" onSubmit={search}>
          <div className="search-fields">
            <label className="search-field"><Icon name="pin" /><span><span className="field-label">Pick-up location</span><select value={location} onChange={(e) => setLocation(e.target.value)}><option value="">Where are you headed?</option>{['Johannesburg', 'Pretoria', 'Cape Town', 'Durban'].map((city) => <option key={city}>{city}</option>)}</select></span></label>
            <label className="search-field"><Icon name="calendar" /><span><span className="field-label">Pick-up date</span><input type="date" min={today()} value={pickupDate} onChange={(e) => { setPickupDate(e.target.value); if (returnDate && returnDate <= e.target.value) setReturnDate(''); setDateError(''); }} aria-describedby={dateError ? 'home-date-error' : undefined} /></span></label>
            <label className="search-field"><Icon name="calendar" /><span><span className="field-label">Return date</span><input type="date" min={nextDate(pickupDate || today())} value={returnDate} onChange={(e) => { setReturnDate(e.target.value); setDateError(''); }} aria-describedby={dateError ? 'home-date-error' : undefined} /></span></label>
            <button type="submit" className="btn-primary !rounded-xl !min-h-14"><Icon name="search" size={17} />Find my ride</button>
          </div>
          {dateError && <p id="home-date-error" role="alert" className="notice-error mt-4">{dateError}</p>}
        </form>
        <div className="search-note"><span><Icon name="check" size={13} />Clear daily pricing</span><span><Icon name="check" size={13} />Easy online booking</span><span><Icon name="check" size={13} />Real people, ready to help</span></div>
      </section>

      <div className="brand-strip"><p>A love for cars.<br />A taste for adventure.</p><div className="brand-names" aria-label="Automotive inspiration"><span>BMW</span><span>Mercedes-Benz</span><span>TOYOTA</span><span>Volkswagen</span><span>Audi</span><span>HYUNDAI</span></div></div>

      <section className="home-section">
        <div className="section-heading"><div><p className="eyebrow">Different plans. The right car.</p><h2 className="section-title">What's your kind of journey?</h2></div><p className="page-intro !text-xs !max-w-64">A weekday essential or a weekend escape.<br />Make the drive part of the experience.</p></div>
        <div className="category-grid">
          {[
            { name: 'City essentials', copy: 'Make the everyday effortless.', image: 'sedan', to: '/browse?category=Sedan' },
            { name: 'Room to roam', copy: 'More space. More possibilities.', image: 'suv', to: '/browse?category=SUV' },
            { name: 'A quieter escape', copy: 'Discover a different kind of drive.', image: 'electric', to: '/browse?fuelType=Electric' },
          ].map((category) => <Link key={category.name} to={category.to} className="category-card"><h3>{category.name}</h3><p>{category.copy}</p><span className="category-arrow"><Icon name="arrow-up-right" size={15} /></span><img src={`/collections/${category.image}.webp`} width="800" height="800" alt="" loading="lazy" decoding="async" /></Link>)}
        </div>
      </section>

      <section className="home-section !pt-2">
        <div className="section-heading"><div><p className="eyebrow">The collection</p><h2 className="section-title">Meet your next set of keys.</h2><p className="page-intro">A few standout rides, ready for your next adventure.</p></div><Link to="/browse" className="btn-secondary !text-xs">View the full fleet <Icon name="arrow-up-right" size={15} /></Link></div>
        {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" role="status" aria-label="Loading featured cars">{[1, 2, 3].map((n) => <div key={n} className="skeleton h-96" />)}</div> : error ? <div className="empty-state"><Icon name="car" size={34} /><h2>A short pit stop.</h2><p>{error}</p><button className="btn-secondary" onClick={() => setRetry(retry + 1)}>Try again <Icon name="arrow-right" size={15} /></button></div> : cars.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{cars.map((car) => <CarCard key={car._id} car={car} />)}</div> : <div className="empty-state"><Icon name="car" size={34} /><h2>New journeys are on the way.</h2><p>There are no cars listed right now. Our team can help you plan your next rental.</p><Link to="/contact" className="btn-secondary">Talk to our team</Link></div>}
      </section>

      <section className="experience-section" id="why-roadwheels">
        <div className="experience-inner">
          <div><p className="eyebrow">Less hassle. More open road.</p><h2 className="section-title">The journey should<br />start with a smile.<br /><span className="text-[#efb58d]">Not a stack of forms.</span></h2><p className="page-intro">We keep the details simple, so you can focus on the part that matters. Getting out there.</p><Link to="/browse" className="text-link !text-xs text-[#efb58d]">Find your next drive <Icon name="arrow-up-right" size={16} /></Link></div>
          <div className="experience-features">{[
            ['search', 'Your car, your choice', 'Compare vehicles, locations and daily rates to find a rental that fits your plans.'],
            ['calendar', 'Dates that work for you', 'See availability before you book, with reserved dates checked for your chosen car.'],
            ['key', 'Every detail in one place', 'Track your booking from request to return, right from your personal dashboard.'],
            ['mail', 'A real team behind you', 'Questions about your next drive? Get in touch. We’re here to help with the details.'],
          ].map(([icon, title, copy]) => <div key={title}><Icon name={icon} size={26} /><h3>{title}</h3><p>{copy}</p></div>)}</div>
        </div>
      </section>

      <section className="home-section" id="how-it-works">
        <div className="section-heading"><div><p className="eyebrow">From screen to scenic route</p><h2 className="section-title">A little planning. A lot of possibility.</h2></div><span className="text-xs text-[var(--color-text-muted)]">Your next journey, in three simple steps.</span></div>
        <div className="steps-grid">{[
          ['01', 'Find your fit.', 'Choose your location and dates. Explore the cars and find the one that feels right.'],
          ['02', 'Make it yours.', 'Sign in, review your rental details and send your request. Follow confirmation in your bookings.'],
          ['03', 'Take the long way.', 'Once confirmed, collect your keys at the agreed location. The next chapter is all yours.'],
        ].map(([step, title, copy]) => <div className="step-card" key={step}><div className="step-top"><span>{step}</span></div><h3>{title}</h3><p>{copy}</p></div>)}</div>
      </section>

      <section className="border-t border-[var(--color-border)] bg-white" id="faq"><div className="home-section faq-layout"><div><p className="eyebrow">A few things worth knowing</p><h2 className="section-title">Good questions.<br />Straight answers.</h2><p className="page-intro mt-5 !text-sm">A little clarity before you hit the road.</p><Link to="/contact" className="text-link mt-6 text-[var(--color-accent)] !text-xs">Still curious? Let's talk <Icon name="arrow-up-right" size={16} /></Link></div><div>{questions.map(([question, answer]) => <details key={question} className="faq-item"><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></div></section>
      <section className="home-cta"><div><p className="eyebrow !mb-3">The best stories start with a drive</p><h2 className="section-title !text-3xl">Where to next?</h2></div><Link to="/browse" className="btn-primary">Let's find your ride <Icon name="arrow-up-right" size={17} /></Link></section>
    </div>
  );
}
