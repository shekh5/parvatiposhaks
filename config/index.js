import dotenv from 'dotenv';

const isTest = process.env.NODE_ENV === 'test';
// Tests set their own environment and must never read a developer's .env
if (!isTest) dotenv.config();

const env = process.env;
const num = (value, fallback) => (value === undefined || value === '' ? fallback : Number(value));
const list = (value, fallback) =>
  (value || fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const config = {
  env: env.NODE_ENV || 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest,
  port: num(env.PORT, 3000),
  mongoUrl: env.MONGO_DB_URL,
  frontendUrl: (env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  jwt: {
    secret: env.JWT_SECRET,
    accessMinutes: num(env.ACCESS_TOKEN_MINUTES, 15),
    refreshDays: num(env.REFRESH_TOKEN_DAYS, 30),
  },
  cors: {
    origins: list(env.CORS_ORIGIN, 'http://localhost:5173'),
  },
  rateLimit: {
    windowMinutes: num(env.RATE_LIMIT_WINDOW_MINUTES, 15),
    max: num(env.RATE_LIMIT_MAX, 100),
    authMax: num(env.AUTH_RATE_LIMIT_MAX, 10),
  },
  smtp: {
    service: env.SMTP_SERVICE,
    host: env.SMTP_HOST,
    port: num(env.SMTP_PORT, 587),
    mail: env.SMTP_MAIL,
    password: env.SMTP_PASSWORD,
  },
  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  },
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  },
  requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION === 'true',
  shop: {
    currency: env.CURRENCY || 'INR',
    taxPercent: num(env.TAX_PERCENT, 0),
    shippingFee: num(env.SHIPPING_FEE, 0),
    freeShippingAbove: num(env.FREE_SHIPPING_ABOVE, 0),
    pendingPaymentMinutes: num(env.PENDING_PAYMENT_MINUTES, 30),
    lowStockThreshold: num(env.LOW_STOCK_THRESHOLD, 5),
    resultsPerPage: num(env.RESULTS_PER_PAGE, 12),
  },
};

// Fail fast on missing essentials instead of crashing on the first request
export function validateConfig() {
  const missing = [];
  if (!config.mongoUrl) missing.push('MONGO_DB_URL');
  if (!config.jwt.secret) missing.push('JWT_SECRET');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default config;
