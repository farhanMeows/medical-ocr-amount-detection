const winston = require('winston');
const config = require('../config/env');

// Custom format to exclude sensitive data
const sanitizeLog = winston.format((info) => {
  // Remove or mask sensitive fields
  if (info.rawText && info.rawText.length > 100) {
    info.rawText = info.rawText.substring(0, 100) + '... (truncated)';
  }
  return info;
});

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    sanitizeLog(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'plum-ocr-service' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
          let log = `${timestamp} [${level}]`;
          if (requestId) log += ` [${requestId}]`;
          log += `: ${message}`;
          
          // Add metadata if present
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return log + metaStr;
        })
      ),
    }),
  ],
});

// Add file transport in production
if (config.nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
    })
  );
}

module.exports = logger;

