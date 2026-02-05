/**
 * ==========================================
 * XERO CHATBOT FRONTEND - MAIN JAVASCRIPT
 * ==========================================
 * Handles all frontend interactions:
 * - Chat functionality
 * - Xero OAuth flow
 * - API communication with backend
 * - UI updates and animations
 */

// ==========================================
// CONFIGURATION
// ==========================================

// Backend API URL - Auto-detect environment
// For local development: https://localhost:3000
// For Netlify: /api (uses Netlify Functions)
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'https://localhost:3000'  // Local development
  : '/api';  // Netlify Functions

// Session ID for maintaining conversation context
// Use existing session from localStorage or create new one
const SESSION_ID = localStorage.getItem('xero_session_id') || 'user_' + Date.now();
localStorage.setItem('xero_session_id', SESSION_ID);

// ==========================================
// DOM ELEMENTS
// ==========================================

const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const btnSend = document.getElementById('btn-send');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const xeroBanner = document.getElementById('xero-banner');
const btnConnect = document.getElementById('btn-connect');
const loadingOverlay = document.getElementById('loading-overlay');
const invoiceModal = document.getElementById('invoice-modal');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');
const btnCloseModal = document.getElementById('btn-close-modal');
const quickActions = document.querySelectorAll('.quick-action');

// ==========================================
// STATE
// ==========================================

let xeroConnected = false;
let isTyping = false;

// ==========================================
// INITIALIZATION
// ==========================================

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Xero Chatbot Initialized');
  console.log('Session ID:', SESSION_ID);

  // Check for Xero tokens in localStorage
  const xeroTokens = localStorage.getItem('xero_tokens');
  if (xeroTokens) {
    xeroConnected = true;
    updateStatus(true);
    xeroBanner.style.display = 'none';
    console.log('✅ Xero connected from localStorage');
  }

  checkXeroStatus();
});

// Listen for Xero OAuth callback message
window.addEventListener('message', (event) => {
  // Verify origin for security
  if (event.origin !== window.location.origin && event.origin !== new URL(process.env.XERO_REDIRECT_URI || window.location.href).origin) {
    return;
  }

  if (event.data && event.data.accessToken) {
    // Save Xero tokens
    localStorage.setItem('xero_tokens', JSON.stringify(event.data));
    xeroConnected = true;
    updateStatus(true);
    xeroBanner.style.display = 'none';
    addBotMessage('✅ Xero account connected successfully! You can now create invoices and quotations.');
  }
});

// ==========================================
// XERO CONNECTION
// ==========================================

/**
 * Check Xero connection status
 */
async function checkXeroStatus() {
  try {
    console.log('Checking Xero status for session:', SESSION_ID);
    const response = await fetch(`${API_BASE_URL}/xero/status?session_id=${SESSION_ID}`);
    const data = await response.json();

    console.log('Status response:', data);

    if (data.connected) {
      xeroConnected = true;
      updateStatus(true);
      xeroBanner.style.display = 'none';
    } else {
      // Don't auto-connect - let user manually connect
      xeroConnected = false;
      updateStatus(false);
      xeroBanner.style.display = 'block'; // Show banner with connect button
      console.log('Not connected to Xero - waiting for user to connect manually');
    }
  } catch (error) {
    console.error('Status check failed:', error);
    // Don't auto-connect on error - let user manually connect
    xeroConnected = false;
    updateStatus(false);
    xeroBanner.style.display = 'block'; // Show banner with connect button
    console.log('Status check failed - waiting for user to connect manually');
  }
}

/**
 * Update status indicator
 */
function updateStatus(connected) {
  if (connected) {
    statusDot.classList.add('connected');
    statusText.textContent = 'Xero Connected';
  } else {
    statusDot.classList.remove('connected');
    statusText.textContent = 'Xero Not Connected';
  }
}

/**
 * Handle Xero connection
 */
