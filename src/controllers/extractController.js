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
 * STEP 1: OCR / Text Extraction Only
 * Extract raw tokens from text or image
 */
const step1_extractRawTokens = async (req, res) => {
  const requestId = req.id;

  try {
    const { text } = req.body;
    const file = req.file;

    logger.info("Step 1: Starting raw token extraction", {
      requestId,
      hasText: !!text,
      hasFile: !!file,
    });

    // Validate input
    const inputValidation = validateInput(text, file);
    if (!inputValidation.success) {
      throw new AppError(inputValidation.error, 400, "invalid_input");
    }

    // Extract text
    let ocrResult;
    if (file) {
      const fileValidation = validateFile(file);
      if (!fileValidation.success) {
        throw new AppError(fileValidation.error, 400, "invalid_file");
      }
      ocrResult = await extractTextFromImage(file.buffer, requestId);
    } else {
      const textValidation = validateText(text);
      if (!textValidation.success) {
        throw new AppError(textValidation.error, 400, "invalid_text");
      }
      ocrResult = await extractTextFromString(text, requestId);
    }

    // Check guardrails
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

    // Step 1 Output
    const response = {
      raw_tokens: ocrResult.raw_tokens,
      currency_hint: ocrResult.currency_hint,
      confidence: ocrResult.confidence,
    };

    logger.info("Step 1: Raw token extraction complete", { requestId });
    return res.status(200).json(response);
  } catch (error) {
    logger.error("Step 1 failed", { requestId, error: error.message });
    if (error instanceof AppError) throw error;
    throw new AppError("Step 1 extraction failed", 500, "step1_failed");
  }
};

/**
 * STEP 2: Normalization
 * Requires raw_tokens from Step 1
 */
const step2_normalizeAmounts = async (req, res) => {
  const requestId = req.id;

  try {
    const { raw_tokens } = req.body;

    if (!raw_tokens || !Array.isArray(raw_tokens)) {
      throw new AppError(
        "raw_tokens array is required from Step 1",
        400,
        "invalid_input"
      );
    }

    logger.info("Step 2: Starting normalization", {
      requestId,
      tokenCount: raw_tokens.length,
    });

    const normalizationResult = normalizeAmounts(raw_tokens, requestId);

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

    // Step 2 Output
    const response = {
      normalized_amounts: normalizationResult.normalized_amounts,
      normalization_confidence: normalizationResult.normalization_confidence,
    };

    logger.info("Step 2: Normalization complete", { requestId });
    return res.status(200).json(response);
  } catch (error) {
    logger.error("Step 2 failed", { requestId, error: error.message });
    if (error instanceof AppError) throw error;
    throw new AppError("Step 2 normalization failed", 500, "step2_failed");
  }
};

/**
 * STEP 3: Classification
 * Requires normalized_amounts and raw_text from previous steps
 */
const step3_classifyAmounts = async (req, res) => {
  const requestId = req.id;

  try {
    const { normalized_amounts, raw_text } = req.body;

    if (!normalized_amounts || !Array.isArray(normalized_amounts)) {
      throw new AppError(
        "normalized_amounts array is required from Step 2",
        400,
        "invalid_input"
      );
    }

    if (!raw_text) {
      throw new AppError(
        "raw_text is required for context classification",
        400,
        "invalid_input"
      );
    }

    logger.info("Step 3: Starting classification", {
      requestId,
      amountCount: normalized_amounts.length,
    });

    const classificationResult = classifyAmounts(
      raw_text,
      normalized_amounts,
      requestId
    );

    // Filter only total_bill, paid, and due
    const allowedTypes = ["total_bill", "paid", "due"];
    const filteredAmounts = classificationResult.amounts
      .filter((amount) => allowedTypes.includes(amount.type))
      .map((amount) => ({
        type: amount.type,
        value: amount.value,
      }));

    // Step 3 Output
    const response = {
      amounts: filteredAmounts,
      confidence: classificationResult.confidence,
    };

    logger.info("Step 3: Classification complete", { requestId });
    return res.status(200).json(response);
  } catch (error) {
    logger.error("Step 3 failed", { requestId, error: error.message });
    if (error instanceof AppError) throw error;
    throw new AppError("Step 3 classification failed", 500, "step3_failed");
  }
};

/**
 * STEP 4: Final Output
 * Requires currency_hint, amounts (classified), and raw_text
 */
const step4_finalOutput = async (req, res) => {
  const requestId = req.id;

  try {
    const { currency_hint, amounts, raw_text } = req.body;

    if (!currency_hint) {
      throw new AppError("currency_hint is required", 400, "invalid_input");
    }

    if (!amounts || !Array.isArray(amounts)) {
      throw new AppError(
        "amounts array is required from Step 3",
        400,
        "invalid_input"
      );
    }

    if (!raw_text) {
      throw new AppError(
        "raw_text is required for source provenance",
        400,
        "invalid_input"
      );
    }

    logger.info("Step 4: Building final output", {
      requestId,
      amountCount: amounts.length,
    });

    // Add source provenance to each amount
    const amountsWithSource = amounts.map((amount) => {
      // Find the source line in raw text
      const lines = raw_text.split(/\n+/);
      let sourceLine = "";

      for (const line of lines) {
        if (line.includes(amount.value.toString())) {
          sourceLine = line.trim();
          break;
        }
      }

      return {
        type: amount.type,
        value: amount.value,
        source: sourceLine ? `text: '${sourceLine}'` : "text: (context not found)",
      };
    });

    // Step 4 Output
    const response = {
      currency: currency_hint,
      amounts: amountsWithSource,
      status: "ok",
    };

    logger.info("Step 4: Final output complete", { requestId });
    return res.status(200).json(response);
  } catch (error) {
    logger.error("Step 4 failed", { requestId, error: error.message });
    if (error instanceof AppError) throw error;
    throw new AppError("Step 4 final output failed", 500, "step4_failed");
  }
};

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
  step1_extractRawTokens,
  step2_normalizeAmounts,
  step3_classifyAmounts,
  step4_finalOutput,
  extractAndProcess,
  healthCheck,
};
