import { Link } from 'react-router-dom';
import Logo from './Logo';
import Icon from './Icon';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link to="/" aria-label="RoadWheels home" className="inline-block text-white"><Logo className="h-10" /></Link>
          <p className="mt-5 max-w-60 text-xs leading-7">Good cars. Great journeys.<br />A simpler way to explore South Africa, one drive at a time.</p>
          <p className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-widest"><Icon name="pin" size={13} /> Made for the open road</p>
        </div>
        <div>
          <h2 className="footer-title">Explore</h2>
          <div className="footer-links">
            <Link to="/browse">Our collection</Link>
            <Link to="/browse?category=SUV">SUVs & adventures</Link>
            <Link to="/browse?category=Luxury">A little more luxury</Link>
            <Link to="/#how-it-works">How it works</Link>
          </div>
        </div>
        <div>
          <h2 className="footer-title">Your journey</h2>
          <div className="footer-links">
            <Link to="/dashboard">Your account</Link>
            <Link to="/my-bookings">My bookings</Link>
            <Link to="/#faq">Common questions</Link>
            <Link to="/contact">Get in touch</Link>
          </div>
        </div>
        <div className="footer-contact">
          <h2 className="footer-title">Let's talk</h2>
          <div className="footer-links">
            <a href="mailto:support@roadwheels.com">support@roadwheels.com</a>
            <span>Johannesburg, South Africa</span>
            <span className="text-[10px] leading-6">Monday–Friday · 07:00–18:00<br />Saturday · 08:00–14:00</span>
            <Link to="/contact" className="text-link !text-[11px] text-[#efb58d]">Send us a message <Icon name="arrow-up-right" size={14} /></Link>
          </div>
        </div>
      </div>
      <div className="footer-bottom"><p>© {new Date().getFullYear()} RoadWheels. All rights reserved.</p><p>Designed & built by <span className="text-white">Mlungisi Mahlangu</span>.</p></div>
    </footer>
  );
}
