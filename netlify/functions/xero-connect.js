const crypto = require('crypto');

exports.handler = async (event, context) => {
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
        body: JSON.stringify({
          success: false,
          error: 'session_id is required'
        })
      };
    }

    const clientId = process.env.XERO_CLIENT_ID;
    const redirectUri = process.env.XERO_REDIRECT_URI;
    const scope = process.env.XERO_SCOPE || 'accounting.transactions accounting.contacts offline_access';

    // Generate random state
    const randomState = crypto.randomBytes(16).toString('hex');
    const state = session_id + ':' + randomState;

    // Build authorization URL
    const authUrl = 'https://login.xero.com/identity/connect/authorize?' +
      'response_type=code&' +
      'client_id=' + clientId + '&' +
      'redirect_uri=' + encodeURIComponent(redirectUri) + '&' +
      'scope=' + encodeURIComponent(scope) + '&' +
      'state=' + state;

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        authorization_url: authUrl,
        state: state,
        message: 'Visit this URL to authorize Xero access'
      })
    };

  } catch (error) {
    console.error('Connect error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
