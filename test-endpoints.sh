#!/bin/bash

# Test script for step-by-step endpoints
# Make sure server is running on port 3000 before running this script

BASE_URL="http://localhost:3000"
echo "Testing Plum OCR Step-by-Step Endpoints"
echo "========================================"
echo ""

# Test Step 1: Extract Raw Tokens
echo "📍 STEP 1: Extract Raw Tokens"
echo "POST /api/extract/step1"
echo ""
STEP1_RESPONSE=$(curl -s -X POST $BASE_URL/api/extract/step1 \
  -H "Content-Type: application/json" \
  -d '{"text": "Total: INR 1200 | Paid: 1000 | Due: 200"}')
echo "$STEP1_RESPONSE" | jq .
echo ""
echo "---"
echo ""

# Extract raw_tokens for next step
RAW_TOKENS=$(echo "$STEP1_RESPONSE" | jq -c '.raw_tokens')

# Test Step 2: Normalize Amounts
echo "📍 STEP 2: Normalize Amounts"
echo "POST /api/extract/step2"
echo ""
STEP2_RESPONSE=$(curl -s -X POST $BASE_URL/api/extract/step2 \
  -H "Content-Type: application/json" \
  -d "{\"raw_tokens\": $RAW_TOKENS}")
echo "$STEP2_RESPONSE" | jq .
echo ""
echo "---"
echo ""

# Extract normalized_amounts for next step
NORMALIZED_AMOUNTS=$(echo "$STEP2_RESPONSE" | jq -c '.normalized_amounts')

# Test Step 3: Classify Amounts
echo "📍 STEP 3: Classify Amounts"
echo "POST /api/extract/step3"
echo ""
STEP3_RESPONSE=$(curl -s -X POST $BASE_URL/api/extract/step3 \
  -H "Content-Type: application/json" \
  -d "{\"normalized_amounts\": $NORMALIZED_AMOUNTS, \"raw_text\": \"Total: INR 1200 | Paid: 1000 | Due: 200\"}")
echo "$STEP3_RESPONSE" | jq .
echo ""
echo "---"
echo ""

# Extract amounts for next step
AMOUNTS=$(echo "$STEP3_RESPONSE" | jq -c '.amounts')
CURRENCY=$(echo "$STEP1_RESPONSE" | jq -r '.currency_hint')

# Test Step 4: Final Output
echo "📍 STEP 4: Final Output with Provenance"
echo "POST /api/extract/step4"
echo ""
STEP4_RESPONSE=$(curl -s -X POST $BASE_URL/api/extract/step4 \
  -H "Content-Type: application/json" \
  -d "{\"currency_hint\": \"$CURRENCY\", \"amounts\": $AMOUNTS, \"raw_text\": \"Total: INR 1200 | Paid: 1000 | Due: 200\"}")
echo "$STEP4_RESPONSE" | jq .
echo ""
echo "---"
echo ""

# Test Full Pipeline
echo "📍 FULL PIPELINE: All Steps Combined"
echo "POST /api/extract"
echo ""
curl -s -X POST $BASE_URL/api/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "Total: INR 1200 | Paid: 1000 | Due: 200"}' | jq .
echo ""
echo "---"
echo ""

# Test with OCR errors
echo "📍 BONUS: Testing OCR Error Correction"
echo "Step 1 with OCR errors (l200 instead of 1200)"
echo ""
ERROR_STEP1=$(curl -s -X POST $BASE_URL/api/extract/step1 \
  -H "Content-Type: application/json" \
  -d '{"text": "Total: INR l200 | Paid: 1000 | Due: 2OO"}')
echo "$ERROR_STEP1" | jq .
echo ""

ERROR_TOKENS=$(echo "$ERROR_STEP1" | jq -c '.raw_tokens')
echo "Step 2 normalizes to:"
curl -s -X POST $BASE_URL/api/extract/step2 \
  -H "Content-Type: application/json" \
  -d "{\"raw_tokens\": $ERROR_TOKENS}" | jq .
echo ""

echo "✅ All tests completed!"
