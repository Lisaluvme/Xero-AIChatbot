const axios = require('axios');

/**
 * System prompt for GLM-4-Flash
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

### 4. DELETE (Remove Data)
- "Delete invoice [ID]" / "Remove invoice"
- "Delete contact [name]" / "Remove customer"
- "Delete account [code]"
- "Delete product [name]" / "Remove item"

### 5. POS Operations
- "Process sale" / "Record payment for invoice"
- "Apply payment to invoice"
- "Handle refund"

## Response Format

For actions requiring API calls, output ONLY a valid JSON object (no markdown, no code blocks):

**POST (Create Invoice):**
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

**POST (Create Contact):**
{
  "action": "create_contact",
  "name": "ABC Company",
  "email": "abc@company.com",
  "phone": "0123456789"
}

**GET (List Invoices):**
{
  "action": "get_invoices",
  "filters": { "status": "DRAFT" }
}

**PUT (Update Invoice):**
{
  "action": "update_invoice",
  "invoice_id": "invoice-uuid",
  "invoice_data": {
    "status": "AUTHORISED",
    "reference": "UPDATED-REF"
  }
}

**DELETE (Remove Invoice):**
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
 */
async function chatWithGLM(userMessage, conversationHistory = []) {
  try {
    const apiKey = process.env.GLM_API_KEY;

    if (!apiKey) {
      throw new Error('GLM_API_KEY not found in environment variables');
    }

    // Build messages array
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
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
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
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    // Extract AI response
    const aiContent = response.data.choices[0].message.content;
    const usage = response.data.usage || {};

    // Try to parse as JSON
    let parsedJSON = null;
    let isJSON = false;

    try {
      // Clean the content - remove markdown code blocks
      const cleanedContent = aiContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      parsedJSON = JSON.parse(cleanedContent);
      isJSON = true;
    } catch (e) {
      isJSON = false;
    }

    return {
      success: true,
      content: aiContent,
      parsedJSON: parsedJSON,
      isJSON: isJSON,
      usage: usage
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
 * Netlify Function: Handle chat requests
 */
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { message, conversationHistory = [] } = JSON.parse(event.body);

    if (!message) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    // Call GLM API
    const result = await chatWithGLM(message, conversationHistory);

    if (!result.success) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: result.error,
          message: result.content
        })
      };
    }

    // Return AI response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: result.content,
        isJSON: result.isJSON,
        parsedJSON: result.parsedJSON,
        conversationHistory: [
          ...conversationHistory,
          { role: 'user', content: message },
          { role: 'assistant', content: result.content }
        ]
      })
    };

  } catch (error) {
    console.error('Chat function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
