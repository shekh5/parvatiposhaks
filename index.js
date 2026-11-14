import mongoose from 'mongoose';
import app from './app.js';
import config, { validateConfig } from './config/index.js';
import dbConnect from './db/dbConnect.js';
import logger from './utils/logger.js';
import { expirePendingOrders } from './services/order.service.js';

const SHUTDOWN_GRACE_MS = 10 * 1000;

let server;
let expiryTimer;
let shuttingDown = false;

// Stops taking new requests, lets the ones in progress finish (a checkout
// should never be cut off halfway), then closes the database connection
const shutdown = async (reason, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Shutting down: ${reason}`);
  clearInterval(expiryTimer);

  const force = setTimeout(() => {
    logger.error('Shutdown took too long; exiting now');
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  force.unref();

  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`);
    exitCode = 1;
  }
  process.exit(exitCode);
};

process.on('SIGTERM', () => shutdown('SIGTERM received'));
process.on('SIGINT', () => shutdown('SIGINT received'));

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`, { stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logger.error(`Unhandled Rejection: ${error?.message}`, { stack: error?.stack });
  shutdown('unhandled promise rejection', 1);
});

const start = async () => {
  validateConfig();
  await dbConnect(); // never accept requests before the database is ready

  server = app.listen(config.port, () => {
    logger.info(`Server is running on port ${config.port}`);
  });

  // Release stock held by online orders that were never paid
  expiryTimer = setInterval(async () => {
    try {
      const expired = await expirePendingOrders();
      if (expired) logger.info(`Cancelled ${expired} unpaid order(s)`);
    } catch (error) {
      logger.error(`Failed to expire unpaid orders: ${error.message}`);
    }
  }, 5 * 60 * 1000);
  expiryTimer.unref();
};

start().catch((error) => {
  logger.error(`Server not started: ${error.message}`);
  process.exit(1);
});
