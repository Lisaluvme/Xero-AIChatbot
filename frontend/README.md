# 🎨 Xero Chatbot Frontend

Modern, responsive chatbot UI for Xero AI Accounting Assistant. Deploy to Netlify.

---

## Features

- ✅ **Clean Chat Interface** - Modern, user-friendly design
- ✅ **Real-time Chat** - Instant message responses
- ✅ **Xero OAuth** - Seamless Xero connection flow
- ✅ **Invoice Modals** - Beautiful invoice confirmation dialogs
- ✅ **Responsive** - Works on desktop and mobile
- ✅ **Status Indicator** - Shows Xero connection status
- ✅ **Quick Actions** - Pre-filled message buttons

---

## Tech Stack

- **Vanilla JavaScript** - No framework dependencies
- **CSS3** - Modern styling with gradients and animations
- **HTML5** - Semantic markup
- **Fetch API** - Backend communication

---

## File Structure

```
frontend/
├── index.html         # Main HTML structure
├── style.css          # All styles and animations
├── app.js             # Frontend logic
├── netlify.toml       # Netlify configuration
├── package.json
└── README.md
```

---

## Installation & Setup

### 1. Configure Backend URL

Edit `app.js` (line 10):

```javascript
// Change from:
const API_BASE_URL = 'http://localhost:3000';

// To your Render backend URL:
const API_BASE_URL = 'https://your-backend.onrender.com';
```

### 2. Local Development

```bash
# Install dependencies
npm install

# Start local server
npm run dev
```

Opens at: `http://localhost:3000`

---

## Deployment to Netlify

### Option 1: Drag & Drop (Easiest)

1. Open https://app.netlify.com/
2. Drag the `frontend` folder and drop it
3. Instant deployment!

### Option 2: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Navigate to frontend
cd frontend

# Login
netlify login

# Deploy
netlify deploy --prod
```

### Option 3: GitHub Integration

1. Push frontend code to GitHub
2. In Netlify: **New site from Git**
3. Select repository
4. **Publish directory**: `frontend`
5. Deploy

---

## Configuration

### Backend API URL

Set in `app.js`:

```javascript
const API_BASE_URL = 'https://your-backend.onrender.com';
```

### Xero Connection

Frontend automatically connects to Xero via:
- **Backend URL**: `/login` endpoint
- **Popup Window**: OAuth authorization
- **Status Polling**: Checks connection every 30s

---

## UI Components

### Header

- Logo and title
- Connection status indicator
- Real-time status updates

### Chat Window

- Scrollable message area
- User messages (right-aligned)
- Bot messages (left-aligned)
- Typing indicator
- Smooth animations

### Quick Actions

Pre-configured message buttons:
- 📄 Create Invoice
- 🧮 Calculate
- ❓ Ask Question

### Input Area

- Text input field
- Send button
- Enter key support
- Shift+Enter for new lines

### Xero Banner

- Appears when Xero not connected
- "Connect Xero" button
- Disappears after connection

### Invoice Modal

- Shows invoice details
- Line items breakdown
- Total calculation
- "View in Xero" button

---

## Customization

### Colors

Edit CSS variables in `style.css`:

```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #48bb78;
  --danger-color: #f56565;
  /* ... */
}
```

### Logo

Change logo in `index.html`:

```html
<span class="logo-icon">🤖</span>
<h1>Xero AI Chatbot</h1>
```

### Welcome Message

Edit in `index.html`:

```html
<div class="message bot-message">
  <div class="message-avatar">🤖</div>
  <div class="message-content">
    <p>👋 Your custom welcome message here</p>
  </div>
</div>
```

### Quick Actions

Edit in `index.html`:

```html
<button class="quick-action" data-message="Your custom message here">
  🎯 Your Label
</button>
```

---

## JavaScript Functions Reference

### Main Functions

```javascript
// Add user message to chat
addUserMessage(message)

// Add bot message to chat
addBotMessage(message)

// Show typing indicator
showTypingIndicator(true/false)

// Show invoice modal
showInvoiceModal(data)

// Check Xero status
checkXeroStatus()
```

### Event Handlers

```javascript
// Chat form submit
chatForm.addEventListener('submit', ...)

// Xero connect button
btnConnect.addEventListener('click', ...)

// Quick action buttons
quickActions.forEach(btn => ...)
```

---

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

---

## Mobile Responsive

The UI is fully responsive:
- Desktop: Full-width chat window
- Tablet: Optimized layout
- Mobile: Stacked layout, full-screen modals

---

## Performance

- **No framework overhead** - Pure vanilla JS
- **Minimal dependencies** - Only http-server for dev
- **Fast loading** - < 100kb total size
- **Optimized CSS** - Hardware-accelerated animations

---

## Security

- **XSS Protection**: All user input escaped
- **HTTPS Required** for production
- **CORS Configured** via backend
- **No Sensitive Data** stored in frontend

---

## Accessibility

- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support
- Focus management in modals
- Sufficient color contrast

---

## Troubleshooting

### "Can't Connect to Backend"

**Solution**:
- Check `API_BASE_URL` in `app.js`
- Verify backend is deployed and running
- Test backend health endpoint
- Check browser console for errors

### Xero OAuth Fails

**Solution**:
- Check backend `/callback` endpoint
- Verify Xero app Redirect URI
- Check for popup blocker
- Ensure `FRONTEND_URL` is set in backend

### Messages Not Appearing

**Solution**:
- Open browser DevTools Console
- Check for JavaScript errors
- Verify backend `/chat` endpoint works
- Check network tab for failed requests

---

## Analytics (Optional)

Add analytics in `index.html`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_ID');
</script>
```

---

## Next Steps

1. **Customize Branding**: Update colors, logo, name
2. **Add Analytics**: Track user engagement
3. **Add Error Tracking**: Sentry, LogRocket
4. **Optimize**: Compress images, minify CSS/JS
5. **Test**: Cross-browser testing

---

## Support

- **Netlify Docs**: https://docs.netlify.com/
- **MDN Web Docs**: https://developer.mozilla.org/

---

**License**: ISC
