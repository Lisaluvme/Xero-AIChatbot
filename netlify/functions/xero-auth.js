const crypto = require('crypto');

/**
 * Netlify Function: Initiate Xero OAuth flow
 * Returns the authorization URL for the user to connect their Xero account
 */
exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { session_id } = event.queryStringParameters || {};

    if (!session_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing session_id' })
      };
    }

    const clientId = process.env.XERO_CLIENT_ID;
    const redirectUri = process.env.XERO_REDIRECT_URI;
    const scope = process.env.XERO_SCOPE || 'openid profile email accounting.transactions accounting.contacts accounting.settings offline_access';

    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');

    // Build authorization URL
    const authUrl = new URL('https://login.xero.com/identity/connect/authorize');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('state', state);

    console.log('Authorization URL generated for session:', session_id);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        authorization_url: authUrl.toString(),
        state: state
      })
    };

  } catch (error) {
    console.error('Auth generation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
