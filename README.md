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

### testing

**postman collection:** import `Plum_OCR_API.postman_collection.json` into postman for ready-to-use api tests  
_note: after importing, manually select a medical bill image file in the request body. bundled sample bill lives at [test/sample-bills/images/Sample_Bill.jpg](test/sample-bills/images/Sample_Bill.jpg), or download it from your running server via `http://localhost:3000/sample-bills/images/Sample_Bill.jpg`_

**sample curl commands:** see `SAMPLE_CURL_COMMANDS.md` for comprehensive testing examples

### endpoints

#### ocr extract - image upload

**POST** `/api/extract`

upload medical bill image for ocr processing and amount extraction. runs full 4-step pipeline.

**supported formats:** jpeg, png, pdf  
**max file size:** 5mb

**request:**

```bash
curl -X POST https://plum-ocr-backend.onrender.com/api/extract \
  -F "file=@./test/sample-bills/images/Sample_Bill.jpg"
```

**success response:**

```json
{
  "currency": "INR",
  "amounts": [
    {
      "type": "total_bill",
      "value": 214,
      "source": "text: 'total amount: 214.00'"
    },
    {
      "type": "paid",
      "value": 200,
      "source": "text: 'paid amount: 200.00'"
    }
  ],
  "status": "ok"
}
```

**error responses:**

```json
// no amounts found
{"status": "no_amounts_found", "reason": "No numeric values detected"}

// invalid file type
{"status": "error", "error_code": "invalid_file", "message": "File must be JPEG, PNG, or PDF"}

// file too large
{"status": "error", "error_code": "file_too_large", "message": "File size exceeds 5MB limit"}
```

#### health check

**GET** `/health`

```bash
curl https://plum-ocr-backend.onrender.com/health
```

response: `{"status": "ok", "timestamp": "..."}`

---

## pipeline architecture

Response: {"normalized_amounts": [1200, 1000, 200], "normalization_confidence": 1.0}

````

**step 3: classification**

```bash
POST /api/extract/step3
Body: {"normalized_amounts": [1200, 1000, 200], "raw_text": "..."}
Response: {"amounts": [{"type": "total_bill", "value": 1200}, ...], "confidence": 0.9}
````

**step 4: final output**

```bash
POST /api/extract/step4
Body: {"currency_hint": "INR", "amounts": [...], "raw_text": "..."}
## pipeline architecture

```

medical bill image (jpeg/png/pdf)
↓
┌─────────────────────────────┐
│ step 1: ocr extraction │ → tesseract.js ocr
│ │ → extract numeric tokens
│ │ → detect currency
└─────────────────────────────┘
↓
┌─────────────────────────────┐
│ step 2: normalization │ → fix ocr errors:
│ │ l→1, O→0, I→1, S→5, B→8
│ │ → convert to numbers
└─────────────────────────────┘
↓
┌─────────────────────────────┐
│ step 3: classification │ → match context keywords
│ │ → label as total/paid/due
│ │ → filter relevant amounts
└─────────────────────────────┘
↓
┌─────────────────────────────┐
│ step 4: final output │ → add source provenance
│ │ → return structured json
└─────────────────────────────┘

````

### amount types detected

the service only returns these 3 types in the final output:

- **total_bill** - keywords: total, amount due, grand total, bill amount
- **paid** - keywords: paid, payment, received, amount paid
- **due** - keywords: due, balance, remaining, outstanding

internally, it can also recognize (but filters out):

- discount, tax, consultation_fee, medicine_cost, lab_test_cost, room_charges, subtotal

## testing example

```bash
curl -X POST https://plum-ocr-backend.onrender.com/api/extract \
  -F "file=@./medical-bill.png"
````

see `SAMPLE_CURL_COMMANDS.md` and `DEMO_GUIDE.md` for more examples.

## security features

- **rate limiting**: 30 requests/min (general), 10 requests/min (uploads)
- **input validation**: files max 5mb, types: jpeg/png/pdf only
- **secure config**: all secrets in .env, no credentials in code
- **logging**: request ids for tracing, no sensitive data logged
- **error handling**: proper http status codes, structured error responses

## error codes

| code                  | meaning                          |
| --------------------- | -------------------------------- |
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

- image ocr: 1-3s average response time
- throughput: 10 req/min per ip for uploads (configurable)
- max file size: 5mb (configurable)

## license

ISC

## author

built for plum insurance backend/devsecops internship evaluation

---

**see also:**

- `SAMPLE_CURL_COMMANDS.md` - ready-to-use curl commands
- `Plum_OCR_API.postman_collection.json` - postman collection
- `DEMO_GUIDE.md` - detailed step-by-step testing guide
- inline code documentation in `src/services/`
