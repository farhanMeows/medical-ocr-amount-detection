const vision = require('@google-cloud/vision');
const config = require('../config/env');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

// Initialize Google Cloud Vision client
let visionClient;
try {
  visionClient = new vision.ImageAnnotatorClient({
    keyFilename: config.googleCredentials,
  });
} catch (error) {
  logger.error('Failed to initialize Google Cloud Vision client', { error: error.message });
}

/**
 * Extract text from image using Google Cloud Vision OCR
 * @param {Buffer} imageBuffer - Image file buffer
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<{raw_tokens: string[], currency_hint: string, confidence: number}>}
 */
const extractTextFromImage = async (imageBuffer, requestId) => {
  try {
    if (!visionClient) {
      throw new AppError(
        'OCR service not configured. Please check GOOGLE_APPLICATION_CREDENTIALS',
        500,
        'ocr_not_configured'
      );
    }

    logger.info('Starting OCR text extraction', { requestId });

    // Perform text detection
    const [result] = await visionClient.textDetection(imageBuffer);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      logger.warn('No text detected in image', { requestId });
      throw new AppError(
        'No text detected in the provided image',
        400,
        'no_text_detected'
      );
    }

    // First annotation contains all detected text
    const fullText = detections[0].description;
    
    // Calculate average confidence from individual word detections
    let totalConfidence = 0;
    let confidenceCount = 0;

    if (result.fullTextAnnotation && result.fullTextAnnotation.pages) {
      result.fullTextAnnotation.pages.forEach(page => {
        page.blocks?.forEach(block => {
          block.paragraphs?.forEach(paragraph => {
            paragraph.words?.forEach(word => {
              if (word.confidence !== undefined) {
                totalConfidence += word.confidence;
                confidenceCount++;
              }
            });
          });
        });
      });
    }

    const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0.7;

    // Extract numeric tokens (amounts, percentages)
    const numericTokens = extractNumericTokens(fullText);

    // Detect currency hint
    const currencyHint = detectCurrency(fullText);

    // Check if we found any amounts
    if (numericTokens.length === 0) {
      logger.warn('No numeric amounts found in OCR text', { requestId });
      return {
        status: 'no_amounts_found',
        reason: 'No numeric values detected in the document',
        raw_text: fullText,
      };
    }

    // Check if confidence is too low
    if (avgConfidence < config.minOcrConfidence) {
      logger.warn('OCR confidence below threshold', {
        requestId,
        confidence: avgConfidence,
        threshold: config.minOcrConfidence,
      });
      return {
        status: 'low_confidence',
        reason: 'Document quality too poor or text too noisy',
        confidence: parseFloat(avgConfidence.toFixed(2)),
        raw_text: fullText,
      };
    }

    logger.info('OCR extraction successful', {
      requestId,
      tokensFound: numericTokens.length,
      confidence: avgConfidence,
    });

    return {
      raw_tokens: numericTokens,
      currency_hint: currencyHint,
      confidence: parseFloat(avgConfidence.toFixed(2)),
      raw_text: fullText,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('OCR extraction failed', {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError(
      'Failed to extract text from image. Please ensure the image is clear and readable.',
      500,
      'ocr_failed'
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
    logger.info('Processing text input', { requestId });

    // Extract numeric tokens
    const numericTokens = extractNumericTokens(text);

    // Detect currency
    const currencyHint = detectCurrency(text);

    if (numericTokens.length === 0) {
      logger.warn('No numeric amounts found in text', { requestId });
      return {
        status: 'no_amounts_found',
        reason: 'No numeric values found in the provided text',
      };
    }

    logger.info('Text extraction successful', {
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
    logger.error('Text extraction failed', {
      requestId,
      error: error.message,
    });
    throw new AppError(
      'Failed to extract amounts from text',
      500,
      'text_extraction_failed'
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
    /\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?%/g,  // Percentages with commas: 1,200.50%
    /\d+(?:\.\d{1,2})?%/g,                   // Simple percentages: 10%, 10.5%
    /(?:Rs\.?|INR|₹)\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/gi, // Currency with commas
    /(?:Rs\.?|INR|₹)\s*\d+(?:\.\d{1,2})?/gi, // Simple currency
    /\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/g,    // Numbers with commas: 1,200.50
    /\d+(?:\.\d{1,2})?/g,                    // Simple numbers: 1200, 1200.50
  ];

  const seen = new Set();
  
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Clean up the token (remove currency symbols for storage)
        const cleaned = match.replace(/(?:Rs\.?|INR|₹)\s*/gi, '').trim();
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

  return 'INR'; // Default to INR for Indian medical bills
};

module.exports = {
  extractTextFromImage,
  extractTextFromString,
};

