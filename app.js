import express from 'express';
import dotenv from 'dotenv';
import productRoute from './routes/productRoute.route.js';
import errorHandlerMiddleware from '../backend/middleware/error.middleware.js';
import authRoute from './routes/auth.route.js';
import orderRoute from './routes/order.route.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import fileUpload from 'express-fileupload';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

const app = express();

// Security Middlewares
app.use(helmet()); // Set security HTTP headers
// Custom sanitization to avoid Express 5 req.query getter error
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again in 15 minutes!' },
});
app.use('/api', limiter);

//middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(path.resolve(), 'public'))); //path for static files like images,css,js etc. we will put all our static files in public folder and access them from there
app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);
app.use(fileUpload());

app.use('/api/v1', productRoute);
app.use('/api/v1', authRoute);
app.use('/api/v1', orderRoute);
app.get('/healthCheck', (req, res) => {
  res.status(200).json({ message: 'Server is healthy' });
});

app.use(errorHandlerMiddleware);

dotenv.config({ path: 'backend/.env' });

export default app;
