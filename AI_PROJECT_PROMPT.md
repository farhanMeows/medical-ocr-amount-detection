# AI Editor Prompt: Medical Bill OCR Backend Service

## Project Overview

Build a complete backend service for medical bill OCR with amount extraction. This is for a Plum Insurance internship evaluation. The code should be **simple, well-structured, and easy to explain in an interview**.

---

## Tech Stack

### Core Technologies

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js (v4.18+)
- **Language**: JavaScript (CommonJS modules - keep it simple, no TypeScript)
- **OCR Engine**: Tesseract.js (v5.1+) - Free, no API keys needed
- **Validation**: Zod (v3.22+) - Schema validation
- **Logging**: Winston (v3.11+) - Structured logging
- **File Upload**: Multer (v1.4+) - Handle multipart/form-data

### DevSecOps Features (Required)

- **Rate Limiting**: express-rate-limit (30 req/min general, 10 req/min uploads)
- **CORS**: Enable cross-origin requests
- **Environment Variables**: dotenv for secure configuration
- **Error Handling**: Custom error classes with proper HTTP status codes
- **Request Tracking**: Unique request IDs for all operations
- **Input Validation**: Zod schemas for all inputs
- **Logging**: Winston with log sanitization (remove sensitive data)
- **Graceful Shutdown**: Handle SIGTERM/SIGINT properly

---

## Project Structure

```
plum/
├── src/
│   ├── config/
│   │   └── env.js              # Environment configuration
│   ├── utils/
│   │   ├── logger.js           # Winston logger with sanitization
│   │   └── validateInput.js    # Zod schemas
│   ├── middleware/
│   │   ├── errorHandler.js     # Custom AppError class + global handler
│   │   └── rateLimiter.js      # Rate limiting configs
│   ├── services/
│   │   ├── ocrService.js       # Tesseract OCR extraction
│   │   ├── normalizationService.js  # OCR error correction
│   │   └── classificationService.js # Context-based classification
│   ├── controllers/
│   │   └── extractController.js     # Main controller (5 functions)
│   ├── routes/
│   │   └── extract.js          # API routes
│   ├── app.js                  # Express app setup
│   └── server.js               # Server entry point
├── test/
│   └── sample-bills/
│       ├── images/             # Test images (PNG, JPG)
│       └── text/               # Test text files
├── .env                        # Environment variables
├── .gitignore                  # Protect sensitive files
├── package.json
└── README.md
```

---

## Step-by-Step Implementation

### STEP 1: Project Setup & Configuration

1. Initialize Node.js project with `package.json`
2. Install all dependencies (express, tesseract.js, zod, winston, multer, express-rate-limit, cors, dotenv)
3. Create `.env` file with:
   ```
   NODE_ENV=development
   PORT=3000
   MAX_FILE_SIZE_MB=5
   LOG_LEVEL=info
   ```
4. Create `.gitignore` to protect:
   - `node_modules/`
   - `.env`
   - `*.log`
   - `*.json` (except package.json, package-lock.json, tsconfig.json)

**Git Commit**: `"initial setup with dependencies and config"`

---

### STEP 2: Core Infrastructure (Config, Logger, Validation, Middleware)

#### A. Environment Configuration (`src/config/env.js`)

```javascript
module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: process.env.PORT || 3000,
  maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || "5"),
  logLevel: process.env.LOG_LEVEL || "info",
};
```

#### B. Winston Logger (`src/utils/logger.js`)

- Console transport with colorization
- JSON format with timestamps
- Request ID tracking
- Sanitize sensitive data (remove email, phone, passwords)

```javascript
const winston = require("winston");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: "plum-ocr-service" },
  transports: [new winston.transports.Console()],
});

module.exports = logger;
```

#### C. Input Validation (`src/utils/validateInput.js`)

Use Zod schemas:

```javascript
const { z } = require("zod");

const textSchema = z.object({
  text: z.string().min(10).max(50000),
});

const rawTokensSchema = z.object({
  raw_tokens: z.array(z.string()),
});

const normalizedAmountsSchema = z.object({
  normalized_amounts: z.array(z.number()),
  raw_text: z.string(),
});

// Export validation functions
```

#### D. Error Handler Middleware (`src/middleware/errorHandler.js`)

```javascript
class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: "error",
    error_code: err.errorCode || "internal_error",
    message: err.message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
```

