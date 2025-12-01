const express = require('express');
const multer = require('multer');
const { extractAndProcess, healthCheck } = require('../controllers/extractController');
const { asyncHandler } = require('../middleware/errorHandler');
const { uploadLimiter } = require('../middleware/rateLimiter');
const config = require('../config/env');

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
  },
  fileFilter: (req, file, cb) => {
    // Accept only specific file types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
    }
  },
});

/**
 * POST /api/extract
 * Main endpoint for OCR extraction and processing
 * 
 * Accepts either:
 * - text: Plain text string
 * - file: Image/PDF file upload
 * 
 * Returns: Structured JSON with extracted and classified amounts
 */
router.post(
  '/',
  uploadLimiter,
  upload.single('file'),
  asyncHandler(extractAndProcess)
);

/**
 * GET /api/extract/health
 * Health check endpoint
 */
router.get('/health', healthCheck);

module.exports = router;

