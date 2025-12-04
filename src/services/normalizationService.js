const logger = require("../utils/logger");

// fix common ocr mistakes in numbers (l->1, O->0, etc)
const normalizeAmounts = (rawTokens, requestId) => {
  try {
    logger.info("Starting normalization", {
      requestId,
      tokenCount: rawTokens.length,
    });

    const normalizedAmounts = [];
    let successfulNormalizations = 0;
    let totalAttempts = 0;

    for (const token of rawTokens) {
      totalAttempts++;

      // Skip if token is a percentage (we'll handle separately)
      if (token.includes("%")) {
        continue;
      }

      const normalized = normalizeToken(token);

      if (normalized !== null) {
        normalizedAmounts.push(normalized);
        successfulNormalizations++;
      }
    }

    // Calculate normalization confidence
    // High confidence if most tokens were successfully normalized
    const confidence =
      totalAttempts > 0 ? successfulNormalizations / totalAttempts : 0;

    logger.info("Normalization complete", {
      requestId,
      inputTokens: rawTokens.length,
      outputAmounts: normalizedAmounts.length,
      confidence,
    });

    return {
      normalized_amounts: normalizedAmounts,
      normalization_confidence: parseFloat(confidence.toFixed(2)),
    };
  } catch (error) {
    logger.error("Normalization failed", {
      requestId,
      error: error.message,
    });
    throw error;
  }
};

// clean up a single token and convert to number
const normalizeToken = (token) => {
  let normalized = token;

  // Remove any currency symbols that might have slipped through
  normalized = normalized.replace(/[₹$€£]/g, "");

  // Common OCR mistakes - fix character substitutions
  const charReplacements = {
    l: "1", // lowercase L to 1
    I: "1", // uppercase I to 1
    O: "0", // uppercase O to 0
    o: "0", // lowercase o to 0
    S: "5", // uppercase S to 5
    s: "5", // lowercase s to 5 (less common)
    B: "8", // uppercase B to 8
    Z: "2", // uppercase Z to 2
    T: "7", // uppercase T to 7 (in some fonts)
    G: "6", // uppercase G to 6 (in some fonts)
  };

  // Apply character replacements, but only if surrounded by digits
  for (const [wrong, correct] of Object.entries(charReplacements)) {
    // Replace if character is between digits or at start/end with digits nearby
    const regex = new RegExp(
      `(\\d)${wrong}(?=\\d)|(?<=\\d)${wrong}(?=\\d)|^${wrong}(?=\\d)|(?<=\\d)${wrong}$`,
      "g"
    );
    normalized = normalized.replace(regex, `$1${correct}`);
  }

  // Remove any remaining non-numeric characters except decimal point and comma
  normalized = normalized.replace(/[^0-9.,]/g, "");

  // strip commas from numbers like 1,200 or 1,200.50
  normalized = normalized.replace(/,/g, "");

  // Validate the result is a valid number
  const parsed = parseFloat(normalized);

  if (isNaN(parsed) || parsed < 0) {
    return null;
  }

  // Round to 2 decimal places
  return Math.round(parsed * 100) / 100;
};

/**
 * Extract and normalize percentage values separately
 * @param {string[]} rawTokens - Raw tokens from OCR
 * @returns {Array<{value: number, isPercentage: true}>}
 */
const normalizePercentages = (rawTokens) => {
  const percentages = [];

  for (const token of rawTokens) {
    if (token.includes("%")) {
      // Extract numeric part
      const numericPart = token.replace("%", "").trim();
      const normalized = normalizeToken(numericPart);

      if (normalized !== null) {
        percentages.push({
          value: normalized,
          isPercentage: true,
        });
      }
    }
  }

  return percentages;
};

/**
 * Validate normalized amounts against business rules
 * @param {number[]} amounts - Normalized amounts
 * @returns {{valid: boolean, reason?: string}}
 */
const validateNormalizedAmounts = (amounts) => {
  // Check if we have any amounts
  if (amounts.length === 0) {
    return {
      valid: false,
      reason: "No valid amounts found after normalization",
    };
  }

  // Check for unreasonably large amounts (> 10 million)
  const maxReasonableAmount = 10000000;
  const hasUnreasonableAmount = amounts.some(
    (amt) => amt > maxReasonableAmount
  );

  if (hasUnreasonableAmount) {
    return {
      valid: false,
      reason: "Detected unreasonably large amounts - possible OCR error",
    };
  }

  // Check for too many zero values
  const zeroCount = amounts.filter((amt) => amt === 0).length;
  if (zeroCount > amounts.length / 2) {
    return {
      valid: false,
      reason: "Too many zero values detected",
    };
  }

  return { valid: true };
};

module.exports = {
  normalizeAmounts,
  normalizePercentages,
  validateNormalizedAmounts,
};
