# Step-by-Step Pipeline Demonstration Guide

This guide shows how to demonstrate each step of the OCR pipeline individually to your interviewer.

## Overview

The pipeline is broken into 4 independent steps:
1. **Step 1**: OCR / Text Extraction
2. **Step 2**: Normalization
3. **Step 3**: Classification
4. **Step 4**: Final Output

---

## Step 1: OCR / Text Extraction

**Endpoint**: `POST /api/extract/step1`

### Example 1: Text Input

```bash
curl -X POST http://localhost:3000/api/extract/step1 \
  -H "Content-Type: application/json" \
  -d '{"text": "Total: INR 1200 | Paid: 1000 | Due: 200 | Discount: 10%"}'
```

**Expected Response**:
```json
{
  "raw_tokens": ["1200", "1000", "200", "10%"],
  "currency_hint": "INR",
  "confidence": 1.0
}
```

### Example 2: Image Input (with OCR)

```bash
curl -X POST http://localhost:3000/api/extract/step1 \
  -F "file=@./test/sample-bills/images/m1.jpg"
```

**Expected Response** (OCR may have errors):
```json
{
  "raw_tokens": ["l200", "1000", "200"],
  "currency_hint": "INR",
  "confidence": 0.74
}
```

### Guardrail Example:

```bash
curl -X POST http://localhost:3000/api/extract/step1 \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World"}'
```

**Response**:
```json
{
  "status": "no_amounts_found",
  "reason": "No numeric values detected in the document"
}
```

---

## Step 2: Normalization

**Endpoint**: `POST /api/extract/step2`

Takes the `raw_tokens` from Step 1 and fixes OCR errors.

### Example:

```bash
curl -X POST http://localhost:3000/api/extract/step2 \
  -H "Content-Type: application/json" \
  -d '{
    "raw_tokens": ["l200", "1000", "200"]
  }'
```

**Expected Response**:
```json
{
  "normalized_amounts": [1200, 1000, 200],
  "normalization_confidence": 1.0
}
```

**Note**: See how `"l200"` (with lowercase L) was corrected to `1200`!

---

## Step 3: Classification

**Endpoint**: `POST /api/extract/step3`

Takes `normalized_amounts` and `raw_text` to classify by context.

### Example:

```bash
curl -X POST http://localhost:3000/api/extract/step3 \
  -H "Content-Type: application/json" \
  -d '{
    "normalized_amounts": [1200, 1000, 200],
    "raw_text": "Total: INR 1200 | Paid: 1000 | Due: 200"
  }'
```

**Expected Response**:
```json
{
  "amounts": [
    {"type": "total_bill", "value": 1200},
    {"type": "paid", "value": 1000},
    {"type": "due", "value": 200}
  ],
  "confidence": 0.90
}
```

---

## Step 4: Final Output

**Endpoint**: `POST /api/extract/step4`

Combines everything with provenance (source tracking).

### Example:

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

**Expected Response**:
```json
{
  "currency": "INR",
  "amounts": [
    {"type": "total_bill", "value": 1200, "source": "text: 'Total: INR 1200'"},
    {"type": "paid", "value": 1000, "source": "text: 'Paid: 1000'"},
    {"type": "due", "value": 200, "source": "text: 'Due: 200'"}
  ],
  "status": "ok"
}
```

---

## Full Pipeline (All Steps Combined)

**Endpoint**: `POST /api/extract`

For convenience, you can still run all 4 steps at once:

```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "Total: INR 1200 | Paid: 1000 | Due: 200"}'
```

---

## Postman Collection for Interviewer

### Step 1: Extract Raw Tokens
- **Method**: POST
- **URL**: `http://localhost:3000/api/extract/step1`
- **Body** (raw JSON):
```json
{
  "text": "Total: INR 1200 | Paid: 1000 | Due: 200 | Discount: 10%"
}
```

### Step 2: Normalize Amounts
- **Method**: POST
- **URL**: `http://localhost:3000/api/extract/step2`
- **Body** (raw JSON):
```json
{
  "raw_tokens": ["l200", "1000", "200"]
}
```

### Step 3: Classify Amounts
- **Method**: POST
- **URL**: `http://localhost:3000/api/extract/step3`
- **Body** (raw JSON):
```json
{
  "normalized_amounts": [1200, 1000, 200],
  "raw_text": "Total: INR 1200 | Paid: 1000 | Due: 200"
}
```

### Step 4: Final Output
- **Method**: POST
- **URL**: `http://localhost:3000/api/extract/step4`
- **Body** (raw JSON):
```json
{
  "currency_hint": "INR",
  "amounts": [
    {"type": "total_bill", "value": 1200},
    {"type": "paid", "value": 1000},
    {"type": "due", "value": 200}
  ],
  "raw_text": "Total: INR 1200 | Paid: 1000 | Due: 200"
}
```

---

## Key Points to Highlight to Interviewer

1. **Modularity**: Each step is independent and testable
2. **Error Correction**: Step 2 shows OCR error correction (l→1, O→0)
3. **Context Awareness**: Step 3 uses surrounding text to classify amounts
4. **Provenance**: Step 4 tracks where each amount came from
5. **Guardrails**: Each step has validation and error handling
6. **Flexibility**: Can run individual steps or full pipeline

---

## Testing Flow

```
Step 1: Extract          Step 2: Normalize       Step 3: Classify       Step 4: Finalize
  (OCR)                    (Fix errors)          (Add context)         (Add source)
    ↓                           ↓                       ↓                      ↓
["l200","1000"]  →  [1200, 1000]  →  [{"type":"total"  →  [{"type":"total",
                                       ,"value":1200}]      "value":1200,
                                                            "source":"..."}]
```

This demonstrates your understanding of:
- **Separation of Concerns**
- **Pipeline Architecture**
- **Error Handling**
- **Data Transformation**
- **API Design**

Good luck with your interview! 🚀
