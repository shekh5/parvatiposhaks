import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import fileUpload from 'express-fileupload';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import morgan from 'morgan';
import config from './config/index.js';
import logger from './utils/logger.js';
import ApiError from './utils/apiError.js';
import errorHandler from './middleware/error.middleware.js';
import { rejectForeignOrigins } from './middleware/origin.middleware.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';
import authRoute from './routes/auth.route.js';
import productRoute from './routes/product.route.js';
import cartRoute from './routes/cart.route.js';
import couponRoute from './routes/coupon.route.js';
import orderRoute from './routes/order.route.js';
import paymentRoute from './routes/payment.route.js';
import adminRoute from './routes/admin.route.js';
import contactRoute from './routes/contact.route.js';

const app = express();

if (config.isProduction) app.set('trust proxy', 1); // real client IPs behind a load balancer

app.use(
  morgan(config.isProduction ? 'combined' : 'dev', {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Product images are shown by the storefront, which may live on another domain
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: config.cors.origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);
// Login cookies are sent cross-site in production, so requests that change
// anything must come from the storefront itself (protection against CSRF)
app.use('/api', rejectForeignOrigins);
app.use('/api', apiLimiter);

// Body size limits are per route: only requests that carry a profile photo may
// be large, and only the Razorpay webhook needs its raw bytes kept for the
// signature check. Each parser skips bodies an earlier one already read.
const API = '/api/v1';
app.use(
  `${API}/payment/webhook`,
  express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use([`${API}/signup`, `${API}/profile`], express.json({ limit: '5mb' }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
// Multipart uploads (profile photos). HTML form posts are deliberately not parsed.
app.use(fileUpload({ limits: { fileSize: 5 * 1024 * 1024 }, abortOnLimit: true }));

// Strip MongoDB operators from user input. Must run after the body parsers.
// (req.query is read-only in Express 5; query values are whitelisted where used.)
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});

app.use(express.static(path.join(path.resolve(), 'public')));

for (const route of [
  authRoute,
  productRoute,
  cartRoute,
  couponRoute,
  orderRoute,
  paymentRoute,
  adminRoute,
  contactRoute,
]) {
  app.use(API, route);
}

app.get('/healthCheck', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy' });
});

app.use((req, res, next) => {
  next(new ApiError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

app.use(errorHandler);

export default app;
