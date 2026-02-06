require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
// Use PORT from environment (Render provides this) or default to 4000 for local
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// ==========================================
// IN-MEMORY STORAGE (No database)
// ==========================================
const sessionData = {
  connected: false,
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  tenantId: null
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Generate random state for CSRF protection
 */
function generateState() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * Log OAuth parameters for debugging
 */
function logOAuthConfig() {
  console.log('\n=== XERO OAUTH CONFIGURATION ===');
  console.log('Client ID:', process.env.XERO_CLIENT_ID ? '✅ SET' : '❌ MISSING');
  console.log('Client Secret:', process.env.XERO_CLIENT_SECRET ? '✅ SET' : '❌ MISSING');
  console.log('Redirect URI:', process.env.XERO_REDIRECT_URI);
  console.log('Scopes:', process.env.XERO_SCOPE);
  console.log('=================================\n');
}

// ==========================================
// ENDPOINTS
// ==========================================

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /xero/auth
 * Start Xero OAuth 2.0 flow
 */
app.get('/xero/auth', (req, res) => {
  console.log('\n🔑 Starting Xero OAuth flow...');

  const clientId = process.env.XERO_CLIENT_ID;
  const redirectUri = process.env.XERO_REDIRECT_URI;
  const scope = process.env.XERO_SCOPE;

  // Validate environment variables
  if (!clientId || !redirectUri || !scope) {
    console.error('❌ Missing environment variables');
    return res.status(500).json({
      error: 'Server configuration error',
      details: 'XERO_CLIENT_ID, XERO_REDIRECT_URI, or XERO_SCOPE is missing'
    });
  }

  // Generate state for CSRF protection
  const state = generateState();

  // Build authorization URL
  const authUrl = new URL('https://login.xero.com/identity/connect/authorize');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('scope', scope);
  authUrl.searchParams.append('state', state);

  console.log('📋 Authorization URL generated:');
  console.log('   Redirect URI:', redirectUri);
  console.log('   State:', state);
  console.log('   Full URL:', authUrl.toString());

  // Return authorization URL to frontend (frontend will handle redirect)
  res.json({
    success: true,
    authorization_url: authUrl.toString()
  });
});

/**
 * GET /xero/callback
 * Handle OAuth callback from Xero
 */
app.get('/xero/callback', async (req, res) => {
  const { code, state } = req.query;

  console.log('\n🔐 Received OAuth callback from Xero');
  console.log('📋 Code:', code ? '✅ RECEIVED' : '❌ MISSING');
  console.log('📋 State:', state || '❌ MISSING');

  // Check if authorization code is present
  if (!code) {
    console.error('❌ No authorization code received');
    return res.status(400).json({
      success: false,
      error: 'Missing authorization code from Xero'
    });
  }

  try {
    // Exchange authorization code for tokens
    console.log('\n🔄 Exchanging authorization code for tokens...');

    const clientId = process.env.XERO_CLIENT_ID;
    const clientSecret = process.env.XERO_CLIENT_SECRET;
    const redirectUri = process.env.XERO_REDIRECT_URI;

    console.log('📋 Token exchange parameters:');
    console.log('   Token URL: https://identity.xero.com/oauth/token');
    console.log('   Redirect URI:', redirectUri);
    console.log('   Redirect URI length:', redirectUri.length);
    console.log('   Redirect URI encoded:', encodeURIComponent(redirectUri));
    console.log('   Client ID:', clientId);
    console.log('   Code received:', code ? 'YES' : 'NO');
    console.log('   Code length:', code ? code.length : 0);

    // Build the request body
    const requestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    });

    console.log('📋 Request body:', requestBody.toString());

    const tokenResponse = await axios.post(
      'https://identity.xero.com/oauth/token',
      requestBody,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('✅ Token exchange successful!');
    console.log('📋 Response status:', tokenResponse.status);

    // Validate response structure
    if (!tokenResponse.data) {
      console.error('❌ Token response missing data field');
      return res.status(500).json({
        success: false,
        error: 'Invalid token response from Xero',
        details: 'Response data is missing'
      });
    }

    // Extract token data with validation
    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Validate required fields
    if (!access_token) {
      console.error('❌ Access token missing from response');
      console.error('📋 Full response:', JSON.stringify(tokenResponse.data, null, 2));
      return res.status(500).json({
        success: false,
        error: 'Missing authorization code from Xero',
        details: 'Xero did not return an access_token. Check your redirect URI and credentials.'
      });
    }

    if (!expires_in) {
      console.error('❌ Expires_in missing from response');
      return res.status(500).json({
        success: false,
        error: 'Invalid token response',
        details: 'expires_in field is missing'
      });
    }

    // Calculate expiration time (current time + expires_in seconds - 5 minutes buffer)
    const expiresAt = Date.now() + (expires_in * 1000) - 300000;

    console.log('📋 Token details:');
    console.log('   Access Token:', access_token ? '✅ RECEIVED (length: ' + access_token.length + ')' : '❌ MISSING');
    console.log('   Refresh Token:', refresh_token ? '✅ RECEIVED' : '❌ MISSING');
    console.log('   Expires In:', expires_in, 'seconds');
    console.log('   Expires At:', new Date(expiresAt).toISOString());

    // Get tenant ID
    console.log('\n🔄 Getting tenant ID from Xero...');

    const connectionsResponse = await axios.get(
      'https://api.xero.com/connections',
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!connectionsResponse.data || connectionsResponse.data.length === 0) {
      console.error('❌ No tenants found');
      return res.status(500).json({
        error: 'No tenants found',
        details: 'Your Xero account has no organizations connected'
      });
    }

    const tenantId = connectionsResponse.data[0].tenantId;
    const tenantName = connectionsResponse.data[0].tenantName;

    console.log('✅ Tenant retrieved:');
    console.log('   Tenant ID:', tenantId);
    console.log('   Tenant Name:', tenantName);

    // Store in memory
    sessionData.connected = true;
    sessionData.accessToken = access_token;
    sessionData.refreshToken = refresh_token;
    sessionData.expiresAt = expiresAt;
    sessionData.tenantId = tenantId;

    console.log('\n✅ Session stored successfully!');
    console.log('📊 Session data:', {
      connected: sessionData.connected,
      tenantId: sessionData.tenantId,
      expiresAt: new Date(sessionData.expiresAt).toISOString()
    });

    // Send success response
    res.json({
      success: true,
      message: 'Xero connection successful',
      tenant: {
        id: tenantId,
        name: tenantName
      }
    });

  } catch (error) {
    console.error('\n❌ ERROR during token exchange or tenant retrieval');
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);

    // Log Xero's error response
    if (error.response) {
      console.error('\n📋 Xero Error Response:');
      console.error('   Status:', error.response.status);
      console.error('   Status Text:', error.response.statusText);
      console.error('   Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));

      // Check if it's HTML (redirect URI mismatch)
      if (error.response.headers['content-type'] && error.response.headers['content-type'].includes('text/html')) {
        console.error('\n⚠️  WARNING: Xero returned HTML instead of JSON');
        console.error('⚠️  This usually means:');
        console.error('   1. Redirect URI mismatch');
        console.error('   2. Invalid client_id or client_secret');
        console.error('   3. Authorization code already used');
        console.error('\n📋 Redirect URI being used:', process.env.XERO_REDIRECT_URI);
        console.error('📋 Make sure this EXACT URI is in your Xero Developer Portal!');
      }

      return res.status(error.response.status).json({
        error: 'Xero API error',
        status: error.response.status,
        details: error.response.data,
        hint: 'Check your Xero Developer Portal redirect URI setting'
      });
    }

    // Network or other errors
    res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
});

/**
 * GET /xero/status
 * Check Xero connection status
 */
app.get('/xero/status', (req, res) => {
  const isExpired = sessionData.expiresAt && Date.now() > sessionData.expiresAt;

  res.json({
    connected: sessionData.connected && !isExpired,
    tenantId: sessionData.tenantId,
    expiresAt: sessionData.expiresAt ? new Date(sessionData.expiresAt).toISOString() : null,
    isExpired: isExpired
  });
});

// ==========================================
// START SERVER
// ==========================================

// Validate environment variables at startup
const requiredEnvVars = [
  'XERO_CLIENT_ID',
  'XERO_CLIENT_SECRET',
  'XERO_REDIRECT_URI',
  'XERO_SCOPE'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('\n❌ FATAL: Missing required environment variables:');
  missingEnvVars.forEach(envVar => {
    console.error('   ❌', envVar);
  });
  console.error('\n📋 Please set these in your .env file and restart the server.\n');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║       XERO OAUTH BACKEND - MINIMAL BUILD              ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`\n🚀 Server running on: http://localhost:${PORT}`);
  console.log(`📚 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 OAuth start: http://localhost:${PORT}/xero/auth`);
  console.log(`📊 Status check: http://localhost:${PORT}/xero/status`);

  logOAuthConfig();
});
