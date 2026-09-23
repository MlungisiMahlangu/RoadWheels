import { useState, useEffect, useRef, useId, useCallback } from 'react';
import { api } from '../services/api';

const CATEGORIES = ['Economy', 'Sedan', 'SUV', 'Hatchback', 'Bakkies', 'Minivan (MPV)', 'Truck', 'Luxury'];

const AddCarModal = ({ car, onClose, onSaved }) => {
  const isEditing = !!car;
  const id = useId();
  const dialogRef = useRef(null);
  const submitState = useRef('idle');

  const [form, setForm] = useState({
    brand: car?.brand || '',
    name: car?.name || '',
    description: car?.description || '',
    pricePerDay: car?.pricePerDay ?? '',
    seats: car?.seats ?? '',
    year: car?.year ?? '',
    category: car?.category || CATEGORIES[0],
    transmission: car?.transmission || 'Manual',
    fuelType: car?.fuelType || 'Petrol',
    color: car?.color || '',
    location: car?.location || '',
    mileage: car?.mileage ?? '',
    images: Array.isArray(car?.images) ? car.images.join(', ') : (car?.images || ''),
    features: Array.isArray(car?.features) ? car.features.join(', ') : (car?.features || ''),
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleClose = useCallback(() => {
    if (submitState.current !== 'submitting') onClose();
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const focusable = () => [...dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
      if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (!dialog.contains(document.activeElement) || document.activeElement === dialog) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const containFocus = (event) => {
      if (dialog.isConnected && !dialog.contains(event.target)) (focusable()[0] || dialog).focus();
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('focusin', containFocus);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('focusin', containFocus);
    };
  }, [handleClose]);

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (dialogRef.current.querySelector('input') || dialogRef.current).focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    if (showSuccess) dialogRef.current?.focus();
  }, [showSuccess]);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitState.current !== 'idle') return;
    submitState.current = 'submitting';
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        pricePerDay: Number(form.pricePerDay),
        seats: Number(form.seats),
        year: Number(form.year),
        mileage: Number(form.mileage) || 0,
        images: form.images.split(',').map((s) => s.trim()).filter(Boolean),
        features: form.features.split(',').map((s) => s.trim()).filter(Boolean),
      };

      if (isEditing) {
        await api.updateCar(car._id, payload);
      } else {
        await api.createCar(payload);
      }
    } catch (err) {
      submitState.current = 'idle';
      setError(err.message || 'Unable to save this car. Please try again.');
      setSubmitting(false);
      return;
    }
    submitState.current = 'saved';
    setSubmitting(false);
    setShowSuccess(true);
    // Refresh now; onSaved may unmount us, and Done must not trigger another save/refresh.
    onSaved();
  };

  const title = isEditing ? 'Edit Car' : 'Add New Car';
  const buttonLabel = isEditing ? 'Save Changes' : 'Add Car';
  const submittingLabel = isEditing ? 'Saving...' : 'Adding...';
  const successTitle = isEditing ? 'Car Updated' : 'Car Added';
  const successMessage = isEditing
    ? `${form.brand} ${form.name} has been updated successfully.`
    : `${form.brand} ${form.name} has been added to your fleet.`;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6" onClick={handleClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={showSuccess ? `${id}-success` : undefined}
        tabIndex={-1}
        className="panel shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id={`${id}-title`} className="text-xl font-bold">{showSuccess ? successTitle : title}</h2>
          <button type="button" onClick={handleClose} disabled={submitting} aria-label="Close dialog" className="icon-button text-2xl leading-none text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-50">
            ×
          </button>
        </div>

        {showSuccess ? (
          <>
            <p id={`${id}-success`} className="text-sm text-[var(--color-text-muted)] leading-7 mb-6">{successMessage}</p>
            <button type="button" onClick={handleClose} className="btn-primary w-full">Done</button>
          </>
        ) : (
          <form onSubmit={handleSubmit} aria-busy={submitting}>
            {error && <p className="notice-error mb-4" role="alert">{error}</p>}
            {submitting && <p className="sr-only" role="status">{submittingLabel}</p>}
            <fieldset disabled={submitting} className="min-w-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Brand" value={form.brand} onChange={update('brand')} required />
                <Field label="Model" value={form.name} onChange={update('name')} required />
              </div>

              <div>
                <label htmlFor={`${id}-description`} className="field-label">Description</label>
                <textarea
                  id={`${id}-description`}
                  value={form.description}
                  onChange={update('description')}
                  required
                  rows={3}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <Field label="Price/day (R)" type="number" min="0.01" max="100000" step="0.01" value={form.pricePerDay} onChange={update('pricePerDay')} required />
                <Field label="Seats" type="number" min="1" max="60" step="1" value={form.seats} onChange={update('seats')} required />
                <Field label="Year" type="number" min="1950" max={new Date().getFullYear() + 2} step="1" value={form.year} onChange={update('year')} required />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <Select label="Category" value={form.category} onChange={update('category')} options={CATEGORIES} />
                <Select label="Transmission" value={form.transmission} onChange={update('transmission')} options={['Manual', 'Automatic']} />
                <Select label="Fuel Type" value={form.fuelType} onChange={update('fuelType')} options={['Petrol', 'Diesel', 'Electric', 'Hybrid']} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Color" value={form.color} onChange={update('color')} required />
                <Field label="Location" value={form.location} onChange={update('location')} required />
              </div>

              <Field label="Mileage (km)" type="number" min="0" max="2000000" step="1" value={form.mileage} onChange={update('mileage')} />

              <Field
                label="Image URLs (comma-separated)"
                value={form.images}
                onChange={update('images')}
                placeholder="https://... , https://..."
              />
              <Field
                label="Features (comma-separated)"
                value={form.features}
                onChange={update('features')}
                placeholder="Bluetooth, Cruise Control, Sunroof"
              />

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleClose} disabled={submitting} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? submittingLabel : buttonLabel}
                </button>
              </div>
            </fieldset>
          </form>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, ...props }) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <input {...props} id={id} className="input-field" />
    </div>
  );
};

const Select = ({ label, options, ...props }) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <select {...props} id={id} className="input-field">
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
};

export default AddCarModal;
