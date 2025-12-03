const {
  validateText,
  validateFile,
  validateInput,
} = require("../utils/validateInput");
const {
  extractTextFromImage,
  extractTextFromString,
} = require("../services/ocrService");
const {
  normalizeAmounts,
  validateNormalizedAmounts,
} = require("../services/normalizationService");
const {
  classifyAmounts,
  validateClassification,
} = require("../services/classificationService");
const logger = require("../utils/logger");
const { AppError } = require("../middleware/errorHandler");

/**
 * Main controller for OCR extraction and processing pipeline
 * Handles both text and image inputs
 */
const extractAndProcess = async (req, res) => {
  const requestId = req.id;

  try {
    const { text } = req.body;
    const file = req.file;

    logger.info("Received extraction request", {
      requestId,
      hasText: !!text,
      hasFile: !!file,
      fileType: file?.mimetype,
    });

    // Validate that at least one input is provided
    const inputValidation = validateInput(text, file);
    if (!inputValidation.success) {
      throw new AppError(inputValidation.error, 400, "invalid_input");
    }

    // STEP 1: OCR / Text Extraction
    let ocrResult;

    if (file) {
      // Validate file
      const fileValidation = validateFile(file);
      if (!fileValidation.success) {
        throw new AppError(fileValidation.error, 400, "invalid_file");
      }

      // Extract text from image
      ocrResult = await extractTextFromImage(file.buffer, requestId);
    } else {
      // Validate text
      const textValidation = validateText(text);
      if (!textValidation.success) {
        throw new AppError(textValidation.error, 400, "invalid_text");
      }

      // Process text directly
      ocrResult = await extractTextFromString(text, requestId);
    }

    // Check for guardrail conditions
    if (ocrResult.status === "no_amounts_found") {
      return res.status(200).json({
        status: "no_amounts_found",
        reason: ocrResult.reason,
      });
    }

    if (ocrResult.status === "low_confidence") {
      return res.status(200).json({
        status: "low_confidence",
        reason: ocrResult.reason,
        confidence: ocrResult.confidence,
      });
    }

    // STEP 2: Normalization
    const normalizationResult = normalizeAmounts(
      ocrResult.raw_tokens,
      requestId
    );

    // Validate normalized amounts
    const validationResult = validateNormalizedAmounts(
      normalizationResult.normalized_amounts
    );
    if (!validationResult.valid) {
      return res.status(200).json({
        status: "invalid_amounts",
        reason: validationResult.reason,
      });
    }

    // STEP 3: Context Classification
    const classificationResult = classifyAmounts(
      ocrResult.raw_text,
      normalizationResult.normalized_amounts,
      requestId
    );

    // Validate classification consistency
    const classificationValidation = validateClassification(
      classificationResult.amounts
    );
    if (!classificationValidation.valid) {
      logger.warn("Classification validation warnings", {
        requestId,
        warnings: classificationValidation.warnings,
      });
    }

    // STEP 4: Final Output - Filter only total_bill, paid, and due
    const allowedTypes = ["total_bill", "paid", "due"];
    const filteredAmounts = classificationResult.amounts
      .filter((amount) => allowedTypes.includes(amount.type))
      .map((amount) => ({
        type: amount.type,
        value: amount.value,
        source: amount.source,
      }));

    const response = {
      currency: ocrResult.currency_hint,
      amounts: filteredAmounts,
      status: "ok",
    };

    logger.info("Extraction pipeline completed successfully", {
      requestId,
      amountsExtracted: filteredAmounts.length,
      status: "ok",
    });

    return res.status(200).json(response);
  } catch (error) {
    logger.error("Extraction pipeline failed", {
      requestId,
      error: error.message,
      stack: error.stack,
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      "Failed to process the request",
      500,
      "processing_failed"
    );
  }
};

/**
 * Health check endpoint
 */
const healthCheck = (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "plum-ocr-backend",
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  extractAndProcess,
  healthCheck,
};
