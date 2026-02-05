# 🚀 Deployment Guide - Xero AI Chatbot

Complete guide for deploying the Xero AI Chatbot with **Backend → Render** and **Frontend → Netlify**.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Backend Setup (Render)](#backend-setup-render)
4. [Frontend Setup (Netlify)](#frontend-setup-netlify)
5. [Xero OAuth Configuration](#xero-oauth-configuration)
6. [Testing the Deployment](#testing-the-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

- [ ] **Render Account** - https://render.com (free tier available)
- [ ] **Netlify Account** - https://netlify.com (free tier available)
- [ ] **Xero Developer Account** - https://developer.xero.com/
- [ ] **Zhipu AI Account** - https://open.bigmodel.cn/

### Required API Keys

- [ ] GLM-4-Flash API Key
- [ ] Xero Client ID
- [ ] Xero Client Secret

---

## Project Structure

```
xero-chatbot/
├── backend/                 # Backend for Render deployment
│   ├── server.js           # Express server
│   ├── glmClient.js        # GLM-4-Flash client
│   ├── xeroClient.js       # Xero API client
│   ├── package.json
│   └── .env.example
│
├── frontend/               # Frontend for Netlify deployment
│   ├── index.html          # Main HTML
│   ├── style.css           # Styles
│   ├── app.js              # Frontend JavaScript
│   ├── package.json
│   └── netlify.toml        # Netlify configuration
│
└── DEPLOYMENT.md           # This file
```

---

## Backend Setup (Render)

### Step 1: Prepare Backend for Deployment

Navigate to the backend folder:

```bash
cd /Users/mgmadmin/Desktop/Xero\ Chatbot/backend
```

### Step 2: Create `.env` File

```bash
# Copy .env.example to .env
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# GLM-4-Flash API
GLM_API_KEY=your_glm_api_key_here

# Xero OAuth (we'll update the redirect URI after deployment)
XERO_CLIENT_ID=your_xero_client_id
XERO_CLIENT_SECRET=your_xero_client_secret
XERO_REDIRECT_URI=https://your-backend.onrender.com/callback
XERO_SCOPE=accounting.transactions accounting.contacts accounting.settings offline_access

# Server
PORT=3000
NODE_ENV=production

# CORS (we'll update after frontend deployment)
FRONTEND_URL=https://your-frontend.netlify.app
```

### Step 3: Create `render.yaml` Configuration

Create a file named `render.yaml` in the backend folder:

```yaml
services:
  - type: web
    name: xero-chatbot-backend
    env: node
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
```

### Step 4: Deploy to Render

#### Option A: Via Render Dashboard (Recommended for first time)

1. Go to https://dashboard.render.com/
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `xero-chatbot-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Root Directory**: `backend`
5. Add Environment Variables (from your `.env`):
   - `GLM_API_KEY`
   - `XERO_CLIENT_ID`
   - `XERO_CLIENT_SECRET`
   - `XERO_REDIRECT_URI` (use: `https://xero-chatbot-backend.onrender.com/callback`)
   - `XERO_SCOPE`
   - `FRONTEND_URL` (leave blank for now, update after frontend deployment)
6. Click **"Deploy"**

#### Option B: Via Render CLI

```bash
# Install Render CLI
npm install -g render-cli

# Login
render login

# Deploy
render deploy --src ./backend
```

### Step 5: Note Your Backend URL

After deployment, Render will provide:
```
https://xero-chatbot-backend.onrender.com
```

**Copy this URL** - you'll need it for:
- Xero Redirect URI
- Frontend configuration

---

## Frontend Setup (Netlify)

### Step 1: Update Backend URL in Frontend

Edit `frontend/app.js`:

```javascript
// Find this line (around line 10):
const API_BASE_URL = 'http://localhost:3000';

// Change to your Render backend URL:
const API_BASE_URL = 'https://xero-chatbot-backend.onrender.com';
```

### Step 2: Deploy to Netlify

#### Option A: Drag & Drop (Easiest)

1. Go to https://app.netlify.com/
2. Open the frontend folder in your file manager:
   ```
   /Users/mgmadmin/Desktop/Xero Chatbot/frontend
   ```
3. Drag the entire `frontend` folder and drop it into Netlify
4. Netlify will deploy instantly
5. Note your URL: `https://your-frontend-name.netlify.app`

#### Option B: Via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Navigate to frontend folder
cd /Users/mgmadmin/Desktop/Xero\ Chatbot/frontend

# Login
netlify login

# Initialize
netlify init

# Deploy
netlify deploy --prod
```

#### Option C: Via GitHub (Recommended for updates)

1. Push frontend code to GitHub
2. In Netlify Dashboard → **"New site from Git"**
3. Select your repository
4. Configure:
   - **Build command**: (leave empty)
   - **Publish directory**: `frontend`
   - **Branch**: `main`
5. Click **"Deploy site"**

### Step 3: Note Your Frontend URL

After deployment, Netlify will provide:
```
https://amazing-xero-chatbot.netlify.app
```

---

## Xero OAuth Configuration

### Step 1: Update Xero App Redirect URI

1. Go to https://developer.xero.com/app/
2. Select your app
3. Go to **"Configuration"**
4. Add your Render backend URL to **Redirect URIs**:
   ```
   https://xero-chatbot-backend.onrender.com/callback
   ```
5. Click **"Save"**

### Step 2: Update Backend CORS Settings

In your Render Dashboard:

1. Go to your web service
2. **"Environment"** tab
3. Add/update environment variable:
   ```
   FRONTEND_URL=https://your-frontend.netlify.app
   ```
4. Click **"Save Changes"**
5. Render will automatically restart the service

### Step 3: Test the Connection

1. Visit your frontend: `https://your-frontend.netlify.app`
2. Click **"Connect Xero"** button
3. You should be redirected to Xero authorization page
4. Authorize the app
5. You should see success message

---

## Testing the Deployment

### Test 1: Health Check

```bash
# Backend health
curl https://xero-chatbot-backend.onrender.com/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2026-01-29T...",
#   "service": "Xero Chatbot Backend"
# }
```

### Test 2: Chat Endpoint

```bash
curl -X POST https://xero-chatbot-backend.onrender.com/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello! What can you do?",
    "session_id": "test123"
  }'
```

### Test 3: Frontend Connection

1. Open your frontend URL in browser
2. Send a message: "Hello!"
3. You should receive a response

### Test 4: Xero Connection

1. Click **"Connect Xero"** button
2. Authorize in Xero
3. Status should change to **"Xero Connected"**
4. Try creating an invoice

### Test 5: Invoice Creation

Send this message:
```
Create an invoice for ABC Company, 2 items: Web Design RM2000, Hosting RM500
```

Expected:
- AI confirms details
- Invoice created in Xero
- Success modal appears

---

## Troubleshooting

### Issue 1: CORS Errors

**Error**: "Access to fetch blocked by CORS policy"

**Solution**:
1. In Render Dashboard, update `FRONTEND_URL` environment variable
2. Ensure exact URL: `https://your-frontend.netlify.app`
3. No trailing slash
4. Restart the service

### Issue 2: Xero OAuth Fails

**Error**: "Invalid redirect_uri"

**Solution**:
1. Check Xero app settings
2. Ensure Redirect URI matches exactly: `https://your-backend.onrender.com/callback`
3. No trailing slash
4. Wait 5-10 minutes for Xero changes to take effect

### Issue 3: "Xero Not Connected"

**Error**: Status shows "Xero Not Connected" after authorization

**Solutions**:
1. Check browser console for errors
2. Verify backend `/callback` endpoint is accessible
3. Check Render logs for errors
4. Clear browser cache and try again

### Issue 4: Invoice Creation Fails

**Error**: "Failed to create invoice in Xero"

**Solutions**:
1. Ensure Xero account is connected
2. Check Xero API limits (free tier: 1000 calls/month)
3. Verify customer name exists in Xero
4. Check Render logs for detailed error
5. Try again after a few seconds

### Issue 5: Frontend Can't Reach Backend

**Error**: Network error when sending messages

**Solutions**:
1. Verify `API_BASE_URL` in `frontend/app.js` is correct
2. Check backend is deployed and running
3. Test backend health endpoint directly
4. Check Render logs for errors

### Issue 6: Token Refresh Fails

**Error**: "Token refresh failed"

**Solutions**:
1. Disconnect and reconnect Xero account
2. Check Xero app scopes are correct
3. Verify `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET` are correct
4. Check Render logs for OAuth errors

---

## Environment Variables Reference

### Backend Environment Variables

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `GLM_API_KEY` | ✅ | `your_glm_api_key` | Zhipu AI API key |
| `XERO_CLIENT_ID` | ✅ | `ABC123XYZ` | Xero OAuth client ID |
| `XERO_CLIENT_SECRET` | ✅ | `secret123` | Xero OAuth secret |
| `XERO_REDIRECT_URI` | ✅ | `https://.../callback` | OAuth callback URL |
| `XERO_SCOPE` | ✅ | `accounting.transactions...` | API permissions |
| `PORT` | ❌ | `3000` | Server port (auto-set by Render) |
| `FRONTEND_URL` | ✅ | `https://...netlify.app` | CORS allowed origin |
| `NODE_ENV` | ❌ | `production` | Environment mode |

---

## Production Checklist

Before going live, ensure:

- [ ] Backend deployed to Render
- [ ] Frontend deployed to Netlify
- [ ] `API_BASE_URL` updated in frontend
- [ ] Xero Redirect URI configured
- [ ] CORS configured (`FRONTEND_URL` in Render)
- [ ] All environment variables set
- [ ] Health check endpoint working
- [ ] Xero OAuth flow tested
- [ ] Invoice creation tested
- [ ] Error handling tested
- [ ] SSL/HTTPS enabled (automatic on Netlify/Render)

---

## Next Steps

1. **Monitor Usage**: Check Render and Netlify dashboards regularly
2. **Set Up Alerts**: Configure email alerts for errors
3. **Customize Branding**: Update frontend with your logo/colors
4. **Add Features**: Extend the chatbot with more capabilities
5. **Scale Up**: Upgrade plans as needed

---

## Support

- **Render Docs**: https://render.com/docs
- **Netlify Docs**: https://docs.netlify.com/
- **Xero API Docs**: https://developer.xero.com/documentation/
- **GLM-4-Flash Docs**: https://open.bigmodel.cn/dev/api

---

**Last Updated**: 2026-01-29
**Version**: 1.0.0
