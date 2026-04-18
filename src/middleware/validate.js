const isEmail = (value) => /^\S+@\S+\.\S+$/.test(value);

const fail = (res, errors) => res.status(400).json({ message: 'Validation failed', details: { fields: errors } });

const validateSignup = (req, res, next) => {
  const { name, email, password, role } = req.body;
  const errors = [];

  if (!name || name.trim().length < 2) errors.push('Name must be at least 2 characters long');
  if (!email || !isEmail(email)) errors.push('A valid email is required');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters long');
  if (role && !['admin', 'user'].includes(role)) errors.push('Role must be admin or user');

  return errors.length ? fail(res, errors) : next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || !isEmail(email)) errors.push('A valid email is required');
  if (!password) errors.push('Password is required');

  return errors.length ? fail(res, errors) : next();
};

const validateEvent = (req, res, next) => {
  const { title, description, location, category, date, seatLimit, durationMinutes } = req.body;
  const errors = [];
  const parsedSeats = Number(seatLimit);
  const parsedDuration = durationMinutes === undefined ? 180 : Number(durationMinutes);

  if (!title || title.trim().length < 3) errors.push('Title must be at least 3 characters long');
  if (!description || description.trim().length < 10) errors.push('Description must be at least 10 characters long');
  if (!location || !location.trim()) errors.push('Location is required');
  if (!category || !['tech', 'fun', 'fest', 'sports', 'business'].includes(category)) {
    errors.push('Category must be tech, fun, fest, sports, or business');
  }
  if (!date || Number.isNaN(new Date(date).getTime())) errors.push('A valid date is required');
  if (!Number.isInteger(parsedSeats) || parsedSeats < 1) errors.push('Seat limit must be a whole number greater than 0');
  if (!Number.isInteger(parsedDuration) || parsedDuration < 30) errors.push('Duration must be at least 30 minutes');

  return errors.length ? fail(res, errors) : next();
};

const validateFeedback = (req, res, next) => {
  const { rating, feedback } = req.body;
  const errors = [];
  const parsedRating = Number(rating);

  if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    errors.push('Rating must be a whole number from 1 to 5');
  }

  if (feedback !== undefined && typeof feedback !== 'string') {
    errors.push('Feedback must be text');
  }

  if (typeof feedback === 'string' && feedback.trim().length > 500) {
    errors.push('Feedback must be 500 characters or fewer');
  }

  return errors.length ? fail(res, errors) : next();
};

module.exports = { validateSignup, validateLogin, validateEvent, validateFeedback };
