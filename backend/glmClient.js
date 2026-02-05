/**
 * GLM-4-Flash Client for Xero Accounting
 *
 * This module handles all interactions with Zhipu AI's GLM-4 model.
 * It processes user messages and determines whether to:
 * 1. Create invoices/quotations (returns structured JSON)
 * 2. Answer accounting questions (returns text response)
 *
 * API Documentation: https://open.bigmodel.cn/dev/api
 */

/**
 * Request Queue for GLM API
 *
 * Prevents concurrency limit errors by ensuring only one request
 * is sent to GLM API at a time.
 */
class GLMRequestQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  async add(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { requestFn, resolve, reject } = this.queue.shift();

    try {
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.isProcessing = false;
      // Small delay between requests to avoid rate limits
      setTimeout(() => this.process(), 500);
    }
  }
}

const glmQueue = new GLMRequestQueue();

/**
 * System Prompt for GLM-4-Flash - Xero JSON-Only Mode
 *
 * Strict JSON output mode for Xero document creation.
 * AI extracts structured data, backend handles validation and calculations.
 */
const SYSTEM_PROMPT = `You are an intelligent Xero accounting assistant. You can:

1. Answer accounting questions conversationally
2. Create invoices, quotations, and other Xero documents
3. Retrieve, update, and delete Xero data (contacts, invoices, accounts, etc.)
4. Perform calculations and provide accounting advice

RESPONSE FORMAT:
- For questions: Respond in plain text, be helpful and conversational
- For creating documents: Output ONLY valid JSON (no markdown, no code blocks)
- For data retrieval: Output JSON with the requested data structure

WHEN TO OUTPUT JSON:
Only output JSON when the user explicitly asks to:
- Create invoice/quotation
- Add contact/customer
- Update existing record
- Delete record
- Retrieve specific data

JSON SCHEMA - CREATE QUOTATION:
When user provides complete quotation data, output:
{
  "action": "create_quotation",
  "type": "ACCREC",
  "contact_name": "Customer Name Sdn Bhd",
  "date": "2026-01-30",
  "expiry_date": "2026-02-28",
  "line_items": [
    {
      "description": "Service or product description",
      "quantity": 1,
      "unit_amount": 1000,
      "tax_type": "NONE",
      "account_code": "200"
    }
  ],
  "currency_code": "MYR",
  "reference": "Optional reference number"
}

JSON SCHEMA - INVOICE:
When user provides complete invoice data, output:
{
  "action": "create_invoice",
  "type": "ACCREC",
  "contact_name": "Customer Name Sdn Bhd",
  "date": "2026-01-30",
  "due_date": "2026-02-28",
  "line_items": [
    {
      "description": "Service or product description",
      "quantity": 1,
      "unit_amount": 1000,
      "tax_type": "NONE",
      "account_code": "200"
    }
  ],
  "currency_code": "MYR",
  "reference": "Optional reference number"
}

MISSING DATA RESPONSE:
If required information is missing, output:
{
  "action": "request_info",
  "document_type": "quotation or invoice",
  "missing_fields": [
    "contact_name",
    "date",
    "line_items[0].description",
    "line_items[0].quantity"
  ],
  "message": "Please provide the following information to create the quotation"
}

REQUIRED FIELDS:
- contact_name (string)
- date (YYYY-MM-DD)
- line_items array with at least 1 item containing:
  - description (string)
  - quantity (number)
  - unit_amount (number)

OPTIONAL FIELDS:
- expiry_date (for quotations) or due_date (for invoices)
- line_items[].tax_type (default: "NONE")
- line_items[].account_code (default: "200")
- reference (string)
- currency_code (default: "MYR")

TAX TYPES (Malaysia):
- NONE (no tax)
- SST 6% (Sales and Service Tax)
- SST 10% (specific services)

DEFAULT VALUES:
- currency_code: "MYR"
- tax_type: "NONE"
- account_code: "200"
- quotation status: "DRAFT"
- invoice status: "AUTHORISED"
- type: "ACCREC"

CONVERSATION EXAMPLES:
User: "hi"
AI: "Hello! I'm your Xero accounting assistant. How can I help you today?"

User: "What's the difference between a quote and an invoice?"
AI: "A quote (or quotation) is a document you send to a customer before providing goods or services - it's an offer that can be accepted or rejected. An invoice is a request for payment sent after the goods or services have been provided. Quotes can be converted to invoices once accepted."

User: "Create an invoice for ABC Corp for RM1000"
AI: {JSON output for create_invoice}

Remember: Be conversational and helpful unless the user explicitly requests a Xero operation.
`;

