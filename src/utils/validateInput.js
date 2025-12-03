const { z } = require("zod");
const config = require("../config/env");

// Schema for text input
const textInputSchema = z.object({
  text: z
    .string()
    .min(1, "Text cannot be empty")
    .max(
      config.maxTextLength,
      `Text exceeds maximum length of ${config.maxTextLength} characters`
    ),
});

// Schema for file uploads
const fileInputSchema = z.object({
  mimetype: z.enum(
    ["image/jpeg", "image/png", "image/jpg", "application/pdf"],
    {
      errorMap: () => ({ message: "File must be JPEG, PNG, or PDF" }),
    }
  ),
  size: z
    .number()
    .max(
      config.maxFileSizeMB * 1024 * 1024,
      `File size exceeds ${config.maxFileSizeMB}MB limit`
    ),
});

/**
 * Validate text input
 * @param {string} text - Input text to validate
 * @returns {{success: boolean, data?: any, error?: string}}
 */
const validateText = (text) => {
  try {
    const result = textInputSchema.parse({ text });
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }
    return { success: false, error: "Validation failed" };
  }
};

/**
 * Validate uploaded file
 * @param {Object} file - Multer file object
 * @returns {{success: boolean, data?: any, error?: string}}
 */
const validateFile = (file) => {
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  try {
    const result = fileInputSchema.parse({
      mimetype: file.mimetype,
      size: file.size,
    });
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }
    return { success: false, error: "File validation failed" };
  }
};

/**
 * Validate that at least one input (text or file) is provided
 * @param {string} text - Text input
 * @param {Object} file - File input
 * @returns {{success: boolean, error?: string}}
 */
const validateInput = (text, file) => {
  if (!text && !file) {
    return {
      success: false,
      error: "Either text or file must be provided",
    };
  }
  return { success: true };
};

module.exports = {
  validateText,
  validateFile,
  validateInput,
};
