import config from '../config/index.js';
import ApiError from '../utils/apiError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Browsers attach an Origin header to every cross-site request that can change
// data. If it names a site that is not the storefront, the request was started
// by some other page using the shopper's cookies, and is refused.
// Requests with no Origin (server-to-server calls such as the payment webhook,
// command-line tools) carry no browser cookies and are let through.
export const rejectForeignOrigins = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (!origin) return next();

  const sameHost = origin === `${req.protocol}://${req.get('host')}`;
  if (sameHost || config.cors.origins.includes(origin)) return next();

  next(new ApiError('Requests from this site are not allowed', 403));
};