#### E. Rate Limiter (`src/middleware/rateLimiter.js`)

```javascript
const rateLimit = require("express-rate-limit");

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: "Too many requests, please try again later",
});

const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10, // 10 uploads per minute
  message: "Too many file uploads, please try again later",
});

module.exports = { apiLimiter, uploadLimiter };
```

**Git Commit**: `"add core infrastructure: logger, validation, error handling, rate limiting"`

---

### STEP 3: Service Layer (The 3-Step Pipeline)

This is the **core focus area**: OCR → Numeric Normalization → Context Classification

#### A. OCR Service (`src/services/ocrService.js`)

**Purpose**: Extract text and numeric tokens from images or text

```javascript
const Tesseract = require("tesseract.js");

/**
 * Extract text from image using Tesseract OCR
 * @param {Buffer} imageBuffer - Image file buffer
 * @returns {Promise<{text: string, confidence: number}>}
 */
async function extractTextFromImage(imageBuffer) {
  const { data } = await Tesseract.recognize(imageBuffer, "eng");
  return {
    text: data.text,
    confidence: data.confidence / 100, // Normalize to 0-1
  };
}

/**
 * Extract numeric tokens using regex
 * Patterns: 1200, 1,200, 1200.50, $1200, ₹1200, 10%
 */
function extractNumericTokens(text) {
  const patterns = [
    /(?:₹|INR|Rs\.?|USD|\$|EUR|€|GBP|£)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(\d+(?:\.\d{2})?)\s*%/gi,
  ];
  // Extract and return array of tokens
}

/**
 * Detect currency from text
 * Returns: INR, USD, EUR, GBP, or "INR" (default)
 */
function detectCurrency(text) {
  if (/₹|INR|Rs\.?/i.test(text)) return "INR";
  if (/\$|USD/i.test(text)) return "USD";
  if (/€|EUR/i.test(text)) return "EUR";
  if (/£|GBP/i.test(text)) return "GBP";
  return "INR";
}

module.exports = {
  extractTextFromImage,
  extractTextFromString: (text) => ({ text, confidence: 1.0 }),
  extractNumericTokens,
  detectCurrency,
};
```

**Output Example**:

```json
{
  "raw_tokens": ["1200", "1000", "200", "10%"],
  "currency_hint": "INR",
  "confidence": 0.85
}
```

#### B. Normalization Service (`src/services/normalizationService.js`)

**Purpose**: Fix OCR errors in numeric tokens

**Common OCR Errors**:

- `l` (lowercase L) → `1`
- `O` (letter O) → `0`
- `I` (letter I) → `1`
- `S` (letter S) → `5`
- `B` (letter B) → `8`
- `Z` (letter Z) → `2`

```javascript
/**
 * Normalize a single token by fixing OCR errors
 * @param {string} token - Raw token like "l200" or "1O00"
 * @returns {number|null} - Normalized number or null if invalid
 */
function normalizeToken(token) {
  let cleaned = token
    .replace(/[₹$€£,\s]/g, "") // Remove currency symbols and whitespace
    .replace(/l/g, "1") // Fix lowercase L
    .replace(/O/g, "0") // Fix letter O
    .replace(/I/g, "1") // Fix letter I
    .replace(/S/g, "5") // Fix letter S
    .replace(/B/g, "8") // Fix letter B
    .replace(/Z/g, "2") // Fix letter Z
    .replace(/%$/, ""); // Remove percentage sign

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Normalize array of tokens
 * @param {string[]} rawTokens
 * @returns {number[]} - Array of normalized numbers
 */
function normalizeAmounts(rawTokens) {
  return rawTokens.map(normalizeToken).filter((n) => n !== null && n > 0);
}

/**
 * Validate normalized amounts (business rules)
 */
function validateNormalizedAmounts(amounts) {
  // Check for reasonable ranges (e.g., < 1,000,000)
  // Check for duplicates
  // Return validation result
}

module.exports = { normalizeAmounts, validateNormalizedAmounts };
```

**Output Example**:

```json
{
  "normalized_amounts": [1200, 1000, 200],
  "normalization_confidence": 1.0
}
```

#### C. Classification Service (`src/services/classificationService.js`)

**Purpose**: Classify amounts by context (keywords around the number)

**Amount Types** (classify into these categories):

