import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `[${info.timestamp}] ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

const transports = isTest
  ? [new winston.transports.Console({ silent: true })]
  : [
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' }),
    ];

const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: fileFormat,
  transports,
});

if (!isProduction && !isTest) {
  logger.add(new winston.transports.Console({ format: consoleFormat }));
}

export default logger;
