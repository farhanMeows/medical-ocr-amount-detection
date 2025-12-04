const Tesseract = require("tesseract.js");
const config = require("../config/env");
const logger = require("../utils/logger");
const { AppError } = require("../middleware/errorHandler");

// run tesseract on image buffer and extract numeric tokens
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

// extract tokens from plain text input (no ocr needed)
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

// pull out all numbers from text using regex patterns
const extractNumericTokens = (text) => {
  const tokens = [];
  const seen = new Set();

  // look for amounts with context or decimals (most reliable)
  const contextPatterns = [
    /(?:total|paid|due|balance|amount|mrp|discount|tax|subtotal|net|gross)[:\s]*(?:Rs\.?|INR|₹|Rs)?\s*(\d{1,6}(?:\.\d{1,2})?)/gi,
    /(?:Rs\.?|INR|₹|Rs)\s*(\d{1,6}(?:\.\d{1,2})?)/gi,
    /\b(\d{1,6}\.\d{2})\b/g, // amounts with .XX decimal
  ];

  contextPatterns.forEach((pattern) => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = match[1] || match[0];
      const cleaned = value.replace(/[₹$€£Rs\s,]/gi, "").trim();

      if (cleaned && !seen.has(cleaned)) {
        const num = parseFloat(cleaned);
        if (!isNaN(num) && num >= 0.01 && num <= 999999) {
          tokens.push(cleaned);
          seen.add(cleaned);
        }
      }
    }
  });

  // fallback: get numbers that look like money amounts
  if (tokens.length < 3) {
    const numberPattern = /\b(\d{2,6}(?:\.\d{1,2})?)\b/g;
    const matches = text.matchAll(numberPattern);
    for (const match of matches) {
      const cleaned = match[1].trim();
      if (cleaned && !seen.has(cleaned)) {
        const num = parseFloat(cleaned);
        // skip dates, phone numbers, etc (too many digits)
        if (!isNaN(num) && num >= 10 && num <= 999999 && cleaned.length <= 8) {
          tokens.push(cleaned);
          seen.add(cleaned);
        }
      }
    }
  }

  return tokens;
};

// figure out currency from symbols like ₹, $, €

// figure out currency from symbols like ₹, $, €
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
