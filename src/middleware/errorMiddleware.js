const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Not found - ${req.originalUrl}`));
};

const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = error.message || 'Server error';
  const details = {};

  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details.fields = Object.values(error.errors).map((fieldError) => fieldError.message);
  }

  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid resource id';
  }

  if (error.code === 11000) {
    statusCode = 409;
    message = 'Duplicate record';
    details.fields = Object.keys(error.keyValue || {});
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Invalid or expired token';
  }

  res.status(statusCode).json({
    message,
    ...(Object.keys(details).length ? { details } : {}),
    ...(process.env.NODE_ENV === 'production' ? {} : { stack: error.stack }),
  });
};

module.exports = { notFound, errorHandler };
