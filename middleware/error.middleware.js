import ApiError from '../utils/apiError.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// Translates known library errors into clean client errors
const normalize = (err) => {
  if (err instanceof ApiError) return err;
  if (err.name === 'CastError') return new ApiError(`Invalid ${err.path}`, 400);
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors || {}).map((e) => ({ field: e.path, message: e.message }));
    return new ApiError(errors.map((e) => e.message).join(', ') || 'Validation failed', 400, errors);
  }
  if (err.code === 11000) {
    return new ApiError(`${Object.keys(err.keyValue || {}).join(', ')} already exists`, 409);
  }
  if (err.name === 'JsonWebTokenError') return new ApiError('Invalid token. Please sign in again', 401);
  if (err.name === 'TokenExpiredError') return new ApiError('Token expired. Please sign in again', 401);
  if (err.type === 'entity.parse.failed') return new ApiError('Malformed JSON in request body', 400);
  if (err.type === 'entity.too.large') return new ApiError('Request body is too large', 413);
  return err;
};

// eslint-disable-next-line no-unused-vars
export default (err, req, res, next) => {
  const error = normalize(err);
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    logger.error(`${statusCode} - ${error.message} - ${req.method} ${req.originalUrl}`, {
      stack: error.stack,
    });
  } else {
    logger.warn(`${statusCode} - ${error.message} - ${req.method} ${req.originalUrl}`);
  }

  // Unexpected failures can carry internals; keep them out of production responses
  const hide = statusCode >= 500 && !(error instanceof ApiError) && config.isProduction;
  res.status(statusCode).json({
    success: false,
    message: hide ? 'Internal Server Error' : error.message,
    errors: error.errors || [],
  });
};
