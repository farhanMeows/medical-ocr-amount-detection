# Plum OCR Backend Service

A production-ready backend service for OCR-based medical bill processing with intelligent amount extraction and classification. Built for Plum Insurance as part of Backend/DevSecOps internship evaluation.

## 🎯 Overview

This service implements a complete **OCR → Normalization → Classification** pipeline that:

- Accepts medical bills as **text input** or **image uploads** (JPEG/PNG/PDF)
- Uses **Google Cloud Vision API** for OCR
- Normalizes numeric values by fixing common OCR mistakes
- Classifies amounts by context (total, paid, due, discount, etc.)
- Returns structured JSON with full provenance

## features

- tesseract.js ocr for image text extraction
- fixes common ocr errors automatically
- classifies amounts by context keywords
- supports multiple currencies (inr, usd, eur, gbp)
- rate limiting (30 requests/min)
- structured logging with request ids
- input validation using zod
- proper error handling with custom error classes

## project structure

\`\`\`
plum-ocr-backend/
├── src/
│ ├── app.js # Express app configuration
│ ├── server.js # Server entry point
│ ├── config/
│ │ └── env.js # Environment configuration
│ ├── controllers/
│ │ └── extractController.js # Main extraction logic
│ ├── middleware/
│ │ ├── errorHandler.js # Error handling
│ │ └── rateLimiter.js # Rate limiting
│ ├── routes/
│ │ └── extract.js # API routes
│ ├── services/
│ │ ├── ocrService.js # Google Cloud Vision integration
│ │ ├── normalizationService.js # OCR error correction
│ │ └── classificationService.js # Context classification
│ └── utils/
│ ├── logger.js # Winston logger
│ └── validateInput.js # Zod schemas
├── test/
│ └── sample-bills/ # Sample test files
├── .env.example # Environment template
├── .gitignore
├── package.json
└── README.md
\`\`\`

## setup

### prerequisites

- node.js v16+ and npm

### clone and install

\`\`\`bash
git clone https://github.com/farhanMeows/medical-ocr-amount-detection.git
cd medical-ocr-amount-detection
\`\`\`

### 2. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 3. Configure Google Cloud Vision API

#### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Cloud Vision API**

#### Step 2: Create Service Account

1. Navigate to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Give it a name (e.g., `plum-ocr-service`)
4. Grant role: **Cloud Vision API User**
5. Click **Done**

#### Step 3: Generate Key

1. Click on the created service account
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Choose **JSON** format
5. Download the key file (e.g., `plum-vision-key.json`)

#### Step 4: Place Key in Project

\`\`\`bash

# Move the key to your project root

mv ~/Downloads/plum-vision-key.json ./google-cloud-key.json
\`\`\`

### 4. Configure Environment Variables

Create a \`.env\` file from the example:

\`\`\`bash
cp .env.example .env
\`\`\`

Edit \`.env\`:

\`\`\`env
PORT=3000
NODE_ENV=development

# Google Cloud Vision API - Update with your key path

GOOGLE_APPLICATION_CREDENTIALS=./google-cloud-key.json

# Rate Limiting

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30

# File Upload Limits

MAX_FILE_SIZE_MB=5
MAX_TEXT_LENGTH=10000

# Logging

LOG_LEVEL=info

# OCR Threshold

MIN_OCR_CONFIDENCE=0.5
\`\`\`

### 5. Start the Server

\`\`\`bash

# Development mode (with auto-reload)

npm run dev

# Production mode

npm start
\`\`\`

The server will start on \`http://localhost:3000\`

## 📡 API Documentation

### Base URL

\`\`\`
http://localhost:3000
\`\`\`

### Endpoints

#### 1. Extract Amounts (Main Endpoint)

**POST** \`/api/extract\`

Processes text or image input through the full OCR pipeline.

##### Request Options

**Option A: Text Input**

\`\`\`bash
curl -X POST http://localhost:3000/api/extract \\
-H "Content-Type: application/json" \\
-d '{
"text": "Total: INR 1200 | Paid: 1000 | Due: 200 | Discount: 10%"
}'
\`\`\`

**Option B: Image Upload**

\`\`\`bash
curl -X POST http://localhost:3000/api/extract \\
-F "file=@/path/to/medical-bill.jpg"
\`\`\`

##### Success Response (200 OK)

\`\`\`json
{
"currency": "INR",
"amounts": [
{
"type": "total_bill",
"value": 1200,
"source": "text: 'Total: INR 1200'",
"confidence": 0.9
},
{
"type": "paid",
"value": 1000,
"source": "text: 'Paid: 1000'",
"confidence": 0.9
},
{
"type": "due",
"value": 200,
"source": "text: 'Due: 200'",
"confidence": 0.9
}
],
"status": "ok",
"metadata": {
"ocr_confidence": 1,
"normalization_confidence": 1,
"classification_confidence": 0.9
}
}
\`\`\`

##### Guardrail Responses

**No Amounts Found**
\`\`\`json
{
"status": "no_amounts_found",
"reason": "No numeric values detected in the document"
}
\`\`\`

**Low Confidence**
\`\`\`json
{
"status": "low_confidence",
"reason": "Document quality too poor or text too noisy",
"confidence": 0.42
}
\`\`\`

##### Error Response (400/500)

\`\`\`json
{
"status": "error",
"error_code": "invalid_file",
"message": "File must be JPEG, PNG, or PDF"
}
\`\`\`

#### 2. Health Check

**GET** \`/health\` or \`/api/extract/health\`

\`\`\`bash
curl http://localhost:3000/health
\`\`\`

Response:
\`\`\`json
{
"status": "ok",
"timestamp": "2024-12-02T10:30:00.000Z"
}
\`\`\`

## 🧪 Testing Examples

### Example 1: Simple Text Input

\`\`\`bash
curl -X POST http://localhost:3000/api/extract \\
-H "Content-Type: application/json" \\
-d '{
"text": "APOLLO HOSPITALS\\nTotal Bill: Rs 7371\\nAmount Paid: Rs 5000\\nBalance Due: Rs 2371"
}'
\`\`\`

### Example 2: Complex Medical Bill

\`\`\`bash
curl -X POST http://localhost:3000/api/extract \\
-H "Content-Type: application/json" \\
-d '{
"text": "Consultation Fee: Rs 1500\\nLab Tests: Rs 2500\\nMedicines: Rs 800\\nSubtotal: Rs 4800\\nDiscount (10%): Rs 480\\nTotal: INR 4320"
}'
\`\`\`

### Example 3: Image Upload

\`\`\`bash
curl -X POST http://localhost:3000/api/extract \\
-F "file=@./test/sample-bills/sample-bill-1.txt"
\`\`\`

### Example 4: Using Sample Bill

The project includes a sample bill in \`test/sample-bills/sample-bill-1.txt\`:

\`\`\`bash
curl -X POST http://localhost:3000/api/extract \\
-H "Content-Type: application/json" \\
-d @test/sample-bills/sample-bill-1.txt
\`\`\`

## 🏗️ Architecture

### Pipeline Flow

\`\`\`
Input (Text/Image)
↓
┌──────────────────┐
│ Step 1: OCR │ → Google Cloud Vision (if image)
│ │ → Extract raw tokens
└──────────────────┘
↓
┌──────────────────┐
│ Step 2: Normalize│ → Fix OCR errors (l→1, O→0)
│ │ → Parse amounts
└──────────────────┘
↓
┌──────────────────┐
│ Step 3: Classify │ → Context matching
│ │ → Type detection
└──────────────────┘
↓
┌──────────────────┐
│ Step 4: Output │ → Structured JSON
│ │ → With provenance
└──────────────────┘
\`\`\`

### Amount Types Detected

| Type                 | Examples                                     |
| -------------------- | -------------------------------------------- |
| \`total_bill\`       | "Total Amount", "Bill Amount", "Grand Total" |
| \`paid\`             | "Amount Paid", "Payment", "Received"         |
| \`due\`              | "Balance Due", "Outstanding", "Pending"      |
| \`discount\`         | "Discount", "Concession", "Rebate"           |
| \`tax\`              | "GST", "VAT", "Service Tax"                  |
| \`consultation_fee\` | "Consultation Fee", "Doctor Charges"         |
| \`medicine_cost\`    | "Medicines", "Pharmacy"                      |
| \`lab_test_cost\`    | "Lab Tests", "Investigations"                |
| \`room_charges\`     | "Room Charges", "Accommodation"              |
| \`subtotal\`         | "Sub Total", "Subtotal"                      |
| \`other\`            | Amounts without clear context                |

## 🔒 Security Features

### Rate Limiting

- **General API**: 30 requests/minute per IP
- **Upload Endpoint**: 10 requests/minute per IP
- Returns 429 status when exceeded

### Input Validation

- Text: Max 10,000 characters
- Files: Max 5MB, only JPEG/PNG/PDF
- Strict type checking with Zod

### Secure Configuration

- Environment variables for all secrets
- No credentials in code
- \`.gitignore\` protects sensitive JSON files

### Logging

- Request IDs for tracing
- No sensitive data logged
- Structured JSON logs
- Separate error logs in production

## 🐛 Error Codes

| Code                    | Meaning                          |
| ----------------------- | -------------------------------- |
| \`invalid_input\`       | Neither text nor file provided   |
| \`invalid_text\`        | Text validation failed           |
| \`invalid_file\`        | File type/size validation failed |
| \`ocr_not_configured\`  | Google Cloud credentials missing |
| \`no_text_detected\`    | OCR found no text in image       |
| \`ocr_failed\`          | OCR service error                |
| \`rate_limit_exceeded\` | Too many requests                |
| \`not_found\`           | Route not found                  |
| \`internal_error\`      | Unexpected server error          |

## 📝 Postman Collection

You can test the API using this Postman collection structure:

### Collection: Plum OCR API

#### 1. Extract from Text

- **Method**: POST
- **URL**: \`http://localhost:3000/api/extract\`
- **Body** (raw JSON):
  \`\`\`json
  {
  "text": "Total: INR 1200 | Paid: 1000 | Due: 200"
  }
  \`\`\`

#### 2. Extract from Image

- **Method**: POST
- **URL**: \`http://localhost:3000/api/extract\`
- **Body** (form-data):
  - Key: \`file\`
  - Type: File
  - Value: Select your image file

#### 3. Health Check

- **Method**: GET
- **URL**: \`http://localhost:3000/health\`

## 🚦 Development

### Available Scripts

\`\`\`bash

# Start development server with auto-reload

npm run dev

# Start production server

npm start

# Install dependencies

npm install
\`\`\`

### Adding New Amount Types

To add new classification types, edit \`src/services/classificationService.js\`:

\`\`\`javascript
{
type: 'your_new_type',
patterns: [
/your\s*pattern[:\s]*(?:rs\.?|inr|₹)?\s\*(\d+)/i,
],
confidence: 0.8,
}
\`\`\`

## 📊 Performance

- **Average response time**: < 500ms (text input)
- **Average response time**: 1-3s (image OCR)
- **Throughput**: 30 req/min per IP (configurable)
- **Max file size**: 5MB (configurable)

## 🤝 Contributing

This is an internship evaluation project. For production use, consider:

1. Adding comprehensive test suites (Jest/Mocha)
2. Implementing caching (Redis)
3. Adding database persistence
4. Setting up CI/CD pipeline
5. Adding Prometheus metrics
6. Implementing API authentication

## 📄 License

ISC

## 👤 Author

Built for **Plum Insurance** as part of Backend/DevSecOps Internship Evaluation.

---

**Questions?** Check the inline code documentation or review the service files in \`src/services/\`.