async function connectToXero() {
  try {
    showLoading(true);

    // Add message to inform user
    addBotMessage('🔗 Connecting to Xero... Please authorize in the popup window.');

    // Store session ID in localStorage for sharing between windows
    localStorage.setItem('xero_session_id', SESSION_ID);

    const response = await fetch(`${API_BASE_URL}/xero/auth?session_id=${SESSION_ID}`);
    const data = await response.json();

    if (data.success && data.authorization_url) {
      // Open Xero authorization in new window
      const authWindow = window.open(data.authorization_url, 'xero-auth', 'width=600,height=700');

      // Poll for connection status
      const checkInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`${API_BASE_URL}/xero/status?session_id=${SESSION_ID}`);
          const statusData = await statusResponse.json();

          if (statusData.connected) {
            clearInterval(checkInterval);
            xeroConnected = true;
            updateStatus(true);
            xeroBanner.style.display = 'none';
            showLoading(false);

            addBotMessage('✅ Xero account connected successfully! You can now create invoices and quotations.');

            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
          }
        } catch (error) {
          console.error('Status check failed:', error);
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!xeroConnected) {
          showLoading(false);
          addBotMessage('⏱️ Connection attempt timed out. Click "Connect Xero" to try again.');
          xeroBanner.style.display = 'block';
        }
      }, 300000);

    } else {
      showLoading(false);
      addBotMessage('❌ Failed to initiate Xero connection. Please try again.');
      xeroBanner.style.display = 'block';
    }
  } catch (error) {
    showLoading(false);
    console.error('Xero connection error:', error);
    addBotMessage('❌ Error connecting to Xero. Please check your connection and try again.');
    xeroBanner.style.display = 'block';
  }
}

// Button click handler
btnConnect.addEventListener('click', connectToXero);

// ==========================================
// CHAT FUNCTIONALITY
// ==========================================

/**
 * Handle chat form submission
 */
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const message = userInput.value.trim();
  if (!message || isTyping) return;

  // Add user message to chat
  addUserMessage(message);
  userInput.value = '';

  // Show typing indicator
  showTypingIndicator(true);
  isTyping = true;

  try {
    // Get conversation history from localStorage
    const conversationHistory = JSON.parse(localStorage.getItem('conversation_history') || '[]');

    // Send message to backend
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        conversationHistory: conversationHistory
      })
    });

    const data = await response.json();

    // Hide typing indicator
    showTypingIndicator(false);
    isTyping = false;

    if (data.success) {
      // Save updated conversation history
      if (data.conversationHistory) {
        localStorage.setItem('conversation_history', JSON.stringify(data.conversationHistory));
      }

      addBotMessage(data.message);

      if (data.type === 'invoice_created') {
        showInvoiceModal(data);
        xeroBanner.style.display = 'block';
      } else if (data.type === 'invoice_error') {
        // Invoice creation error
        addBotMessage(data.message);
        addBotMessage(`❌ Error: ${data.xero_error}`);
      }
    } else {
      addBotMessage(`❌ Error: ${data.error || 'Unknown error occurred'}`);
    }
  } catch (error) {
    showTypingIndicator(false);
    isTyping = false;
    console.error('Chat error:', error);
    addBotMessage('❌ Error communicating with the server. Please try again.');
  }
});

/**
 * Quick action buttons
 */
quickActions.forEach(btn => {
  btn.addEventListener('click', () => {
    const message = btn.getAttribute('data-message');
    userInput.value = message;
    chatForm.dispatchEvent(new Event('submit'));
  });
});

// ==========================================
// UI FUNCTIONS
// ==========================================

/**
 * Add user message to chat
 */
function addUserMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user-message';
  messageDiv.innerHTML = `
    <div class="message-avatar">👤</div>
    <div class="message-content">
      <p>${escapeHtml(message)}</p>
    </div>
  `;
  chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

/**
 * Add bot message to chat
 */
function addBotMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message bot-message';

  // Convert markdown-like syntax to HTML
  const formattedMessage = formatMessage(message);

  messageDiv.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-content">
      ${formattedMessage}
    </div>
  `;
  chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

/**
 * Show typing indicator
 */
function showTypingIndicator(show) {
  const existingIndicator = document.querySelector('.typing-indicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }

  if (show) {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;
    chatMessages.appendChild(indicator);
    scrollToBottom();
  }
}

/**
 * Show/hide loading overlay
 */
let loadingTimeout = null;

function showLoading(show) {
  loadingOverlay.style.display = show ? 'flex' : 'none';

  // Auto-hide loading after 10 seconds to prevent infinite loading
  if (show) {
    if (loadingTimeout) clearTimeout(loadingTimeout);
    loadingTimeout = setTimeout(() => {
      showLoading(false);
      console.warn('Loading timeout - hiding loading overlay');
    }, 10000);
  } else {
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      loadingTimeout = null;
    }
  }
}

/**
 * Format message with basic markdown support
 */
function formatMessage(message) {
  // Convert newlines to <br>
  let formatted = message.replace(/\n/g, '<br>');

  // Convert **bold** to <strong>
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Convert *italic* to <em>
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Convert lists
  formatted = formatted.replace(/^- (.*)$/gm, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  return formatted;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Scroll chat to bottom
 */
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==========================================
// MODAL FUNCTIONS
// ==========================================

/**
 * Show invoice modal
 */
function showInvoiceModal(data) {
  const invoice = data.xero_invoice;

  const lineItemsHtml = invoice.LineItems.map(item => `
    <div class="invoice-detail">
      <span class="invoice-label">${escapeHtml(item.Description)}</span>
      <span class="invoice-value">RM ${parseFloat(item.UnitAmount).toFixed(2)} × ${item.Quantity}</span>
    </div>
  `).join('');

  modalBody.innerHTML = `
    <div class="invoice-detail">
      <span class="invoice-label">Invoice Number:</span>
      <span class="invoice-value">${escapeHtml(invoice.InvoiceNumber)}</span>
    </div>
    <div class="invoice-detail">
      <span class="invoice-label">Contact:</span>
      <span class="invoice-value">${escapeHtml(invoice.Contact.Name)}</span>
    </div>
    <div class="invoice-detail">
      <span class="invoice-label">Date:</span>
      <span class="invoice-value">${invoice.Date}</span>
    </div>
    <div class="invoice-detail">
      <span class="invoice-label">Due Date:</span>
      <span class="invoice-value">${invoice.DueDate}</span>
    </div>
    <hr style="margin: 16px 0; border: none; border-top: 1px solid #e2e8f0;">
    ${lineItemsHtml}
    <div class="invoice-total">
      <span>Total:</span>
      <span>RM ${parseFloat(invoice.Total).toFixed(2)}</span>
    </div>
  `;

  // Set view invoice button URL
  const btnViewInvoice = document.getElementById('btn-view-invoice');
  btnViewInvoice.href = data.invoice_url;

  invoiceModal.style.display = 'flex';
}

/**
 * Close modal handlers
 */
modalClose.addEventListener('click', () => {
  invoiceModal.style.display = 'none';
});

btnCloseModal.addEventListener('click', () => {
  invoiceModal.style.display = 'none';
});

invoiceModal.addEventListener('click', (e) => {
  if (e.target === invoiceModal) {
    invoiceModal.style.display = 'none';
  }
});

// ==========================================
// KEYBOARD SHORTCUTS
// ==========================================

// Enter to send, Shift+Enter for new line
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event('submit'));
  }
});

// ==========================================
// ERROR HANDLING
// ==========================================

// Handle network errors
window.addEventListener('online', () => {
  addBotMessage('✅ Connection restored');
});

window.addEventListener('offline', () => {
  addBotMessage('⚠️ You are offline. Please check your internet connection.');
});

// ==========================================
// POLL XERO STATUS
// ==========================================

// Check Xero status on page load
checkXeroStatus();

// Check Xero status every 30 seconds
setInterval(() => {
  checkXeroStatus();
}, 30000);

console.log('✅ Frontend loaded successfully');
console.log('📡 Backend URL:', API_BASE_URL);