- `total_bill` - Keywords: total, amount due, grand total, bill amount
- `paid` - Keywords: paid, payment, received, amount paid
- `due` - Keywords: due, balance, remaining, outstanding
- `discount` - Keywords: discount, off, concession
- `tax` - Keywords: tax, GST, VAT, service tax
- `consultation_fee` - Keywords: consultation, doctor fee, visit
- `medicine_cost` - Keywords: medicine, medication, pharmacy, drugs
- `lab_test_cost` - Keywords: lab, test, pathology, diagnostic
- `room_charges` - Keywords: room, bed, ward, ICU
- `subtotal` - Keywords: subtotal, sub-total, sub total

```javascript
/**
 * Classify a single amount by context
 * @param {number} amount - The numeric value
 * @param {string} context - Surrounding text (20 chars before/after)
 * @returns {string} - Amount type
 */
function classifyAmount(amount, context) {
  const lower = context.toLowerCase();

  if (/total|amount due|grand total/i.test(lower)) return "total_bill";
  if (/paid|payment|received/i.test(lower)) return "paid";
  if (/due|balance|remaining|outstanding/i.test(lower)) return "due";
  if (/discount|off|concession/i.test(lower)) return "discount";
  if (/tax|gst|vat/i.test(lower)) return "tax";
  // ... more classifications

  return "unknown";
}

/**
 * Classify all amounts in raw text
 * @param {number[]} normalizedAmounts
 * @param {string} rawText
 * @returns {Array<{type: string, value: number}>}
 */
function classifyAmounts(normalizedAmounts, rawText) {
  // For each amount, find its position in text
  // Extract context (20 chars before/after)
  // Classify and return array
}

/**
 * Filter to only return: total_bill, paid, due
 * (as per user requirement)
 */
function filterRelevantAmounts(classifiedAmounts) {
  return classifiedAmounts.filter((a) =>
    ["total_bill", "paid", "due"].includes(a.type)
  );
}

module.exports = { classifyAmounts, filterRelevantAmounts };
```

**Output Example**:

```json
{
  "amounts": [
    { "type": "total_bill", "value": 1200 },
    { "type": "paid", "value": 1000 },
    { "type": "due", "value": 200 }
  ],
  "confidence": 0.9
}
```

**Git Commit**: `"implement 3-step pipeline: ocr, normalization, classification"`

---

### STEP 4: Controller & Routes

#### A. Extract Controller (`src/controllers/extractController.js`)

**5 Functions** (keep them simple and well-commented):

1. **`step1_extractRawTokens(req, res)`**

   - Input: `{text: string}` OR `file` (multipart)
   - Process: Run OCR or extract from text
   - Output:

   ```json
   {
     "raw_tokens": ["1200", "1000", "200"],
     "currency_hint": "INR",
     "confidence": 0.85
   }
   ```

2. **`step2_normalizeAmounts(req, res)`**

   - Input: `{raw_tokens: string[]}`
   - Process: Fix OCR errors
   - Output:

   ```json
   {
     "normalized_amounts": [1200, 1000, 200],
     "normalization_confidence": 1.0
   }
   ```

3. **`step3_classifyAmounts(req, res)`**

   - Input: `{normalized_amounts: number[], raw_text: string}`
   - Process: Classify by context
   - Output:

   ```json
   {
     "amounts": [
       { "type": "total_bill", "value": 1200 },
       { "type": "paid", "value": 1000 },
       { "type": "due", "value": 200 }
     ],
     "confidence": 0.9
   }
   ```

4. **`step4_finalOutput(req, res)`**

   - Input: `{currency_hint: string, amounts: Array, raw_text: string}`
   - Process: Add provenance (source tracking)
   - Output:

   ```json
   {
     "currency": "INR",
     "amounts": [
       {
         "type": "total_bill",
         "value": 1200,
         "source": "text: 'Total: INR 1200'"
       },
       {
         "type": "paid",
         "value": 1000,
         "source": "text: 'Paid: 1000'"
       },
       {
         "type": "due",
         "value": 200,
         "source": "text: 'Due: 200'"
       }
     ],
     "status": "ok"
   }
   ```

5. **`extractAndProcess(req, res)`** - Full pipeline (all 4 steps combined)
   - Input: `{text: string}` OR `file` (multipart)
   - Process: Run all 4 steps
   - Output: Same as step4

**Important**: Each function should:

