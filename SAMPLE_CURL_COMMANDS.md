# Plum OCR Backend API - Sample curl Commands

Base URL (Production): https://plum-ocr-backend.onrender.com
Base URL (Local): http://localhost:3000

---

## 1. Health Check

```bash
curl https://plum-ocr-backend.onrender.com/health
```

**Expected Response:**

```json
{ "status": "ok", "timestamp": "2025-12-04T10:49:39.753Z" }
```

---

## 2. OCR Extract - Image Upload

**Note:** Replace `/path/to/bill.png` with actual image path

```bash
curl -X POST https://plum-ocr-backend.onrender.com/api/extract \
  -F "file=@/path/to/bill.png"
```

**Example with test file (if you have the repo cloned):**

```bash
curl -X POST https://plum-ocr-backend.onrender.com/api/extract \
  -F "file=@./test/sample-bills/images/test.png"
```

**Expected Response:**

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

---

## 3. Error Testing - Invalid File Type

```bash
curl -X POST https://plum-ocr-backend.onrender.com/api/extract \
  -F "file=@/path/to/document.txt"
```

**Expected Error:**

```json
{
  "status": "error",
  "error_code": "invalid_file",
  "message": "File must be JPEG, PNG, or PDF"
}
```

---

## 4. Rate Limiting Test

```bash
curl -X POST https://plum-ocr-backend.onrender.com/api/extract/step2 \
  -H "Content-Type: application/json" \
  -d '{
    "raw_tokens": ["2l4", "2OO", "I00"]
  }'
```

**Expected Response:**

```json
{
  "normalized_amounts": [214, 200, 100],
  "normalization_confidence": 1.0
}
```

---

## 6. Step 3 - Classification

Classify amounts by context keywords:

```bash
curl -X POST https://plum-ocr-backend.onrender.com/api/extract/step3 \
  -H "Content-Type: application/json" \
  -d '{
    "normalized_amounts": [214, 200, 0],
    "raw_text": "Total Amount: 214.00\nPaid Amount: 200.00\nBalance Amount: 0"
  }'
```

**Expected Response:**

```json
{
  "amounts": [
    { "type": "total_bill", "value": 214 },
    { "type": "paid", "value": 200 },
    { "type": "due", "value": 0 }
  ],
  "confidence": 0.9
}
```

---

## 7. Step 4 - Final Output

Add source provenance to amounts:

```bash
curl -X POST https://plum-ocr-backend.onrender.com/api/extract/step4 \
  -H "Content-Type: application/json" \
  -d '{
    "currency_hint": "INR",
    "amounts": [
      {"type": "total_bill", "value": 214},
      {"type": "paid", "value": 200}
    ],
    "raw_text": "Total Amount: 214.00\nPaid Amount: 200.00"
  }'
```

**Expected Response:**

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

## 4. Rate Limiting Test

Run multiple requests quickly to test rate limiting (10 req/min for image uploads):

```bash
for i in {1..12}; do
  echo "Request $i:"
  curl -X POST https://plum-ocr-backend.onrender.com/api/extract \
    -F "file=@./test/sample-bills/images/test.png"
  echo ""
  sleep 1
done
```

**Expected:** After 10 requests, you'll get:

```json
{
  "status": "error",
  "error_code": "rate_limit_exceeded",
  "message": "Too many requests. Please try again later."
}
```

---

## Tips for Testing:

1. **Use `-i` flag to see response headers:**

   ```bash
   curl -i https://plum-ocr-backend.onrender.com/health
   ```

2. **Pretty print JSON with `jq` (if installed):**

   ```bash
   curl https://plum-ocr-backend.onrender.com/api/extract \
     -F "file=@./test.png" | jq
   ```

3. **Save response to file:**

   ```bash
   curl https://plum-ocr-backend.onrender.com/api/extract \
     -F "file=@./test.png" \
     -o response.json
   ```

4. **Test with verbose output:**
   ```bash
   curl -v https://plum-ocr-backend.onrender.com/health
   ```
