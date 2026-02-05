# Xero AI Chatbot - Deployment Guide

## 🚀 Quick Start

### Option 1: Deploy Backend + Frontend Separately (Recommended)

#### Backend (Render.com)

1. **Create a new Web Service on Render.com**
   - Go to https://render.com
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select the `Xero-AIChatbot` repository

2. **Configure Build Settings**
   ```
   Root Directory: backend
   Build Command: npm install
   Start Command: npm start
   Environment: Node 18
   ```

3. **Set Environment Variables** (in Render Dashboard)
   ```
   GROQ_API_KEY=your_groq_api_key_here
   GLM_API_KEY=your_glm_api_key_here
   XERO_CLIENT_ID=your_xero_client_id
   XERO_CLIENT_SECRET=your_xero_client_secret
   XERO_REDIRECT_URI=https://your-render-app-url.onrender.com/callback
   XERO_SCOPE=accounting.transactions accounting.contacts accounting.settings offline_access
   PORT=3000
   NODE_ENV=production
   FRONTEND_URL=https://your-netlify-site.netlify.app
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Copy your Render URL (e.g., `https://xero-chatbot-backend.onrender.com`)

#### Frontend (Netlify)

1. **Update Backend URL in frontend/app.js**
   ```javascript
   // Line 22 - Update with your Render URL
   : 'https://your-actual-render-app.onrender.com';
   ```

2. **Deploy to Netlify**
   - Go to https://netlify.com
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository
   - Configure build settings:
     ```
     Build command: (leave empty)
     Publish directory: frontend
     ```
   - Click "Deploy site"

3. **Update Xero App Callback URL**
   - Go to https://developer.xero.com/app/
   - Select your app
   - Add this callback URL: `https://your-render-app.onrender.com/callback`

---

### Option 2: Netlify Functions (Serverless)

For a completely serverless setup, you can use Netlify Functions:

1. **Move backend code to netlify/functions/**
2. **Update frontend/app.js API_BASE_URL** to use `/api`
3. **Set environment variables** in Netlify dashboard

> Note: This requires more setup. See "Netlify Functions Setup" section below.

---

## 🔧 Configuration Files

### Frontend: `frontend/app.js`

The frontend automatically detects the environment:
- **Local**: Uses `https://localhost:3000`
- **Production**: Uses your Render backend URL

```javascript
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'https://localhost:3000'  // Local development
  : 'https://xero-chatbot-backend.onrender.com';  // Production - UPDATE THIS!
```

### Backend: `backend/.env`

Required environment variables:
```env
# AI API Keys (need at least one)
GROQ_API_KEY=gsk_your_key_here
GLM_API_KEY=your_key_here

# Xero OAuth
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_REDIRECT_URI=https://your-backend-url.com/callback

# Server
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://your-netlify-site.netlify.app
```

---

## 📋 Deployment Checklist

### Before Deploying

- [ ] Backend running locally on `https://localhost:3000`
- [ ] Frontend working locally on `http://127.0.0.1:8080`
- [ ] Xero OAuth flow working locally
- [ ] All API keys set in `.env`
- [ ] SSL certificates working locally

### Deploying Backend (Render)

- [ ] Create Render web service
- [ ] Set all environment variables
- [ ] Update Xero redirect URI to Render URL
- [ ] Backend deployed and accessible
- [ ] Test `/health` endpoint

### Deploying Frontend (Netlify)

- [ ] Update `API_BASE_URL` in `frontend/app.js` with Render URL
- [ ] Deploy to Netlify
- [ ] Test Netlify site loads
- [ ] Test Xero connection
- [ ] Test chat functionality

### Final Testing

- [ ] Chat responds to messages
- [ ] Xero OAuth flow works
- [ ] Can create invoices
- [ ] Can create quotations
- [ ] All features work as expected

---

## 🔒 Security Notes

### ✅ DO:

- Store API keys in environment variables
- Use HTTPS for production
- Enable CORS for your Netlify domain
- Keep `.env` files out of git (add to `.gitignore`)
- Use different API keys for production

### ❌ DON'T:

- Commit `.env` files to git
- Expose API keys in frontend code
- Use HTTP in production
- Share your Xero client secret

---

## 🐛 Troubleshooting

### Frontend loads but can't connect to backend

**Problem:** CORS error or connection refused

**Solution:**
1. Check `FRONTEND_URL` in backend `.env` matches your Netlify URL
2. Check `API_BASE_URL` in frontend points to correct backend URL
3. Verify backend is deployed and running

### Xero OAuth fails

**Problem:** "Invalid redirect_uri" error

**Solution:**
1. Check `XERO_REDIRECT_URI` in backend `.env`
2. Update Xero app settings with exact callback URL
3. URL must be exact match (including https:// and trailing paths)

### Chatbot not responding

**Problem:** No response from AI

**Solution:**
1. Check `GROQ_API_KEY` is set and valid
2. Check backend logs for errors
3. Verify API key has available credits

---

## 📱 Updating Your Deployed Site

### Backend Changes

```bash
git add backend/
git commit -m "Update backend"
git push
```

Render will auto-deploy on push.

### Frontend Changes

```bash
git add frontend/
git commit -m "Update frontend"
git push
```

Netlify will auto-deploy on push.

---

## 🌐 URLs After Deployment

Once deployed, you'll have:

- **Frontend**: `https://your-site.netlify.app`
- **Backend**: `https://your-app.onrender.com`
- **Health Check**: `https://your-app.onrender.com/health`
- **Xero Callback**: `https://your-app.onrender.com/callback`

---

## 💡 Development Workflow

### Local Development

```bash
# Terminal 1: Backend
cd backend
npm start

# Terminal 2: Frontend
cd frontend
npm run dev
```

Visit `http://127.0.0.1:8080`

### Deploying Changes

```bash
# 1. Make changes
# 2. Test locally
# 3. Commit and push
git add .
git commit -m "Description"
git push origin main

# 4. Wait for auto-deployment
# Render: ~2-5 minutes
# Netlify: ~30 seconds
```

---

## 📞 Support

If you encounter issues:

1. Check the logs:
   - Render: Dashboard → Logs
   - Netlify: Dashboard → Deploys → Click deploy → Deploy log

2. Verify environment variables

3. Test locally first

4. Check this guide's troubleshooting section

---

## 🎯 Next Steps

After initial deployment:

1. **Set up custom domain** (optional)
2. **Monitor usage** on Render/Netlify dashboards
3. **Set up alerts** for errors
4. **Backup database** if you add one
5. **Scale up** if needed (Render has paid tiers)

---

**Happy Chatting! 🤖**
