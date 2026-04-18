const bcrypt = require('bcrypt');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const generateToken = require('../utils/generateToken');

const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const sendAuthResponse = (res, user, statusCode = 200) => {
  res.status(statusCode).json({
    token: generateToken(user),
    user: serializeUser(user),
  });
};

const signup = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, password: hashedPassword, role: role || 'user' });

  sendAuthResponse(res, user, 201);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  sendAuthResponse(res, user);
});

const getMe = asyncHandler(async (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

module.exports = {
  signup,
  login,
  getMe,
};
