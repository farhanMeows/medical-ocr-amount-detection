# plum ocr backend service

backend service for extracting amounts from medical bills. supports text and image inputs with ocr processing.

**🚀 live demo:** https://plum-ocr-backend.onrender.com

## overview

implements a 4-step pipeline: **ocr → normalization → classification → output**

- accepts medical bills as text or images (jpeg/png/pdf)
- uses tesseract.js for ocr
- fixes common ocr errors (l→1, O→0, I→1, S→5, B→8)
- classifies amounts using context keywords (total, paid, due)
- returns structured json with source provenance
- supports both full pipeline and individual step execution

## features

### core functionality

- tesseract.js ocr integration (free, offline)
- automatic ocr error correction
- context-based amount classification
- multi-currency support (INR, USD, EUR, GBP)
- confidence scoring at each stage
- step-by-step endpoints for testing

### devsecops features

- rate limiting (30 req/min general, 10 req/min uploads)
- structured logging with winston
- input validation using zod
- custom error handling
- request tracing with unique ids
- file type and size validation

## project structure

```
plum/
├── src/
│   ├── app.js                      # express app setup
│   ├── server.js                   # server entry point
│   ├── config/
│   │   └── env.js                  # environment config
│   ├── controllers/
│   │   └── extractController.js    # main pipeline logic
│   ├── middleware/
│   │   ├── errorHandler.js         # error handling
│   │   └── rateLimiter.js          # rate limiting
│   ├── routes/
│   │   └── extract.js              # api routes
│   ├── services/
│   │   ├── ocrService.js           # tesseract ocr
│   │   ├── normalizationService.js # error correction
│   │   └── classificationService.js # context classification
│   └── utils/
│       ├── logger.js               # winston logger
│       └── validateInput.js        # zod schemas
├── test/
│   └── sample-bills/              # test files
├── DEMO_GUIDE.md                  # step-by-step demo
├── .env                           # environment vars
└── package.json
```

## setup

### prerequisites

- node.js v16+
- npm

### installation

```bash
# clone repository
git clone https://github.com/farhanMeows/medical-ocr-amount-detection.git
cd medical-ocr-amount-detection

# install dependencies
npm install

# create .env file (optional - uses defaults)
cp .env.example .env

# start server
npm start
```

server runs on `http://localhost:3000`

### environment variables

create `.env` file (optional):

```env
PORT=3000
NODE_ENV=development
MAX_FILE_SIZE_MB=5
MAX_TEXT_LENGTH=10000
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30
```

**note:** no api keys needed! tesseract runs locally.

## api documentation

### base url

```
local: http://localhost:3000
production: https://plum-ocr-backend.onrender.com
```

### endpoints

#### 1. full pipeline (main endpoint)

**POST** `/api/extract`

runs all 4 steps in one request.

**text input:**

```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "Total: INR 1200 | Paid: 1000 | Due: 200"}'
```

**image input:**

```bash
curl -X POST http://localhost:3000/api/extract \
  -F "file=@./test/sample-bills/images/test.png"
```

**success response:**

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

**error responses:**

```json
// no amounts found
{"status": "no_amounts_found", "reason": "No numeric values detected"}

// invalid input
{"status": "error", "error_code": "invalid_file", "message": "File must be JPEG, PNG, or PDF"}
```

#### 2. step-by-step endpoints

use these to test individual pipeline stages:

**step 1: ocr/text extraction**

```bash
POST /api/extract/step1
Body: {"text": "..."} or file upload
Response: {"raw_tokens": [...], "currency_hint": "INR", "confidence": 0.85}
```

**step 2: normalization**

```bash
POST /api/extract/step2
Body: {"raw_tokens": ["l200", "1000", "200"]}
Response: {"normalized_amounts": [1200, 1000, 200], "normalization_confidence": 1.0}
```

**step 3: classification**

```bash
POST /api/extract/step3
Body: {"normalized_amounts": [1200, 1000, 200], "raw_text": "..."}
Response: {"amounts": [{"type": "total_bill", "value": 1200}, ...], "confidence": 0.9}
```

**step 4: final output**

```bash
POST /api/extract/step4
Body: {"currency_hint": "INR", "amounts": [...], "raw_text": "..."}
Response: {"currency": "INR", "amounts": [...with sources...], "status": "ok"}
```

