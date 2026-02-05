/**
 * Xero Accounting Business Logic
 *
 * This module provides calculation and formatting functions for Xero accounting.
 * It handles:
 * - Line item calculations (subtotal, tax, total)
 * - MYR currency formatting
 * - Tax type handling (NONE, SST, GST)
 * - Line amount type handling (Exclusive, Inclusive)
 * - Discount calculations
 * - Date formatting
 *
 * Xero Tax Types for Malaysia:
 * - NONE: No tax
 * - SST 6%: Sales and Service Tax (6%)
 * - SST 10%: Service Tax (10% for specific services)
 *
 * Line Amount Types:
 * - Exclusive: Tax is calculated ON TOP of unit amounts
 * - Inclusive: Tax is INCLUDED in unit amounts
 */

/**
 * Calculate line item totals
 *
 * @param {Array} lineItems - Array of line items
 * @param {string} lineAmountType - 'Exclusive' or 'Inclusive'
 * @returns {Object} - Calculated line items with extended amounts
 */
function calculateLineItems(lineItems, lineAmountType = 'Exclusive') {
  return lineItems.map(item => {
    const quantity = parseFloat(item.quantity) || 0;
    const unitAmount = parseFloat(item.unit_amount) || 0;
    const discountRate = parseFloat(item.discount_rate) || 0;

    // Calculate line amount (quantity × unit amount)
    let lineAmount = quantity * unitAmount;

    // Apply discount if present
    let discountAmount = 0;
    if (discountRate > 0) {
      discountAmount = lineAmount * (discountRate / 100);
      lineAmount = lineAmount - discountAmount;
    }

    // Calculate tax based on tax type and line amount type
    let taxAmount = 0;
    let taxRate = 0;

    if (item.tax_type && item.tax_type !== 'NONE') {
      // Extract tax rate from tax_type (e.g., "SST 6%" -> 6)
      taxRate = extractTaxRate(item.tax_type);

      if (lineAmountType === 'Exclusive') {
        // Tax is calculated ON TOP of the line amount
        taxAmount = lineAmount * (taxRate / 100);
      } else {
        // Tax is INCLUDED in the line amount
        // Formula: taxAmount = lineAmount × (taxRate / (100 + taxRate))
        taxAmount = lineAmount * (taxRate / (100 + taxRate));
      }
    }

    // Calculate total (line amount + tax for exclusive, or just line amount for inclusive)
    let total;
    if (lineAmountType === 'Exclusive') {
      total = lineAmount + taxAmount;
    } else {
      total = lineAmount; // Tax is already included
    }

    return {
      ...item,
      line_amount: lineAmount,
      tax_amount: taxAmount,
      tax_rate: taxRate,
      discount_amount: discountAmount,
      total: total
    };
  });
}

/**
 * Calculate invoice/quotation totals
 *
 * @param {Array} lineItems - Array of line items (with calculated amounts)
 * @returns {Object} - Summary totals
 */
function calculateTotals(lineItems) {
  const subtotal = lineItems.reduce((sum, item) => sum + (item.line_amount || 0), 0);
  const totalTax = lineItems.reduce((sum, item) => sum + (item.tax_amount || 0), 0);
  const totalDiscount = lineItems.reduce((sum, item) => sum + (item.discount_amount || 0), 0);

  // Grand total depends on whether tax is inclusive or exclusive
  // For exclusive: total = subtotal + totalTax
  // For inclusive: total = subtotal (tax already included)
  const hasExclusiveTax = lineItems.some(item =>
    item.tax_type && item.tax_type !== 'NONE'
  );

  let total;
  if (hasExclusiveTax) {
    total = subtotal + totalTax;
  } else {
    total = subtotal;
  }

  return {
    subtotal: roundToTwoDecimals(subtotal),
    total_tax: roundToTwoDecimals(totalTax),
    total_discount: roundToTwoDecimals(totalDiscount),
    total: roundToTwoDecimals(total),
    line_count: lineItems.length
  };
}

/**
 * Extract tax rate from tax type string
 *
 * @param {string} taxType - Xero tax type (e.g., "SST 6%", "GST 6%")
 * @returns {number} - Tax rate as percentage (e.g., 6)
 */
