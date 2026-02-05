const axios = require('axios');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { code, state } = event.queryStringParameters || {};

    if (!code) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing authorization code' })
      };
    }

    const clientId = process.env.XERO_CLIENT_ID;
    const clientSecret = process.env.XERO_CLIENT_SECRET;
    const redirectUri = process.env.XERO_REDIRECT_URI;

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      'https://identity.xero.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const tokens = tokenResponse.data;

    // Get tenants
    const tenantsResponse = await axios.get(
      'https://api.xero.com/connections',
      {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const tenants = tenantsResponse.data;
    const tenantId = tenants[0].tenantId;
    const tenantName = tenants[0].tenantName;

    // Return HTML response with token data
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Xero Connected</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .success-icon { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #2D3748; margin-bottom: 20px; }
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
    .label { font-weight: 600; color: #4A5568; }
    .value { color: #667eea; }
    .btn {
      background: #667eea;
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      margin-top: 20px;
    }
    #tokenData { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✅</div>
    <h1>Xero Account Connected!</h1>
    <div class="info-box">
      <div class="info-item">
        <span class="label">Organization:</span>
        <span class="value">${tenantName}</span>
      </div>
      <div class="info-item">
        <span class="label">Status:</span>
        <span class="value">Ready</span>
      </div>
    </div>
    <p style="color: #718096; margin: 20px 0;">
      Your Xero account has been successfully connected.<br>
      You can now create invoices and quotations.
    </p>
    <button class="btn" onclick="sendTokenToParent()">Complete Connection</button>
    <div id="tokenData">
      ${JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in * 1000),
        tenantId: tenantId,
        tenantName: tenantName
      })}
    </div>
  </div>
  <script>
    function sendTokenToParent() {
      const tokenData = document.getElementById('tokenData').textContent;
      if (window.opener) {
        window.opener.postMessage(JSON.parse(tokenData), '*');
        window.close();
      } else {
        // Fallback: store in localStorage and redirect
        localStorage.setItem('xero_tokens', tokenData);
        window.location.href = '/';
      }
    }
  </script>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html'
      },
      body: html
    };

  } catch (error) {
    console.error('Callback error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
