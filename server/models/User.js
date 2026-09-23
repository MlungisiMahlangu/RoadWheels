const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  email: {
    type: String, required: true, unique: true, immutable: true, trim: true, lowercase: true,
    maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  // This field contains a bcrypt hash, not the user-supplied plaintext password.
  password: { type: String, required: true, select: false },
  tokenVersion: { type: Number, default: 0, select: false, min: 0, validate: Number.isSafeInteger },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isSuspended: { type: Boolean, default: false },
  phone: { type: String, default: '', trim: true, maxlength: 32 },
  licenseNumber: { type: String, default: '', trim: true, maxlength: 64 },
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      delete ret.password;
      delete ret.tokenVersion;
      return ret;
    },
  },
});

userSchema.index({ createdAt: -1, _id: -1 });

module.exports = mongoose.model('User', userSchema);
