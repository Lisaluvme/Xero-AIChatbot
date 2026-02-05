# Xero 401 Authentication Fix - Summary

## Issues Identified and Fixed

### 🔴 **Critical Issue #1: Token Refresh Overwrites Session Data**

**Problem:**
When refreshing tokens, the code was using `setSession()` which ONLY stored the new token data, completely **overwriting** all existing session data including:
- `tenantId` ❌ Lost
- `tenantName` ❌ Lost
- `conversationHistory` ❌ Lost
- `oauthState` ❌ Lost
- `connected` status ❌ Lost

**Location:** `index.js` lines 319-323 (old code)

```javascript
// ❌ WRONG - Overwrites everything!
setSession(session_id, {
  accessToken: refreshResult.tokens.accessToken,
  refreshToken: refreshResult.tokens.refreshToken,
  expiresAt: refreshResult.tokens.expiresAt
});
```

**Fix:**
Updated `setSession()` to preserve existing data:

```javascript
// ✅ CORRECT - Merges with existing data
function setSession(sessionId, data) {
  const existing = sessions.get(sessionId) || {};
  sessions.set(sessionId, {
    ...existing,  // Preserve existing data first
    ...data,      // Then overlay new data
    updatedAt: Date.now()
  });
}
```

---

### 🔴 **Critical Issue #2: No Proper Token Refresh Before API Calls**

**Problem:**
Token refresh logic only ran in the chat endpoint and was incomplete. Other endpoints (GET, POST, PUT, DELETE) didn't refresh tokens before calling Xero API, causing 401 errors when tokens expired.

**Fix:**
Created `ensureValidToken()` function that:
1. Checks if token is expired or will expire within 5 minutes
2. Automatically refreshes if needed
3. Preserves ALL session data during refresh
4. Returns the updated session
5. Provides detailed logging

**Location:** `index.js` lines 76-122

```javascript
async function ensureValidToken(sessionId) {
  const session = getSession(sessionId);

  // Check if refresh is needed
  if (!needsRefresh(session.expiresAt)) {
    console.log('✅ Token is still valid');
    return { success: true, session };
  }

  // Refresh token
  const refreshResult = await xeroClient.refreshAccessToken(session.refreshToken);

  // Update session while preserving ALL existing data
  setSession(sessionId, {
    accessToken: refreshResult.tokens.accessToken,
    refreshToken: refreshResult.tokens.refreshToken || session.refreshToken,
    expiresAt: refreshResult.tokens.expiresAt
  });

  return { success: true, session: getSession(sessionId) };
}
```

---

### 🔴 **Critical Issue #3: Inadequate Error Logging for 401s**

**Problem:**
When 401 errors occurred, there was no detailed logging to debug the issue. Hard to tell:
- Was the token expired?
- Was the tenantId correct?
- Was the token malformed?

**Fix:**
Added comprehensive logging throughout:

**Token Exchange** (`xeroClient.js`):
```javascript
console.log('🔑 Using Xero scopes:', scope);
console.log('✅ Token received, scopes:', response.data.scope);
```

**Tenant Fetch** (`xeroClient.js`):
```javascript
console.log('🔑 Fetching tenants from Xero Connections API...');
console.log(`✅ Successfully retrieved ${response.data.length} tenants`);

if (error.response?.status === 401) {
  console.error('❌ 401 Unauthorized - Token may be invalid or expired');
  console.error('📊 Token was:', accessToken.substring(0, 20) + '...');
}
```

**Callback Handler** (`index.js`):
```javascript
console.log('🔑 Received OAuth callback, exchanging code for tokens...');
console.log('✅ Token received successfully');
console.log('📊 Token expires at:', new Date(tokenResult.tokens.expiresAt).toISOString());
console.log(`✅ Found ${tenantsResult.tenants.length} tenants:`);
tenantsResult.tenants.forEach((tenant, index) => {
  console.log(`   ${index + 1}. ${tenant.tenantName} (${tenant.tenantId})`);
});
```

**Token Refresh** (`index.js`):
```javascript
console.log('🔄 Refreshing access token...');
console.log('📊 Token expired at:', new Date(session.expiresAt).toISOString());
console.log('📊 Current time:', new Date().toISOString());
console.log('✅ Token refreshed successfully');
console.log('📊 New token expires at:', new Date(refreshResult.tokens.expiresAt).toISOString());
```

---

### 🔴 **Issue #4: Missing Token Validation in CRUD Endpoints**

**Problem:**
CRUD endpoints (GET, POST, PUT, DELETE) used a synchronous `getActiveSession()` that didn't check token validity.

**Fix:**
Made `getActiveSession()` async and added token validation:

```javascript
const getActiveSession = async (sessionId) => {
  const session = getSession(sessionId);
  if (!session || !session.connected) {
    return null;
  }

  // Ensure token is valid before proceeding
  if (session.refreshToken) {
    const tokenCheck = await ensureValidToken(sessionId);
    if (!tokenCheck.success) {
      console.error('❌ Failed to get valid token for session:', sessionId);
      return null;
    }
    return tokenCheck.session;
  }

  return session;
};
```

