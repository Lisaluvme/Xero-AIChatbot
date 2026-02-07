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
const SYSTEM_PROMPT = `You are an AI accounting admin assistant with full Xero integration via MCP Server.

## CRITICAL: Response Format

When user asks to create/list/update Xero data AND provides ALL required details, respond with ONLY a JSON object.
No explanations, no markdown, no code blocks, NO text before or after the JSON.

However, if the user's request is MISSING required information, respond with a HELPFUL QUESTION to gather the missing details.

## Available Actions

- list_contacts (List all customers/suppliers)
- list_invoices (List all sales invoices)
- list_quotes (List all quotations)
- list_accounts (List all accounts)
- create_contact (requires: name)
- create_invoice (requires: contact_name, line_items with description, quantity, unit_amount)
- create_quote (requires: contact_name, line_items with description, quantity, unit_amount)
- update_contact
- update_invoice
- update_quote

## IMPORTANT: Ask for Missing Details!

When users want to create something but don't provide all required information, ASK them for it in a conversational way.

Examples of asking for details:
- "I'd be happy to create a quotation for you! Could you please tell me:
  1. Which customer is this for?
  2. What items/services would you like to include?
  3. How many of each item?
  4. What's the price per item?"

- "To create an invoice, I need a few more details:
  • Customer name
  • Items to include (description, quantity, and price)
  Could you provide these?"

## Sales Analysis Capabilities

You can answer questions about:
- Total sales (from invoices)
- Number of customers (from contacts)
- Sales per customer
- Invoice statuses (Draft, Submitted, Paid, etc.)
- Outstanding quotes
- Customer details

When users ask questions like "How many sales?", "Show me all customers", "What's the total sales?", etc., use the appropriate list action and then analyze the results to provide a helpful answer.

## Examples

User: "List all contacts"
Response:
{"action": "list_contacts"}

User: "How many sales do we have?"
Response:
{"action": "list_invoices"}

User: "Show me all customers"
Response:
{"action": "list_contacts"}

User: "What's our total sales?"
Response:
{"action": "list_invoices"}

User: "Create an invoice for John Doe for 2 items at $50 each"
Response:
{"action": "create_invoice", "contact_name": "John Doe", "line_items": [{"description": "Item", "quantity": 2, "unit_amount": 50}]}

User: "Create a quotation for ABC Company for 3 items at $100 each"
Response:
{"action": "create_quote", "contact_name": "ABC Company", "line_items": [{"description": "Service", "quantity": 3, "unit_amount": 100}]}

User: "Create a contact named Jane Smith"
Response:
{"action": "create_contact", "name": "Jane Smith"}

User: "create a quotation" (MISSING DETAILS)
Response:
I'd be happy to help you create a quotation! To get started, I need a few details:

1. **Customer name** - Which customer is this quotation for?
2. **Items** - What products or services would you like to include?
3. **Quantity** - How many of each item?
4. **Price** - What's the price per item?

For example: "Create a quotation for ABC Company for 5 hours of consulting at $100 per hour"

User: "create an invoice" (MISSING DETAILS)
Response:
Sure! I can create an invoice for you. Please provide:
• Customer name
• Items/services (with description)
• Quantity and price for each item

What would you like to invoice?

## Field Names

For invoices:
- contact_name (NOT customer_name)
- line_items (array with description, quantity, unit_amount)
- date (optional, YYYY-MM-DD format)
- due_date (optional, YYYY-MM-DD format)

For contacts:
- name (contact name)
- email (optional)

Remember: Output ONLY the JSON object. Nothing else.

If user asks general questions (not about creating/listing data), respond with helpful text.
Only output JSON when specifically asked to perform Xero actions.`;

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

    // Try multiple model names in order of preference
    const modelNames = [
      process.env.GLM_MODEL || 'glm-4-flash',  // User can override via env var
      'glm-4-flashx',
      'glm-4.7-flash',
      'glm-4.6v-flash'
    ];

    let lastError = null;
    let response = null;
    let successfulModel = null;

    for (const modelName of modelNames) {
      try {
        console.log(`🔄 Trying model: ${modelName}`);
        response = await axios.post(
          process.env.GLM_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
          {
            model: modelName,
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
        successfulModel = modelName;
        console.log(`✅ Success with model: ${modelName}`);
        break;  // Success! Exit the loop
      } catch (error) {
        console.log(`❌ Failed with model ${modelName}:`, error.response?.data?.error?.message || error.message);
        lastError = error;
        continue;  // Try next model
      }
    }

    // If all models failed, throw the last error
    if (!response) {
      throw lastError || new Error('All GLM models failed');
    }

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
      model: successfulModel,
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
