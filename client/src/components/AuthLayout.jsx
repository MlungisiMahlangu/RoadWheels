import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';

export const PasswordField = ({ id, label, value, onChange, autoComplete, minLength, description }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="field-label">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          aria-describedby={description ? `${id}-hint` : undefined}
          className="input-field"
          style={{ paddingRight: '4.5rem' }}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-1 right-1 w-16 rounded-lg text-xs font-semibold text-[#bc4c2a] transition-colors hover:bg-[#f7f7f2] hover:text-[#a43c1e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc4c2a]"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {description && <p id={`${id}-hint`} className="mt-2 text-xs leading-relaxed text-[#64716a]">{description}</p>}
    </div>
  );
};

const AuthLayout = ({ eyebrow, title, intro, visualTitle, visualDescription, children }) => (
  <div className="bg-[#f7f7f2] text-[#18221f]">
    <div className="page-shell">
      <div className="grid overflow-hidden rounded-[28px] border border-[#dedfd8] bg-white lg:grid-cols-[0.95fr_1fr]">
        <aside className="relative isolate hidden flex-col justify-between bg-[#18221f] text-white lg:flex lg:min-h-[680px] lg:p-12">
          <picture>
            <source media="(min-width: 1024px)" srcSet="/hero-car-768.webp 768w, /hero-car-1280.webp 1280w" sizes="50vw" />
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
              alt=""
              width="1536"
              height="1024"
              className="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_center]"
            />
          </picture>
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#18221f]/50 via-[#18221f]/10 to-[#18221f]/95" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em]">RoadWheels / Rent. Drive. Explore.</p>
          <div className="mt-20 max-w-sm lg:mt-64">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-white/75">A little further. A little freer.</p>
            <h2 className="text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">{visualTitle}</h2>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/80">{visualDescription}</p>
          </div>
        </aside>

        <section aria-labelledby="auth-title" className="flex min-w-0 items-center px-6 py-10 sm:px-10 sm:py-12 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <Link to="/" aria-label="RoadWheels home" className="mb-9 inline-block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#bc4c2a]">
              <Logo className="h-9 w-auto text-[#18221f]" />
            </Link>
            <p className="eyebrow mb-3">{eyebrow}</p>
            <h1 id="auth-title" className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-3 mb-8 text-sm leading-relaxed text-[#64716a]">{intro}</p>
            {children}
          </div>
        </section>
      </div>
      <p className="mt-6 text-center text-xs text-[#64716a]">
        A question before you get started?{' '}
        <Link to="/contact" className="font-medium text-[#18221f] underline decoration-[#bc4c2a]/40 underline-offset-4 hover:text-[#bc4c2a]">Talk to our team</Link>
      </p>
    </div>
  </div>
);

export default AuthLayout;
