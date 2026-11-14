import { validationResult } from 'express-validator';
import ApiError from '../utils/apiError.js';

// Runs after express-validator chains and reports every failure in one response
const validateRequest = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new ApiError(errors[0].message, 400, errors));
};

export default validateRequest;
