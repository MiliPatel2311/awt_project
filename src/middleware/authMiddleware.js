const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401);
    throw new Error('Authentication token is required');
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'replace_this_secret_for_production';
  const decoded = jwt.verify(token, secret);
  const user = await User.findById(decoded.id);

  if (!user) {
    res.status(401);
    throw new Error('User no longer exists');
  }

  req.user = user;
  next();
});

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403);
    throw new Error('You do not have permission to perform this action');
  }

  next();
};

module.exports = { protect, authorize };
