const mongoose = require('mongoose');

const normalizeCategory = (value) => typeof value === 'string' && value.trim() === 'Minivan(MPV)' ? 'Minivan (MPV)' : value;
const isSafeImageUrl = (value) => {
    if (typeof value !== 'string' || !value || value.length > 2048 ||
        /[\\\u0000-\u0020\u007f]/.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value)) return false;
    if (value.startsWith('/')) return !/^\/(?:\/|%2f)/i.test(value);
    if (!/^https?:\/\//i.test(value)) return false;
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
    } catch {
        return false;
    }
};
const boundedText = (maxlength) => ({ type: String, required: true, trim: true, minlength: 1, maxlength });

const carSchema = new mongoose.Schema({
    name: boundedText(120),
    brand: boundedText(80),
    description: boundedText(5000),
    images: {
        type: [{ ...boundedText(2048), validate: isSafeImageUrl }],
        default: [], validate: (value) => Array.isArray(value) && value.length <= 20,
    },
    pricePerDay: { type: Number, required: true, min: Number.MIN_VALUE, max: 100000, validate: Number.isFinite },
    category: {
        ...boundedText(60),
        set(value) {
            // Query setters must preserve the legacy spelling in $in filters.
            return this instanceof mongoose.Document ? normalizeCategory(value) : value;
        },
    },
    transmission: { type: String, enum: ['Manual', 'Automatic'], required: true },
    fuelType: { type: String, enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid'], required: true },
    seats: { type: Number, required: true, min: 1, max: 60, validate: Number.isInteger },
    color: boundedText(60),
    year: {
        type: Number, required: true, min: 1950,
        validate: (value) => Number.isInteger(value) && value <= new Date().getFullYear() + 2,
    },
    mileage: { type: Number, default: 0, min: 0, max: 2000000, validate: Number.isFinite },
    location: boundedText(120),
    features: {
        type: [boundedText(100)], default: [],
        validate: (value) => Array.isArray(value) && value.length <= 50,
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    isAvailable: { type: Boolean, default: true },
    reservationVersion: { type: Number, default: 0, select: false },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            delete ret.reservationVersion;
            return ret;
        },
    },
});

carSchema.statics.normalizeCategory = normalizeCategory;
carSchema.statics.isSafeImageUrl = isSafeImageUrl;
carSchema.index({ isAvailable: 1, createdAt: -1 });
carSchema.index({ isAvailable: 1, category: 1, location: 1, pricePerDay: 1 });

module.exports = mongoose.model('Car', carSchema);