- Validate input using Zod schemas
- Log with request ID
- Handle errors with custom AppError
- Return proper HTTP status codes (200, 400, 500)

#### B. Routes (`src/routes/extract.js`)

```javascript
const express = require("express");
const multer = require("multer");
const router = express.Router();

// Configure multer (5MB limit, memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Step-by-step endpoints
router.post(
  "/step1",
  uploadLimiter,
  upload.single("file"),
  step1_extractRawTokens
);
router.post("/step2", apiLimiter, step2_normalizeAmounts);
router.post("/step3", apiLimiter, step3_classifyAmounts);
router.post("/step4", apiLimiter, step4_finalOutput);

// Full pipeline
router.post("/", uploadLimiter, upload.single("file"), extractAndProcess);

// Health check
router.get("/health", healthCheck);

module.exports = router;
```

**Git Commit**: `"add controller and routes with step-by-step endpoints"`

---

### STEP 5: Express App & Server

#### A. Express App (`src/app.js`)

```javascript
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");
const extractRoutes = require("./routes/extract");

const app = express();

// Generate unique request ID
app.use((req, res, next) => {
  req.id = crypto.randomBytes(4).toString("hex");
  next();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(apiLimiter);

// Routes
app.use("/api/extract", extractRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
```

#### B. Server (`src/server.js`)

```javascript
const app = require("./app");
const logger = require("./utils/logger");
const config = require("./config/env");

const server = app.listen(config.port, () => {
  logger.info("🚀 Plum OCR Backend Service started", {
    port: config.port,
    environment: config.nodeEnv,
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Starting graceful shutdown...");
  server.close(() => {
    logger.info("Server closed. Process terminating...");
    process.exit(0);
  });
});
```

**Git Commit**: `"add express app and server with graceful shutdown"`

---

### STEP 6: Testing & Documentation

#### A. Sample Test Files

Create test files in `test/sample-bills/`:

- `text/bill1.txt` - Simple text with amounts
- `images/test.png` - Medical bill image
- `images/m1.jpg`, `m2.jpg` - More samples

#### B. README.md

Include:

- Project overview
- Tech stack
- Setup instructions (`npm install`, create `.env`, `npm start`)
- API documentation with curl examples
- Architecture diagram (3-step pipeline)
- DevSecOps features list

#### C. Test Script (`test-endpoints.sh`)

Bash script to test all 4 step endpoints + full pipeline

**Git Commit**: `"add documentation and test files"`

---

## Git Commit Guidelines

**Use simple, lowercase commit messages**:

- `"initial setup with dependencies and config"`
- `"add core infrastructure: logger, validation, error handling, rate limiting"`
- `"implement 3-step pipeline: ocr, normalization, classification"`
- `"add controller and routes with step-by-step endpoints"`
- `"add express app and server with graceful shutdown"`
- `"add documentation and test files"`
- `"fix route syntax error"`
- `"update readme with step-by-step endpoint documentation"`

---

## Key Requirements

### Code Quality

✅ **Keep it SIMPLE** - Easy to explain in interview
✅ **Well-commented** - Explain complex logic
✅ **Modular** - Separation of concerns (services, controllers, middleware)
✅ **Consistent** - Follow same patterns throughout
✅ **Error handling** - Every function should handle errors properly

### JSON Input/Output Examples

**Example 1: Text Input (Full Pipeline)**

```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Medical Bill\nTotal: INR 1200\nPaid: 1000\nDue: 200"
  }'
```

Response:

```json
{
  "currency": "INR",
  "amounts": [
    {
      "type": "total_bill",
      "value": 1200,
      "source": "text: 'Total: INR 1200'"
    },
    {
      "type": "paid",
      "value": 1000,
      "source": "text: 'Paid: 1000'"
    },
    {
      "type": "due",
      "value": 200,
      "source": "text: 'Due: 200'"
    }
  ],
  "status": "ok"
}
```

**Example 2: Image Input (Full Pipeline)**

```bash
curl -X POST http://localhost:3000/api/extract \
  -F "file=@./test/sample-bills/images/test.png"
```

Response: Same JSON structure as above

**Example 3: Step-by-Step**

Step 1:

```bash
curl -X POST http://localhost:3000/api/extract/step1 \
  -H "Content-Type: application/json" \
  -d '{"text": "Total: INR 1200 | Paid: 1000 | Due: 200"}'
```

