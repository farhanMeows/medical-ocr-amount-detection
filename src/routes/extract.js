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

// main endpoint - runs full pipeline
router.post(
  "/",
  uploadLimiter,
  upload.single("file"),
  asyncHandler(extractAndProcess)
);

// step 1: extract numbers from text or image
router.post(
  "/step1",
  uploadLimiter,
  upload.single("file"),
  asyncHandler(step1_extractRawTokens)
);

// step 2: fix ocr errors in numbers
router.post("/step2", apiLimiter, asyncHandler(step2_normalizeAmounts));

// step 3: classify amounts by context
router.post("/step3", apiLimiter, asyncHandler(step3_classifyAmounts));

// step 4: add sources and package final output
router.post("/step4", apiLimiter, asyncHandler(step4_finalOutput));

// health check
router.get("/health", healthCheck);

module.exports = router;