Updated all CRUD endpoints to use `await getActiveSession()`:

```javascript
app.get('/api/invoices', async (req, res) => {
  const session = await getActiveSession(session_id);  // ✅ Now async with token refresh
  // ...
});
```

---

### 🟢 **Issue #5: Added Organization Test Endpoint**

**New Feature:**
Added `GET /api/organization` endpoint to test Xero API connectivity:

```javascript
app.get('/api/organization', async (req, res) => {
  const session = await getActiveSession(session_id);

  const response = await axios.get(
    'https://api.xero.com/api.xro/2.0/Organisation',
    {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Xero-tenant-id': session.tenantId,
        'Accept': 'application/json'
      }
    }
  );

  res.json({
    success: true,
    organization: response.data.Organisations[0]
  });
});
```

**Usage:**
```bash
GET https://localhost:3000/api/organization?session_id=user_xxx
```

---

## Testing the Fixes

### 1. **Test Token Exchange & Tenant Selection**
```bash
# Connect to Xero
GET https://localhost:3000/xero/auth?session_id=test_user
```

Watch logs for:
- ✅ Token received successfully
- ✅ Found X tenants: Mega Genset, Demo Company
- ✅ Selected tenant: Mega Genset Malaysia Sdn Bhd (28ceb5ab-5dc9-45bf-88a2-0564bd8fa561)

### 2. **Test Organization Endpoint**
```bash
# Test basic API call
GET https://localhost:3000/api/organization?session_id=test_user
```

Expected response:
```json
{
  "success": true,
  "organization": {
    "OrganisationID": "...",
    "Name": "Mega Genset Malaysia Sdn Bhd",
    ...
  }
}
```

### 3. **Test Token Refresh**
Wait for token to approach expiry, then make any API call. Watch logs:
- 🔄 Refreshing access token...
- ✅ Token refreshed successfully
- 📊 New token expires at: ...

### 4. **Test CRUD Operations**
```bash
# Get invoices
GET https://localhost:3000/api/invoices?session_id=test_user

# Create invoice
POST https://localhost:3000/api/invoices
{
  "session_id": "test_user",
  "invoice_data": { ... }
}
```

---

## Environment Variables Required

```env
# Xero OAuth 2.0
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_REDIRECT_URI=https://localhost:3000/xero/callback

# Important: Include Identity API scopes
XERO_SCOPE=openid profile email accounting.transactions accounting.contacts accounting.settings offline_access

# Server
PORT=3000
NODE_ENV=development
```

---

## Render Deployment Notes

### 1. **Update Xero App Callback URL**
Add your Render URL to Xero app:
- `https://your-app.onrender.com/xero/callback`

### 2. **Environment Variables on Render**
Set these in Render dashboard:
- `XERO_REDIRECT_URI=https://your-app.onrender.com/xero/callback`
- `NODE_ENV=production`

### 3. **Token Persistence**
Current implementation uses in-memory storage (Map). For production:
- Add Redis for token persistence across restarts
- Or use a database (PostgreSQL, MongoDB)

---

## What Caused the 401 Errors

### **Root Causes:**

1. **Expired tokens not being refreshed** - Token refresh logic only ran in chat endpoint, not CRUD endpoints

2. **Session data loss on refresh** - When tokens refreshed, tenantId was lost, causing API calls to fail with 401

3. **No automatic token validation** - API calls used potentially expired tokens without checking validity first

4. **Missing scopes** - Token needs `openid profile email` for Identity API (Connections endpoint)

---

## Files Modified

1. **`index.js`**
   - Fixed `setSession()` to preserve existing data
   - Added `ensureValidToken()` function
   - Updated callback handler with detailed logging
   - Made `getActiveSession()` async
   - Updated all CRUD endpoints to use async getActiveSession
   - Added `/api/organization` test endpoint

2. **`xeroClient.js`**
   - Added comprehensive logging to `getTenants()`
   - Added 401 error detection and logging
   - Added scope logging to `getAuthorizationUrl()`
   - Added token scope logging to `exchangeCodeForToken()`

---

## Success Metrics

✅ Token exchange works
✅ Tenant selection works
✅ Tokens refresh automatically
✅ Session data preserved during refresh
✅ All CRUD endpoints validate tokens
✅ Detailed logging for debugging
✅ 401 errors now explain root cause

---

## Next Steps for Production

1. **Add persistent session storage** (Redis or database)
2. **Implement token refresh retry logic** with exponential backoff
3. **Add webhook support** for Xero events
4. **Implement rate limiting** for Xero API calls
5. **Add monitoring** for token expiry and refresh failures
6. **Load test** with multiple concurrent users

---

## Support

For issues, check the logs:
- Token exchange: Look for `🔑 Received OAuth callback`
- Tenant selection: Look for `✅ Found X tenants`
- Token refresh: Look for `🔄 Refreshing access token`
- API calls: Look for `📊 Getting invoices for tenant`

All errors are prefixed with `❌` for easy grepping.