```json
{
  "raw_tokens": ["1200", "1000", "200"],
  "currency_hint": "INR",
  "confidence": 1.0
}
```

Step 2:

```bash
curl -X POST http://localhost:3000/api/extract/step2 \
  -H "Content-Type: application/json" \
  -d '{"raw_tokens": ["l200", "1000", "200"]}'
```

```json
{ "normalized_amounts": [1200, 1000, 200], "normalization_confidence": 1.0 }
```

Step 3:

```bash
curl -X POST http://localhost:3000/api/extract/step3 \
  -H "Content-Type: application/json" \
  -d '{
    "normalized_amounts": [1200, 1000, 200],
    "raw_text": "Total: INR 1200 | Paid: 1000 | Due: 200"
  }'
```

```json
{
  "amounts": [
    { "type": "total_bill", "value": 1200 },
    { "type": "paid", "value": 1000 },
    { "type": "due", "value": 200 }
  ],
  "confidence": 0.9
}
```

Step 4:

```bash
curl -X POST http://localhost:3000/api/extract/step4 \
  -H "Content-Type: application/json" \
  -d '{
    "currency_hint": "INR",
    "amounts": [
      {"type": "total_bill", "value": 1200},
      {"type": "paid", "value": 1000},
      {"type": "due", "value": 200}
    ],
    "raw_text": "Total: INR 1200 | Paid: 1000 | Due: 200"
  }'
```

```json
{
  "currency": "INR",
  "amounts": [
    {
      "type": "total_bill",
      "value": 1200,
      "source": "text: 'Total: INR 1200'"
    },
    { "type": "paid", "value": 1000, "source": "text: 'Paid: 1000'" },
    { "type": "due", "value": 200, "source": "text: 'Due: 200'" }
  ],
  "status": "ok"
}
```

**Example 4: Error Handling**

```bash
curl -X POST http://localhost:3000/api/extract/step1 \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World"}'
```

```json
{
  "status": "no_amounts_found",
  "reason": "No numeric values detected in the document"
}
```

---

## DevSecOps Checklist

✅ Rate limiting (30 req/min general, 10 req/min uploads)
✅ CORS enabled
✅ Environment variables (.env)
✅ Custom error handling with proper HTTP codes
✅ Request ID tracking
✅ Input validation (Zod schemas)
✅ Structured logging (Winston)
✅ Log sanitization (remove sensitive data)
✅ Graceful shutdown (SIGTERM/SIGINT)
✅ File size limits (5MB)
✅ File type validation (JPEG, PNG, PDF)
✅ .gitignore (protect secrets)

---

## Interview Talking Points

When explaining this project to the interviewer, emphasize:

1. **Pipeline Architecture**: "I designed a 3-step pipeline - OCR extraction, normalization to fix OCR errors, and context-based classification"

2. **Modularity**: "Each step is independent and testable. I can demonstrate each step separately or run the full pipeline"

3. **Error Correction**: "OCR often makes mistakes like reading 'l' as '1' or 'O' as '0'. My normalization layer fixes these automatically"

4. **Context Awareness**: "The classification service uses surrounding keywords to identify if a number is total_bill, paid, or due"

5. **DevSecOps**: "I implemented rate limiting, input validation, structured logging, error handling, and graceful shutdown"

6. **Simplicity**: "I kept the code simple and well-commented so it's maintainable and easy to understand"

7. **Provenance**: "The final output includes source tracking, so you know exactly where each amount came from in the document"

---

## Final Checklist

Before submission:

- [ ] All dependencies installed
- [ ] .env file configured
- [ ] Server starts without errors (`npm start`)
- [ ] All 4 step endpoints working
- [ ] Full pipeline endpoint working
- [ ] Image OCR working (test with test.png)
- [ ] Text input working
- [ ] Error handling working (try invalid input)
- [ ] Rate limiting working (try 31 requests)
- [ ] README.md complete with examples
- [ ] All commits pushed to GitHub
- [ ] Code is clean, simple, and well-commented

---

## Success Criteria

✅ **Functional**: All endpoints return correct JSON responses
✅ **Simple**: Code is easy to read and explain
✅ **Documented**: README with clear examples
✅ **Secure**: DevSecOps features implemented
✅ **Tested**: Works with both text and image inputs
✅ **Interview-Ready**: Can explain architecture and design decisions

---

Good luck with your implementation! Keep it simple, modular, and well-documented. 🚀
