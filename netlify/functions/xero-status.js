const axios = require('axios');

/**
 * Netlify Function: Check Xero connection status
 * Returns whether the user has an active Xero session
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

    // For Netlify Functions, we can't maintain in-memory sessions
    // Check if tokens exist in the user's browser via localStorage
    // The frontend handles this, so we return a basic response

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        connected: false,
        message: 'Client-side token check required'
      })
    };

  } catch (error) {
    console.error('Status check error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
