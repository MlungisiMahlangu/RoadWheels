import { useState } from 'react';
import { api } from '../services/api';
import ConfirmDialog from './ConfirmDialog';

const CATEGORIES = ['Economy', 'Sedan', 'SUV', 'Hatchback', 'Bakkies', 'Minivan (MPV)', 'Truck', 'Luxury'];

const AddCarModal = ({ car, onClose, onSaved }) => {
  const isEditing = !!car;

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

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      setShowSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    onSaved();
    onClose();
  };

  const title = isEditing ? 'Edit Car' : 'Add New Car';
  const buttonLabel = isEditing ? 'Save Changes' : 'Add Car';
  const submittingLabel = isEditing ? 'Saving...' : 'Adding...';
  const successTitle = isEditing ? 'Car Updated' : 'Car Added';
  const successMessage = isEditing
    ? `${form.brand} ${form.name} has been updated successfully.`
    : `${form.brand} ${form.name} has been added to your fleet.`;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">{title}</h2>
            <button onClick={onClose} className="text-2xl leading-none text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              ×
            </button>
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Brand" value={form.brand} onChange={update('brand')} required />
              <Field label="Model" value={form.name} onChange={update('name')} required />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={update('description')}
                required
                rows={3}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <Field label="Price/day (R)" type="number" value={form.pricePerDay} onChange={update('pricePerDay')} required />
              <Field label="Seats" type="number" value={form.seats} onChange={update('seats')} required />
              <Field label="Year" type="number" value={form.year} onChange={update('year')} required />
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

            <Field label="Mileage (km)" type="number" value={form.mileage} onChange={update('mileage')} />

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
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-full border border-[var(--color-border)] font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 rounded-full bg-[var(--color-accent)] text-white font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
              >
                {submitting ? submittingLabel : buttonLabel}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={showSuccess}
        title={successTitle}
        message={successMessage}
        confirmLabel="Done"
        cancelLabel=""
        onConfirm={handleSuccessClose}
        onCancel={handleSuccessClose}
      />
    </>
  );
};

const Field = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium mb-1.5">{label}</label>
    <input
      {...props}
      className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
    />
  </div>
);

const Select = ({ label, options, ...props }) => (
  <div>
    <label className="block text-sm font-medium mb-1.5">{label}</label>
    <select
      {...props}
      className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
    >
      {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);

export default AddCarModal;
