/**
 * Xero Chatbot Server - MCP Architecture
 *
 * This is the REFACTORED version that uses Xero MCP Server.
 *
 * Architecture:
 * Chat UI → Backend → MCP Client → MCP Server (npx) → Xero API
 *
 * REMOVED:
 * - OAuth redirect_uri logic
 * - /xero/auth endpoint
 * - /xero/callback endpoint
 * - Authorization code handling
 * - Token refresh logic
 * - Direct Xero API calls
 *
 * ADDED:
 * - MCP Server process management
 * - MCP tool calling
 */

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const glmClient = require('./glmClient');
const { XeroMCPClient } = require('./mcpClient');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:8081',
    'https://xerochatbot.netlify.app',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8081'
  ],
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ==========================================
// MCP CLIENT (Global Singleton)
// ==========================================
let mcpClient = null;

/**
 * Initialize MCP Server on startup
 */
async function initializeMCPServer() {
  try {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║        INITIALIZING XERO MCP SERVER                    ║');
    console.log('║     (OAuth 2.0 Client Credentials Grant)              ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📝 Authentication Method: Client Credentials Grant');
    console.log('📝 Token Endpoint: https://identity.xero.com/connect/token');
    console.log('📝 Grant Type: client_credentials');
    console.log('');

    mcpClient = new XeroMCPClient();
    await mcpClient.start();

    // Test connection
    const tools = await mcpClient.listTools();
    console.log(`✅ MCP Server loaded ${tools.length} tools`);

  } catch (error) {
    console.error('❌ Failed to initialize MCP Server:', error);
    console.log('⚠️  Server will start but Xero features will be disabled');
  }
}

// ==========================================
// SESSION STORAGE (For conversation history only)
// ==========================================
const sessions = new Map();

function setSession(sessionId, data) {
  const existing = sessions.get(sessionId) || {};
  sessions.set(sessionId, {
    ...existing,
    ...data,
    updatedAt: Date.now()
  });
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

// ==========================================
// ROUTES
// ==========================================

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Xero Chatbot (MCP)',
    xero_connected: !!mcpClient
  });
});

/**
 * Xero status (simplified - no OAuth)
 */
app.get('/xero/status', async (req, res) => {
  try {
    if (!mcpClient) {
      return res.json({
        connected: false,
        message: 'MCP Server not initialized'
      });
    }

    // Test MCP connection
    const orgDetails = await mcpClient.getOrganisationDetails();

    res.json({
      connected: true,
      authType: 'mcp',
      message: 'Connected via MCP Server',
      organisation: orgDetails
    });

  } catch (error) {
    res.json({
      connected: false,
      error: error.message
    });
  }
});

/**
 * MAIN CHAT ENDPOINT
 *
 * This is the core of the chatbot - handles user messages,
 * integrates with GLM AI, and executes MCP tool calls.
 */
