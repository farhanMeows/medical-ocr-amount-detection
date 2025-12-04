const rateLimit = require("express-rate-limit");
const config = require("../config/env");
const logger = require("../utils/logger");

// limit requests per ip to prevent spam
const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs, // Time window in milliseconds
  max: config.rateLimitMaxRequests, // Max requests per window
  message: {
    status: "error",
    error_code: "rate_limit_exceeded",
    message: `Too many requests from this IP, please try again after ${
      config.rateLimitWindowMs / 1000
    } seconds`,
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res, next, options) => {
    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json(options.message);
  },
  skip: (req) => {
    // Skip rate limiting for health check endpoints
    return req.path === "/health" || req.path === "/";
  },
});

// stricter limit for file uploads
const uploadLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: Math.floor(config.rateLimitMaxRequests / 3), // More restrictive for uploads
  message: {
    status: "error",
    error_code: "upload_rate_limit_exceeded",
    message: "Too many file uploads, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn("Upload rate limit exceeded", {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json(options.message);
  },
});

module.exports = {
  apiLimiter,
  uploadLimiter,
};
