# Xero Chatbot - MCP Architecture Guide

## 🎯 Overview

This is the **REFACTORED** version using **Xero MCP Server** with **Custom Connection (M2M)**.

**Key Difference:**
- ❌ **NO OAuth redirects** (no `/authorize`, no `/callback`)
- ❌ **NO authorization codes**
- ❌ **NO direct Xero API calls**
- ✅ **MCP Server** handles all Xero communication
- ✅ **Custom Connection** with `client_id` + `client_secret` only

---

## 🏗️ Architecture

```
┌─────────────┐
│  Chat UI    │
│ (Browser)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Backend   │
│  Express.js │
└──────┬──────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
┌────────────┐  ┌──────────────┐
│  GLM AI    │  │ MCP Client   │
└────────────┘  └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ MCP Server   │
                │ (npx process)│
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │   Xero API   │
                └──────────────┘
```

---

## 🚀 Startup Flow

### 1. MCP Server Initialization (Automatic)

When the backend starts, it automatically:

```bash
npx -y @xeroapi/xero-mcp-server@latest
```

With environment variables:
- `XERO_CLIENT_ID`
- `XERO_CLIENT_SECRET`

### 2. Connection Established

The MCP Server:
- Authenticates with Xero using Custom Connection
- Loads all available tools (list-contacts, create-invoice, etc.)
- Ready to receive JSON-RPC requests via stdin/stdout

### 3. Chatbot Ready

Users can now:
- Chat with GLM AI
- Ask to list contacts, create invoices
- Backend forwards requests to MCP Server
- MCP Server calls Xero API
- Results returned to user

---

## 📋 What Was DELETED

### Removed Files/Functions:
- ❌ `/xero/auth` endpoint (OAuth authorization URL)
- ❌ `/xero/callback` endpoint (OAuth callback handler)
- ❌ `getAuthorizationUrl()` function
- ❌ `exchangeCodeForToken()` function
- ❌ `refreshAccessToken()` function
- ❌ Token storage in sessions
- ❌ `XERO_REDIRECT_URI` configuration

### Removed from .env:
```bash
# DELETED - Not needed for MCP Custom Connection
XERO_REDIRECT_URI=https://localhost:3000/xero/callback
XERO_SCOPE=openid profile email ...
XERO_AUTH_TYPE=m2m
```

### Kept:
```bash
# KEPT - Only these are needed
XERO_CLIENT_ID=830EBC2DFB86463596CAE8D0D0BDDF32
XERO_CLIENT_SECRET=iJSXkhLW3QlB1wvvWSgzvSX7M_PmLqf7fNy8CZyqHdG9hMjI
```

---

## 🔧 Available MCP Tools

### Contacts
- `list-contacts` - Get all contacts
- `create-contact` - Create new contact
- `update-contact` - Update existing contact

### Invoices
- `list-invoices` - Get all invoices
- `create-invoice` - Create new invoice
- `update-invoice` - Update draft invoice

### Other
- `list-accounts` - Chart of accounts
- `list-organisation-details` - Organisation info
- `create-payment` - Record payment
- `list-quotes` - Quotes management

---

## 💡 Example Tool Calls

### List Contacts
```javascript
const result = await mcpClient.callTool('list-contacts');
```

**User says:** "Show me all contacts"

**Backend does:**
```javascript
const contacts = await mcpClient.listContacts();
```

**MCP Server → Xero API:** `GET /Contacts`

### Create Invoice
```javascript
const result = await mcpClient.callTool('create-invoice', {
  type: 'ACCREC',
  contact: { name: 'John Doe' },
  lineItems: [
    { description: 'Consulting', quantity: 5, unit_amount: 100 }
  ],
  status: 'DRAFT'
});
```

**User says:** "Create an invoice for John Doe for 5 hours of consulting at $100/hr"

**Backend does:**
```javascript
const invoice = await mcpClient.createInvoice({
  contact: { name: 'John Doe' },
  lineItems: [
    { description: 'Consulting', quantity: 5, unit_amount: 100 }
  ]
});
```

**MCP Server → Xero API:** `PUT /Invoices`

---

## ⚠️ Common Mistakes