app.post('/chat', async (req, res) => {
  try {
    const { message, session_id = 'default' } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Get or create session
    let session = getSession(session_id);
    if (!session) {
      session = {
        conversationHistory: []
      };
      setSession(session_id, session);
    }

    // Ensure conversationHistory exists
    if (!session.conversationHistory) {
      session.conversationHistory = [];
      setSession(session_id, session);
    }

    // Get AI response from GLM
    const aiResponse = await glmClient.chatWithGLM(
      message,
      session.conversationHistory
    );

    if (!aiResponse.success) {
      return res.json({
        success: false,
        message: aiResponse.content,
        error: aiResponse.error
      });
    }

    // Update conversation history
    session.conversationHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: aiResponse.content }
    );
    if (session.conversationHistory.length > 20) {
      session.conversationHistory = session.conversationHistory.slice(-20);
    }
    setSession(session_id, session);

    // If AI response is JSON (MCP tool call request)
    if (aiResponse.isJSON && aiResponse.parsedJSON) {
      const actionData = aiResponse.parsedJSON;
      const action = actionData.action;

      console.log('🤖 GLM Generated Action:', action);
      console.log('🤖 GLM Generated Data:', JSON.stringify(actionData, null, 2));

      // Check if MCP Server is available
      if (!mcpClient) {
        return res.json({
          success: true,
          type: 'text',
          message: aiResponse.content,
          xero_connected: false,
          xero_error: 'MCP Server not available. Please check server configuration.'
        });
      }

      // Execute the action via MCP
      try {
        let result = null;

        switch (action) {
          case 'list_contacts':
            result = await mcpClient.listContacts();
            break;

          case 'create_contact':
            // Validate required fields
            if (!actionData.name) {
              return res.json({
                success: true,
                type: 'text',
                message: "I'd be happy to create a new contact for you! Please provide:\n\n• Contact name (required)\n• Email address (optional)\n\nFor example: \"Create a contact for John Smith with email john@example.com\"",
                xero_connected: true
              });
            }

            result = await mcpClient.createContact({
              name: actionData.name,
              emailAddress: actionData.email
            });
            break;

          case 'list_invoices':
            result = await mcpClient.listInvoices();
            break;

          case 'list_quotes':
            result = await mcpClient.listQuotes();
            break;

          case 'create_invoice':
            // Validate required fields
            if (!actionData.contact_name) {
              return res.json({
                success: true,
                type: 'text',
                message: "I'd be happy to create an invoice for you! Please provide:\n\n• Customer name\n• Items/services (with description)\n• Quantity and price for each item\n\nFor example: \"Create an invoice for ABC Company for 5 hours of consulting at $100 per hour\"",
                xero_connected: true
              });
            }

            if (!actionData.line_items || actionData.line_items.length === 0) {
              return res.json({
                success: true,
                type: 'text',
                message: `I can create an invoice for ${actionData.contact_name}! However, I need to know what items to include.\n\nPlease provide:\n• Item description\n• Quantity\n• Price per item\n\nFor example: \"Add 2 hours of consulting at $100 each\"`,
                xero_connected: true
              });
            }

            // First, search for contact by name to get ContactID
            let contactId = null;
            if (actionData.contact_name) {
              try {
                console.log('🔍 Searching for contact:', actionData.contact_name);
                const contactsResult = await mcpClient.callTool('list-contacts', {});

                if (contactsResult && contactsResult.content) {
                  // Find matching contact
                  for (const item of contactsResult.content) {
                    if (item.type === 'text' && item.text.includes(actionData.contact_name)) {
                      // Extract ContactID from the text
                      const match = item.text.match(/ID: ([a-f0-9-]+)/);
                      if (match) {
                        contactId = match[1];
                        console.log('✅ Found ContactID:', contactId);
                        break;
                      }
                    }
                  }
                }

                if (!contactId) {
                  return res.json({
                    success: false,
                    error: `Contact "${actionData.contact_name}" not found. Please create the contact first or use an exact contact name.`
                  });
                }
              } catch (error) {
                console.error('Error searching for contact:', error);
              }
            }

            // Transform GLM field names to MCP field names
            const lineItems = (actionData.line_items || actionData.items || []).map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitAmount: item.unit_amount || item.unitAmount,
              accountCode: item.account_code || item.accountCode || '200',
              taxType: item.tax_type || item.taxType || 'NONE'
            }));

            const invoiceData = {
              type: actionData.type || 'ACCREC',
              contactId: contactId, // Use ContactID instead of name
              lineItems: lineItems,
              status: actionData.status || 'DRAFT',
              date: actionData.date,
              dueDate: actionData.due_date,
              reference: actionData.reference
            };

            console.log('🔧 Creating invoice with data:', JSON.stringify(invoiceData, null, 2));
            result = await mcpClient.createInvoice(invoiceData);
            break;

          case 'create_quote':
            // Validate required fields
            if (!actionData.contact_name) {
              return res.json({
                success: true,
                type: 'text',
                message: "I'd be happy to help you create a quotation! Please provide:\n\n1. **Customer name** - Which customer is this quotation for?\n2. **Items** - What products or services would you like to include?\n3. **Quantity** - How many of each item?\n4. **Price** - What's the price per item?\n\nFor example: \"Create a quotation for ABC Company for 5 hours of consulting at $100 per hour\"",
                xero_connected: true
              });
            }

            if (!actionData.line_items || actionData.line_items.length === 0) {
              return res.json({
                success: true,
                type: 'text',
                message: `I can create a quotation for ${actionData.contact_name}! However, I need to know what items to include.\n\nPlease provide:\n• Item description\n• Quantity\n• Price per item\n\nFor example: \"Add 3 website design services at $500 each\"`,
                xero_connected: true
              });
            }

            // First, search for contact by name to get ContactID
            let quoteContactId = null;
            if (actionData.contact_name) {
              try {
                console.log('🔍 Searching for contact for quote:', actionData.contact_name);
                const contactsResult = await mcpClient.callTool('list-contacts', {});

                if (contactsResult && contactsResult.content) {
                  // Find matching contact
                  for (const item of contactsResult.content) {
                    if (item.type === 'text' && item.text.includes(actionData.contact_name)) {
                      // Extract ContactID from the text
                      const match = item.text.match(/ID: ([a-f0-9-]+)/);
                      if (match) {
                        quoteContactId = match[1];
                        console.log('✅ Found ContactID for quote:', quoteContactId);
                        break;
                      }
                    }
                  }
                }

                if (!quoteContactId) {
                  return res.json({
                    success: false,
                    error: `Contact "${actionData.contact_name}" not found. Please create the contact first or use an exact contact name.`
                  });
                }
              } catch (error) {
                console.error('Error searching for contact:', error);
              }
            }

            // Transform GLM field names to MCP field names
            const quoteLineItems = (actionData.line_items || actionData.items || []).map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitAmount: item.unit_amount || item.unitAmount,
              accountCode: item.account_code || item.accountCode || '200',
              taxType: item.tax_type || item.taxType || 'NONE'
            }));

            const quoteData = {
              type: 'ACCREC',
              contactId: quoteContactId,
              lineItems: quoteLineItems,
              status: actionData.status || 'DRAFT',
              date: actionData.date,
              dueDate: actionData.due_date,
              reference: actionData.reference
            };

            console.log('🔧 Creating quote with data:', JSON.stringify(quoteData, null, 2));
            result = await mcpClient.createQuote(quoteData);
            break;

          case 'get_invoices':
            result = await mcpClient.listInvoices();
            break;

          default:
            return res.json({
              success: false,
              error: `Unknown action: ${action}`
            });
        }

        // For list-type actions, analyze the data with GLM and provide smart answer
        const listActions = ['list_invoices', 'list_contacts', 'list_quotes', 'list_accounts', 'get_invoices'];

        if (listActions.includes(action)) {
          console.log('📊 Analyzing data with GLM for smart answer...');

          try {
            // Extract the content from the result
            let dataText = '';
            if (result && result.content) {
              for (const item of result.content) {
                if (item.type === 'text') {
                  dataText += item.text + '\n';
                }
              }
            }

            // Send the data back to GLM for analysis
            const analysisPrompt = `You are an accounting assistant. The user asked: "${message}"

Here is the data from Xero:
${dataText}

Please analyze this data and provide a helpful, conversational answer to the user's question.
Be specific with numbers and totals. If they asked about sales totals, calculate the total.
If they asked about counts, provide the count.
Keep your answer concise but informative.`;

            const analysisResponse = await glmClient.chatWithGLM(analysisPrompt, []);

            if (analysisResponse.success) {
              return res.json({
                success: true,
                type: 'xero_analysis',
                action: action,
                raw_data: result,
                analysis: analysisResponse.content,
                message: analysisResponse.content,
                xero_connected: true
              });
            } else {
              // Fallback to raw data if analysis fails
              return res.json({
                success: true,
                type: 'xero_action',
                action: action,
                result: result,
                message: `✅ Successfully executed: ${action}`,
                xero_connected: true
              });
            }
          } catch (analysisError) {
            console.error('Analysis error:', analysisError);
            // Fallback to raw data
            return res.json({
              success: true,
              type: 'xero_action',
              action: action,
              result: result,
              message: `✅ Successfully executed: ${action}`,
              xero_connected: true
            });
          }
        }

        // For create/update actions, return the result directly
        return res.json({
          success: true,
          type: 'xero_action',
          action: action,
          result: result,
          message: `✅ Successfully executed: ${action}`,
          xero_connected: true
        });

      } catch (xeroError) {
        console.error('Xero/MCP error:', xeroError);
        return res.json({
          success: false,
          error: `Xero operation failed: ${xeroError.message}`,
          xero_connected: true
        });
      }
    }

    // Regular text response
    return res.json({
      success: true,
      type: 'text',
      message: aiResponse.content,
      xero_connected: !!mcpClient
    });

  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get chat history
 */
