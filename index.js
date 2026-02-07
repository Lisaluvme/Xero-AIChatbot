/**
 * Xero Chatbot - Main Express Server
 *
 * This is the main server file that handles:
 * - Chat endpoint for AI conversations
 * - Xero OAuth2 callback handling
 * - Token management and refresh
 * - Integration between GLM-4-Flash AI and Xero API
 */

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const glmClient = require('./glmClient');
const xeroClient = require('./xeroClient');
const xeroFull = require('./xeroClientFull');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Allow requests from Netlify frontend
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
// SESSION STORAGE (In-memory for demo)
// In production, use Redis or database
// ==========================================
const sessions = new Map();

/**
 * Store session data
 */
function setSession(sessionId, data) {
  const existing = sessions.get(sessionId) || {};
  sessions.set(sessionId, {
    ...existing,
    ...data,
    updatedAt: Date.now()
  });
}

/**
 * Get session data
 */
function getSession(sessionId) {
  return sessions.get(sessionId);
}

/**
 * Find session by OAuth state
 */
function getSessionByOAuthState(state) {
  for (const [sessionId, data] of sessions.entries()) {
    if (data.oauthState === state) {
      return { sessionId, data };
    }
  }
  return null;
}

/**
 * Check if access token needs refresh
 */
function needsRefresh(expiresAt) {
  if (!expiresAt) return true;
  // Refresh 5 minutes before expiration
  return Date.now() > (expiresAt - 300000);
}

/**
 * Refresh access token with proper error handling and logging
 */
async function ensureValidToken(sessionId) {
  const session = getSession(sessionId);
  if (!session || !session.connected) {
    return { success: false, error: 'Not connected to Xero' };
  }

  // Check if token needs refresh
  if (!needsRefresh(session.expiresAt)) {
    console.log('✅ Token is still valid, expires at:', new Date(session.expiresAt).toISOString());
    return { success: true, session };
  }

  console.log('🔄 Token needs refresh...');
  console.log('📊 Token expired at:', new Date(session.expiresAt).toISOString());
  console.log('📊 Current time:', new Date().toISOString());

  try {
    // Handle M2M token refresh
    if (session.authType === 'm2m') {
      console.log('🔄 Using M2M token refresh...');
      const m2mResult = await xeroClient.getM2MToken();

      if (!m2mResult.success) {
        console.error('❌ M2M token refresh failed:', m2mResult.error);
        return { success: false, error: 'M2M token refresh failed', details: m2mResult.error };
      }

      // Get tenants for the new token
      const tenantsResult = await xeroClient.getTenants(m2mResult.tokens.accessToken);
      if (!tenantsResult.success || tenantsResult.tenants.length === 0) {
        return { success: false, error: 'Failed to get tenants after M2M refresh' };
      }

      console.log('✅ M2M token refreshed successfully');
      console.log('📊 New token expires at:', new Date(m2mResult.tokens.expiresAt).toISOString());

      setSession(sessionId, {
        accessToken: m2mResult.tokens.accessToken,
        tenantId: tenantsResult.tenants[0].tenantId,
        tenantName: tenantsResult.tenants[0].tenantName,
        expiresAt: m2mResult.tokens.expiresAt,
        authType: 'm2m'
      });

      return { success: true, session: getSession(sessionId) };
    }

    // Handle OAuth token refresh (with refresh token)
    if (!session.refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    const refreshResult = await xeroClient.refreshAccessToken(session.refreshToken);

    if (!refreshResult.success) {
      console.error('❌ Token refresh failed:', refreshResult.error);
      return { success: false, error: 'Token refresh failed', details: refreshResult.error };
    }

    console.log('✅ Token refreshed successfully');
    console.log('📊 New token expires at:', new Date(refreshResult.tokens.expiresAt).toISOString());

    // Update session while preserving ALL existing data
    setSession(sessionId, {
      accessToken: refreshResult.tokens.accessToken,
      refreshToken: refreshResult.tokens.refreshToken || session.refreshToken,
      expiresAt: refreshResult.tokens.expiresAt
    });

    return { success: true, session: getSession(sessionId) };
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// ROUTES
// ==========================================

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Xero Chatbot'
  });
});

