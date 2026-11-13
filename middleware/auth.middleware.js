import User from '../models/user.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import config from '../config/index.js';
import { verifyAccessToken } from '../utils/tokens.js';

const readToken = (req) => {
  if (req.cookies?.accessToken) return req.cookies.accessToken;
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

export const verifyUserAuth = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw new ApiError('Please sign in to access this resource', 401);

  const decoded = verifyAccessToken(token); // JWT errors become 401 in the error handler
  const user = await User.findById(decoded.id);
  if (!user) throw new ApiError('Please sign in to access this resource', 401);

  req.user = user;
  next();
});

export const roleBasedAccess =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ApiError('You are not allowed to access this resource', 403));
    }
    next();
  };

// Only enforced when REQUIRE_EMAIL_VERIFICATION=true
export const requireVerifiedEmail = (req, res, next) => {
  if (config.requireEmailVerification && !req.user.isEmailVerified) {
    return next(new ApiError('Please verify your email address first', 403));
  }
  next();
};
