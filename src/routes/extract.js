const express = require("express");
const multer = require("multer");
const {
  step1_extractRawTokens,
  step2_normalizeAmounts,
  step3_classifyAmounts,
  step4_finalOutput,
  extractAndProcess,
  healthCheck,
} = require("../controllers/extractController");
const { asyncHandler } = require("../middleware/errorHandler");
const { uploadLimiter, apiLimiter } = require("../middleware/rateLimiter");
const config = require("../config/env");

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
  },
  fileFilter: (req, file, cb) => {
    // Accept only specific file types
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and PDF are allowed."));
    }
  },
});

/**
 * POST /api/extract
 * Main endpoint - Full pipeline (all 4 steps combined)
 */
router.post(
  "/",
  uploadLimiter,
  upload.single("file"),
  asyncHandler(extractAndProcess)
);

/**
 * POST /api/extract/step1
 * Step 1: OCR / Text Extraction
 * Extract raw tokens from text or image
 */
router.post(
  "/step1",
  uploadLimiter,
  upload.single("file"),
  asyncHandler(step1_extractRawTokens)
);

/**
 * POST /api/extract/step2
 * Step 2: Normalization
 * Body: { "raw_tokens": ["1200", "1000", "200"] }
 */
router.post(
  "/step2",
  apiLimiter,
  asyncHandler(step2_normalizeAmounts)
);

/**
 * POST /api/extract/step3
 * Step 3: Classification
 * Body: { "normalized_amounts": [1200, 1000, 200], "raw_text": "..." }
 */
router.post(
  "/step3",
  apiLimiter,
  asyncHandler(step3_classifyAmounts)
);

/**
 * POST /api/extract/step4
 * Step 4: Final Output
 * Body: { "currency_hint": "INR", "amounts": [...], "raw_text": "..." }
 */
router.post(
  "/step4",
  apiLimiter,
  asyncHandler(step4_finalOutput)
);

/**
 * GET /api/extract/health
 * Health check endpoint
 */
router.get("/health", healthCheck);module.exports = router;
