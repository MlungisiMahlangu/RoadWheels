import { Link } from 'react-router-dom';
import Logo from './Logo';

const Footer = () => {
  return (
    <footer className="bg-[#111318] text-white/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
        {/* Brand */}
        <div>
          <div className="text-white mb-4">
            <Logo className="h-9" />
          </div>
          <p className="text-sm mb-4">
            Browse, book, and hit the road in minutes, no hidden fees, no hassle.
          </p>
          <div className="flex gap-3">
            {['Facebook', 'Instagram', 'Twitter'].map((s) => (
              <a
                key={s}
                href="#"
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs hover:bg-[var(--color-accent)] transition-colors"
              >
                {s[0]}
              </a>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div>
          <h3 className="text-white font-semibold mb-4">Quick Links</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
            <li><Link to="/browse" className="hover:text-white transition-colors">Browse Cars</Link></li>
            <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            <li><Link to="/my-bookings" className="hover:text-white transition-colors">My Bookings</Link></li>
            <li><Link to="/signup" className="hover:text-white transition-colors">Sign Up</Link></li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <h3 className="text-white font-semibold mb-4">Company</h3>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
            <li><a href="#" className="hover:text-white transition-colors">FAQ</a></li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h3 className="text-white font-semibold mb-4">Contact</h3>
          <ul className="space-y-2 text-sm">
            <li>support@roadwheels.com</li>
            <li>+27 XX XXX XXXX</li>
            <li>Johannesburg, South Africa</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-6">
        <p className="text-center text-xs text-white/40">
          © {new Date().getFullYear()} RoadWheels. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;