require('dotenv').config();

const config = {
  // Server Configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Google Cloud Vision API
  googleCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,

  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 30,

  // File Upload Limits
  maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB) || 5,
  maxTextLength: parseInt(process.env.MAX_TEXT_LENGTH) || 10000,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // OCR Thresholds
  minOcrConfidence: parseFloat(process.env.MIN_OCR_CONFIDENCE) || 0.5,
};

// Validate critical configuration
if (!config.googleCredentials && config.nodeEnv === 'production') {
  console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS is not set in production!');
  process.exit(1);
}

module.exports = config;

