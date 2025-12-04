const logger = require("../utils/logger");

// figure out what type each amount is by looking at nearby words
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

// classify one amount by checking keywords around it
const classifyAmount = (amount, lowerText, lines, originalText) => {
  const amountStr = amount.toString();
  
  // classification patterns with regex that captures the number
  const patterns = [
    // Total Bill patterns
    {
      type: "total_bill",
      patterns: [
        /total\s*(?:bill|amount|charges?|cost)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /(?:grand|net)\s*total\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /bill\s*amount\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /amount\s*payable\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /total[:\-]\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,  // total: 214.00 or total - 214.00
      ],
      confidence: 0.9,
    },
    // Paid amount patterns
    {
      type: "paid",
      patterns: [
        /paid\s*(?:amount|amt)?[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /amount\s*paid[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /payment[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /received[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
      ],
      confidence: 0.9,
    },
    // Due/Balance patterns
    {
      type: "due",
      patterns: [
        /(?:balance|due)\s*(?:amount|amt)?[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /amount\s*(?:due|outstanding)[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /pending[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
      ],
      confidence: 0.9,
    },
    // Discount patterns
    {
      type: "discount",
      patterns: [
        /discount[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /concession[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /rebate[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
      ],
      confidence: 0.85,
    },
    // Tax patterns
    {
      type: "tax",
      patterns: [
        /(?:gst|vat|tax)[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /service\s*tax[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
      ],
      confidence: 0.85,
    },
    // Consultation Fee
    {
      type: "consultation_fee",
      patterns: [
        /consultation\s*(?:fee|charges?)[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /doctor\s*(?:fee|charges?)[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
      ],
      confidence: 0.8,
    },
    // Medicine costs
    {
      type: "medicine_cost",
      patterns: [
        /medicine[s]?\s*(?:cost|charges?)?[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /pharmacy[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /drugs?[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
      ],
      confidence: 0.8,
    },
    // Lab tests
    {
      type: "lab_test_cost",
      patterns: [
        /lab\s*(?:test[s]?|charges?)[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /investigation[s]?[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /diagnostic[s]?[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
      ],
      confidence: 0.8,
    },
    // Room charges
    {
      type: "room_charges",
      patterns: [
        /room\s*(?:charges?|rent)[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /bed\s*charges?[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /accommodation[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
      ],
      confidence: 0.8,
    },
    // Subtotal
    {
      type: "subtotal",
      patterns: [
        /sub\s*total[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
        /sub[-\s]*total[:\s]*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{2})?)/i,
      ],
      confidence: 0.75,
    },
  ];

  // try to match patterns in the full text and see if captured number matches our amount
  let bestMatch = null;
  let highestConfidence = 0;

  for (const category of patterns) {
    for (const pattern of category.patterns) {
      const match = lowerText.match(pattern);
      if (match && match[1]) {
        const capturedAmount = parseFloat(match[1].replace(/,/g, ""));
        // check if captured number matches our amount
        if (capturedAmount === amount && category.confidence > highestConfidence) {
          highestConfidence = category.confidence;
          bestMatch = {
            type: category.type,
            value: amount,
            source: `text: '${match[0]}'`,
            confidence: category.confidence,
          };
        }
      }
    }
  }

  // if no pattern matched, classify as "other"
  if (!bestMatch) {
    bestMatch = {
      type: "other",
      value: amount,
      source: "text: (context not found)",
      confidence: 0.5,
    };
  }

  return bestMatch;
};

// check if the amounts make sense together (total = paid + due)
const validateClassification = (classifiedAmounts) => {
  const warnings = [];

  // Find key amounts
  const total = classifiedAmounts.find((a) => a.type === "total_bill");
  const paid = classifiedAmounts.find((a) => a.type === "paid");
  const due = classifiedAmounts.find((a) => a.type === "due");
  const subtotal = classifiedAmounts.find((a) => a.type === "subtotal");

  // check if total = paid + due (with small margin for rounding)
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

  // due shouldn't be more than total
  if (total && due && due.value > total.value) {
    warnings.push(
      "Due amount is greater than total - possible classification error"
    );
  }

  // paid shouldn't be more than total
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
