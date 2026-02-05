/**
 * ==========================================
 * XERO CHATBOT - MAIN SERVER
 * ==========================================
 * Production-ready Node.js/Express backend
 * Integrated with GLM-4.7-Flash AI and Xero API
 *
 * Endpoints:
 * - GET  /health        - Health check
 * - GET  /login         - Redirect to Xero OAuth
 * - GET  /callback      - Xero OAuth callback handler
 * - GET  /status        - Check Xero connection status
 * - POST /chat          - Main chat endpoint
 * - POST /create-invoice - Create invoice directly
 * - POST /disconnect    - Disconnect Xero account
 *
 * Deployment: Render.com
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const glmClient = require('./glmClient');
const xeroClient = require('./xeroClient');
const https = require('https');
const fs = require('fs');
const http = require('http');

// ==========================================
// EXPRESS APP SETUP
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080', process.env.FRONTEND_URL || 'http://localhost:8080']
}));
app.use(express.json());

// ==========================================
// IN-MEMORY SESSION STORAGE
// ==========================================
// In production, use Redis or a database
const sessions = new Map();

function setSession(id, data) {
  sessions.set(id, data);
}

function getSession(id) {
  return sessions.get(id);
}

function deleteSession(id) {
  sessions.delete(id);
}

// ==========================================
// ROUTES
// ==========================================

/**
 * Health Check Endpoint
 *
 * GET /health
 * Returns server status and uptime
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Xero Chatbot Backend',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

/**
 * Root Endpoint - API Information
 *
 * GET /
 * Returns available endpoints
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Xero Chatbot API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      xero_connect: 'GET /xero/connect?session_id=xxx',
      xero_callback: 'GET /xero/callback?code=xxx&state=xxx',
      status: 'GET /status?session_id=xxx',
      chat: 'POST /chat',
      xero_quotation: 'POST /xero/quotation',
      xero_invoice: 'POST /xero/invoice',
      xero_contacts: 'GET /xero/contacts',
      xero_organisations: 'GET /xero/organisations',
      disconnect: 'POST /disconnect'
    },
    documentation: 'See README.md'
  });
});

/**
 * Xero OAuth Connect - Initiate Authorization
 *
 * GET /xero/connect?session_id=xxx
 * Redirects user to Xero authorization page
 */
