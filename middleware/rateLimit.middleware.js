import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

const build = (limit, message) =>
  rateLimit({
    windowMs: config.rateLimit.windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => !config.isProduction,
    message: { success: false, message, errors: [] },
  });

export const apiLimiter = build(config.rateLimit.max, 'Too many requests. Please try again later');

// Tighter limit for sign-in, sign-up and password or token endpoints
export const authLimiter = build(
  config.rateLimit.authMax,
  'Too many attempts. Please try again later'
);