### ❌ Mistake 1: Mixing OAuth with MCP
```javascript
// WRONG - Don't do this
const authUrl = `https://login.xero.com/identity/connect/authorize...`;
window.location.href = authUrl;
```

**Correct:** MCP Custom Connection has NO user authorization step

### ❌ Mistake 2: Direct Xero API calls
```javascript
// WRONG - Don't call Xero directly
axios.get('https://api.xero.com/api.xro/2.0/Contacts', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**Correct:** Always use MCP tools
```javascript
await mcpClient.callTool('list-contacts');
```

### ❌ Mistake 3: Using authorization codes
```javascript
// WRONG - No auth codes in MCP
const code = req.query.code;
const token = await exchangeCodeForToken(code);
```

**Correct:** MCP Server handles authentication internally

### ❌ Mistake 4: Setting redirect_uri
```javascript
// WRONG - Not needed
XERO_REDIRECT_URI=https://localhost:3000/xero/callback
```

**Correct:** Delete this from .env

---

## 🧪 Testing

### 1. Start Server
```bash
cd /Users/mgmadmin/Desktop/Xero\ Chatbot
npm start
```

### 2. Check MCP Tools
```bash
curl -k https://localhost:3000/xero/tools
```

### 3. Test Chat
```bash
curl -k -X POST https://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "List all contacts"}'
```

### 4. Create Invoice
```bash
curl -k -X POST https://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Create an invoice for Test Customer for 2 items at $50 each"}'
```

---

## 🔍 Debugging

### Check MCP Server Status
```bash
curl -k https://localhost:3000/xero/status
```

Expected response:
```json
{
  "connected": true,
  "authType": "mcp",
  "organisation": { ... }
}
```

### View Available Tools
```bash
curl -k https://localhost:3000/xero/tools
```

### Server Logs
Look for:
- `🚀 Starting Xero MCP Server...`
- `✅ MCP Server loaded N tools`
- `🔧 Calling MCP tool: list-contacts`

---

## 📁 File Structure

```
/Users/mgmadmin/Desktop/Xero Chatbot/
├── server-mcp.js       # ✅ NEW - MCP-based server
├── mcpClient.js        # ✅ NEW - MCP client wrapper
├── index.js            # ⚠️  OLD - OAuth-based (deprecated)
├── glmClient.js        # ✅ GLM AI client (unchanged)
├── xeroClient.js       # ❌ DELETE - Direct Xero API (not needed)
├── .env                # ✅ Updated - No redirect_uri
└── package.json        # ✅ Updated - New start script
```

---

## ✅ Production Checklist

- [ ] MCP Server starts successfully
- [ ] `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET` are set
- [ ] NO `XERO_REDIRECT_URI` in .env
- [ ] Can list contacts via MCP
- [ ] Can create invoice via MCP
- [ ] GLM AI generates correct JSON
- [ ] Frontend connects to backend
- [ ] Error handling works

---

## 🎓 Key Takeaways

1. **MCP Server = Middleware**
   - Handles all Xero authentication
   - Exposes standardized tools
   - Runs as separate `npx` process

2. **Custom Connection = Machine-to-Machine**
   - No user OAuth flow
   - No redirect_uri
   - No authorization codes
   - Just `client_id` + `client_secret`

3. **Backend = Orchestrator**
   - Receives user messages
   - Calls GLM AI for intent
   - Executes MCP tools
   - Returns results

4. **Never Talk to Xero Directly**
   - Always use MCP tools
   - MCP handles rate limits
   - MCP handles token refresh
   - MCP handles API errors

---

## 🆚 OAuth vs MCP

| Feature | OAuth (OLD) | MCP Custom Connection (NEW) |
|---------|-------------|----------------------------|
| Redirect URI | ✅ Required | ❌ Not needed |
| User Authorization | ✅ Required | ❌ Not needed |
| Authorization Code | ✅ Required | ❌ Not needed |
| Token Refresh | ✅ Manual | ❌ Automatic (MCP handles) |
| Direct Xero API | ✅ Yes | ❌ No (via MCP only) |
| Authentication Type | User-based | Machine-to-Machine |
| Setup Complexity | High | Low |
| Session Management | Required | Not required |

---

## 📞 Support

If MCP Server fails to start:
1. Check `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET`
2. Ensure Custom Connection app (not OAuth app)
3. Verify authorization completed in Xero email
4. Check npx is installed: `which npx`

For MCP Server issues:
- https://github.com/XeroAPI/xero-mcp-server
- https://developer.xero.com/documentation/guides/oauth2/custom-connections/