app.get('/xero/connect', (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        error: 'session_id is required'
      });
    }

    // Generate Xero authorization URL with session_id
    const { url, state } = xeroClient.getAuthorizationUrl(session_id);

    // Store state for CSRF verification during callback
    setSession(session_id, { oauthState: state });

    res.json({
      success: true,
      authorization_url: url,
      message: 'Visit this URL to authorize Xero access'
    });

  } catch (error) {
    console.error('Connect error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Legacy route for backward compatibility
app.get('/login', (req, res) => {
  res.redirect(307, req.originalUrl.replace('/login', '/xero/connect'));
});

/**
 * Xero OAuth Callback Handler
 *
 * GET /xero/callback?code=xxx&state=xxx
 * Handles redirect from Xero after authorization
 * Exchanges code for access tokens
 */
app.get('/xero/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      console.error('Callback: Missing authorization code');
      return res.status(400).send('Missing authorization code');
    }

    console.log('Callback: Received code, exchanging for token...');
    console.log('Callback: State:', state);

    // Extract session_id from state parameter (format: "session_id:random_string")
    let sessionId = 'default';
    if (state && state.includes(':')) {
      const parts = state.split(':');
      sessionId = parts[0];
      console.log('Callback: Extracted session ID from state:', sessionId);
    }

    // Exchange authorization code for tokens
    const tokenResult = await xeroClient.exchangeCodeForToken(code);

    if (!tokenResult.success) {
      console.error('Callback: Token exchange failed:', tokenResult.error);
      return res.status(400).json({
        success: false,
        error: tokenResult.error
      });
    }

    console.log('Callback: Token received, fetching tenants...');

    // Get tenants (organizations)
    const tenantsResult = await xeroClient.getTenants(tokenResult.tokens.accessToken);

    if (!tenantsResult.success) {
      console.error('Callback: Get tenants failed:', tenantsResult.error);
      return res.status(400).json({
        success: false,
        error: tenantsResult.error
      });
    }

    // Store tokens in session
    const tenantId = tenantsResult.tenants[0].tenantId;

    console.log('Callback: Storing tokens for session:', sessionId);

    setSession(sessionId, {
      accessToken: tokenResult.tokens.accessToken,
      refreshToken: tokenResult.tokens.refreshToken,
      expiresAt: tokenResult.tokens.expiresAt,
      refreshAt: tokenResult.tokens.refreshAt,
      tenantId: tenantId,
      tenantName: tenantsResult.tenants[0].tenantName,
      connected: true
    });

    // Send user-friendly HTML response
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Xero Connected - Success</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
          }
          .success-icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 {
            color: #2D3748;
            margin-bottom: 10px;
            font-size: 28px;
          }
          .info-box {
            background: #F7FAFC;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
          }
          .info-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #E2E8F0;
          }
          .info-item:last-child {
            border-bottom: none;
          }
          .label {
            font-weight: 600;
            color: #4A5568;
          }
          .value {
            color: #667eea;
            font-weight: 500;
          }
          .note {
            color: #718096;
            font-size: 14px;
            line-height: 1.6;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Xero Account Connected!</h1>
          <div class="info-box">
            <div class="info-item">
              <span class="label">Organization:</span>
              <span class="value">${tenantsResult.tenants[0].tenantName}</span>
            </div>
            <div class="info-item">
              <span class="label">Tenant ID:</span>
              <span class="value">${tenantId.substring(0, 8)}...</span>
            </div>
            <div class="info-item">
              <span class="label">Status:</span>
              <span class="value">Ready</span>
            </div>
          </div>
          <p class="note">
            Your Xero account has been successfully connected.<br>
            You can now create invoices and quotations.
          </p>
          <p class="note">
            You can close this window and return to the chatbot.
          </p>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

// Legacy route for backward compatibility
app.get('/callback', (req, res) => {
  res.redirect(307, req.originalUrl.replace('/callback', '/xero/callback'));
});

/**
 * Check Xero Connection Status
 *
 * GET /status?session_id=xxx
 * Returns whether Xero is connected and tenant info
 */
app.get('/status', (req, res) => {
  try {
    const { session_id } = req.query;
    const sessionId = session_id || 'default';
    const session = getSession(sessionId);

    if (!session || !session.connected) {
      return res.json({
        connected: false,
        message: 'Xero account not connected. Please authorize first.'
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
 * POST /chat
 * Receives user message, returns AI response
 * Handles both text responses and invoice/quotation creation
 */
app.post('/chat', async (req, res) => {
  try {
    const { message, session_id } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const sessionId = session_id || 'default';

    // Get or create session
    let session = getSession(sessionId);
    if (!session) {
      session = {
        conversationHistory: [],
        connected: false
      };
      setSession(sessionId, session);
    }

    // Refresh access token if needed (5 minutes before expiry)
    if (session.connected && session.refreshToken && xeroClient.needsRefresh(session.expiresAt)) {
      console.log('Refreshing Xero access token...');

      const refreshResult = await xeroClient.refreshAccessToken(session.refreshToken);

      if (refreshResult.success) {
        setSession(sessionId, {
          accessToken: refreshResult.tokens.accessToken,
          refreshToken: refreshResult.tokens.refreshToken,
          expiresAt: refreshResult.tokens.expiresAt,
          refreshAt: refreshResult.tokens.refreshAt
        });
        session = getSession(sessionId);
        console.log('Token refreshed successfully');
      } else {
        console.error('Token refresh failed:', refreshResult.error);
      }
    }

    // Get AI response from GLM-4.7-Flash
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

    // Update conversation history (keep last 20 messages)
    // Initialize conversationHistory if it doesn't exist
    if (!session.conversationHistory) {
      session.conversationHistory = [];
    }

    session.conversationHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: aiResponse.content }
    );
    if (session.conversationHistory.length > 20) {
      session.conversationHistory = session.conversationHistory.slice(-20);
    }

    // If AI response is JSON (invoice/quotation request or info request)
    if (aiResponse.isJSON && aiResponse.parsedJSON) {
      const responseData = aiResponse.parsedJSON;

      // Handle request_info action (AI needs more data)
      if (responseData.action === 'request_info') {
        return res.json({
          success: true,
          type: 'request_info',
          data: responseData,
          message: responseData.message || 'Please provide additional information'
        });
      }

      // Check if Xero is connected
      if (!session.connected || !session.accessToken) {
        return res.json({
          success: true,
          type: 'document_data',
          message: aiResponse.content,
          data: responseData,
          xero_connected: false,
          note: 'Please connect Xero account first via /login'
        });
      }

      // Handle create_quotation action
      if (responseData.action === 'create_quotation') {
        const xeroResult = await xeroClient.createQuotation(
          responseData,
          session.accessToken,
          session.tenantId
        );

        if (xeroResult.success) {
          res.json({
            success: true,
            type: 'quotation_created',
            message: 'Quotation created successfully in Xero',
            data: responseData,
            xero_quote: xeroResult.quote,
            xero_quote_id: xeroResult.quote.QuoteID,
            xero_quote_number: xeroResult.quoteNumber,
            quotation_url: xeroResult.quotationUrl
          });
        } else {
          res.json({
            success: false,
            type: 'quotation_error',
            message: 'Failed to create quotation',
            data: responseData,
            xero_error: xeroResult.error,
            details: xeroResult.details
          });
        }
        return;
      }

      // Handle create_invoice action
      if (responseData.action === 'create_invoice') {
        const xeroResult = await xeroClient.createInvoice(
          responseData,
          session.accessToken,
          session.tenantId
        );

        if (xeroResult.success) {
          res.json({
            success: true,
            type: 'invoice_created',
            message: 'Invoice created successfully in Xero',
            data: responseData,
            xero_invoice: xeroResult.invoice,
            xero_invoice_id: xeroResult.invoice.InvoiceID,
            xero_invoice_number: xeroResult.invoice.InvoiceNumber,
            invoice_url: xeroResult.invoiceUrl
          });
        } else {
          res.json({
            success: false,
            type: 'invoice_error',
            message: 'Failed to create invoice',
            data: responseData,
            xero_error: xeroResult.error,
            details: xeroResult.details
          });
        }
        return;
      }

      // Unknown action
      res.json({
        success: true,
        type: 'unknown_action',
        data: responseData,
        message: 'Received JSON response with unknown action'
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
 * Create Invoice Endpoint (Direct)
 *
 * POST /create-invoice
 * Creates invoice directly from structured data
 */
app.post('/create-invoice', async (req, res) => {
  try {
    const { invoiceData, session_id } = req.body;

    if (!invoiceData) {
      return res.status(400).json({
        success: false,
        error: 'invoiceData is required'
      });
    }

    const sessionId = session_id || 'default';
    const session = getSession(sessionId);

    if (!session || !session.connected) {
      return res.status(401).json({
        success: false,
        error: 'Xero account not connected. Please authorize first.'
      });
    }

    // Create invoice
    const result = await xeroClient.createInvoice(
      invoiceData,
      session.accessToken,
      session.tenantId
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Invoice created successfully',
        invoice: result.invoice,
        invoice_url: result.invoiceUrl
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Disconnect Xero Account
 *
 * POST /disconnect
 * Removes stored tokens
 */
app.post('/disconnect', (req, res) => {
  try {
    const { session_id } = req.body;
    const sessionId = session_id || 'default';

    if (sessions.has(sessionId)) {
      deleteSession(sessionId);
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
 * Create Quotation Endpoint
 *
 * POST /xero/quotation
 * Creates a quotation in Xero
 */
app.post('/xero/quotation', async (req, res) => {
  try {
    const { quotationData, session_id } = req.body;

    if (!quotationData) {
      return res.status(400).json({
        success: false,
        error: 'quotationData is required'
      });
    }

    const sessionId = session_id || 'default';
    const session = getSession(sessionId);

    if (!session || !session.connected) {
      return res.status(401).json({
        success: false,
        error: 'Xero account not connected. Please authorize first.'
      });
    }

    // Create quotation
    const result = await xeroClient.createQuotation(
      quotationData,
      session.accessToken,
      session.tenantId
    );

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        quote: result.quote,
        quotationUrl: result.quotationUrl,
        quoteNumber: result.quoteNumber
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Create quotation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Create Invoice Endpoint
 *
 * POST /xero/invoice
 * Creates an invoice in Xero
 */
app.post('/xero/invoice', async (req, res) => {
  try {
    const { invoiceData, session_id } = req.body;

    if (!invoiceData) {
      return res.status(400).json({
        success: false,
        error: 'invoiceData is required'
      });
    }

    const sessionId = session_id || 'default';
    const session = getSession(sessionId);

    if (!session || !session.connected) {
      return res.status(401).json({
        success: false,
        error: 'Xero account not connected. Please authorize first.'
      });
    }

    // Create invoice
    const result = await xeroClient.createInvoice(
      invoiceData,
      session.accessToken,
      session.tenantId
    );

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        invoice: result.invoice,
        invoiceUrl: result.invoiceUrl
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get Contacts Endpoint
 *
 * GET /xero/contacts?session_id=xxx
 * Retrieves all contacts from Xero
 */
app.get('/xero/contacts', async (req, res) => {
  try {
    const { session_id, where, order, page } = req.query;
    const sessionId = session_id || 'default';
    const session = getSession(sessionId);

    if (!session || !session.connected) {
      return res.status(401).json({
        success: false,
        error: 'Xero account not connected. Please authorize first.'
      });
    }

    // Get contacts
    const result = await xeroClient.getContacts(
      session.accessToken,
      session.tenantId,
      { where, order, page }
    );

    if (result.success) {
      res.json({
        success: true,
        contacts: result.contacts,
        pagination: result.pagination
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get Organisation Endpoint
 *
 * GET /xero/organisations?session_id=xxx
 * Retrieves organisation details from Xero
 */
app.get('/xero/organisations', async (req, res) => {
  try {
    const { session_id } = req.query;
    const sessionId = session_id || 'default';
    const session = getSession(sessionId);

    if (!session || !session.connected) {
      return res.status(401).json({
        success: false,
        error: 'Xero account not connected. Please authorize first.'
      });
    }

    // Get organisation
    const result = await xeroClient.getOrganisation(
      session.accessToken,
      session.tenantId
    );

    if (result.success) {
      res.json({
        success: true,
        organisation: result.organisation
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Get organisation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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

// For local development, use HTTP instead of HTTPS
// This avoids self-signed certificate issues
if (process.env.NODE_ENV === 'production' && process.env.PORT === '3000') {
  // Production: Use HTTPS
  const sslOptions = {
    key: fs.readFileSync(__dirname + '/key.pem'),
    cert: fs.readFileSync(__dirname + '/cert.pem')
  };

  https.createServer(sslOptions, app).listen(PORT, () => {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║              XERO CHATBOT BACKEND STARTED                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`🚀 HTTPS Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 Base URL: https://localhost:${PORT}`);
    console.log('');
    console.log('Endpoints:');
    console.log(`  - Health:     GET  https://localhost:${PORT}/health`);
    console.log(`  - Login:      GET  https://localhost:${PORT}/login?session_id=xxx`);
    console.log(`  - Status:     GET  https://localhost:${PORT}/status?session_id=xxx`);
    console.log(`  - Chat:       POST https://localhost:${PORT}/chat`);
    console.log(`  - Invoice:    POST https://localhost:${PORT}/create-invoice`);
    console.log(`  - Disconnect: POST https://localhost:${PORT}/disconnect`);
    console.log('');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
  });
} else {
  // Development: Use HTTP
  app.listen(PORT, () => {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║              XERO CHATBOT BACKEND STARTED                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`🚀 HTTP Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 Base URL: http://localhost:${PORT}`);
    console.log('');
    console.log('Endpoints:');
    console.log(`  - Health:     GET  http://localhost:${PORT}/health`);
    console.log(`  - Login:      GET  http://localhost:${PORT}/login?session_id=xxx`);
    console.log(`  - Status:     GET  http://localhost:${PORT}/status?session_id=xxx`);
    console.log(`  - Chat:       POST http://localhost:${PORT}/chat`);
    console.log(`  - Invoice:    POST http://localhost:${PORT}/create-invoice`);
    console.log(`  - Disconnect: POST http://localhost:${PORT}/disconnect`);
    console.log('');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
  });
}

module.exports = app;
