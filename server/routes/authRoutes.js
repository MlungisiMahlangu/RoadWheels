const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protectedRoute, adminOnly } = require('../middleware/auth');
const { HttpError } = require('../middleware/errors');

const router = express.Router();
const USER_FIELDS = '_id name email role isSuspended phone licenseNumber createdAt updatedAt';

function validateBody(body, allowed) {
    if (!body || (Object.getPrototypeOf(body) !== Object.prototype && Object.getPrototypeOf(body) !== null) ||
        Object.keys(body).some((key) => !allowed.includes(key))) {
        throw new HttpError(400, 'Request must be an object containing only supported fields');
    }
}

function text(value, field, max, allowEmpty = false) {
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value) ||
        (!allowEmpty && !value.trim())) {
        throw new HttpError(400, `${field} must be ${allowEmpty ? 'a' : 'a nonblank'} string of at most ${max} characters`);
    }
    return value.trim();
}

function emailAddress(value) {
    const email = text(value, 'Email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'A valid email is required');
    return email;
}

function validatePassword(value, strong = false) {
    // Never trim passwords or silently permit bcrypt's 72-byte truncation.
    if (typeof value !== 'string' || !value.length || Buffer.byteLength(value, 'utf8') > 72) {
        throw new HttpError(400, 'Password must be a nonempty string of at most 72 UTF-8 bytes');
    }
    if (strong && (value.length < 8 || !/[A-Z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value))) {
        throw new HttpError(400, 'Password must be at least 8 characters with an uppercase letter, number, and special character');
    }
}

function userDTO(user) {
    const result = { id: user._id };
    for (const field of USER_FIELDS.split(' ')) {
        if (user[field] !== undefined) result[field] = user[field];
    }
    return result;
}

function signToken(user) {
    return jwt.sign({ id: user._id.toString(), role: user.role, ver: user.tokenVersion ?? 0 },
        process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1d' });
}

function validateId(id) {
    if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw new HttpError(400, 'Invalid user ID');
}

// Legacy records without a stored version behave as version zero, without a migration.
function expectedVersion(version) {
    return version === 0 ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] } : { tokenVersion: version };
}

router.post('/signup', async (req, res, next) => {
    try {
        validateBody(req.body, ['name', 'email', 'password']);
        const name = text(req.body.name, 'Name', 120);
        const email = emailAddress(req.body.email);
        validatePassword(req.body.password, true);
        if (await User.findOne({ email })) throw new HttpError(400, 'Email already in use');
        const password = await bcrypt.hash(req.body.password, 10);
        const user = await User.create({ name, email, password });
        res.status(201).json({ token: signToken(user), user: userDTO(user) });
    } catch (err) {
        // The unique index also covers simultaneous signups for the same address.
        next(err.code === 11000 ? new HttpError(400, 'Email already in use') : err);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        validateBody(req.body, ['email', 'password']);
        const email = emailAddress(req.body.email);
        validatePassword(req.body.password);
        const user = await User.findOne({ email }).select('+password +tokenVersion');
        if (!user || !await bcrypt.compare(req.body.password, user.password)) {
            throw new HttpError(401, 'Invalid credentials');
        }
        if (user.isSuspended) throw new HttpError(403, 'This account has been suspended', 'ACCOUNT_SUSPENDED');
        res.json({ token: signToken(user), user: userDTO(user) });
    } catch (err) {
        next(err);
    }
});

router.get('/me', protectedRoute, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select(USER_FIELDS);
        if (!user) throw new HttpError(401, 'Not authorized, account no longer exists');
        res.json(userDTO(user));
    } catch (err) {
        next(err);
    }
});

router.put('/me', protectedRoute, async (req, res, next) => {
    try {
        validateBody(req.body, ['name', 'email', 'phone', 'licenseNumber']);
        const update = {};
        if (req.body.name !== undefined) update.name = text(req.body.name, 'Name', 120);
        if (req.body.phone !== undefined) update.phone = text(req.body.phone, 'Phone', 32, true);
        if (req.body.licenseNumber !== undefined) update.licenseNumber = text(req.body.licenseNumber, 'License number', 64, true);
        const email = req.body.email === undefined ? undefined : emailAddress(req.body.email);
        const existing = await User.findById(req.user.id).select(USER_FIELDS);
        if (!existing) throw new HttpError(401, 'Not authorized, account no longer exists');
        if (email !== undefined && email !== existing.email.trim().toLowerCase()) {
            throw new HttpError(400, 'Email cannot be changed');
        }
        if (!Object.keys(update).length) return res.json(userDTO(existing));
        const user = await User.findByIdAndUpdate(req.user.id, { $set: update }, { new: true, runValidators: true }).select(USER_FIELDS);
        if (!user) throw new HttpError(401, 'Not authorized, account no longer exists');
        res.json(userDTO(user));
    } catch (err) {
        next(err);
    }
});

router.put('/me/password', protectedRoute, async (req, res, next) => {
    try {
        validateBody(req.body, ['currentPassword', 'newPassword']);
        validatePassword(req.body.currentPassword);
        validatePassword(req.body.newPassword, true);
        const user = await User.findById(req.user.id).select('+password +tokenVersion');
        if (!user) throw new HttpError(401, 'Not authorized, account no longer exists');
        if (user.isSuspended) throw new HttpError(403, 'This account has been suspended', 'ACCOUNT_SUSPENDED');
        const version = user.tokenVersion ?? 0;
        if (version !== req.user.tokenVersion) throw new HttpError(401, 'Session has expired; please log in again');
        if (!await bcrypt.compare(req.body.currentPassword, user.password)) throw new HttpError(400, 'Current password is incorrect');
        const password = await bcrypt.hash(req.body.newPassword, 10);
        const updated = await User.findOneAndUpdate(
            { _id: user._id, password: user.password, isSuspended: { $ne: true }, ...expectedVersion(version) },
            { $set: { password }, $inc: { tokenVersion: 1 } },
            { new: true, runValidators: true }
        ).select('+tokenVersion');
        if (!updated) throw new HttpError(401, 'Account changed; please log in again');
        res.json({ message: 'Password updated successfully', token: signToken(updated), user: userDTO(updated) });
    } catch (err) {
        next(err);
    }
});

router.get('/users', protectedRoute, adminOnly, async (req, res, next) => {
    try {
        const users = await User.find().select(USER_FIELDS).sort({ createdAt: -1, _id: -1 }).lean();
        res.json(users.map(userDTO));
    } catch (err) {
        next(err);
    }
});

router.put('/users/:id/suspend', protectedRoute, adminOnly, async (req, res, next) => {
    try {
        validateId(req.params.id);
        validateBody(req.body, ['isSuspended']);
        if (typeof req.body.isSuspended !== 'boolean') throw new HttpError(400, 'isSuspended must be a boolean');
        const isSuspended = req.body.isSuspended;
        const changed = await User.findOneAndUpdate(
            { _id: req.params.id, role: { $ne: 'admin' }, isSuspended: isSuspended ? { $ne: true } : true },
            { $set: { isSuspended }, $inc: { tokenVersion: 1 } },
            { new: true, runValidators: true }
        ).select(USER_FIELDS);
        const user = changed || await User.findById(req.params.id).select(USER_FIELDS);
        if (!user) throw new HttpError(404, 'User not found');
        if (user.role === 'admin') throw new HttpError(400, "Can't suspend an admin");
        // Suspension revokes sessions only. Administrators manage bookings explicitly;
        // active/on-road rentals must never be cancelled as an account side effect.
        res.json(userDTO(user));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
