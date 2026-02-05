# Xero Chatbot - Netlify Deployment Guide

This guide will help you deploy the Xero Chatbot to Netlify.

## Prerequisites

1. A Netlify account (free tier works)
2. Netlify CLI installed: `npm install -g netlify-cli`
3. Xero Developer account with Custom App created
4. Groq API key (free)

## Quick Start

### 1. Set Up Environment Variables

In your Netlify dashboard, go to **Site Settings > Environment Variables** and add:

```
GROQ_API_KEY=your_groq_api_key_here
XERO_CLIENT_ID=your_xero_client_id_here
XERO_CLIENT_SECRET=your_xero_client_secret_here
XERO_REDIRECT_URI=https://YOUR_SITE.netlify.app/xero/callback
XERO_SCOPE=accounting.transactions accounting.contacts accounting.settings offline_access
```

Replace `YOUR_SITE` with your actual Netlify site name.

### 2. Update Xero App Redirect URI

In your Xero Developer dashboard:
1. Go to your app settings
2. Add the redirect URI: `https://YOUR_SITE.netlify.app/xero/callback`
3. Save changes

### 3. Deploy to Netlify

#### Option A: Deploy via Netlify CLI (Recommended)

```bash
# Navigate to project root
cd "/Users/mgmadmin/Desktop/Xero Chatbot"

# Login to Netlify
netlify login

# Initialize site
netlify init

# Deploy
netlify deploy --prod
```

#### Option B: Deploy via Git

1. Push your code to GitHub/GitLab/Bitbucket
2. In Netlify dashboard, click "New Site from Git"
3. Connect your repository
4. Configure build settings:
   - **Publish directory**: `frontend`
   - **Functions directory**: `netlify/functions`
5. Add environment variables (see step 1)
6. Deploy!

### 4. Test the Deployment

1. Visit your Netlify URL
2. Click "Connect Xero" button
3. Authorize the Xero app
4. Try creating an invoice or quotation

## Project Structure

```
Xero Chatbot/
├── frontend/              # Static HTML/CSS/JS files
│   ├── index.html
│   ├── style.css
│   └── app.js
├── backend/              # Original Express server (for reference)
│   ├── server.js
│   ├── xeroClient.js
│   ├── glmClient.js
│   └── .env
├── netlify/              # Netlify Functions
│   └── functions/
│       ├── chat.js
│       ├── xero-connect.js
│       ├── xero-callback.js
│       └── status.js
└── netlify.toml          # Netlify configuration
```

## Netlify Functions

- **chat.js**: Main chat endpoint, handles AI responses and invoice/quotation creation
- **xero-connect.js**: Initiates Xero OAuth flow
- **xero-callback.js**: Handles Xero OAuth callback
- **status.js**: Checks Xero connection status

## Important Notes

1. **Session Storage**: The current implementation uses in-memory storage. For production, consider using:
   - Netlify KV (key-value store)
   - Redis
   - A database (MongoDB, PostgreSQL, etc.)

2. **Environment Variables**: Never commit `.env` files to Git. Use Netlify environment variables instead.

3. **CORS**: All Netlify Functions include CORS headers to allow cross-origin requests.

4. **Xero Callback URL**: The redirect URI in Xero must match exactly:
   - `https://YOUR_SITE.netlify.app/xero/callback`
   - Note: `/xero/callback` (not `/callback`)

## Troubleshooting

### Issue: "No access_token in response"

**Solution**: Make sure the redirect URI in Xero matches exactly with the one in environment variables. Also verify the Client Secret is correct.

### Issue: "Session not found"

**Solution**: Current implementation uses in-memory storage. Each new deployment resets sessions. Consider using persistent storage for production.

### Issue: "Invalid redirect_uri"

**Solution**: Update your Xero app settings with the correct Netlify URL including the path `/xero/callback`.

### Issue: Functions not found

**Solution**: Ensure `netlify.toml` has the correct functions directory configured:
```toml
[build]
  functions = "netlify/functions"
```

## Local Development

To test Netlify Functions locally:

```bash
# Install dependencies
cd "/Users/mgmadmin/Desktop/Xero Chatbot/backend"
npm install

# Start Netlify dev server
cd ..
netlify dev
```

This will run the frontend on port 8888 and functions locally.

## Production Checklist

- [ ] Environment variables configured in Netlify
- [ ] Xero app redirect URI updated to production URL
- [ ] Test Xero OAuth flow
- [ ] Test invoice creation
- [ ] Test quotation creation
- [ ] Add persistent session storage
- [ ] Set up monitoring/logging (Netlify logs available in dashboard)

## Support

For issues related to:
- **Xero API**: https://developer.xero.com/documentation
- **Netlify Functions**: https://docs.netlify.com/functions/
- **Groq API**: https://console.groq.com/
