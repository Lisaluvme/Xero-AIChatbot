/**
 * Xero OAuth 2.0 Client Credentials Grant Handler
 *
 * This module handles the OAuth 2.0 Client Credentials flow for Xero Custom Connections.
 * No redirect_uri, no authorization codes, no browser-based OAuth.
 *
 * Process:
 * 1. Exchange client_id + client_secret for access_token
 * 2. Cache the token with expiry time
 * 3. Automatically refresh when expired
 * 4. Use Bearer token in API requests
 */

const axios = require('axios');

/**
 * Token cache
 */
let tokenCache = {
  accessToken: null,
  expiresAt: null,
  tenantId: null
};

/**
 * Get access token using Client Credentials Grant
 *
 * POST https://identity.xero.com/connect/token
 * grant_type=client_credentials
 * client_id=YOUR_CLIENT_ID
 * client_secret=YOUR_CLIENT_SECRET
 * scope=accounting.transactions accounting.settings accounting.contacts
 */
async function getAccessToken() {
  try {
    // Check if we have a valid cached token
    if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
      console.log('✅ Using cached Xero access token');
      return tokenCache.accessToken;
    }

    console.log('🔄 Fetching new Xero access token via Client Credentials Grant...');

    const clientId = process.env.XERO_CLIENT_ID;
    const clientSecret = process.env.XERO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('XERO_CLIENT_ID and XERO_CLIENT_SECRET must be set');
    }

    // Build the request - scopes must match exactly what's in the Custom Connection
    const scopes = 'accounting.transactions accounting.settings.read accounting.contacts';

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', scopes);

    // Exchange client credentials for access token
    const response = await axios.post(
      'https://identity.xero.com/connect/token',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );

    console.log('📊 Token Response Status:', response.status);

    if (response.status !== 200) {
      throw new Error(`Token request failed with status ${response.status}`);
    }

    const data = response.data;
    console.log('✅ Access token received successfully');
    console.log('📊 Token type:', data.token_type);
    console.log('📊 Expires in:', data.expires_in, 'seconds');
    console.log('📊 Scope:', data.scope);

    // Cache the token
    const expiresIn = data.expires_in || 1800; // Default 30 minutes
    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (expiresIn * 1000), // Convert to milliseconds, subtract 5 min buffer
      tenantId: data.tenant_id || null
    };

    console.log('📊 Token expires at:', new Date(tokenCache.expiresAt).toISOString());
    console.log('✅ Token cached for future use');

    return tokenCache.accessToken;

  } catch (error) {
    console.error('❌ Failed to get access token:', error.response?.data || error.message);

    // Detailed error logging
    if (error.response) {
      console.error('📊 Error Status:', error.response.status);
      console.error('📊 Error Data:', JSON.stringify(error.response.data, null, 2));
    }

    throw new Error(`Failed to get Xero access token: ${error.response?.data?.error || error.message}`);
  }
}

/**
 * Get current token info (for debugging)
 */
function getTokenInfo() {
  return {
    hasToken: !!tokenCache.accessToken,
    expiresAt: tokenCache.expiresAt ? new Date(tokenCache.expiresAt).toISOString() : null,
    isExpired: tokenCache.expiresAt ? Date.now() >= tokenCache.expiresAt : true,
    tenantId: tokenCache.tenantId
  };
}

/**
 * Clear token cache (for testing)
 */
function clearTokenCache() {
  console.log('🗑️  Clearing token cache...');
  tokenCache = {
    accessToken: null,
    expiresAt: null,
    tenantId: null
  };
}

module.exports = {
  getAccessToken,
  getTokenInfo,
  clearTokenCache
};
