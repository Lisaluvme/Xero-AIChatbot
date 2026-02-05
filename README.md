# 🤖 Xero AI Chatbot

An intelligent AI-powered chatbot that integrates with Xero accounting software to create invoices, quotations, and manage contacts through natural conversation.

## ✨ Features

- 🗣️ **Conversational AI** - Chat naturally to create invoices and quotations
- 🔄 **Xero Integration** - Full OAuth 2.0 authentication with Xero
- 📄 **Create Documents** - Generate invoices, quotations, and manage contacts
- 🧮 **Smart Calculations** - Automatic tax, discount, and total calculations
- 🎨 **Beautiful UI** - Modern, responsive interface
- 🔒 **Secure** - OAuth 2.0 with encrypted sessions

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Lisaluvme/Xero-AIChatbot.git
   cd Xero-AIChatbot
   ```

2. **Install dependencies**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **Set up environment variables**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start the servers**
   
   Terminal 1 (Backend):
   ```bash
   cd backend
   npm start
   ```

   Terminal 2 (Frontend):
   ```bash
   cd frontend
   npm run dev
   ```

5. **Open your browser**
   - Frontend: http://127.0.0.1:8080
   - Backend: https://localhost:3000

## 🔑 Required API Keys

### 1. Groq API (Free & Fast)
- Go to https://console.groq.com/
- Create an account
- Get your API key
- Add to `.env`: `GROQ_API_KEY=gsk_...`

### 2. Xero Developer App
- Go to https://developer.xero.com/app/
- Create a new Custom App
- Copy Client ID and Secret
- Add to `.env`:
  - `XERO_CLIENT_ID=...`
  - `XERO_CLIENT_SECRET=...`
  - `XERO_REDIRECT_URI=https://localhost:3000/callback`

## 🌐 Deployment

### Quick Deploy (Recommended)

#### Backend: Render.com
1. Push code to GitHub
2. Go to https://render.com
3. Create new Web Service
4. Connect your GitHub repo
5. Set environment variables (see `.env.example`)
6. Deploy!

#### Frontend: Netlify
1. Go to https://netlify.com
2. Import your GitHub repo
3. Set publish directory to `frontend`
4. Update `API_BASE_URL` in `frontend/app.js` with your Render URL
5. Deploy!

📖 **Full Deployment Guide**: See [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)

## 💬 Usage Examples

### Creating an Invoice
```
You: Create an invoice for ABC Corp for web design services, RM5000

Bot: I'll create that invoice for you. Here are the details:
- Contact: ABC Corp
- Description: Web design services
- Amount: RM 5,000.00
- Status: Ready to create in Xero

Shall I proceed?
```

### Creating a Quotation
```
You: Create a quote for John Doe - 2 hours consulting at RM500/hr

Bot: Creating quotation for John Doe:
- Consulting services: 2 hours × RM500 = RM1,000
- Total: RM1,000.00

Ready to send to Xero?
```

### Asking Questions
```
You: What's the difference between a quote and an invoice?

Bot: A quote (or quotation) is a document you send to a customer 
before providing goods or services - it's an offer that can be 
accepted or rejected. An invoice is a request for payment sent 
after the goods or services have been provided.
```

## 📁 Project Structure

```
Xero-AIChatbot/
├── backend/
│   ├── server.js          # Express server & API endpoints
│   ├── glmClient.js       # AI integration (Groq/GLM)
│   ├── xeroClient.js      # Xero API integration
│   ├── .env.example       # Environment variables template
│   └── package.json       # Backend dependencies
│
├── frontend/
│   ├── index.html         # Main HTML file
│   ├── app.js             # Frontend JavaScript
│   ├── style.css          # Styling
│   └── package.json       # Frontend dependencies
│
├── DEPLOYMENT-GUIDE.md    # Full deployment instructions
├── README.md              # This file
└── netlify.toml           # Netlify configuration
```

## 🔧 Configuration

### Backend (.env)
```env
GROQ_API_KEY=gsk_your_key_here
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_REDIRECT_URI=https://your-backend.com/callback
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://your-frontend.com
```

### Frontend (app.js)
The frontend auto-detects environment:
- **Local**: Uses `https://localhost:3000`
- **Production**: Uses your Render backend URL

## 🛠️ API Endpoints

- `GET /health` - Health check
- `GET /xero/connect?session_id=xxx` - Initiate Xero OAuth
- `GET /xero/callback` - Xero OAuth callback
- `GET /status?session_id=xxx` - Check connection status
- `POST /chat` - Send message to AI
- `POST /xero/invoice` - Create invoice
- `POST /xero/quotation` - Create quotation
- `GET /xero/contacts` - Get contacts
- `POST /disconnect` - Disconnect Xero

## 🔒 Security

- ✅ Environment variables for all secrets
- ✅ OAuth 2.0 for Xero authentication
- ✅ HTTPS in production
- ✅ CORS protection
- ✅ No secrets in git

## 🐛 Troubleshooting

### "Invalid redirect_uri" error
- Check `XERO_REDIRECT_URI` matches your Xero app settings exactly
- Include `https://` and the full path

### Chatbot not responding
- Verify `GROQ_API_KEY` is set and valid
- Check backend logs for errors
- Ensure backend is running

### Can't connect to Xero
- Verify Xero credentials are correct
- Check callback URL is whitelisted in Xero app
- Ensure you're using HTTPS (required by Xero)

📖 **More help**: See [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)

## 📝 License

ISC

## 👤 Author

Lisa Lu

## 🙏 Acknowledgments

- [Groq](https://groq.com) - Fast AI inference
- [Xero API](https://developer.xero.com) - Accounting integration
- [Express](https://expressjs.com) - Backend framework
- [Netlify](https://netlify.com) - Frontend hosting
- [Render](https://render.com) - Backend hosting

---

**Happy Chatting! 🤖**
