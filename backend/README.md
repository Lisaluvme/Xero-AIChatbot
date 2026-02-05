# 🤖 Xero Chatbot Backend

Production-ready Node.js/Express backend integrated with **GLM-4-Flash AI** and **Xero API**.

---

## Features

- ✅ **GLM-4-Flash Integration** - AI-powered chat responses
- ✅ **Xero OAuth 2.0** - Secure authentication with token refresh
- ✅ **Invoice Creation** - Create invoices and quotations in Xero
- ✅ **RESTful API** - Clean endpoints for frontend communication
- ✅ **Session Management** - Conversation context tracking
- ✅ **Error Handling** - Comprehensive error responses

---

## Tech Stack

- **Node.js** - Runtime environment
- **Express** - Web framework
- **Axios** - HTTP client for API calls
- **GLM-4-Flash** - Zhipu AI model
- **Xero API** - Accounting integration

---

## API Endpoints

### Health & Status

```
GET /health
GET /
```

### Xero Authentication

```
GET  /login              - Initiate OAuth flow
GET  /callback           - OAuth callback handler
GET  /status             - Check connection status
POST /disconnect         - Disconnect account
```

### Chat & Documents

```
POST /chat              - Main chat endpoint
POST /create-invoice    - Direct invoice creation
```

---

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
GLM_API_KEY=your_glm_api_key
XERO_CLIENT_ID=your_xero_client_id
XERO_CLIENT_SECRET=your_xero_client_secret
XERO_REDIRECT_URI=http://localhost:3000/callback
XERO_SCOPE=accounting.transactions accounting.contacts accounting.settings offline_access
PORT=3000
FRONTEND_URL=http://localhost:3000
```

### 3. Start Server

```bash
# Development
npm run dev

# Production
npm start
```

Server runs on: `http://localhost:3000`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GLM_API_KEY` | ✅ | Zhipu AI API key |
| `XERO_CLIENT_ID` | ✅ | Xero OAuth client ID |
| `XERO_CLIENT_SECRET` | ✅ | Xero OAuth secret |
| `XERO_REDIRECT_URI` | ✅ | OAuth callback URL |
| `XERO_SCOPE` | ✅ | API permissions |
| `PORT` | ❌ | Server port (default: 3000) |
| `FRONTEND_URL` | ✅ | CORS allowed origin |
| `NODE_ENV` | ❌ | Environment mode |

---

## API Documentation

### POST /chat

Main chat endpoint. Processes user messages and returns AI responses.

**Request**:
```json
{
  "message": "Create an invoice for ABC Company, Web Design RM2000",
  "session_id": "user_123"
}
```

**Response (Text)**:
```json
{
  "success": true,
  "type": "text",
  "message": "AI response here...",
  "xero_connected": true
}
```

**Response (Invoice Created)**:
```json
{
  "success": true,
  "type": "invoice_created",
  "message": "Invoice created successfully!",
  "xero_invoice": { ... },
  "invoice_url": "https://go.xero.com/..."
}
```

---

### GET /login

Initiate Xero OAuth flow.

**Request**:
```
GET /login?session_id=user_123
```

**Response**:
```json
{
  "success": true,
  "authorization_url": "https://login.xero.com/identity/connect/authorize?..."
}
```

---

### GET /status

Check Xero connection status.

**Request**:
```
GET /status?session_id=user_123
```

**Response**:
```json
{
  "connected": true,
  "tenantName": "My Organization",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

---

## File Structure

```
backend/
├── server.js          # Main Express server
├── glmClient.js       # GLM-4-Flash API client
├── xeroClient.js      # Xero API client (OAuth, invoices)
├── package.json
├── .env.example
└── README.md
```

---

## Deployment to Render

### Option 1: Render Dashboard

1. Go to https://dashboard.render.com/
2. **New +** → **Web Service**
3. Connect GitHub repository
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Add environment variables
6. Deploy

### Option 2: Render CLI

```bash
npm install -g render-cli
render login
render deploy --src ./backend
```

---

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Testing

```bash
# Health check
curl http://localhost:3000/health

# Chat endpoint
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "session_id": "test"}'
```

---

## Troubleshooting

### "Xero Not Connected"

- Ensure OAuth flow completed
- Check `XERO_REDIRECT_URI` matches Xero app settings
- Verify `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET`

### "GLM API Error"

- Check `GLM_API_KEY` is valid
- Verify API key has credits
- Check network connectivity

### CORS Errors

- Ensure `FRONTEND_URL` is set correctly
- No trailing slash in URL
- Exact match required

---

## Security Notes

- Never commit `.env` file
- Use `process.env` for sensitive data
- Enable HTTPS in production
- Implement rate limiting for production
- Use proper session storage (Redis/database)

---

## Support

- **Xero API Docs**: https://developer.xero.com/documentation/
- **GLM-4-Flash Docs**: https://open.bigmodel.cn/dev/api
- **Express Docs**: https://expressjs.com/

---

**License**: ISC