/**
 * Root endpoint - API information
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Xero Chatbot API',
    version: '1.0.0',
    endpoints: {
      chat: 'POST /chat',
      xeroAuth: 'GET /xero/auth',
      xeroCallback: 'GET /xero/callback',
      xeroDisconnect: 'POST /xero/disconnect'
    },
    documentation: 'See README.md for usage examples'
  });
});

/**
 * Initiate Xero OAuth2 authentication
 *
 * Returns authorization URL for user to visit
 */
app.get('/xero/auth', async (req, res) => {
  try {
    const { url, state } = xeroClient.getAuthorizationUrl();

    // Store state in session for verification during callback
    const sessionId = req.query.session_id || 'default';
    setSession(sessionId, { oauthState: state });

    res.json({
      success: true,
      authorization_url: url,
      message: 'Visit the authorization URL to connect your Xero account'
    });

  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Xero OAuth2 callback handler
 *
 * Receives authorization code and exchanges for tokens
 */
app.get('/xero/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    console.log('🔑 Received OAuth callback, exchanging code for tokens...');

    // Exchange code for access token
    const tokenResult = await xeroClient.exchangeCodeForToken(code);

    if (!tokenResult.success) {
      console.error('❌ Token exchange failed:', tokenResult.error);
      return res.status(400).json({
        success: false,
        error: tokenResult.error
      });
    }

    console.log('✅ Token received successfully');
    console.log('📊 Token expires at:', new Date(tokenResult.tokens.expiresAt).toISOString());
    console.log('🔑 Getting tenants (organizations)...');

    // Get tenants (organizations)
    const tenantsResult = await xeroClient.getTenants(tokenResult.tokens.accessToken);

    if (!tenantsResult.success) {
      console.error('❌ Get tenants failed:', tenantsResult.error);
      return res.status(400).json({
        success: false,
        error: tenantsResult.error
      });
    }

    console.log(`✅ Found ${tenantsResult.tenants.length} tenants:`);
    tenantsResult.tenants.forEach((tenant, index) => {
      console.log(`   ${index + 1}. ${tenant.tenantName} (${tenant.tenantId})`);
    });

    // Get session ID from state (which was set during auth initiation)
    const sessionData = getSessionByOAuthState(state);
    const sessionId = sessionData?.sessionId || 'default';

    // Select Mega Genset Malaysia Sdn Bhd tenant (exclude Demo Company)
    const selectedTenant = tenantsResult.tenants.find(tenant =>
      tenant.tenantId === '28ceb5ab-5dc9-45bf-88a2-0564bd8fa561' ||
      tenant.tenantName === 'Mega Genset Malaysia Sdn Bhd'
    ) || tenantsResult.tenants[0]; // Fallback to first if not found

    console.log(`💾 Storing session for: ${sessionId}`);
    console.log(`📊 Selected tenant: ${selectedTenant.tenantName} (${selectedTenant.tenantId})`);

    // Store session data while preserving existing data (like oauthState)
    setSession(sessionId, {
      accessToken: tokenResult.tokens.accessToken,
      refreshToken: tokenResult.tokens.refreshToken,
      expiresAt: tokenResult.tokens.expiresAt,
      tenantId: selectedTenant.tenantId,
      tenantName: selectedTenant.tenantName,
      tenants: tenantsResult.tenants, // Store all tenants for future use
      connected: true
    });

    // Send HTML response (user-friendly)
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Xero Connected</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            text-align: center;
            padding: 20px;
          }
          .success {
            color: #2E7D32;
            font-size: 24px;
            margin-bottom: 20px;
          }
          .info {
            background: #E8F5E9;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="success">✅ Xero Account Connected Successfully!</div>
        <div class="info">
          <p><strong>Tenant:</strong> ${selectedTenant.tenantName}</p>
          <p><strong>Tenant ID:</strong> <code>${selectedTenant.tenantId}</code></p>
          <p>You can now use the chatbot to create invoices and quotations.</p>
        </div>
        <p>You can close this window and return to your application.</p>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('❌ Callback error:', error);
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

/**
 * Disconnect Xero account
 */
app.post('/xero/disconnect', (req, res) => {
  try {
    const sessionId = req.body.session_id || 'default';

    if (sessions.has(sessionId)) {
      sessions.delete(sessionId);
    }

    res.json({
      success: true,
      message: 'Xero account disconnected successfully'
    });

  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Check Xero connection status
 */
app.get('/xero/status', (req, res) => {
  try {
    const sessionId = req.query.session_id || 'default';
    const session = getSession(sessionId);

    if (!session || !session.connected) {
      return res.json({
        connected: false,
        message: 'Xero account not connected. Please authenticate first.'
      });
    }

    res.json({
      connected: true,
      tenantName: session.tenantName,
      tenantId: session.tenantId
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * MAIN CHAT ENDPOINT
 *
 * Handles user messages, integrates with GLM-4-Flash AI,
 * and creates invoices/quotations in Xero when requested
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
        conversationHistory: [],
        connected: false
      };

      // Auto-connect with M2M if configured
      if (process.env.XERO_AUTH_TYPE === 'm2m') {
        console.log('🔑 M2M authentication configured - auto-connecting...');
        try {
          const m2mResult = await xeroClient.getM2MToken();
          console.log('📊 M2M Result success:', m2mResult.success);
          console.log('📊 M2M Result has tokens:', !!m2mResult.tokens);
          if (m2mResult.tokens) {
            console.log('📊 Access token exists:', !!m2mResult.tokens.accessToken);
            console.log('📊 Access token (first 20 chars):', m2mResult.tokens.accessToken?.substring(0, 20) + '...');
          }

          if (m2mResult.success && m2mResult.tokens && m2mResult.tokens.accessToken) {
            // Get tenants
            const tenantsResult = await xeroClient.getTenants(m2mResult.tokens.accessToken);
            if (tenantsResult.success && tenantsResult.tenants.length > 0) {
              session.accessToken = m2mResult.tokens.accessToken;
              session.tenantId = tenantsResult.tenants[0].tenantId;
              session.tenantName = tenantsResult.tenants[0].tenantName;
              session.expiresAt = m2mResult.tokens.expiresAt;
              session.connected = true;
              session.authType = 'm2m';
              console.log('✅ M2M auto-connection successful!');
              console.log('📊 Tenant:', session.tenantName);
            } else {
              console.error('❌ Failed to get tenants:', tenantsResult.error);
            }
          }
        } catch (error) {
          console.error('❌ M2M auto-connection failed:', error.message);
        }
      }

      setSession(session_id, session);
    }

    // Ensure conversationHistory exists
    if (!session.conversationHistory) {
      session.conversationHistory = [];
      setSession(session_id, session);
    }

    // Ensure we have a valid token before processing
    if (session.connected && session.refreshToken) {
      const tokenCheck = await ensureValidToken(session_id);
      if (!tokenCheck.success) {
        console.error('❌ Token validation failed:', tokenCheck.error);
        return res.status(401).json({
          success: false,
          error: 'Xero authentication failed. Please reconnect.',
          details: tokenCheck.error
        });
      }
      session = tokenCheck.session;
    }

    // Get AI response from GLM-4-Flash
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

    // Update conversation history (keep last 10 messages)
    session.conversationHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: aiResponse.content }
    );
    if (session.conversationHistory.length > 20) {
      session.conversationHistory = session.conversationHistory.slice(-20);
    }

    // If AI response is JSON (CRUD operation request)
    if (aiResponse.isJSON && aiResponse.parsedJSON) {
      const actionData = aiResponse.parsedJSON;
      const action = actionData.action;

      // Check if Xero is connected
      if (!session.connected || !session.accessToken) {
        return res.json({
          success: true,
          type: 'action_data',
          message: `Here is the ${action} data ready to be executed in Xero.`,
          data: actionData,
          xero_connected: false,
          note: 'Please connect Xero account first'
        });
      }

      let xeroResult;

      // Handle different CRUD operations
      switch (action) {
        // ================== GET OPERATIONS ==================
        case 'get_invoices':
          xeroResult = await xeroFull.getInvoices(session.accessToken, session.tenantId, actionData.filters || {});
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'data_retrieved',
              message: `Found ${xeroResult.count} invoices`,
              data: xeroResult.invoices
            });
          }
          break;

        case 'get_contacts':
          xeroResult = await xeroFull.getContacts(session.accessToken, session.tenantId, actionData.filters || {});
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'data_retrieved',
              message: `Found ${xeroResult.count} contacts`,
              data: xeroResult.contacts
            });
          }
          break;

        case 'get_accounts':
          xeroResult = await xeroFull.getAccounts(session.accessToken, session.tenantId, actionData.filters || {});
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'data_retrieved',
              message: `Found ${xeroResult.count} accounts`,
              data: xeroResult.accounts
            });
          }
          break;

        case 'get_items':
          xeroResult = await xeroFull.getItems(session.accessToken, session.tenantId, actionData.filters || {});
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'data_retrieved',
              message: `Found ${xeroResult.count} items`,
              data: xeroResult.items
            });
          }
          break;

        case 'get_payments':
          xeroResult = await xeroFull.getPayments(session.accessToken, session.tenantId, actionData.filters || {});
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'data_retrieved',
              message: `Found ${xeroResult.count} payments`,
              data: xeroResult.payments
            });
          }
          break;

        // ================== CREATE OPERATIONS ==================
        case 'create_invoice':
          xeroResult = await xeroFull.createInvoice(actionData, session.accessToken, session.tenantId);
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'invoice_created',
              message: `${aiResponse.content}\n\n✅ Invoice created successfully!`,
              xero_invoice: xeroResult.invoice,
              invoice_url: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${xeroResult.invoice.InvoiceID}`
            });
          }
          break;

        case 'create_contact':
          xeroResult = await xeroFull.createContact(actionData, session.accessToken, session.tenantId);
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'contact_created',
              message: `✅ Contact "${actionData.name}" created successfully!`,
              contact: xeroResult.contact
            });
          }
          break;

        case 'create_account':
          xeroResult = await xeroFull.createAccount(actionData, session.accessToken, session.tenantId);
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'account_created',
              message: `✅ Account "${actionData.name}" created successfully!`,
              account: xeroResult.account
            });
          }
          break;

        case 'create_item':
          xeroResult = await xeroFull.createItem(actionData, session.accessToken, session.tenantId);
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'item_created',
              message: `✅ Item "${actionData.name}" created successfully!`,
              item: xeroResult.item
            });
          }
          break;

        case 'create_payment':
          xeroResult = await xeroFull.createPayment(actionData, session.accessToken, session.tenantId);
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'payment_created',
              message: `✅ Payment of RM${actionData.amount} recorded successfully!`,
              payment: xeroResult.payment
            });
          }
          break;

        // ================== UPDATE OPERATIONS ==================
        case 'update_invoice':
          xeroResult = await xeroFull.updateInvoice(actionData.invoice_id, actionData.invoice_data, session.accessToken, session.tenantId);
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'invoice_updated',
              message: `✅ Invoice updated successfully!`,
              invoice: xeroResult.invoice
            });
          }
          break;

        case 'update_contact':
          xeroResult = await xeroFull.updateContact(actionData.contact_id, actionData.contact_data, session.accessToken, session.tenantId);
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'contact_updated',
              message: `✅ Contact updated successfully!`,
              contact: xeroResult.contact
            });
          }
          break;

        case 'update_account':
          xeroResult = await xeroFull.updateAccount(actionData.account_id, actionData.account_data, session.accessToken, session.tenantId);
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'account_updated',
              message: `✅ Account updated successfully!`,
              account: xeroResult.account
            });
          }
          break;

        case 'update_item':
          xeroResult = await xeroFull.updateItem(actionData.item_id, actionData.item_data, session.accessToken, session.tenantId);
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'item_updated',
              message: `✅ Item updated successfully!`,
              item: xeroResult.item
            });
          }
          break;

        // ================== DELETE OPERATIONS ==================
        case 'delete_invoice':
          xeroResult = await xeroFull.deleteInvoice(actionData.invoice_id, session.accessToken, session.tenantId);
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'invoice_deleted',
              message: `✅ Invoice deleted successfully!`
            });
          }
          break;

        case 'delete_contact':
          xeroResult = await xeroFull.deleteContact(actionData.contact_id, session.accessToken, session.tenantId);
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'contact_deleted',
              message: `✅ Contact deleted successfully!`
            });
          }
          break;

        case 'delete_item':
          xeroResult = await xeroFull.deleteItem(actionData.item_id, session.accessToken, session.tenantId);
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'item_deleted',
              message: `✅ Item deleted successfully!`
            });
          }
          break;

        case 'delete_payment':
          xeroResult = await xeroFull.deletePayment(actionData.payment_id, session.accessToken, session.tenantId);
          if (xeroResult.success) {
            return res.json({
              success: true,
              type: 'payment_deleted',
              message: `✅ Payment deleted successfully!`
            });
          }
          break;

        default:
          return res.json({
            success: false,
            type: 'unknown_action',
            message: `Unknown action: ${action}`,
            data: actionData
          });
      }

      // If we got here, the operation failed
      return res.json({
        success: false,
        type: 'xero_error',
        message: aiResponse.content,
        data: actionData,
        xero_error: xeroResult?.error || 'Operation failed',
        details: xeroResult?.details
      });

    } else {
      // Regular text response from AI
      res.json({
        success: true,
        type: 'text',
        message: aiResponse.content,
        xero_connected: session.connected || false
      });
    }

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
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
      history: session ? session.conversationHistory : []
    });

  } catch (error) {
    console.error('History error:', error);
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
      setSession(sessionId, { conversationHistory: [] });
    }

    res.json({
      success: true,
      message: 'Chat history cleared'
    });

  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// CRUD API ENDPOINTS - Full Admin Operations
// ==========================================

// Helper function to get session data with valid token
const getActiveSession = async (sessionId) => {
  const session = getSession(sessionId);
  if (!session || !session.connected) {
    return null;
  }

  // Ensure token is valid
  if (session.refreshToken) {
    const tokenCheck = await ensureValidToken(sessionId);
    if (!tokenCheck.success) {
      console.error('❌ Failed to get valid token for session:', sessionId);
      return null;
    }
    return tokenCheck.session;
  }

  return session;
};

/**
 * Test endpoint - Get organization info
 */
app.get('/api/organization', async (req, res) => {
  try {
    const { session_id = 'default' } = req.query;
    console.log('📊 Getting organization info for session:', session_id);

    const session = await getActiveSession(session_id);
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Not connected to Xero or session invalid'
      });
    }

    console.log('✅ Session is valid');
    console.log('📊 Using tenant:', session.tenantName);
    console.log('📊 Tenant ID:', session.tenantId);

    const response = await axios.get(
      'https://api.xero.com/api.xro/2.0/Organisation',
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Xero-tenant-id': session.tenantId,
          'Accept': 'application/json'
        }
      }
    );

    console.log('✅ Organization API call successful');

    res.json({
      success: true,
      organization: response.data.Organisations[0]
    });
  } catch (error) {
    console.error('❌ Organization API error:', error.response?.data || error.message);

    // Check if it's a 401 error
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        details: error.response.data,
        cause: 'Token may be expired or invalid'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
});

// ==================== INVOICES ====================

/**
 * Get all invoices
 */
app.get('/api/invoices', async (req, res) => {
  try {
    const { session_id = 'default', status, contact_id } = req.query;
    const session = await getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    console.log(`📊 Getting invoices for tenant: ${session.tenantName}`);

    const filters = {};
    if (status) filters.status = status;
    if (contact_id) filters.contact_id = contact_id;

    const result = await xeroFull.getInvoices(session.accessToken, session.tenantId, filters);
    res.json(result);
  } catch (error) {
    console.error('❌ Get invoices error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get single invoice by ID
 */
app.get('/api/invoices/:invoiceId', async (req, res) => {
  try {
    const { session_id = 'default' } = req.query;
    const session = await getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const result = await xeroFull.getInvoiceById(req.params.invoiceId, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    console.error('❌ Get invoice error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create invoice
 */
app.post('/api/invoices', async (req, res) => {
  try {
    const { session_id = 'default', invoice_data } = req.body;
    const session = await getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    console.log(`📝 Creating invoice for tenant: ${session.tenantName}`);

    const result = await xeroFull.createInvoice(invoice_data, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    console.error('❌ Create invoice error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update invoice
 */
app.put('/api/invoices/:invoiceId', async (req, res) => {
  try {
    const { session_id = 'default', invoice_data } = req.body;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const result = await xeroFull.updateInvoice(req.params.invoiceId, invoice_data, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete invoice
 */
app.delete('/api/invoices/:invoiceId', async (req, res) => {
  try {
    const { session_id = 'default' } = req.query;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const result = await xeroFull.deleteInvoice(req.params.invoiceId, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CONTACTS ====================

/**
 * Get all contacts
 */
app.get('/api/contacts', async (req, res) => {
  try {
    const { session_id = 'default', where } = req.query;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const filters = {};
    if (where) filters.where = where;

    const result = await xeroFull.getContacts(session.accessToken, session.tenantId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get single contact by ID
 */
app.get('/api/contacts/:contactId', async (req, res) => {
  try {
    const { session_id = 'default' } = req.query;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const result = await xeroFull.getContactById(req.params.contactId, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create contact
 */
app.post('/api/contacts', async (req, res) => {
  try {
    const { session_id = 'default', contact_data } = req.body;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const result = await xeroFull.createContact(contact_data, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update contact
 */
app.put('/api/contacts/:contactId', async (req, res) => {
  try {
    const { session_id = 'default', contact_data } = req.body;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const result = await xeroFull.updateContact(req.params.contactId, contact_data, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete contact
 */
app.delete('/api/contacts/:contactId', async (req, res) => {
  try {
    const { session_id = 'default' } = req.query;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const result = await xeroFull.deleteContact(req.params.contactId, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ACCOUNTS ====================

/**
 * Get all accounts
 */
app.get('/api/accounts', async (req, res) => {
  try {
    const { session_id = 'default', where } = req.query;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const filters = {};
    if (where) filters.where = where;

    const result = await xeroFull.getAccounts(session.accessToken, session.tenantId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create account
 */
app.post('/api/accounts', async (req, res) => {
  try {
    const { session_id = 'default', account_data } = req.body;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const result = await xeroFull.createAccount(account_data, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update account
 */
app.put('/api/accounts/:accountId', async (req, res) => {
  try {
    const { session_id = 'default', account_data } = req.body;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const result = await xeroFull.updateAccount(req.params.accountId, account_data, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ITEMS/PRODUCTS ====================

/**
 * Get all items
 */
app.get('/api/items', async (req, res) => {
  try {
    const { session_id = 'default', where } = req.query;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const filters = {};
    if (where) filters.where = where;

    const result = await xeroFull.getItems(session.accessToken, session.tenantId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create item
 */
app.post('/api/items', async (req, res) => {
  try {
    const { session_id = 'default', item_data } = req.body;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const result = await xeroFull.createItem(item_data, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update item
 */
app.put('/api/items/:itemId', async (req, res) => {
  try {
    const { session_id = 'default', item_data } = req.body;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const result = await xeroFull.updateItem(req.params.itemId, item_data, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete item
 */
app.delete('/api/items/:itemId', async (req, res) => {
  try {
    const { session_id = 'default' } = req.query;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const result = await xeroFull.deleteItem(req.params.itemId, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PAYMENTS (POS) ====================

/**
 * Get all payments
 */
app.get('/api/payments', async (req, res) => {
  try {
    const { session_id = 'default', where } = req.query;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const filters = {};
    if (where) filters.where = where;

    const result = await xeroFull.getPayments(session.accessToken, session.tenantId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create payment (POS)
 */
app.post('/api/payments', async (req, res) => {
  try {
    const { session_id = 'default', payment_data } = req.body;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const result = await xeroFull.createPayment(payment_data, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete payment
 */
app.delete('/api/payments/:paymentId', async (req, res) => {
  try {
    const { session_id = 'default' } = req.query;
    const session = getActiveSession(session_id);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Not connected to Xero' });
    }

    const result = await xeroFull.deletePayment(req.params.paymentId, session.accessToken, session.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ==========================================
// START SERVER
// ==========================================

// Detect if running on Render (production) or local
const isRender = process.env.RENDER || process.env.NODE_ENV === 'production';

if (isRender) {
  // Render deployment - use HTTP (Render handles HTTPS externally)
  app.listen(PORT, () => {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║           Xero Chatbot Server Started                ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log(`🚀 Server running on: http://localhost:${PORT}`);
    console.log(`📚 API Health: http://localhost:${PORT}/health`);
    console.log(`💬 Chat Endpoint: POST http://localhost:${PORT}/chat`);
    console.log(`🔐 Xero Auth: GET http://localhost:${PORT}/xero/auth`);
    console.log('🌐 Running on Render (HTTPS enabled by Render)');
    console.log('╚═══════════════════════════════════════════════════════╝');
  });
} else {
  // Local development - use HTTPS with self-signed certificate
  try {
    const sslOptions = {
      key: fs.readFileSync('./key.pem'),
      cert: fs.readFileSync('./cert.pem')
    };

    https.createServer(sslOptions, app).listen(PORT, () => {
      console.log('╔═══════════════════════════════════════════════════════╗');
      console.log('║           Xero Chatbot Server Started                ║');
      console.log('╚═══════════════════════════════════════════════════════╝');
      console.log(`🚀 Server running on: https://localhost:${PORT}`);
      console.log(`📚 API Health: https://localhost:${PORT}/health`);
      console.log(`💬 Chat Endpoint: POST https://localhost:${PORT}/chat`);
      console.log(`🔐 Xero Auth: GET https://localhost:${PORT}/xero/auth`);
      console.log('');
      console.log('📖 Test the chatbot with:');
      console.log(`   curl -X POST https://localhost:${PORT}/chat \\`);
      console.log('   -H "Content-Type: application/json" \\');
      console.log('   -d \'{"message": "Hello! What can you do?"}\'');
      console.log('');
      console.log('📝 See README.md for complete documentation');
      console.log('╚═══════════════════════════════════════════════════════╝');
    });
  } catch (error) {
    console.error('❌ SSL Certificate not found. Please run:');
    console.log('   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes');
    console.error('Falling back to HTTP...');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on: http://localhost:${PORT}`);
    });
  }
}

module.exports = app;
