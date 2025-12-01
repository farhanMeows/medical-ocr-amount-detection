const logger = require('../utils/logger');

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  const requestId = req.id || 'unknown';

  // Log error with request context
  logger.error('Error occurred', {
    requestId,
    errorCode: err.errorCode || 'internal_error',
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Default error response
  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 'internal_error';
  const message = err.isOperational ? err.message : 'Internal server error occurred';

  // Send error response
  res.status(statusCode).json({
    status: 'error',
    error_code: errorCode,
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Handle 404 errors
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError('Route not found', 404, 'not_found');
  next(error);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
};

