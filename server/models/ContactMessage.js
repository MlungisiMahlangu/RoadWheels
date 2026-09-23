const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  email: {
    type: String, required: true, trim: true, lowercase: true, maxlength: 254,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  message: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

contactMessageSchema.index({ createdAt: -1, _id: -1 });
contactMessageSchema.index({ isRead: 1, createdAt: -1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
