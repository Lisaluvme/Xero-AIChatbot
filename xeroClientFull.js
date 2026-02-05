/**
 * Xero API Client - Full CRUD Operations
 *
 * Complete admin functionality for Xero:
 * - GET (Read): Retrieve invoices, contacts, accounts, items, payments
 * - POST (Create): Create invoices, contacts, accounts, items, payments
 * - PUT (Update): Update invoices, contacts, accounts, items
 * - DELETE (Remove): Delete invoices, contacts, accounts, items
 * - POS: Point of sale operations
 */

const axios = require('axios');

// ==========================================
// GET OPERATIONS - Retrieve Data
// ==========================================

/**
 * Get all invoices with filtering
 */
async function getInvoices(accessToken, tenantId, filters = {}) {
  try {
    let url = 'https://api.xero.com/api.xro/2.0/Invoices';
    const params = [];

    if (filters.status) params.push(`Status=${filters.status}`);
    if (filters.contact_id) params.push(`ContactID=${filters.contact_id}`);
    if (filters.date) params.push(`Date=${filters.date}`);
    if (filters.since) params.push(`If-Modified-Since=${filters.since}`);

    if (params.length > 0) url += '?' + params.join('&');

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        'Accept': 'application/json'
      }
    });

    return {
      success: true,
      invoices: response.data.Invoices || [],
      count: response.data.Invoices?.length || 0
    };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
}

/**
 * Get single invoice by ID
 */
async function getInvoiceById(invoiceId, accessToken, tenantId) {
  try {
    const response = await axios.get(
      `https://api.xero.com/api.xro/2.0/Invoices/${invoiceId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Accept': 'application/json'
        }
      }
    );

    return {
      success: true,
      invoice: response.data.Invoices[0]
    };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
}

/**
 * Get all contacts
 */
async function getContacts(accessToken, tenantId, filters = {}) {
  try {
    let url = 'https://api.xero.com/api.xro/2.0/Contacts';

    if (filters.where) {
      url += `?where=${encodeURIComponent(filters.where)}`;
    }

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        'Accept': 'application/json'
      }
    });

    return {
      success: true,
      contacts: response.data.Contacts || [],
      count: response.data.Contacts?.length || 0
    };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
}

/**
 * Get contact by ID
 */
async function getContactById(contactId, accessToken, tenantId) {
  try {
    const response = await axios.get(
      `https://api.xero.com/api.xro/2.0/Contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Accept': 'application/json'
        }
      }
    );

    return {
      success: true,
      contact: response.data.Contacts[0]
    };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
}

/**
 * Get all accounts (chart of accounts)
 */
async function getAccounts(accessToken, tenantId, filters = {}) {
  try {
    let url = 'https://api.xero.com/api.xro/2.0/Accounts';

    if (filters.where) {
      url += `?where=${encodeURIComponent(filters.where)}`;
    }

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        'Accept': 'application/json'
      }
    });

    return {
      success: true,
      accounts: response.data.Accounts || [],
      count: response.data.Accounts?.length || 0
    };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
}

/**
 * Get all items/products
 */
async function getItems(accessToken, tenantId, filters = {}) {
  try {
    let url = 'https://api.xero.com/api.xro/2.0/Items';

    if (filters.where) {
      url += `?where=${encodeURIComponent(filters.where)}`;
    }

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        'Accept': 'application/json'
      }
    });

    return {
      success: true,
      items: response.data.Items || [],
      count: response.data.Items?.length || 0
    };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
}

/**
 * Get payments
 */
async function getPayments(accessToken, tenantId, filters = {}) {
  try {
    let url = 'https://api.xero.com/api.xro/2.0/Payments';

    if (filters.where) {
      url += `?where=${encodeURIComponent(filters.where)}`;
    }

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        'Accept': 'application/json'
      }
    });

    return {
      success: true,
      payments: response.data.Payments || [],
      count: response.data.Payments?.length || 0
    };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
}

// ==========================================
// POST OPERATIONS - Create Data
// ==========================================

/**
 * Create invoice
 */
