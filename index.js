import app from './app.js';
import config, { validateConfig } from './config/index.js';
import dbConnect from './db/dbConnect.js';
import logger from './utils/logger.js';
import { expirePendingOrders } from './services/order.service.js';

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`, { stack: error.stack });
  process.exit(1);
});

let server;

const start = async () => {
  validateConfig();
  await dbConnect(); // never accept requests before the database is ready

  server = app.listen(config.port, () => {
    logger.info(`Server is running on port ${config.port}`);
  });

  // Release stock held by online orders that were never paid
  const timer = setInterval(async () => {
    try {
      const expired = await expirePendingOrders();
      if (expired) logger.info(`Cancelled ${expired} unpaid order(s)`);
    } catch (error) {
      logger.error(`Failed to expire unpaid orders: ${error.message}`);
    }
  }, 5 * 60 * 1000);
  timer.unref();
};

start().catch((error) => {
  logger.error(`Server not started: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logger.error(`Unhandled Rejection: ${error?.message}`, { stack: error?.stack });
  if (server) server.close(() => process.exit(1));
  else process.exit(1);
});
