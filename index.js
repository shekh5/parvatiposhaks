import app from './app.js';
import 'dotenv/config';
import dbConnect from './db/dbConnect.js';
import { v2 as cloudinary } from 'cloudinary';
import logger from './utils/logger.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PORT = process.env.PORT || 3000;

//handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`, { stack: error.stack });
  logger.error('Shutting down the server due to uncaught exception');
  process.exit(1);
});

let server;

dbConnect()
  .then(() => {
    server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    logger.error(`Failed to connect to database. Server not started: ${error.message}`);
    process.exit(1);
  });

process.on('unhandledRejection', (error) => {
  logger.error(`Unhandled Rejection: ${error?.message}`, { stack: error?.stack });
  logger.error('Shutting down the server due to unhandled promise rejection');
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});