function extractTaxRate(taxType) {
  // Match common patterns: "SST 6%", "GST 6%", "6%", "OUTPUT6%"
  const match = taxType.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Get Xero tax type name for Malaysia
 *
 * @param {number} rate - Tax rate (e.g., 6, 10)
 * @param {string} type - 'SST' or 'GST'
 * @returns {string} - Xero tax type code
 */
function getXeroTaxType(rate = 0, type = 'SST') {
  if (rate === 0) return 'NONE';

  // Common Xero tax types for Malaysia
  const taxTypes = {
    'SST': {
      6: 'SST 6%',
      10: 'SST 10%'
    },
    'GST': {
      6: 'GST 6%'
    }
  };

  return taxTypes[type]?.[rate] || `${type} ${rate}%`;
}

/**
 * Format currency as MYR
 *
 * @param {number} amount - Amount to format
 * @param {boolean} withSymbol - Include "RM" prefix
 * @returns {string} - Formatted currency string (e.g., "RM 1,234.56" or "1,234.56")
 */
function formatCurrency(amount, withSymbol = true) {
  const formatted = parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  return withSymbol ? `RM ${formatted}` : formatted;
}

/**
 * Parse currency string to number
 *
 * @param {string} currencyString - Currency string (e.g., "RM 1,234.56" or "1,234.56")
 * @returns {number} - Parsed number
 */
function parseCurrency(currencyString) {
  if (typeof currencyString === 'number') return currencyString;

  // Remove "RM", spaces, and commas, then parse
  const cleaned = currencyString
    .replace(/RM/gi, '')
    .replace(/,/g, '')
    .trim();

  return parseFloat(cleaned) || 0;
}

/**
 * Round to 2 decimal places (for currency)
 *
 * @param {number} num - Number to round
 * @returns {number} - Rounded number
 */
function roundToTwoDecimals(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Validate line item data
 *
 * @param {Object} item - Line item to validate
 * @returns {Object} - Validation result with errors if any
 */
function validateLineItem(item) {
  const errors = [];

  if (!item.description || item.description.trim() === '') {
    errors.push('Description is required');
  }

  if (!item.quantity || parseFloat(item.quantity) <= 0) {
    errors.push('Quantity must be greater than 0');
  }

  if (!item.unit_amount || parseFloat(item.unit_amount) < 0) {
    errors.push('Unit amount must be 0 or greater');
  }

  if (!item.account_code) {
    errors.push('Account code is required');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate invoice/quotation data
 *
 * @param {Object} data - Document data to validate
 * @returns {Object} - Validation result with errors if any
 */
function validateDocument(data) {
  const errors = [];

  if (!data.contact_name || data.contact_name.trim() === '') {
    errors.push('Contact name is required');
  }

  if (!data.date) {
    errors.push('Date is required');
  }

  if (!data.line_items || !Array.isArray(data.line_items) || data.line_items.length === 0) {
    errors.push('At least one line item is required');
  } else {
    // Validate each line item
    data.line_items.forEach((item, index) => {
      const itemValidation = validateLineItem(item);
      if (!itemValidation.valid) {
        errors.push(`Line item ${index + 1}: ${itemValidation.errors.join(', ')}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Format date as YYYY-MM-DD (Xero API format)
 *
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) {
    throw new Error('Invalid date');
  }

  return d.toISOString().split('T')[0];
}

/**
 * Add days to a date
 *
 * @param {Date|string} date - Start date
 * @param {number} days - Number of days to add (can be negative)
 * @returns {string} - Formatted date string
 */
function addDays(date, days) {
  const d = date instanceof Date ? date : new Date(date);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/**
 * Generate summary text for invoice/quotation
 *
 * @param {Object} data - Document data with calculated totals
 * @param {string} docType - 'Invoice' or 'Quotation'
 * @returns {string} - Human-readable summary
 */
function generateDocumentSummary(data, docType = 'Invoice') {
  const lines = data.line_items || [];

  let summary = `${docType} Summary\n`;
  summary += `═══════════════════════════════════\n`;
  summary += `Contact: ${data.contact_name}\n`;
  summary += `Date: ${data.date}\n`;
  if (data.due_date) {
    summary += `Due Date: ${data.due_date}\n`;
  }
  summary += `\n`;

  summary += `Line Items:\n`;
  lines.forEach((item, index) => {
    const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_amount) || 0);
    summary += `  ${index + 1}. ${item.description}\n`;
    summary += `     Qty: ${item.quantity} × ${formatCurrency(item.unit_amount)} = ${formatCurrency(lineTotal)}\n`;
    if (item.tax_type && item.tax_type !== 'NONE') {
      summary += `     Tax: ${item.tax_type}\n`;
    }
  });

  if (data.subtotal !== undefined) {
    summary += `\n`;
    summary += `Subtotal: ${formatCurrency(data.subtotal)}\n`;
    if (data.total_tax > 0) {
      summary += `Tax: ${formatCurrency(data.total_tax)}\n`;
    }
    if (data.total_discount > 0) {
      summary += `Discount: -${formatCurrency(data.total_discount)}\n`;
    }
    summary += `─────────────────────────────────\n`;
    summary += `TOTAL: ${formatCurrency(data.total)}\n`;
  }

  return summary;
}

/**
 * Calculate and prepare complete document data
 *
 * This is the main function that combines all calculations.
 * Use this before sending data to Xero API.
 *
 * @param {Object} documentData - Raw document data
 * @param {string} lineAmountType - 'Exclusive' or 'Inclusive'
 * @returns {Object} - Complete document with all calculations
 */
function prepareDocument(documentData, lineAmountType = 'Exclusive') {
  // Validate first
  const validation = validateDocument(documentData);
  if (!validation.valid) {
    throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
  }

  // Calculate line items
  const calculatedLineItems = calculateLineItems(
    documentData.line_items,
    lineAmountType
  );

  // Calculate totals
  const totals = calculateTotals(calculatedLineItems);

  // Return complete document
  return {
    ...documentData,
    line_items: calculatedLineItems,
    ...totals,
    line_amount_types: lineAmountType
  };
}

module.exports = {
  // Calculations
  calculateLineItems,
  calculateTotals,
  extractTaxRate,

  // Tax handling
  getXeroTaxType,

  // Currency
  formatCurrency,
  parseCurrency,
  roundToTwoDecimals,

  // Validation
  validateLineItem,
  validateDocument,

  // Dates
  formatDate,
  addDays,

  // Summary
  generateDocumentSummary,

  // Main function
  prepareDocument
};
