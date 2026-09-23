const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HttpError } = require('./errors');

const protectedRoute = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== 'string' || !/^Bearer [^\s]+$/.test(authHeader)) {
        return next(new HttpError(401, 'Authorization token is missing or malformed'));
    }
    let decoded;
    try {
        decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (!decoded || typeof decoded.id !== 'string' || !/^[a-f\d]{24}$/i.test(decoded.id) ||
            !Number.isSafeInteger(decoded.ver) || decoded.ver < 0) {
            return next(new HttpError(401, 'Not authorized, invalid token'));
        }
    } catch (err) {
        return next(new HttpError(401, 'Not authorized, invalid token'));
    }
    try {
        const user = await User.findById(decoded.id).select('_id role isSuspended +tokenVersion');
        if (!user) throw new HttpError(401, 'Not authorized, account no longer exists');
        if (user.isSuspended) throw new HttpError(403, 'This account has been suspended', 'ACCOUNT_SUSPENDED');
        const tokenVersion = user.tokenVersion ?? 0;
        if (decoded.ver !== tokenVersion) throw new HttpError(401, 'Session has expired; please log in again');
        // Never trust a role carried in an old token over the current account role.
        req.user = { id: user._id.toString(), role: user.role, tokenVersion };
    } catch (err) {
        return next(err);
    }
    next();
};

const adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') return next(new HttpError(403, 'Admin access required'));
    next();
};

module.exports = { protectedRoute, adminOnly };
