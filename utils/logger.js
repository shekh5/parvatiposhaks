import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
// Hosting platforms collect what a server prints, and local files vanish with
// the container. Files are written in development, or when asked for.
const toFiles = process.env.LOG_TO_FILES ? process.env.LOG_TO_FILES === 'true' : !isProduction;

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const readableFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `[${info.timestamp}] ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

const transports = [];
if (isTest) {
  transports.push(new winston.transports.Console({ silent: true }));
} else {
  transports.push(new winston.transports.Console({ format: isProduction ? jsonFormat : readableFormat }));
  if (toFiles) {
    transports.push(
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' })
    );
  }
}

const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: jsonFormat,
  transports,
});

export default logger;
