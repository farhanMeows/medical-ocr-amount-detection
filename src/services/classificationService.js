const logger = require("../utils/logger");

/**
 * Classify amounts based on surrounding text context
 * @param {string} rawText - Original text from OCR
 * @param {number[]} normalizedAmounts - Normalized numeric amounts
 * @param {string} requestId - Request ID for logging
 * @returns {{amounts: Array, confidence: number}}
 */
const classifyAmounts = (rawText, normalizedAmounts, requestId) => {
  try {
    logger.info("Starting amount classification", {
      requestId,
      amountCount: normalizedAmounts.length,
    });

    const classifiedAmounts = [];
    const text = rawText.toLowerCase();

    // Split text into lines for better context matching
    const lines = rawText.split(/\n+/);

    for (const amount of normalizedAmounts) {
      const classification = classifyAmount(amount, text, lines, rawText);
      classifiedAmounts.push(classification);
    }

    // Calculate overall confidence
    const totalConfidence = classifiedAmounts.reduce(
      (sum, item) => sum + (item.confidence || 0.5),
      0
    );
    const avgConfidence =
      classifiedAmounts.length > 0
        ? totalConfidence / classifiedAmounts.length
        : 0.5;

    logger.info("Classification complete", {
      requestId,
      classified: classifiedAmounts.length,
      avgConfidence,
    });

    return {
      amounts: classifiedAmounts,
      confidence: parseFloat(avgConfidence.toFixed(2)),
    };
  } catch (error) {
    logger.error("Classification failed", {
      requestId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Classify a single amount based on context
 * @param {number} amount - The numeric amount
 * @param {string} lowerText - Lowercase full text
 * @param {string[]} lines - Text split into lines
 * @param {string} originalText - Original text with casing
 * @returns {{type: string, value: number, source: string, confidence: number}}
 */
const classifyAmount = (amount, lowerText, lines, originalText) => {
  // Find the line containing this amount
  const amountStr = amount.toString();
  let sourceLine = "";

  for (const line of lines) {
    if (line.includes(amountStr)) {
      sourceLine = line.trim();
      break;
    }
  }

  // Classification patterns with confidence scores
  const patterns = [
    // Total Bill patterns
    {
      type: "total_bill",
      patterns: [
        /total\s*(?:bill|amount|charges?|cost)?[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /(?:grand|net)?\s*total[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /bill\s*amount[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /amount\s*payable[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
      ],
      confidence: 0.9,
    },
    // Paid amount patterns
    {
      type: "paid",
      patterns: [
        /(?:amount\s*)?paid[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /payment[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /received[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
      ],
      confidence: 0.9,
    },
    // Due/Balance patterns
    {
      type: "due",
      patterns: [
        /(?:balance\s*)?due[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /(?:amount\s*)?outstanding[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /balance[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /pending[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
      ],
      confidence: 0.9,
    },
    // Discount patterns
    {
      type: "discount",
      patterns: [
        /discount[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /concession[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /rebate[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
      ],
      confidence: 0.85,
    },
    // Tax patterns
    {
      type: "tax",
      patterns: [
        /(?:gst|vat|tax)[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /service\s*tax[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
      ],
      confidence: 0.85,
    },
    // Consultation Fee
    {
      type: "consultation_fee",
      patterns: [
        /consultation\s*(?:fee|charges?)[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /doctor\s*(?:fee|charges?)[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
      ],
      confidence: 0.8,
    },
    // Medicine costs
    {
      type: "medicine_cost",
      patterns: [
        /medicine[s]?\s*(?:cost|charges?)?[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /pharmacy[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /drugs?[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
      ],
      confidence: 0.8,
    },
    // Lab tests
    {
      type: "lab_test_cost",
      patterns: [
        /lab\s*(?:test[s]?|charges?)[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /investigation[s]?[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /diagnostic[s]?[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
      ],
      confidence: 0.8,
    },
    // Room charges
    {
      type: "room_charges",
      patterns: [
        /room\s*(?:charges?|rent)[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /bed\s*charges?[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /accommodation[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
      ],
      confidence: 0.8,
    },
    // Subtotal
    {
      type: "subtotal",
      patterns: [
        /sub\s*total[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
        /sub[-\s]*total[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
      ],
      confidence: 0.75,
    },
  ];

  // Try to match patterns
  let bestMatch = null;
  let highestConfidence = 0;

  for (const category of patterns) {
    for (const pattern of category.patterns) {
      const match = sourceLine.match(pattern) || lowerText.match(pattern);
      if (
        match &&
        match[1] &&
        parseFloat(match[1].replace(/,/g, "")) === amount
      ) {
        if (category.confidence > highestConfidence) {
          highestConfidence = category.confidence;
          bestMatch = {
            type: category.type,
            value: amount,
            source: `text: '${sourceLine || match[0]}'`,
            confidence: category.confidence,
          };
        }
      }
    }
  }

  // If no pattern matched, classify as "other"
  if (!bestMatch) {
    bestMatch = {
      type: "other",
      value: amount,
      source: sourceLine
        ? `text: '${sourceLine}'`
        : "text: (context not found)",
      confidence: 0.5,
    };
  }

  return bestMatch;
};

/**
 * Validate classified amounts for consistency
 * E.g., Total should equal sum of components
 * @param {Array} classifiedAmounts - Array of classified amounts
 * @returns {{valid: boolean, warnings: string[]}}
 */
const validateClassification = (classifiedAmounts) => {
  const warnings = [];

  // Find key amounts
  const total = classifiedAmounts.find((a) => a.type === "total_bill");
  const paid = classifiedAmounts.find((a) => a.type === "paid");
  const due = classifiedAmounts.find((a) => a.type === "due");
  const subtotal = classifiedAmounts.find((a) => a.type === "subtotal");

  // Validate: Total = Paid + Due (with some tolerance for rounding)
  if (total && paid && due) {
    const calculatedTotal = paid.value + due.value;
    const difference = Math.abs(total.value - calculatedTotal);

    if (difference > 1) {
      // Allow 1 rupee tolerance for rounding
      warnings.push(
        `Total (${total.value}) doesn't match Paid (${paid.value}) + Due (${due.value})`
      );
    }
  }

  // Validate: Due should be less than or equal to Total
  if (total && due && due.value > total.value) {
    warnings.push(
      "Due amount is greater than total - possible classification error"
    );
  }

  // Validate: Paid should be less than or equal to Total
  if (total && paid && paid.value > total.value) {
    warnings.push(
      "Paid amount is greater than total - possible classification error"
    );
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
};

module.exports = {
  classifyAmounts,
  validateClassification,
};
