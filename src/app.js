const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const extractRoutes = require('./routes/extract');

const app = express();

// Generate unique request ID for each request
app.use((req, res, next) => {
  req.id = crypto.randomBytes(4).toString('hex'); // 8-character hex ID
  next();
});

// Log all incoming requests
app.use((req, res, next) => {
  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json({ limit: '1mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '1mb' })); // Parse URL-encoded bodies

// Apply rate limiting to all routes
app.use(apiLimiter);

// Root health check
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Plum OCR Backend Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      extract: 'POST /api/extract',
      health: 'GET /api/extract/health',
    },
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/extract', extractRoutes);

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler (must be last)
app.use(errorHandler);

module.exports = app;

