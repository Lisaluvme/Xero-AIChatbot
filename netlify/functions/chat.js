const axios = require('axios');

// Helper function to call Groq API
async function callGroqAPI(message, conversationHistory = []) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      throw new Error('GROQ_API_KEY not found in environment variables');
    }

    const messages = [
      {
        role: 'system',
        content: `You are an intelligent Xero accounting assistant. You can:

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

CONVERSATION EXAMPLES:
User: "hi"
AI: "Hello! I'm your Xero accounting assistant. How can I help you today?"

User: "What's the difference between a quote and an invoice?"
AI: "A quote (or quotation) is a document you send to a customer before providing goods or services - it's an offer that can be accepted or rejected. An invoice is a request for payment sent after the goods or services have been provided. Quotes can be converted to invoices once accepted."

Remember: Be conversational and helpful unless the user explicitly requests a Xero operation.`
      },
      ...conversationHistory,
      {
        role: 'user',
        content: message
      }
    ];

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        messages: messages,
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiMessage = response.data.choices[0].message.content;
    
    // Check if response is JSON
    let isJSON = false;
    let parsedJSON = null;
    try {
      if (aiMessage.trim().startsWith('{')) {
        parsedJSON = JSON.parse(aiMessage);
        isJSON = true;
      }
    } catch (e) {
      // Not JSON
    }

    return {
      success: true,
      content: aiMessage,
      isJSON: isJSON,
      parsedJSON: parsedJSON
    };
  } catch (error) {
    console.error('Groq API error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
      content: 'I apologize, but I\'m having trouble connecting to my AI service. Please try again.'
    };
  }
}

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { message, conversationHistory } = JSON.parse(event.body);

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    // Get AI response
    const aiResponse = await callGroqAPI(message, conversationHistory || []);

    // Update conversation history
    const newHistory = [
      ...(conversationHistory || []),
      { role: 'user', content: message },
      { role: 'assistant', content: aiResponse.content }
    ].slice(-20); // Keep last 20 messages

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: aiResponse.success,
        message: aiResponse.content,
        conversationHistory: newHistory,
        isJSON: aiResponse.isJSON,
        parsedJSON: aiResponse.parsedJSON
      })
    };

  } catch (error) {
    console.error('Chat error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