see `DEMO_GUIDE.md` for detailed examples.

#### 3. health check

**GET** `/health` or `/api/extract/health`

```bash
curl http://localhost:3000/health
```

response: `{"status": "ok", "timestamp": "..."}`

## pipeline architecture

```
input (text/image)
       ↓
┌─────────────────────────────┐
│ step 1: ocr/text extraction │ → tesseract.js (if image)
│                             │ → extract numeric tokens
│                             │ → detect currency
└─────────────────────────────┘
       ↓
┌─────────────────────────────┐
│ step 2: normalization       │ → fix ocr errors:
│                             │   l→1, O→0, I→1, S→5, B→8
│                             │ → convert to numbers
└─────────────────────────────┘
       ↓
┌─────────────────────────────┐
│ step 3: classification      │ → match context keywords
│                             │ → label as total/paid/due
│                             │ → filter relevant amounts
└─────────────────────────────┘
       ↓
┌─────────────────────────────┐
│ step 4: final output        │ → add source provenance
│                             │ → return structured json
└─────────────────────────────┘
```

### amount types detected

the service only returns these 3 types in the final output:

- **total_bill** - keywords: total, amount due, grand total, bill amount
- **paid** - keywords: paid, payment, received, amount paid
- **due** - keywords: due, balance, remaining, outstanding

internally, it can also recognize (but filters out):

- discount, tax, consultation_fee, medicine_cost, lab_test_cost, room_charges, subtotal

## testing examples

### text input

```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{
    "text": "APOLLO HOSPITALS\nTotal Bill: Rs 1200\nAmount Paid: Rs 1000\nBalance Due: Rs 200"
  }'
```

### image input

```bash
curl -X POST http://localhost:3000/api/extract \
  -F "file=@./test/sample-bills/images/test.png"
```

### step-by-step demo

```bash
# step 1: extract
curl -X POST http://localhost:3000/api/extract/step1 \
  -H "Content-Type: application/json" \
  -d '{"text": "Total: INR 1200 | Paid: 1000 | Due: 200"}'

# step 2: normalize (use raw_tokens from step 1)
curl -X POST http://localhost:3000/api/extract/step2 \
  -H "Content-Type: application/json" \
  -d '{"raw_tokens": ["1200", "1000", "200"]}'

# step 3: classify (use normalized_amounts from step 2)
curl -X POST http://localhost:3000/api/extract/step3 \
  -H "Content-Type: application/json" \
  -d '{"normalized_amounts": [1200, 1000, 200], "raw_text": "Total: INR 1200 | Paid: 1000 | Due: 200"}'
```

## security features

- **rate limiting**: 30 requests/min (general), 10 requests/min (uploads)
- **input validation**: text max 10k chars, files max 5mb, types: jpeg/png/pdf
- **secure config**: all secrets in .env, no credentials in code
- **logging**: request ids for tracing, no sensitive data logged
- **error handling**: proper http status codes, structured error responses

## error codes

| code                  | meaning                          |
| --------------------- | -------------------------------- |
| `invalid_input`       | neither text nor file provided   |
| `invalid_text`        | text validation failed           |
| `invalid_file`        | file type/size validation failed |
| `no_amounts_found`    | no numeric values detected       |
| `ocr_failed`          | ocr service error                |
| `rate_limit_exceeded` | too many requests                |
| `not_found`           | route not found                  |
| `internal_error`      | unexpected server error          |

## development

```bash
# development mode with auto-reload
npm run dev

# production mode
npm start
```

### adding new amount types

edit `src/services/classificationService.js`:

```javascript
{
  type: 'your_new_type',
  patterns: [
    /your\s*pattern[:\s]*(?:rs\.?|inr|₹)?\s*(\d+)/i,
  ],
  confidence: 0.8,
}
```

then update the filter in `extractController.js` to include your new type.

## performance

- text input: < 500ms average response time
- image ocr: 1-3s average response time
- throughput: 30 req/min per ip (configurable)
- max file size: 5mb (configurable)

## license

ISC

## author

built for plum insurance backend/devsecops internship evaluation

---

**see also:**

- `DEMO_GUIDE.md` - detailed step-by-step testing guide
- inline code documentation in `src/services/`
