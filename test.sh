#!/bin/bash

# ==========================================
# Xero Chatbot Test Script
# ==========================================
# This script provides easy testing of the chatbot endpoints

BASE_URL="http://localhost:3000"
SESSION_ID="test_user_$(date +%s)"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔═══════════════════════════════════════════════════════╗"
echo "║           Xero Chatbot Test Script                    ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "Session ID: ${SESSION_ID}"
echo "Base URL: ${BASE_URL}"
echo ""

# ==========================================
# TEST 1: Health Check
# ==========================================
echo -e "${BLUE}TEST 1: Health Check${NC}"
echo "Testing: GET /health"
curl -s "${BASE_URL}/health" | jq '.'
echo ""
echo ""

# ==========================================
# Test 2: Check Xero Status
# ==========================================
echo -e "${BLUE}TEST 2: Check Xero Connection Status${NC}"
echo "Testing: GET /xero/status"
curl -s "${BASE_URL}/xero/status?session_id=${SESSION_ID}" | jq '.'
echo ""
echo ""

# ==========================================
# Test 3: Chat - General Question
# ==========================================
echo -e "${BLUE}TEST 3: Chat - General Question${NC}"
echo "Testing: POST /chat"
echo "Message: \"Hello! What can you help me with?\""
echo ""
curl -s -X POST "${BASE_URL}/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"Hello! What can you help me with?\",
    \"session_id\": \"${SESSION_ID}\"
  }" | jq '.'
echo ""
echo ""

# ==========================================
# Test 4: Chat - Create Invoice (with all details)
# ==========================================
echo -e "${BLUE}TEST 4: Chat - Create Invoice (Complete)${NC}"
echo "Testing: POST /chat"
echo "Message: \"Create an invoice for ABC Company, 2 items: Web Design RM2000, Hosting RM500, date 2026-01-29\""
echo ""
curl -s -X POST "${BASE_URL}/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"Create an invoice for ABC Company, 2 items: Web Design RM2000, Hosting RM500, date 2026-01-29\",
    \"session_id\": \"${SESSION_ID}\"
  }" | jq '.'
echo ""
echo ""

# ==========================================
# Test 5: Chat - Missing Information
# ==========================================
echo -e "${BLUE}TEST 5: Chat - Missing Information${NC}"
echo "Testing: POST /chat"
echo "Message: \"Create an invoice\""
echo ""
curl -s -X POST "${BASE_URL}/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"Create an invoice\",
    \"session_id\": \"${SESSION_ID}\"
  }" | jq '.'
echo ""
echo ""

# ==========================================
# Test 6: Chat - Accounting Calculation
# ==========================================
echo -e "${BLUE}TEST 6: Chat - Accounting Calculation${NC}"
echo "Testing: POST /chat"
echo "Message: \"Calculate total for 10 items at RM50 each with 10% discount\""
echo ""
curl -s -X POST "${BASE_URL}/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"Calculate total for 10 items at RM50 each with 10% discount\",
    \"session_id\": \"${SESSION_ID}\"
  }" | jq '.'
echo ""
echo ""

# ==========================================
# Test 7: Get Chat History
# ==========================================
echo -e "${BLUE}TEST 7: Get Chat History${NC}"
echo "Testing: GET /chat/history"
curl -s "${BASE_URL}/chat/history?session_id=${SESSION_ID}" | jq '.'
echo ""
echo ""

# ==========================================
# XERO AUTHENTICATION INSTRUCTIONS
# ==========================================
echo -e "${YELLOW}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║         XERO AUTHENTICATION INSTRUCTIONS             ║${NC}"
echo -e "${YELLOW}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "To connect Xero (required for invoice creation):"
echo ""
echo "1. Get authorization URL:"
echo -e "${GREEN}curl \"${BASE_URL}/xero/auth?session_id=${SESSION_ID}\"${NC}"
echo ""
echo "2. Visit the returned URL in your browser"
echo "3. Authorize the Xero app"
echo "4. You'll be redirected back with success message"
echo ""
echo "5. Test invoice creation again with:"
echo -e "${GREEN}curl -X POST \"${BASE_URL}/chat\" \\${NC}"
echo -e "${GREEN}  -H \"Content-Type: application/json\" \\${NC}"
echo -e "${GREEN}  -d '{\"message\": \"Create an invoice for ABC Company, 2 items: Web Design RM2000, Hosting RM500\", \"session_id\": \"${SESSION_ID}\"}'${NC}"
echo ""
echo ""
echo -e "${GREEN}All tests completed!${NC}"
echo ""
