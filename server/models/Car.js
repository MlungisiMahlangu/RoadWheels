const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
    name: { type: String, required: true },
    brand: { type: String, required: true },
    description: { type: String, required: true },
    images: [{ type: String }],
    pricePerDay: { type: Number, required: true },
    category: { type: String, required: true },
    transmission: { type: String, enum: ['Manual', 'Automatic'], required: true },
    fuelType: { type: String, enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid'], required: true },
    seats: { type: Number, required: true },
    color: { type: String, required: true },
    year: { type: Number, required: true },
    mileage: { type: Number, default: 0 },
    location: { type: String, required: true },
    features: [{ type: String }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Car', carSchema);
