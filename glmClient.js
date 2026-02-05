/**
 * GLM-4-Flash API Client
 *
 * This module handles all interactions with the GLM-4-Flash API for AI responses.
 * It processes user messages and determines whether to create invoices/quotations
 * or answer accounting questions.
 */

const axios = require('axios');

/**
 * System prompt that defines the AI assistant's behavior
 */
const SYSTEM_PROMPT = `You are an AI accounting admin assistant with full Xero API integration. You can perform complete CRUD operations:

## Capabilities

### 1. GET (Retrieve Data)
- "Show me all invoices" / "List invoices" / "Get pending invoices"
- "Find customer ABC" / "Show contact details"
- "Display chart of accounts" / "List all accounts"
- "Show products" / "List items in inventory"
- "View payments" / "Get payment history"

### 2. POST (Create Data)
- "Create invoice for [customer]" / "New invoice"
- "Add contact [name]" / "Create customer"
- "Create account [code]" / "New account"
- "Add product [name]" / "New item"
- "Record payment" / "Add payment"

### 3. PUT (Update Data)
- "Update invoice [ID]" / "Modify invoice"
- "Edit contact [name]" / "Update customer"
- "Change account [details]"
- "Update product [name]" / "Modify item"
- "Edit payment"

### 4. DELETE (Remove Data)
- "Delete invoice [ID]" / "Remove invoice"
- "Delete contact [name]" / "Remove customer"
- "Delete account [code]"
- "Delete product [name]" / "Remove item"
- "Delete payment"

### 5. POS Operations
- "Process sale" / "Record payment for invoice"
- "Apply payment to invoice"
- "Handle refund"

## Response Format

For actions requiring API calls, output ONLY a valid JSON object (no markdown, no code blocks):

**GET Operations:**
{
  "action": "get_invoices",
  "filters": { "status": "DRAFT" }
}

**POST (Create) Operations:**
{
  "action": "create_invoice",
  "customer_name": "Customer Name",
  "date": "2026-02-05",
  "due_date": "2026-02-12",
  "line_items": [
    { "description": "Product A", "quantity": 2, "unit_amount": 100, "tax_type": "NONE", "account_code": "200" }
  ],
  "reference": "INV-001",
  "type": "ACCREC",
  "status": "DRAFT"
}

{
  "action": "create_contact",
  "name": "ABC Company",
  "email": "abc@company.com",
  "phone": "0123456789"
}

{
  "action": "create_payment",
  "invoice_id": "invoice-uuid",
  "account_code": "200",
  "amount": 500,
  "reference": "PAY-001"
}

**PUT (Update) Operations:**
{
  "action": "update_invoice",
  "invoice_id": "invoice-uuid",
  "invoice_data": {
    "status": "AUTHORISED",
    "reference": "UPDATED-REF"
  }
}

**DELETE Operations:**
{
  "action": "delete_invoice",
  "invoice_id": "invoice-uuid"
}

## Guidelines
- Be concise, professional but friendly
- Ask for missing required information
- Format currency as "RM X,XXX.XX"
- Format dates as "YYYY-MM-DD"
- Default tax_type: "NONE" (Malaysia)
- Default account_code: "200" (Sales)
- Do NOT wrap JSON in code blocks
- For general questions, respond normally with text
`;

/**
 * Chat with GLM-4-Flash API
 *
 * @param {string} userMessage - The user's message
 * @param {Array} conversationHistory - Previous conversation context
 * @returns {Promise<Object>} - AI response with content and metadata
 */
async function chatWithGLM(userMessage, conversationHistory = []) {
  try {
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
    const response = await axios.post(
      process.env.GLM_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      {
        model: 'glm-4-flash',
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 0.9
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GLM_API_KEY}`
        }
      }
    );

    // Extract AI response
    const aiContent = response.data.choices[0].message.content;
    const usage = response.data.usage || {};

    // Determine if response is JSON (invoice/quotation) or text (general response)
    let parsedJSON = null;
    let isJSON = false;

    // Try to parse as JSON
    try {
      // Clean the content - remove markdown code blocks if present
      const cleanedContent = aiContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      parsedJSON = JSON.parse(cleanedContent);
      isJSON = true;
    } catch (e) {
      // Not JSON, treat as regular text response
      isJSON = false;
    }

    return {
      success: true,
      content: aiContent,
      parsedJSON: parsedJSON,
      isJSON: isJSON,
      usage: usage,
      rawResponse: response.data
    };

  } catch (error) {
    console.error('GLM API Error:', error.response?.data || error.message);

    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
      content: 'Sorry, I encountered an error processing your request. Please try again.'
    };
  }
}

/**
 * Detect if user wants to create an invoice/quotation
 *
 * @param {string} message - User message
 * @returns {boolean} - True if intent is to create document
 */
function detectDocumentCreationIntent(message) {
  const keywords = [
    'create', 'generate', 'new', 'make', 'add', 'draft',
    'invoice', 'quotation', 'quote', 'bill', 'sales'
  ];

  const lowerMessage = message.toLowerCase();
  return keywords.some(keyword => lowerMessage.includes(keyword));
}

module.exports = {
  chatWithGLM,
  detectDocumentCreationIntent
};
