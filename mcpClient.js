/**
 * Xero MCP Client
 *
 * This module handles communication with the Xero MCP Server.
 * The MCP Server runs as a separate process and handles all Xero API calls.
 *
 * Authentication: OAuth 2.0 Client Credentials Grant
 * - Fetches access_token using client_id + client_secret
 * - Passes Bearer token to MCP Server via environment variable
 * - Automatically refreshes token when expired
 *
 * Architecture:
 * Chatbot → XeroAuth (get token) → MCP Client → MCP Server (with Bearer token) → Xero API
 */

const { spawn } = require('child_process');
const readline = require('readline');
const xeroAuth = require('./xeroAuth');

/**
 * Xero MCP Client Class
 */
class XeroMCPClient {
  constructor() {
    this.mcpProcess = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.currentBearerToken = null;
  }

  /**
   * Start the MCP Server process with Bearer Token
   */
  async start() {
    console.log('🚀 Starting Xero MCP Server with Bearer Token...');

    // First, get access token using Client Credentials Grant
    try {
      this.currentBearerToken = await xeroAuth.getAccessToken();
      console.log('✅ Access token obtained, starting MCP Server...');
    } catch (error) {
      console.error('❌ Failed to get access token:', error.message);
      throw error;
    }

    // Start MCP Server with Bearer Token environment variable
    this.mcpProcess = spawn('npx', ['-y', '@xeroapi/xero-mcp-server@latest'], {
      env: {
        ...process.env,
        XERO_CLIENT_BEARER_TOKEN: this.currentBearerToken
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Setup stderr logging
    this.mcpProcess.stderr.on('data', (data) => {
      const errorMsg = data.toString().trim();
      if (errorMsg) {
        console.error('MCP Server stderr:', errorMsg);
      }
    });

    // Handle process exit
    this.mcpProcess.on('close', (code) => {
      console.log(`MCP Server process exited with code ${code}`);
    });

    // Setup stdout message handler
    const rl = readline.createInterface({
      input: this.mcpProcess.stdout,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      try {
        const message = JSON.parse(line);
        this.handleMessage(message);
      } catch (error) {
        // Ignore non-JSON output (like debug logs)
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('[')) {
          console.log('MCP Server:', trimmed);
        }
      }
    });

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ MCP Server started with Bearer Token');
  }

  /**
   * Handle incoming messages from MCP Server
   */
  handleMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      resolve(message);
    }
  }

  /**
   * Send a request to MCP Server
   */
  async sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${this.requestId++}`;

      this.pendingRequests.set(id, { resolve, reject });

      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.mcpProcess.stdin.write(JSON.stringify(request) + '\n');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('MCP request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * List all tools available from MCP Server
   */
  async listTools() {
    try {
      const response = await this.sendRequest('tools/list');
      return response.result?.tools || [];
    } catch (error) {
      console.error('Failed to list tools:', error);
      return [];
    }
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolName, args = {}) {
    try {
      console.log(`🔧 Calling MCP tool: ${toolName}`, args);
      const response = await this.sendRequest('tools/call', {
        name: toolName,
        arguments: args
      });

      if (response.error) {
        console.error(`❌ MCP Tool Error:`, JSON.stringify(response.error, null, 2));
        throw new Error(JSON.stringify(response.error));
      }

      // Log result content for debugging
      if (response.result && response.result.content) {
        console.log(`📥 MCP Tool Response:`, JSON.stringify(response.result, null, 2));
      }

      return response.result;
    } catch (error) {
      console.error(`❌ Tool call failed: ${toolName}`, error);
      throw error;
    }
  }

  // ==========================================
  // XERO-SPECIFIC METHODS (wrappers around MCP tools)
  // ==========================================

  /**
   * List all contacts
   */
  async listContacts() {
    return await this.callTool('list-contacts');
  }

  /**
   * Create a new contact
   */
  async createContact(contactData) {
    return await this.callTool('create-contact', contactData);
  }

  /**
   * List all invoices
   */
  async listInvoices() {
    return await this.callTool('list-invoices', { page: 1 });
  }

  /**
   * Create a new invoice
   */
  async createInvoice(invoiceData) {
    return await this.callTool('create-invoice', invoiceData);
  }

  /**
   * Create a new quote
   */
  async createQuote(quoteData) {
    return await this.callTool('create-quote', quoteData);
  }

  /**
   * List all quotes
   */
  async listQuotes() {
    return await this.callTool('list-quotes', { page: 1 });
  }

  /**
   * List all accounts
   */
  async listAccounts() {
    return await this.callTool('list-accounts');
  }

  /**
   * Get organisation details
   */
  async getOrganisationDetails() {
    return await this.callTool('list-organisation-details');
  }

  /**
   * Stop the MCP Server
   */
  async stop() {
    if (this.mcpProcess) {
      console.log('🛑 Stopping MCP Server...');
      this.mcpProcess.kill();
      this.mcpProcess = null;
    }
  }
}

module.exports = { XeroMCPClient };
