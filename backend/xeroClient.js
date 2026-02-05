/**
 * Xero API Client
 *
 * This module handles all Xero API interactions including:
 * - OAuth 2.0 authentication flow
 * - Token refresh handling
 * - Creating invoices and quotations
 * - Managing contacts
 *
 * API Documentation: https://developer.xero.com/documentation/
 */

const axios = require('axios');
const crypto = require('crypto');

/**
 * ==========================================
 * OAUTH 2.0 AUTHENTICATION FUNCTIONS
 * ==========================================
 */

/**
 * Generate Xero OAuth 2.0 Authorization URL
 *
 * This creates the URL where users will be redirected to grant permissions.
 *
 * @param {string} sessionId - Session ID to include in callback
 * @returns {Object} - Contains authorization URL and state parameter for CSRF protection
 */
function getAuthorizationUrl(sessionId = null) {
  const clientId = process.env.XERO_CLIENT_ID;
  const redirectUri = process.env.XERO_REDIRECT_URI;
  const scope = process.env.XERO_SCOPE || 'accounting.transactions accounting.contacts accounting.settings offline_access';

  // Generate random state parameter for security (CSRF protection)
  // Encode session_id into the state parameter so it's returned in the callback
  const randomState = crypto.randomBytes(16).toString('hex');
  const state = sessionId ? `${sessionId}:${randomState}` : randomState;

  // Build authorization URL
  // Xero OAuth 2.0 endpoint: https://login.xero.com/identity/connect/authorize
  const authUrl = `https://login.xero.com/identity/connect/authorize?` +
    `response_type=code&` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scope)}&` +
    `state=${state}`;

  return { url: authUrl, state: state };
}

/**
 * Exchange authorization code for access token
 *
 * After user authorizes, Xero redirects back with a code.
 * Exchange this code for actual access tokens.
 *
 * @param {string} code - Authorization code from callback
 * @returns {Promise<Object>} - Token response with access_token, refresh_token, expires_in
 */
async function exchangeCodeForToken(code) {
  try {
    console.log('Exchanging code for token...');
    console.log('Redirect URI:', process.env.XERO_REDIRECT_URI);
    console.log('Client ID:', process.env.XERO_CLIENT_ID);
    console.log('Code (first 20 chars):', code.substring(0, 20) + '...');

    // Token endpoint: https://identity.xero.com/connect/token
    const response = await axios.post(
      'https://identity.xero.com/connect/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.XERO_REDIRECT_URI,
        client_id: process.env.XERO_CLIENT_ID,
        client_secret: process.env.XERO_CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        // Allow redirects but track them
        maxRedirects: 5,
        beforeRedirect: (options, { headers }) => {
          console.log('Redirecting to:', options.href || options.url);
        }
      }
    );

    console.log('Token response received');
    console.log('Status:', response.status);
    console.log('Response data keys:', Object.keys(response.data));
    console.log('Full response:', JSON.stringify(response.data, null, 2));

    // Check if access_token exists
    if (!response.data.access_token) {
      throw new Error('No access_token in response');
    }

    console.log('Token type:', response.data.token_type);
    console.log('Expires in:', response.data.expires_in);

    // Extract and structure token data
    const tokenData = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type,
      expiresAt: Date.now() + (response.data.expires_in * 1000),
      // Calculate when to refresh (5 minutes before expiry)
      refreshAt: Date.now() + ((response.data.expires_in - 300) * 1000)
    };

    return {
      success: true,
      tokens: tokenData
    };

  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error_description || error.message
    };
  }
}

/**
 * Refresh access token using refresh token
 *
 * Xero access tokens expire after 30 minutes.
 * Use the refresh token to get a new access token without user interaction.
 *
 * @param {string} refreshToken - Refresh token from initial authorization
 * @returns {Promise<Object>} - New token response
 */
async function refreshAccessToken(refreshToken) {
  try {
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

    const tokenData = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type,
      expiresAt: Date.now() + (response.data.expires_in * 1000),
      refreshAt: Date.now() + ((response.data.expires_in - 300) * 1000)
    };

    return {
      success: true,
      tokens: tokenData
    };

  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error_description || error.message
    };
  }
}

/**
 * ==========================================
 * TENANT MANAGEMENT FUNCTIONS
 * ==========================================
 */

/**
 * Get all tenants (organizations) for authenticated user
 *
 * A Xero user can have access to multiple organizations (tenants).
 * This retrieves all available tenants.
 *
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Object>} - List of tenants
 */
async function getTenants(accessToken) {
  try {
    console.log('Fetching tenants...');
    console.log('Access token (first 20 chars):', accessToken.substring(0, 20) + '...');

    // Connections endpoint: https://api.xero.com/Connections
    const response = await axios.get(
      'https://api.xero.com/Connections',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Tenants fetched successfully:', response.data.length);

    return {
      success: true,
      tenants: response.data
    };

  } catch (error) {
    console.error('Get tenants error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
}

/**
 * ==========================================
 * INVOICE / QUOTATION FUNCTIONS
 * ==========================================
 */

/**
 * Create an invoice or quotation in Xero
 *
 * This creates a draft invoice or quotation in the specified Xero tenant.
 *
 * @param {Object} invoiceData - Invoice/quotation data from AI
 * @param {string} accessToken - Valid access token
 * @param {string} tenantId - Xero tenant ID
 * @returns {Promise<Object>} - Created invoice response
 */
async function createInvoice(invoiceData, accessToken, tenantId) {
  try {
    // Build Xero API invoice object
    const xeroInvoice = {
      Type: invoiceData.type || 'ACCREC', // ACCREC = Accounts Receivable (sales)
      Contact: {
        Name: invoiceData.customer_name || 'Customer',
        ContactNumber: invoiceData.customer_code || ''
      },
      Date: invoiceData.date || new Date().toISOString().split('T')[0],
      DueDate: invoiceData.due_date || invoiceData.date,
      LineItems: invoiceData.line_items.map(item => ({
        Description: item.description,
        Quantity: parseFloat(item.quantity) || 1,
        UnitAmount: parseFloat(item.unit_amount) || 0,
        TaxType: item.tax_type || 'NONE',
        AccountCode: item.account_code || '200'
      })),
      Status: invoiceData.status || 'DRAFT', // DRAFT, SUBMITTED, APPROVED
      Reference: invoiceData.reference || '',
      CurrencyCode: invoiceData.currency_code || 'MYR'
    };

    // Add line amount type if specified
    if (invoiceData.line_amount_types) {
      xeroInvoice.LineAmountType = invoiceData.line_amount_types;
    }

    // Make API request to create invoice
    // Invoices endpoint: https://api.xero.com/api.xro/2.0/Invoices
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

    // Extract created invoice
    const createdInvoice = response.data.Invoices[0];

    // Generate Xero URL for viewing the invoice
    const invoiceUrl = `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${createdInvoice.InvoiceID}`;

    return {
      success: true,
      invoice: createdInvoice,
      invoiceUrl: invoiceUrl,
      message: 'Invoice/Quotation created successfully in Xero'
    };

  } catch (error) {
    console.error('Create invoice error:', error.response?.data || error.message);

    // Extract meaningful error messages from Xero
    let errorMessage = 'Failed to create invoice in Xero';

    if (error.response?.data) {
      const xeroError = error.response.data;

      // Xero returns validation errors in different formats
      if (xeroError.Problem) {
        if (Array.isArray(xeroError.Problem)) {
          errorMessage = xeroError.Problem.map(p => p.Message).join('; ');
        } else {
          errorMessage = xeroError.Problem.Message || errorMessage;
        }
      } else if (xeroError.detail) {
        errorMessage = xeroError.detail;
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
 * Create a quotation in Xero
 *
 * Xero Quotes are separate from Invoices and use different endpoint.
 *
 * @param {Object} quotationData - Quotation data from AI
 * @param {string} accessToken - Valid access token
 * @param {string} tenantId - Xero tenant ID
 * @returns {Promise<Object>} - Created quotation response
 */
async function createQuotation(quotationData, accessToken, tenantId) {
  try {
    // Build Xero API quote object
    const xeroQuote = {
      Type: 'ACCREC', // Quotes are always ACCREC
      Contact: {
        Name: quotationData.contact_name || quotationData.customer_name || 'Customer',
        ContactNumber: quotationData.contact_code || quotationData.customer_code || ''
      },
      Date: quotationData.date || new Date().toISOString().split('T')[0],
      ExpiryDate: quotationData.expiry_date || quotationData.due_date || quotationData.date,
      LineItems: quotationData.line_items.map(item => ({
        Description: item.description,
        Quantity: parseFloat(item.quantity) || 1,
        UnitAmount: parseFloat(item.unit_amount) || 0,
        TaxType: item.tax_type || 'NONE',
        AccountCode: item.account_code || '200'
      })),
      Status: quotationData.status || 'DRAFT',
      Reference: quotationData.reference || quotationData.quote_number || '',
      CurrencyCode: quotationData.currency_code || 'MYR',
      LineAmountTypes: quotationData.line_amount_types || 'Exclusive' // Tax exclusive by default
    };

    // Add line amount type if specified
    if (quotationData.line_amount_types) {
      xeroQuote.LineAmountTypes = quotationData.line_amount_types;
    }

    // Make API request to create quotation
    // Quotes endpoint: https://api.xero.com/api.xro/2.0/Quotes
    const response = await axios.put(
      `https://api.xero.com/api.xro/2.0/Quotes`,
      { Quotes: [xeroQuote] },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    // Extract created quote
    const createdQuote = response.data.Quotes[0];

    // Generate Xero URL for viewing the quote
    const quoteUrl = `https://go.xero.com/Quotes/View.aspx?QuoteID=${createdQuote.QuoteID}`;

    return {
      success: true,
      quote: createdQuote,
      quotationUrl: quoteUrl,
      quoteNumber: createdQuote.QuoteNumber,
      message: 'Quotation created successfully in Xero'
    };

  } catch (error) {
    console.error('Create quotation error:', error.response?.data || error.message);

    // Extract meaningful error messages from Xero
    let errorMessage = 'Failed to create quotation in Xero';

    if (error.response?.data) {
      const xeroError = error.response.data;

      if (xeroError.Problem) {
        if (Array.isArray(xeroError.Problem)) {
          errorMessage = xeroError.Problem.map(p => p.Message).join('; ');
        } else {
          errorMessage = xeroError.Problem.Message || errorMessage;
        }
      } else if (xeroError.detail) {
        errorMessage = xeroError.detail;
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
 * ==========================================
 * CONTACT FUNCTIONS
 * ==========================================
 */

/**
 * Get existing contact or create new one
 *
 * This searches for a contact by name. If not found, creates a new one.
 *
 * @param {string} contactName - Contact name to search/create
 * @param {string} accessToken - Valid access token
 * @param {string} tenantId - Xero tenant ID
 * @returns {Promise<Object>} - Contact data
 */
async function getOrCreateContact(contactName, accessToken, tenantId) {
  try {
    // First, try to find existing contact
    // Contacts endpoint: https://api.xero.com/api.xro/2.0/Contacts
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

    // If contact found, return it
    if (searchResponse.data.Contacts && searchResponse.data.Contacts.length > 0) {
      return {
        success: true,
        contact: searchResponse.data.Contacts[0],
        created: false,
        message: 'Existing contact found'
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
      created: true,
      message: 'New contact created'
    };

  } catch (error) {
    console.error('Contact operation error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
}

/**
 * Get all contacts from Xero
 *
 * Retrieves all contacts (customers and suppliers) from the Xero tenant.
 *
 * @param {string} accessToken - Valid access token
 * @param {string} tenantId - Xero tenant ID
 * @param {Object} options - Optional query parameters (where, order, page)
 * @returns {Promise<Object>} - List of contacts
 */
async function getContacts(accessToken, tenantId, options = {}) {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    if (options.where) params.append('where', options.where);
    if (options.order) params.append('order', options.order);
    if (options.page) params.append('page', options.page);

    const queryString = params.toString() ? `?${params.toString()}` : '';

    // Contacts endpoint: https://api.xero.com/api.xro/2.0/Contacts
    const response = await axios.get(
      `https://api.xero.com/api.xro/2.0/Contacts${queryString}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Accept': 'application/json'
        }
      }
    );

    return {
      success: true,
      contacts: response.data.Contacts || [],
      pagination: response.data.Pagination || null
    };

  } catch (error) {
    console.error('Get contacts error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
}

/**
 * Get organisation details
 *
 * Retrieves organisation information from the Xero tenant.
 *
 * @param {string} accessToken - Valid access token
 * @param {string} tenantId - Xero tenant ID
 * @returns {Promise<Object>} - Organisation details
 */
async function getOrganisation(accessToken, tenantId) {
  try {
    // Organisation endpoint: https://api.xero.com/api.xro/2.0/Organisation
    const response = await axios.get(
      `https://api.xero.com/api.xro/2.0/Organisation`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Accept': 'application/json'
        }
      }
    );

    return {
      success: true,
      organisation: response.data.Organisations[0]
    };

  } catch (error) {
    console.error('Get organisation error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
}

/**
 * ==========================================
 * UTILITY FUNCTIONS
 * ==========================================
 */

/**
 * Check if access token needs refresh
 *
 * @param {number} expiresAt - Token expiration timestamp
 * @returns {boolean} - True if token should be refreshed
 */
function needsRefresh(expiresAt) {
  // Refresh 5 minutes before expiration
  return Date.now() > (expiresAt - 300000);
}

module.exports = {
  // OAuth 2.0
  getAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  needsRefresh,

  // Tenant
  getTenants,

  // Invoices
  createInvoice,

  // Quotations
  createQuotation,

  // Contacts
  getOrCreateContact,
  getContacts,

  // Organisation
  getOrganisation
};
