import winston from 'winston';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'warn';
};

// Define colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston about colors
winston.addColors(colors);

// Custom format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console
  new winston.transports.Console(),
  // Error log file
  new winston.transports.File({
    filename: join(__dirname, '../../logs/error.log'),
    level: 'error',
    format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.json()
    )
  }),
  // All logs file
  new winston.transports.File({
    filename: join(__dirname, '../../logs/combined.log'),
    format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.json()
    )
  }),
];

const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

export default logger;
