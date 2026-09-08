const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  car: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
  pickupDate: { type: Date, required: true },
  returnDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled'], default: 'pending' },
  totalPrice: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);