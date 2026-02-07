/**
 * Xero API Client
 *
 * This module handles all Xero API interactions including:
 * - OAuth2 authentication (User flow)
 * - Machine-to-Machine (M2M) authentication
 * - Creating invoices and quotations
 * - Token refresh handling
 */

const axios = require('axios');
const crypto = require('crypto');

/**
 * M2M Authentication - Get access token directly using client credentials
 *
 * @returns {Promise<Object>} - Token response with access_token
 */
async function getM2MToken() {
  try {
    console.log('🔑 Getting M2M access token...');

    const response = await axios.post(
      'https://identity.xero.com/oauth/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.XERO_CLIENT_ID,
        client_secret: process.env.XERO_CLIENT_SECRET,
        scope: process.env.XERO_SCOPE || 'accounting.transactions accounting.contacts accounting.settings'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('✅ M2M token received successfully');
    console.log('📊 Response keys:', Object.keys(response.data));
    console.log('📊 Full response:', JSON.stringify(response.data, null, 2));

    // Calculate expiry time
    const expiresIn = response.data.expires_in || 1800;
    const expiresAt = Date.now() + (expiresIn * 1000);

    return {
      success: true,
      tokens: {
        accessToken: response.data.access_token,
        expiresIn: expiresIn,
        tokenType: response.data.token_type,
        expiresAt: expiresAt
      }
    };

  } catch (error) {
    console.error('❌ M2M token error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Generate Xero OAuth2 authorization URL
 *
 * @returns {string} - Authorization URL for user to visit
 */
function getAuthorizationUrl() {
  const clientId = process.env.XERO_CLIENT_ID;
  const redirectUri = process.env.XERO_REDIRECT_URI;
  const scope = process.env.XERO_SCOPE || 'accounting.transactions accounting.contacts accounting.settings offline_access';

  console.log('🔑 Authorization URL Parameters:');
  console.log('📊 Client ID:', clientId);
  console.log('📊 Redirect URI (raw):', redirectUri);
  console.log('📊 Redirect URI (encoded):', encodeURIComponent(redirectUri));
  console.log('📊 Scope:', scope);

  // Generate state parameter for security
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = `https://login.xero.com/identity/connect/authorize?` +
    `response_type=code&` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scope)}&` +
    `state=${state}`;

  console.log('📊 Full Authorization URL:', authUrl);

  return { url: authUrl, state: state };
}

/**
 * Exchange authorization code for access token
 *
 * @param {string} code - Authorization code from callback
 * @returns {Promise<Object>} - Token response with access_token, refresh_token, etc.
 */
async function exchangeCodeForToken(code) {
  try {
    console.log('🔑 Exchanging code for token...');
    console.log('📊 Token URL: https://identity.xero.com/oauth/token');
    console.log('📊 Redirect URI:', process.env.XERO_REDIRECT_URI);
    console.log('📊 Client ID:', process.env.XERO_CLIENT_ID?.substring(0, 10) + '...');
    console.log('📊 Authorization Code (first 20 chars):', code.substring(0, 20) + '...');
    console.log('📊 Grant Type: authorization_code');

    const requestData = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.XERO_REDIRECT_URI,
      client_id: process.env.XERO_CLIENT_ID,
      client_secret: process.env.XERO_CLIENT_SECRET
    };

    console.log('📊 Request parameters:', {
      grant_type: requestData.grant_type,
      code: requestData.code.substring(0, 20) + '...',
      redirect_uri: requestData.redirect_uri,
      client_id: requestData.client_id.substring(0, 10) + '...',
      client_secret: requestData.client_secret ? '***SET***' : '***MISSING***'
    });

    const response = await axios.post(
      'https://identity.xero.com/oauth/token',
      new URLSearchParams(requestData),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    // Check if response is HTML (error) instead of JSON
    const responseType = response.headers['content-type'];
    console.log('📊 Response status:', response.status);
    console.log('📊 Content-Type:', responseType);

    if (responseType && responseType.includes('text/html')) {
      console.error('❌ Received HTML instead of JSON - Xero rejected the token request');
      console.error('📊 Response data type:', typeof response.data);
      console.error('📊 First 800 chars of HTML response:');
      const htmlPreview = typeof response.data === 'string'
        ? response.data.substring(0, 800)
        : JSON.stringify(response.data).substring(0, 800);
      console.error(htmlPreview);
      console.error('\n📊 This usually means:');
      console.error('   1. Client ID or Client Secret is incorrect');
      console.error('   2. Redirect URI does not match Xero app settings');
      console.error('   3. Authorization code has already been used');

      return {
        success: false,
        error: 'Invalid Xero credentials or redirect URI mismatch'
      };
    }

    // Log the full response structure (sanitized)
    console.log('✅ Token received!');
    console.log('📊 Response type:', typeof response.data);
    console.log('📊 Is object:', typeof response.data === 'object');
    console.log('📊 Response keys:', Object.keys(response.data));
    console.log('📊 Has access_token:', !!response.data.access_token);
    console.log('📊 Has refresh_token:', !!response.data.refresh_token);
    console.log('📊 Has scope:', 'scope' in response.data);
    console.log('📊 Has expires_in:', 'expires_in' in response.data);

    if (response.data.scope) {
      console.log('✅ Token scopes:', response.data.scope);
    } else {
      console.log('⚠️  No scope in response');
    }

    if (response.data.expires_in) {
      console.log('📊 Expires in:', response.data.expires_in, 'seconds');
    } else {
      console.log('⚠️  No expires_in in response, using default 1800 seconds');
    }

    // Calculate expiry time (expires_in is in seconds)
    const expiresIn = response.data.expires_in || 1800; // Default to 30 minutes if not provided
    const expiresAt = Date.now() + (expiresIn * 1000);

    console.log('📊 Token expires at:', new Date(expiresAt).toISOString());

    const tokenData = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: expiresIn,
      tokenType: response.data.token_type,
      expiresAt: expiresAt
    };

    return {
      success: true,
      tokens: tokenData
    };

  } catch (error) {
    console.error('❌ Token exchange error:', error.message);

    // Log detailed response information
    if (error.response) {
      console.error('📊 Response status:', error.response.status);
      console.error('📊 Response status text:', error.response.statusText);
      console.error('📊 Response headers:', JSON.stringify(error.response.headers, null, 2));

      // Check if response is HTML
      const contentType = error.response.headers['content-type'];
      if (contentType && contentType.includes('text/html')) {
        console.error('❌ Response is HTML (not JSON) - Xero rejected the request');
        console.error('📊 First 500 chars of response:');
        const responseData = error.response.data;
        const preview = typeof responseData === 'string'
          ? responseData.substring(0, 500)
          : JSON.stringify(responseData).substring(0, 500);
        console.error(preview);
      }

      // Log response data
      if (error.response.data) {
        console.error('📊 Response data type:', typeof error.response.data);
        if (typeof error.response.data === 'object') {
          console.error('📊 Response data:', JSON.stringify(error.response.data, null, 2));
        }
      }
    }

    // Detailed troubleshooting steps
    console.error('\n🔧 TROUBLESHOOTING STEPS:');
    console.error('1. Verify Client ID:', process.env.XERO_CLIENT_ID?.substring(0, 10) + '...');
    console.error('2. Verify Client Secret is set:', !!process.env.XERO_CLIENT_SECRET);
    console.error('3. Verify Redirect URI:', process.env.XERO_REDIRECT_URI);
    console.error('4. Check Xero app at https://developer.xero.com/app/...');
    console.error('   - Redirect URI must match EXACTLY (including https:// and trailing slash)');
    console.error('   - Auth callback URL should be:', process.env.XERO_REDIRECT_URI);
    console.error('5. Ensure authorization code is fresh (not reused)\n');

    if (error.response?.status === 401) {
      return {
        success: false,
        error: 'Authentication failed: Invalid Client ID, Client Secret, or Redirect URI'
      };
    }

    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Refresh access token using refresh token
 *
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} - New token response
 */
async function refreshAccessToken(refreshToken) {
  try {
    console.log('🔄 Calling Xero token refresh endpoint...');

    const response = await axios.post(
      'https://identity.xero.com/oauth/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.XERO_CLIENT_ID,
        client_secret: process.env.XERO_CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('✅ Refresh token received');

    // Calculate expiry time (expires_in is in seconds)
    const expiresIn = response.data.expires_in || 1800; // Default to 30 minutes
    const expiresAt = Date.now() + (expiresIn * 1000);

    console.log('📊 New token expires in:', expiresIn, 'seconds');
    console.log('📊 New token expires at:', new Date(expiresAt).toISOString());

    const tokenData = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken, // Use old refresh token if new one not provided
      expiresIn: expiresIn,
      tokenType: response.data.token_type,
      expiresAt: expiresAt
    };

    return {
      success: true,
      tokens: tokenData
    };

  } catch (error) {
    console.error('❌ Token refresh error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Get all tenants for the authenticated Xero organization
 *
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Object>} - List of tenants
 */
async function getTenants(accessToken) {
  try {
    console.log('🔑 Fetching tenants from Xero Connections API...');

    if (!accessToken) {
      throw new Error('Access token is missing');
    }

    const response = await axios.get(
      'https://api.xero.com/Connections',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Successfully retrieved ${response.data.length} tenants`);

    return {
      success: true,
      tenants: response.data
    };

  } catch (error) {
    console.error('❌ Get tenants error:', error.response?.data || error.message);

    // Detailed error logging
    if (error.response?.status === 401) {
      console.error('❌ 401 Unauthorized - Token may be invalid or expired');
      if (accessToken) {
        console.error('📊 Token (first 30 chars):', accessToken.substring(0, 30) + '...');
      } else {
        console.error('📊 Token is: MISSING or UNDEFINED');
      }
    }

    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

/**
 * Create an invoice or quotation in Xero
 *
 * @param {Object} invoiceData - Invoice/quotation data
 * @param {string} accessToken - Valid access token
 * @param {string} tenantId - Xero tenant ID
 * @returns {Promise<Object>} - Created invoice response
 */
async function createInvoice(invoiceData, accessToken, tenantId) {
  try {
    // Build Xero API invoice object
    const xeroInvoice = {
      Type: invoiceData.type || 'ACCREC', // ACCREC = Accounts Receivable
      Contact: {
        Name: invoiceData.customer_name || 'Customer',
        ContactNumber: invoiceData.customer_code || ''
      },
      Date: invoiceData.date || new Date().toISOString().split('T')[0],
      DueDate: invoiceData.due_date || invoiceData.date,
      LineItems: invoiceData.line_items.map(item => ({
        Description: item.description,
        Quantity: item.quantity || 1,
        UnitAmount: item.unit_amount || 0,
        TaxType: item.tax_type || 'NONE',
        AccountCode: item.account_code || '200'
      })),
      Status: invoiceData.status || 'DRAFT', // DRAFT or SUBMITTED
      Reference: invoiceData.reference || '',
      CurrencyCode: invoiceData.currency_code || 'MYR'
    };

    // Add line amount types if provided
    if (invoiceData.line_amount_types) {
      xeroInvoice.LineAmountTypes = invoiceData.line_amount_types;
    }

    // Make API request to create invoice
    const response = await axios.put(
      `https://api.xero.com/api.xro/2.0/Invoices`,
      { Invoices: [xeroInvoice] },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    return {
      success: true,
      invoice: response.data.Invoices[0],
      message: 'Invoice/Quotation created successfully in Xero'
    };

  } catch (error) {
    console.error('Create invoice error:', error.response?.data || error.message);

    // Extract Xero error messages
    let errorMessage = 'Failed to create invoice in Xero';
    if (error.response?.data?.Problem) {
      const problems = error.response.data.Problem;
      if (Array.isArray(problems)) {
        errorMessage = problems.map(p => p.Message).join(', ');
      } else {
        errorMessage = problems.Message || errorMessage;
      }
    }

    return {
      success: false,
      error: errorMessage,
      details: error.response?.data
    };
  }
}

/**
 * Get contact by name or create new one
 *
 * @param {string} contactName - Contact name to search
 * @param {string} accessToken - Valid access token
 * @param {string} tenantId - Xero tenant ID
 * @returns {Promise<Object>} - Contact data
 */
async function getOrCreateContact(contactName, accessToken, tenantId) {
  try {
    // First, try to find existing contact
    const searchResponse = await axios.get(
      `https://api.xero.com/api.xro/2.0/Contacts?where=Name=="${encodeURIComponent(contactName)}"`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Accept': 'application/json'
        }
      }
    );

    if (searchResponse.data.Contacts && searchResponse.data.Contacts.length > 0) {
      return {
        success: true,
        contact: searchResponse.data.Contacts[0],
        created: false
      };
    }

    // If not found, create new contact
    const createResponse = await axios.put(
      `https://api.xero.com/api.xro/2.0/Contacts`,
      {
        Contacts: [{
          Name: contactName
        }]
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    return {
      success: true,
      contact: createResponse.data.Contacts[0],
      created: true
    };

  } catch (error) {
    console.error('Contact operation error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Get all invoices (with optional filtering)
 *
 * @param {string} accessToken - Valid access token
 * @param {string} tenantId - Xero tenant ID
 * @param {Object} filters - Optional filters (status, date, etc.)
 * @returns {Promise<Object>} - List of invoices
 */
async function getInvoices(accessToken, tenantId, filters = {}) {
  try {
    let url = 'https://api.xero.com/api.xro/2.0/Invoices';

    // Add query parameters if provided
    const params = [];
    if (filters.status) {
      params.push(`Status=${filters.status}`);
    }
    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        'Accept': 'application/json'
      }
    });

    return {
      success: true,
      invoices: response.data.Invoices || []
    };

  } catch (error) {
    console.error('Get invoices error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

module.exports = {
  getAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  getM2MToken,  // M2M authentication
  getTenants,
  createInvoice,
  getOrCreateContact,
  getInvoices
};
