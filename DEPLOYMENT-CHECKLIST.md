# Xero Chatbot - Netlify Deployment Checklist

Use this checklist to deploy your Xero Chatbot to Netlify successfully.

## Pre-Deployment Steps

### 1. Get Your Netlify Site URL

- [ ] Sign up/login to Netlify: https://app.netlify.com/
- [ ] Create a new site (you can do this during deployment)
- [ ] Note your site URL (e.g., `https://gentle-cookie-123456.netlify.app`)

### 2. Update Xero App Configuration

- [ ] Go to https://developer.xero.com/app/
- [ ] Open your "AI Chatbot" app
- [ ] Add your Netlify callback URL: `https://YOUR_SITE.netlify.app/xero/callback`
- [ ] Save the changes

### 3. Configure Environment Variables in Netlify

In Netlify Dashboard > Site Settings > Environment Variables > Add:

```
GROQ_API_KEY=your_groq_api_key_here
XERO_CLIENT_ID=your_xero_client_id_here
XERO_CLIENT_SECRET=your_xero_client_secret_here
XERO_REDIRECT_URI=https://YOUR_SITE.netlify.app/xero/callback
XERO_SCOPE=accounting.transactions accounting.contacts accounting.settings offline_access
```

**Important**: Replace `YOUR_SITE` with your actual Netlify site name!

## Deployment Steps

### Option A: Deploy via Netlify CLI (Recommended)

```bash
# 1. Navigate to project directory
cd "/Users/mgmadmin/Desktop/Xero Chatbot"

# 2. Login to Netlify
netlify login

# 3. Initialize site (creates .netlify folder)
netlify init

# 4. Deploy to production
npm run deploy
```

### Option B: Deploy via Git

```bash
# 1. Initialize git repository (if not already)
git init

# 2. Add all files
git add .

# 3. Commit
git commit -m "Prepare for Netlify deployment"

# 4. Push to GitHub/GitLab/Bitbucket
git remote add origin YOUR_REPO_URL
git push -u origin main

# 5. In Netlify Dashboard:
#    - Click "New Site from Git"
#    - Connect your repository
#    - Configure:
#      - Publish directory: frontend
#      - Functions directory: netlify/functions
#    - Deploy!
```

## Post-Deployment Steps

### 4. Verify Deployment

- [ ] Visit your Netlify site URL
- [ ] Check that the page loads correctly
- [ ] Check browser console for errors (F12)

### 5. Test Xero OAuth Flow

- [ ] Click "Connect Xero" button
- [ ] You should be redirected to Xero authorization page
- [ ] Authorize the app
- [ ] You should see the success page
- [ ] The chatbot should show "Xero Connected" status

### 6. Test Chat Functionality

- [ ] Send a test message: "Hello"
- [ ] Verify AI responds correctly

### 7. Test Invoice Creation

- [ ] Send: "Create an invoice for ABC Company, 2 items: Web Design RM2000, Hosting RM500"
- [ ] Verify invoice is created in Xero
- [ ] Check if invoice modal shows details
- [ ] Click "View in Xero" button to verify

## Troubleshooting

### Issue: "No access_token in response"

**Causes:**
1. Redirect URI mismatch in Xero app settings
2. Wrong Client Secret in environment variables

**Solution:**
- Verify Xero redirect URI matches exactly: `https://YOUR_SITE.netlify.app/xero/callback`
- Verify Client Secret is correct in Netlify environment variables

### Issue: "Function not found"

**Solution:**
- Ensure `netlify.toml` is in the root directory
- Verify functions directory is set to: `netlify/functions`

### Issue: Session not persisting

**Note:** This is expected behavior with in-memory storage. Each deployment resets sessions.
- For production, consider using Netlify KV or Redis

### Issue: CORS errors

**Solution:**
- All Netlify Functions include CORS headers
- If you still see CORS errors, check Netlify Functions logs

## Files Changed for Netlify Deployment

✅ Created `netlify.toml` - Netlify configuration
✅ Created `netlify/functions/chat.js` - Chat endpoint
✅ Created `netlify/functions/xero-connect.js` - OAuth initiate
✅ Created `netlify/functions/xero-callback.js` - OAuth callback
✅ Created `netlify/functions/status.js` - Connection status
✅ Updated `frontend/app.js` - Changed API_BASE_URL to Netlify Functions
✅ Updated `package.json` - Added Netlify deployment scripts
✅ Updated `.gitignore` - Added Netlify and SSL certificate patterns
✅ Created `.env.example` - Environment variable template
✅ Created `README-NETLIFY.md` - Detailed deployment guide

## Important Notes

1. **Session Storage**: Current implementation uses in-memory storage. For production, implement:
   - Netlify KV (recommended for Netlify)
   - Redis (via external service)
   - Database (MongoDB, PostgreSQL, etc.)

2. **Environment Variables**: Never commit `.env` files to Git. Always use Netlify environment variables for sensitive data.

3. **Xero Callback URL**: Must include the full path `/xero/callback`, not just `/callback`

4. **Local Development**: Use `npm run netlify` to test Netlify Functions locally before deploying

## Support

If you encounter any issues:
- Check Netlify Function logs: Dashboard > Functions > Your Function > Logs
- Check Xero Developer Dashboard for app configuration
- Review the full guide: `README-NETLIFY.md`
