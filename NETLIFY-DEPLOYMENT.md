# Netlify Deployment Guide

## Prerequisites
- Netlify account (free tier works)
- GitHub account
- Xero Developer account with app configured

## Step 1: Prepare Your Repository

1. **Create a GitHub repository** (if you haven't already)
   - Go to https://github.com/new
   - Create a new repo (e.g., "xero-chatbot")
   - Don't initialize with README

2. **Push your code to GitHub**
   ```bash
   cd "/Users/mgmadmin/Desktop/Xero Chatbot"
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/xero-chatbot.git
   git push -u origin main
   ```

## Step 2: Deploy to Netlify

### Option A: Deploy via Netlify CLI (Recommended)

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**
   ```bash
   netlify login
   ```

3. **Deploy from your project directory**
   ```bash
   cd "/Users/mgmadmin/Desktop/Xero Chatbot"
   netlify deploy --prod
   ```

4. **Your site will be live at:**
   - `https://your-site-name.netlify.app`

### Option B: Deploy via Netlify Dashboard

1. Go to https://app.netlify.com/start

2. **"Deploy manually"**
   - Choose your deployment method: **GitHub**
   - Select your repository: `xero-chatbot`
   - Configure build settings:
     - Branch to deploy: `main`
     - Build command: (leave empty)
     - Publish directory: `frontend`

3. **Click "Deploy site"**

## Step 3: Configure Environment Variables

### In Netlify Dashboard:

1. Go to your site in Netlify
2. Click **Site settings** → **Environment variables**
3. Add the following variables:

```
XERO_CLIENT_ID=your_xero_client_id
XERO_CLIENT_SECRET=your_xero_client_secret
XERO_REDIRECT_URI=https://your-site-name.netlify.app/.netlify/functions/xero-callback
XERO_SCOPE=openid profile email accounting.transactions accounting.contacts accounting.settings offline_access
GLM_API_KEY=your_glm_api_key
```

**IMPORTANT:** Replace `your-site-name` with your actual Netlify site name!

## Step 4: Update Xero Developer Portal

1. Go to: https://developer.xero.com/app/manage
2. Find your app: **"AI Chatbot"**
3. **Update Redirect URIs:**
   - Remove any `localhost` URLs
   - Add: `https://your-site-name.netlify.app/.netlify/functions/xero-callback`
4. **Update Company URL:**
   - Change to: `https://your-site-name.netlify.app`

## Step 5: Test Your Deployed App

1. Visit: `https://your-site-name.netlify.app`
2. Click "Connect to Xero"
3. Authorize the app
4. Start chatting!

## Troubleshooting

### Issue: "Invalid redirect_uri"
- Make sure the redirect URI in Xero Portal matches your Netlify URL EXACTLY
- Include `/.netlify/functions/xero-callback` at the end

### Issue: Environment variables not working
- Make sure you've set them in Netlify Dashboard (Site settings → Environment variables)
- Redeploy after adding environment variables

### Issue: Netlify Functions not working
- Check Netlify Functions logs in Dashboard
- Make sure all dependencies are in `package.json`

## Current Configuration

✅ **Backend**: Netlify Functions (serverless)
✅ **Frontend**: Netlify Static Site
✅ **Xero Integration**: Full OAuth2 with token management
✅ **AI**: Groq API for chat functionality

---

**Need help?** Check the Netlify documentation or the README.md file.