async function createInvoice(invoiceData, accessToken, tenantId) {
  try {
    const xeroInvoice = {
      Type: invoiceData.type || 'ACCREC',
      Contact: {
        ContactID: invoiceData.contact_id || null
      },
      Date: invoiceData.date || new Date().toISOString().split('T')[0],
      DueDate: invoiceData.due_date || invoiceData.date,
      LineItems: invoiceData.line_items || [],
      Status: invoiceData.status || 'DRAFT',
      Reference: invoiceData.reference || '',
      CurrencyCode: invoiceData.currency_code || 'MYR'
    };

    // Add contact name if no ID
    if (!xeroInvoice.Contact.ContactID && invoiceData.contact_name) {
      xeroInvoice.Contact.Name = invoiceData.contact_name;
    }

    const response = await axios.put(
      'https://api.xero.com/api.xro/2.0/Invoices',
      { Invoices: [xeroInvoice] },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      invoice: response.data.Invoices[0],
      message: 'Invoice created successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Create contact
 */
async function createContact(contactData, accessToken, tenantId) {
  try {
    const xeroContact = {
      Name: contactData.name,
      EmailAddress: contactData.email || '',
      PhoneNumber: contactData.phone || '',
      Addresses: contactData.addresses || []
    };

    const response = await axios.put(
      'https://api.xero.com/api.xro/2.0/Contacts',
      { Contacts: [xeroContact] },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      contact: response.data.Contacts[0],
      message: 'Contact created successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Create account
 */
async function createAccount(accountData, accessToken, tenantId) {
  try {
    const xeroAccount = {
      Code: accountData.code,
      Name: accountData.name,
      Type: accountData.type,
      TaxType: accountData.tax_type || 'NONE'
    };

    const response = await axios.put(
      'https://api.xero.com/api.xro/2.0/Accounts',
      { Accounts: [xeroAccount] },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      account: response.data.Accounts[0],
      message: 'Account created successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Create item/product
 */
async function createItem(itemData, accessToken, tenantId) {
  try {
    const xeroItem = {
      Code: itemData.code,
      Name: itemData.name,
      Description: itemData.description || '',
      PurchaseDescription: itemData.purchase_description || '',
      PurchaseDetails: itemData.purchase_details || null,
      SalesDetails: itemData.sales_details || null,
      IsTrackedAsInventory: itemData.is_tracked || false,
      IsSold: itemData.is_sold !== false,
      IsPurchased: itemData.is_purchased !== false
    };

    const response = await axios.put(
      'https://api.xero.com/api.xro/2.0/Items',
      { Items: [xeroItem] },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      item: response.data.Items[0],
      message: 'Item created successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Create payment (POS)
 */
async function createPayment(paymentData, accessToken, tenantId) {
  try {
    const xeroPayment = {
      Invoice: {
        InvoiceID: paymentData.invoice_id
      },
      Account: {
        Code: paymentData.account_code
      },
      Date: paymentData.date || new Date().toISOString().split('T')[0],
      Amount: paymentData.amount,
      Reference: paymentData.reference || '',
      CurrencyRate: paymentData.currency_rate || 1.0
    };

    const response = await axios.put(
      'https://api.xero.com/api.xro/2.0/Payments',
      { Payments: [xeroPayment] },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      payment: response.data.Payments[0],
      message: 'Payment created successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// ==========================================
// PUT OPERATIONS - Update Data
// ==========================================

/**
 * Update invoice
 */
async function updateInvoice(invoiceId, invoiceData, accessToken, tenantId) {
  try {
    const xeroInvoice = {
      InvoiceID: invoiceId,
      Type: invoiceData.type,
      Contact: invoiceData.contact,
      Date: invoiceData.date,
      DueDate: invoiceData.due_date,
      LineItems: invoiceData.line_items,
      Status: invoiceData.status,
      Reference: invoiceData.reference || '',
      CurrencyCode: invoiceData.currency_code || 'MYR'
    };

    const response = await axios.post(
      `https://api.xero.com/api.xro/2.0/Invoices/${invoiceId}`,
      { Invoices: [xeroInvoice] },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      invoice: response.data.Invoices[0],
      message: 'Invoice updated successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Update contact
 */
async function updateContact(contactId, contactData, accessToken, tenantId) {
  try {
    const xeroContact = {
      ContactID: contactId,
      Name: contactData.name,
      EmailAddress: contactData.email || '',
      PhoneNumber: contactData.phone || '',
      Addresses: contactData.addresses || []
    };

    const response = await axios.post(
      `https://api.xero.com/api.xro/2.0/Contacts/${contactId}`,
      { Contacts: [xeroContact] },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      contact: response.data.Contacts[0],
      message: 'Contact updated successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Update account
 */
async function updateAccount(accountId, accountData, accessToken, tenantId) {
  try {
    const xeroAccount = {
      AccountID: accountId,
      Code: accountData.code,
      Name: accountData.name,
      Type: accountData.type,
      TaxType: accountData.tax_type || 'NONE'
    };

    const response = await axios.post(
      `https://api.xero.com/api.xro/2.0/Accounts/${accountId}`,
      { Accounts: [xeroAccount] },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      account: response.data.Accounts[0],
      message: 'Account updated successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Update item
 */
async function updateItem(itemId, itemData, accessToken, tenantId) {
  try {
    const xeroItem = {
      ItemID: itemId,
      Code: itemData.code,
      Name: itemData.name,
      Description: itemData.description || '',
      PurchaseDescription: itemData.purchase_description || '',
      PurchaseDetails: itemData.purchase_details || null,
      SalesDetails: itemData.sales_details || null,
      IsTrackedAsInventory: itemData.is_tracked || false,
      IsSold: itemData.is_sold !== false,
      IsPurchased: itemData.is_purchased !== false
    };

    const response = await axios.post(
      `https://api.xero.com/api.xro/2.0/Items/${itemId}`,
      { Items: [xeroItem] },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      item: response.data.Items[0],
      message: 'Item updated successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// ==========================================
// DELETE OPERATIONS - Remove Data
// ==========================================

/**
 * Delete invoice
 */
async function deleteInvoice(invoiceId, accessToken, tenantId) {
  try {
    const response = await axios.delete(
      `https://api.xero.com/api.xro/2.0/Invoices/${invoiceId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId
        }
      }
    );

    return {
      success: true,
      message: 'Invoice deleted successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Delete contact
 */
async function deleteContact(contactId, accessToken, tenantId) {
  try {
    const response = await axios.delete(
      `https://api.xero.com/api.xro/2.0/Contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId
        }
      }
    );

    return {
      success: true,
      message: 'Contact deleted successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Delete item
 */
async function deleteItem(itemId, accessToken, tenantId) {
  try {
    const response = await axios.delete(
      `https://api.xero.com/api.xro/2.0/Items/${itemId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId
        }
      }
    );

    return {
      success: true,
      message: 'Item deleted successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Delete payment
 */
async function deletePayment(paymentId, accessToken, tenantId) {
  try {
    const response = await axios.delete(
      `https://api.xero.com/api.xro/2.0/Payments/${paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId
        }
      }
    );

    return {
      success: true,
      message: 'Payment deleted successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Get or create contact
 */
async function getOrCreateContact(contactName, accessToken, tenantId) {
  try {
    const search = await getContacts(accessToken, tenantId, {
      where: `Name=="${contactName}"`
    });

    if (search.success && search.contacts.length > 0) {
      return {
        success: true,
        contact: search.contacts[0],
        created: false
      };
    }

    const create = await createContact({ name: contactName }, accessToken, tenantId);
    return {
      success: create.success,
      contact: create.contact,
      created: true
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  // GET
  getInvoices,
  getInvoiceById,
  getContacts,
  getContactById,
  getAccounts,
  getItems,
  getPayments,

  // POST (Create)
  createInvoice,
  createContact,
  createAccount,
  createItem,
  createPayment,

  // PUT (Update)
  updateInvoice,
  updateContact,
  updateAccount,
  updateItem,

  // DELETE
  deleteInvoice,
  deleteContact,
  deleteItem,
  deletePayment,

  // Utility
  getOrCreateContact
};
