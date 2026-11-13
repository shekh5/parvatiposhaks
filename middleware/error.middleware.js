import apiError from '../utils/api.Error.js';
import logger from '../utils/logger.js';

export default (err, req, res, next) => {
  err.statuscode = err.statuscode || 500;
  err.message = err.message || 'Internal Server Error';

  logger.error(`${err.statuscode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  if (err.statuscode === 500) {
      logger.error(err); // Log full stack trace for 500 errors
  }

  if (err.name === 'CastError') {
    const message = `This is invalid resource ${err.path}`;
    err = new apiError(message, 404);
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {})
      .map((e) => e.message)
      .join(', ');
    err = new apiError(message || 'Validation failed', 400);
  }

  if (err.code === 11000) {
    const message = `Duplicate ${Object.keys(err.keyValue)} entered. already exists`;
    err = new apiError(message, 400);
  }

  if (err.name === 'JsonWebTokenError') {
    const message = 'JSON Web Token is invalid. Try again.';
    err = new apiError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'JSON Web Token is expired. Try again.';
    err = new apiError(message, 401);
  }

  const statuscode = err.statuscode || 500;
  const hideDetails = statuscode === 500 && process.env.NODE_ENV === 'production';
  res.status(statuscode).json({
    success: false,
    message: hideDetails ? 'Internal Server Error' : err.message,
  });
};
