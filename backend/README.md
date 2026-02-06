# Xero OAuth Backend - Render Deployment

Minimal Express.js backend for Xero OAuth 2.0 authentication, ready to deploy on Render.

## Environment Variables

Set these in your Render Dashboard:

- `XERO_CLIENT_ID` - Your Xero app client ID
- `XERO_CLIENT_SECRET` - Your Xero app client secret
- `XERO_REDIRECT_URI` - Your Render backend URL + `/xero/callback`
  - Example: `https://your-app.onrender.com/xero/callback`
- `XERO_SCOPE` - OAuth scopes (default: `offline_access accounting.transactions accounting.contacts`)

## Deploy to Render

### Option 1: Connect GitHub Repository

1. **Push** your code to GitHub
2. **Create** a new Web Service in Render Dashboard
3. **Configure**:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. **Add Environment Variables** (see above)
5. **Deploy** - Click "Create Web Service"

### Option 2: Deploy from CLI

```bash
# Install Render CLI
npm install -g renderctl

# Deploy
renderctl deploy
```

## Important Setup Steps

### 1. Xero Developer Portal Configuration

After you get your Render URL (e.g., `https://xero-backend-abc.onrender.com`):

1. Go to: https://developer.xero.com/app/manage
2. Find your app
3. In **Redirect URI**, add:
   ```
   https://your-app.onrender.com/xero/callback
   ```
4. In **Company URL**, enter:
   ```
   https://your-app.onrender.com
   ```
5. Click **Save**

### 2. Update Environment Variables in Render

Make sure your `XERO_REDIRECT_URI` matches EXACTLY what you set in Xero Developer Portal.

## Endpoints

Once deployed, your backend will have these endpoints:

- `GET /health` - Health check
- `GET /xero/auth` - Start OAuth flow
- `GET /xero/callback` - OAuth callback (from Xero)
- `GET /xero/status` - Check connection status

## Testing Locally

Before deploying, test locally:

```bash
cd backend
npm install
npm start
```

Visit: http://localhost:4000/health

## Notes

- Render automatically assigns a PORT - the app handles this with `process.env.PORT`
- The redirect URI in Xero Developer Portal must match EXACTLY
- This backend uses in-memory storage (tokens are lost on restart)
- For production, consider adding a database for token persistence

## Troubleshooting

### Deployment fails

- Check that all environment variables are set in Render Dashboard
- Verify the build command: `npm install`
- Verify the start command: `npm start`

### OAuth callback fails

- Make sure the redirect URI matches EXACTLY in both:
  1. Render environment variables
  2. Xero Developer Portal
- Use `https://` for production deployments
