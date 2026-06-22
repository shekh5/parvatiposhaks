import asyncHandler from '../utils/async-handler.js';
import apiError from '../utils/api.Error.js';
import jwt from 'jsonwebtoken';
import User from '../models/user.models.js';

export const verifyUserAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return next(new apiError('Authentication is missing!Please login to access resource', 401));
  }

  let decodedData;
  try {
    decodedData = jwt.verify(token, process.env.JWT_SECRET);
  } catch (jwtErr) {
    return next(jwtErr);
  }

  try {
    req.user = await User.findById(decodedData.id);
  } catch (dbErr) {
    return next(new apiError('Authentication service is temporarily unavailable', 503));
  }

  if (!req.user) {
    return next(new apiError('Authentication is missing!Please login to access resource', 401));
  }
  next();
});

export const roleBasedAccess = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new apiError(`Role - ${req.user.role} is not allowed to access this resource`, 403)
      );
    }
    next();
  };
};
