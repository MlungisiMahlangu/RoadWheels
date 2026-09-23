const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protectedRoute = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token is missing' });
  }
  let decoded;
  try {
    const token = authHeader.split(' ')[1];
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || typeof decoded.id !== 'string' || !/^[a-f\d]{24}$/i.test(decoded.id)) {
      return res.status(401).json({ message: 'Not authorized, invalid token' });
    }
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, invalid token' });
  }
  try {
    const user = await User.findById(decoded.id).select('_id role isSuspended');
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, account no longer exists' });
    }
    if (user.isSuspended) {
      return res.status(403).json({ message: 'This account has been suspended' });
    }
    req.user = { id: user._id.toString(), role: user.role };
  } catch (err) {
    return res.status(500).json({ message: 'Unable to verify account' });
  }
  next();
};

const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

module.exports = { protectedRoute, adminOnly };