app.get('/chat/history', (req, res) => {
  try {
    const sessionId = req.query.session_id || 'default';
    const session = getSession(sessionId);

    res.json({
      success: true,
      history: session?.conversationHistory || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Clear chat history
 */
app.delete('/chat/history', (req, res) => {
  try {
    const sessionId = req.body.session_id || 'default';

    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      session.conversationHistory = [];
      setSession(sessionId, session);
    }

    res.json({
      success: true,
      message: 'Chat history cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * List available MCP tools (for debugging)
 */
app.get('/xero/tools', async (req, res) => {
  try {
    if (!mcpClient) {
      return res.status(503).json({
        error: 'MCP Server not initialized'
      });
    }

    const tools = await mcpClient.listTools();
    res.json({
      success: true,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// STARTUP
// ==========================================

async function startServer() {
  // Initialize MCP Server first
  await initializeMCPServer();

  // Check if running in production (Render) or local development
  const isProduction = process.env.RENDER || process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Production: Use HTTP (Render provides HTTPS automatically)
    app.listen(PORT, () => {
      console.log('');
      console.log('╔═══════════════════════════════════════════════════════╗');
      console.log('║     Xero Chatbot Server Started (Production Mode)        ║');
      console.log('╚═══════════════════════════════════════════════════════╝');
      console.log('🚀 Server running on port:', PORT);
      console.log('📚 API Health: /health');
      console.log('💬 Chat Endpoint: POST /chat');
      console.log('🔧 MCP Tools: /xero/tools');
      console.log('');
      console.log('✅ Production Mode - HTTP Server (Render provides HTTPS)');
      console.log('╚═══════════════════════════════════════════════════════╝');
      console.log('');
    });
  } else {
    // Local Development: Use HTTPS with self-signed certificates
    const options = {
      key: fs.readFileSync('./key.pem'),
      cert: fs.readFileSync('./cert.pem')
    };

    https.createServer(options, app).listen(PORT, () => {
      console.log('');
      console.log('╔═══════════════════════════════════════════════════════╗');
      console.log('║     Xero Chatbot Server Started (Local Development)      ║');
      console.log('╚═══════════════════════════════════════════════════════╝');
      console.log('🚀 Server running on: https://localhost:' + PORT);
      console.log('📚 API Health: https://localhost:' + PORT + '/health');
      console.log('💬 Chat Endpoint: POST https://localhost:' + PORT + '/chat');
      console.log('🔧 MCP Tools: https://localhost:' + PORT + '/xero/tools');
      console.log('');
      console.log('📖 Test the chatbot with:');
      console.log('   curl -k -X POST https://localhost:' + PORT + '/chat \\');
      console.log('   -H "Content-Type: application/json" \\');
      console.log('   -d \'{"message": "List all contacts"}\'');
      console.log('');
      console.log('✅ Local Mode - HTTPS with self-signed certificates');
      console.log('╚═══════════════════════════════════════════════════════╝');
      console.log('');
    });
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (mcpClient) {
    await mcpClient.stop();
  }
  process.exit(0);
});

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
