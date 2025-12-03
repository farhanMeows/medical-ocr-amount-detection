const Tesseract = require("tesseract.js");
const config = require("../config/env");
const logger = require("../utils/logger");
const { AppError } = require("../middleware/errorHandler");

/**
 * Extract text from image using Tesseract OCR
 * @param {Buffer} imageBuffer - Image file buffer
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<{raw_tokens: string[], currency_hint: string, confidence: number}>}
 */
const extractTextFromImage = async (imageBuffer, requestId) => {
  try {
    logger.info("Starting OCR text extraction with Tesseract", { requestId });

    // Perform OCR using Tesseract
    const result = await Tesseract.recognize(
      imageBuffer,
      "eng", // Language: English
      {
        logger: (m) => {
          if (m.status === "recognizing text") {
            logger.debug("Tesseract progress", {
              requestId,
              progress: Math.round(m.progress * 100) + "%",
            });
          }
        },
      }
    );

    const fullText = result.data.text;
    const confidence = result.data.confidence / 100; // Convert to 0-1 scale

    if (!fullText || fullText.trim().length === 0) {
      logger.warn("No text detected in image", { requestId });
      throw new AppError(
        "No text detected in the provided image",
        400,
        "no_text_detected"
      );
    }

    // Extract numeric tokens (amounts, percentages)
    const numericTokens = extractNumericTokens(fullText);

    // Detect currency hint
    const currencyHint = detectCurrency(fullText);

    // Check if we found any amounts
    if (numericTokens.length === 0) {
      logger.warn("No numeric amounts found in OCR text", { requestId });
      return {
        status: "no_amounts_found",
        reason: "No numeric values detected in the document",
        raw_text: fullText,
      };
    }

    // Check if confidence is too low
    if (confidence < config.minOcrConfidence) {
      logger.warn("OCR confidence below threshold", {
        requestId,
        confidence: confidence,
        threshold: config.minOcrConfidence,
      });
      return {
        status: "low_confidence",
        reason: "Document quality too poor or text too noisy",
        confidence: parseFloat(confidence.toFixed(2)),
        raw_text: fullText,
      };
    }

    logger.info("OCR extraction successful", {
      requestId,
      tokensFound: numericTokens.length,
      confidence: confidence,
    });

    return {
      raw_tokens: numericTokens,
      currency_hint: currencyHint,
      confidence: parseFloat(confidence.toFixed(2)),
      raw_text: fullText,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error("OCR extraction failed", {
      requestId,
      error: error.message,
      stack: error.stack,
    });

    throw new AppError(
      "Failed to extract text from image. Please ensure the image is clear and readable.",
      500,
      "ocr_failed"
    );
  }
};

/**
 * Extract text directly (when text input is provided)
 * @param {string} text - Input text
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<{raw_tokens: string[], currency_hint: string, confidence: number}>}
 */
const extractTextFromString = async (text, requestId) => {
  try {
    logger.info("Processing text input", { requestId });

    // Extract numeric tokens
    const numericTokens = extractNumericTokens(text);

    // Detect currency
    const currencyHint = detectCurrency(text);

    if (numericTokens.length === 0) {
      logger.warn("No numeric amounts found in text", { requestId });
      return {
        status: "no_amounts_found",
        reason: "No numeric values found in the provided text",
      };
    }

    logger.info("Text extraction successful", {
      requestId,
      tokensFound: numericTokens.length,
    });

    return {
      raw_tokens: numericTokens,
      currency_hint: currencyHint,
      confidence: 1.0, // Text input has perfect confidence
      raw_text: text,
    };
  } catch (error) {
    logger.error("Text extraction failed", {
      requestId,
      error: error.message,
    });
    throw new AppError(
      "Failed to extract amounts from text",
      500,
      "text_extraction_failed"
    );
  }
};

/**
 * Extract numeric tokens from text
 * Captures: numbers, decimals, percentages, currency symbols
 * @param {string} text - Input text
 * @returns {string[]} - Array of numeric tokens
 */
const extractNumericTokens = (text) => {
  const tokens = [];

  // Pattern to match:
  // - Numbers with optional decimals: 1200, 1200.50
  // - Numbers with commas: 1,200 or 1,200.50
  // - Percentages: 10%, 10.5%
  // - Currency symbols followed by numbers: Rs 1200, INR 1200, ₹1200
  const patterns = [
    /\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?%/g, // Percentages with commas: 1,200.50%
    /\d+(?:\.\d{1,2})?%/g, // Simple percentages: 10%, 10.5%
    /(?:Rs\.?|INR|₹)\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/gi, // Currency with commas
    /(?:Rs\.?|INR|₹)\s*\d+(?:\.\d{1,2})?/gi, // Simple currency
    /\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/g, // Numbers with commas: 1,200.50
    /\d+(?:\.\d{1,2})?/g, // Simple numbers: 1200, 1200.50
  ];

  const seen = new Set();

  patterns.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        // Clean up the token (remove currency symbols for storage)
        const cleaned = match.replace(/(?:Rs\.?|INR|₹)\s*/gi, "").trim();
        if (cleaned && !seen.has(cleaned)) {
          tokens.push(cleaned);
          seen.add(cleaned);
        }
      });
    }
  });

  return tokens;
};

/**
 * Detect currency from text
 * @param {string} text - Input text
 * @returns {string} - Currency code (INR, USD, etc.)
 */
const detectCurrency = (text) => {
  const currencyPatterns = {
    INR: /\b(?:INR|Rs\.?|₹|Rupees?|Indian Rupees?)\b/i,
    USD: /\b(?:USD|\$|Dollars?|US Dollars?)\b/i,
    EUR: /\b(?:EUR|€|Euros?)\b/i,
    GBP: /\b(?:GBP|£|Pounds?)\b/i,
  };

  for (const [currency, pattern] of Object.entries(currencyPatterns)) {
    if (pattern.test(text)) {
      return currency;
    }
  }

  return "INR"; // Default to INR for Indian medical bills
};

module.exports = {
  extractTextFromImage,
  extractTextFromString,
};
