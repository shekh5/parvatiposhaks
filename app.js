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
import { apiLimiter } from './middleware/rateLimit.middleware.js';
import authRoute from './routes/auth.route.js';
import productRoute from './routes/product.route.js';
import cartRoute from './routes/cart.route.js';
import couponRoute from './routes/coupon.route.js';
import orderRoute from './routes/order.route.js';

const app = express();

if (config.isProduction) app.set('trust proxy', 1); // real client IPs behind a load balancer

app.use(
  morgan(config.isProduction ? 'combined' : 'dev', {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

app.use(helmet());
app.use(
  cors({
    origin: config.cors.origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);
app.use('/api', apiLimiter);

// The raw body is kept so the Razorpay webhook signature can be checked
app.use(
  express.json({
    limit: '5mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());
app.use(fileUpload({ limits: { fileSize: 5 * 1024 * 1024 }, abortOnLimit: true }));

// Strip MongoDB operators from user input. Must run after the body parsers.
// (req.query is read-only in Express 5; query values are whitelisted where used.)
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});

app.use(express.static(path.join(path.resolve(), 'public')));

app.use('/api/v1', authRoute);
app.use('/api/v1', productRoute);
app.use('/api/v1', cartRoute);
app.use('/api/v1', couponRoute);
app.use('/api/v1', orderRoute);

app.get('/healthCheck', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy' });
});

app.use((req, res, next) => {
  next(new ApiError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

app.use(errorHandler);

export default app;