/**
 * Generate JWT token for GLM API authentication
 * GLM API requires JWT token signed with API secret
 */
function generateJWT(apiKey) {
  const [id, secret] = apiKey.split('.');

  if (!id || !secret) {
    throw new Error('Invalid API key format');
  }

  const header = {
    alg: 'HS256',
    sign_type: 'SIGN'
  };

  const now = Date.now();
  const payload = {
    api_key: id,
    exp: now + 3600 * 1000, // 1 hour expiration
    timestamp: now
  };

  const crypto = require('crypto');

  function base64UrlEncode(str) {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${data}.${signature}`;
}

/**
 * Chat with GLM-4-Flash API
 *
 * @param {string} userMessage - The user's message
 * @param {Array} conversationHistory - Previous conversation for context
 * @returns {Promise<Object>} - AI response with content and metadata
 */
async function chatWithGLM(userMessage, conversationHistory = []) {
  // Use request queue to prevent concurrency limit errors
  return glmQueue.add(async () => {
    try {
      const apiKey = process.env.GLM_API_KEY || process.env.GROQ_API_KEY;

      if (!apiKey) {
        throw new Error('GLM_API_KEY not found in environment variables');
      }

      // Generate JWT token
      const token = generateJWT(apiKey);

      // Build messages array with system prompt and conversation history
      const messages = [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        ...conversationHistory,
        {
          role: 'user',
          content: userMessage
        }
      ];

      // Make API request to GLM-4-Flash
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          model: 'glm-4.7-flash',
          messages: messages,
          temperature: 0.7,
          max_tokens: 2000,
          top_p: 0.9
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Extract AI response content
      const aiContent = data.choices[0].message.content;
      const usage = data.usage || {};

      // Try to parse response as JSON (for invoice/quotation creation)
      let parsedJSON = null;
      let isJSON = false;

      try {
        // Clean the content - remove markdown code blocks if AI added them
        const cleanedContent = aiContent
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        // Try to parse as JSON
        parsedJSON = JSON.parse(cleanedContent);

        // Verify it's a valid response object (create_quotation, create_invoice, or request_info)
        if (parsedJSON && (
          parsedJSON.action === 'create_invoice' ||
          parsedJSON.action === 'create_quotation' ||
          parsedJSON.action === 'request_info'
        )) {
          isJSON = true;
        }
      } catch (parseError) {
        // Not valid JSON, treat as regular text response
        isJSON = false;
      }

      return {
        success: true,
        content: aiContent,
        parsedJSON: parsedJSON,
        isJSON: isJSON,
        usage: usage,
        model: 'glm-4.7-flash'
      };

    } catch (error) {
      // Handle API errors
      console.error('GLM API Error:', error.message);

      return {
        success: false,
        error: error.message,
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        isJSON: false
      };
    }
  });
}

/**
 * Detect if user wants to create a document
 *
 * This is a helper function to identify user intent early.
 *
 * @param {string} message - User message
 * @returns {boolean} - True if intent appears to be document creation
 */
function detectDocumentCreationIntent(message) {
  const keywords = [
    'create', 'generate', 'new', 'make', 'add', 'draft', 'prepare',
    'invoice', 'quotation', 'quote', 'bill', 'sales',
    'purchase order', 'po', 'delivery order', 'do'
  ];

  const lowerMessage = message.toLowerCase();
  return keywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Format currency for display
 *
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string (e.g., "RM 1,234.56")
 */
function formatCurrency(amount) {
  return `RM ${parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
}

module.exports = {
  chatWithGLM,
  detectDocumentCreationIntent,
  formatCurrency
};
