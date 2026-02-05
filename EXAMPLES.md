# 💬 Example Chat Messages - Xero AI Chatbot

Comprehensive list of example messages to test the chatbot's capabilities.

---

## 📋 Table of Contents

1. [Creating Documents](#creating-documents)
2. [Accounting Questions](#accounting-questions)
3. [Calculations](#calculations)
4. [Missing Information Scenarios](#missing-information-scenarios)
5. [Multi-turn Conversations](#multi-turn-conversations)

---

## Creating Documents

### Create Invoice - Complete Information

```
Create an invoice for ABC Company Sdn Bhd, 2 items: Web Design RM2000, Hosting RM500, date 2026-01-29
```

**Expected Response**:
- AI confirms details
- Creates invoice in Xero
- Returns invoice number and URL

---

### Create Quotation

```
Generate a quotation for XYZ Corporation with 3 items:
- Consulting Services RM150/hour, 10 hours
- Documentation RM500
- Training RM800
Date: 2026-02-01
```

**Expected Response**:
- Calculates total (RM1500 + RM500 + RM800 = RM2800)
- Creates quotation in Xero
- Returns quotation details

---

### Create Invoice with Due Date

```
Create an invoice for John Doe, 2 items: Product A RM100, Product B RM200,
date 2026-01-29, due date 2026-02-28, reference: INV-001
```

**Expected Response**:
- Creates invoice with specified due date
- Includes reference number

---

### Create Invoice with Tax (SST)

```
Create an invoice for Tech Solutions, 1 item: Software License RM5000,
with SST 6%, date 2026-01-29
```

**Expected Response**:
- Calculates SST (6% of RM5000 = RM300)
- Total: RM5300
- Creates invoice with tax

---

## Accounting Questions

### Invoice vs Quotation

```
What's the difference between a quote and an invoice?
```

**Expected Response**:
- Explains quotation is preliminary
- Invoice is formal request for payment
- Key differences explained

---

### Payment Terms

```
What are common payment terms I should use?
```

**Expected Response**:
- Lists common terms (Net 30, Net 15, etc.)
- Explains what they mean
- Recommends based on business type

---

### Recording Expenses

```
How do I record business expenses in Xero?
```

**Expected Response**:
- Explains expense tracking process
- Mentions receipts, categories
- Provides best practices

---

### Tax Questions

```
What is SST and when should I charge it?
```

**Expected Response**:
- Explains Sales and Service Tax (Malaysia)
- Lists taxable services
- Explains current rates

---

### Account Codes

```
What account code should I use for consulting income?
```

**Expected Response**:
- Recommends account code (e.g., 200)
- Explains chart of accounts
- Suggests consulting accountant

---

## Calculations

### Simple Total

```
Calculate total for 5 items at RM50 each
```

**Expected Response**:
```
Subtotal: RM250.00
Total: RM250.00
```

---

### With Discount

```
Calculate total for 10 items at RM100 each with 10% discount
```

**Expected Response**:
```
Subtotal: RM1,000.00
Discount (10%): -RM100.00
Total: RM900.00
```

---

### With Tax

```
What's the total for RM2000 with 6% SST?
```

**Expected Response**:
```
Subtotal: RM2,000.00
Tax (6%): RM120.00
Total: RM2,120.00
```

---

### Complex Calculation

```
Calculate total for invoice:
- Item 1: RM500, quantity 3
- Item 2: RM200, quantity 5
- Item 3: RM150, quantity 2
With 5% discount and 6% SST
```

**Expected Response**:
```
Item 1: RM1,500.00 (3 × RM500)
Item 2: RM1,000.00 (5 × RM200)
Item 3: RM300.00 (2 × RM150)

Subtotal: RM2,800.00
Discount (5%): -RM140.00
After discount: RM2,660.00
Tax (6%): RM159.60
Total: RM2,819.60
```

---

### Profit Margin

```
If I sell for RM500 and it costs me RM300, what's my profit margin?
```

**Expected Response**:
```
Cost: RM300.00
Selling price: RM500.00
Profit: RM200.00
Profit margin: 40%
```

---

## Missing Information Scenarios

### Just "Create Invoice"

```
Create an invoice
```

**Expected Response**:
```
I'd be happy to help you create an invoice! I need some information:

1. Customer name
2. Invoice date
3. Line items (description, quantity, price)

Could you please provide these details?
```

---

### Missing Customer Name

```
Create an invoice with 2 items: Web Design RM2000, Hosting RM500
```

**Expected Response**:
```
I can help with that! Just need to know:
- Which customer is this for?
- What date should I use for the invoice?
```

---

### Missing Items

```
Create an invoice for ABC Company
```

**Expected Response**:
```
Sure! What items should I include on the invoice for ABC Company?
Please provide:
- Item descriptions
- Quantities
- Prices
```

---

## Multi-turn Conversations

### Conversation 1: Building Invoice

```
User: I want to create an invoice
AI: Great! I'll need some details. What's the customer name?

User: ABC Company Sdn Bhd
AI: Got it. What items should I include?

User: 2 items - Consulting RM2000 and Training RM1000
AI: Perfect. What date should I use?

User: Today
AI: Great! Creating invoice for ABC Company Sdn Bhd with:
- Consulting: RM2,000.00
- Training: RM1,000.00
- Total: RM3,000.00
- Date: 2026-01-29

[Creates invoice in Xero]
```

---

### Conversation 2: Calculation Then Create

```
User: How much for 5 hours at RM150 per hour?
AI: That would be RM750.00 (5 × RM150)

User: Create an invoice for that
AI: Sure! I'll need:
- Customer name
- Any other details?

User: For XYZ Corp, date today
AI: Creating invoice for XYZ Corp:
- Consulting: RM750.00 (5 hours @ RM150/hr)
- Total: RM750.00

[Creates invoice in Xero]
```

---

### Conversation 3: Ask Then Create

```
User: What's the difference between Net 30 and Net 15?
AI: Net 30 means payment is due within 30 days of the invoice date.
    Net 15 means payment is due within 15 days.
    Net 15 gives you faster payment but less time for the customer.

User: Create a quotation with Net 15 terms
AI: I'll create that. What customer and items?

User: ABC Company, Web Development RM5000
AI: Creating quotation for ABC Company:
- Web Development: RM5,000.00
- Payment terms: Net 15
- Due date: 2026-02-13

[Creates quotation in Xero]
```

---

## Error Handling Examples

### Invalid Date

```
Create an invoice for ABC Company, Web Design RM2000, date 2026-13-45
```

**Expected Response**:
```
I notice there's an issue with the date. Could you please provide a valid date?
Format: YYYY-MM-DD (e.g., 2026-01-29)
```

---

### Zero Quantity

```
Create an invoice with 0 items at RM100 each
```

**Expected Response**:
```
The quantity can't be zero. Would you like to adjust that?
```

---

### Negative Price

```
Create an invoice for ABC Company with item at -RM100
```

**Expected Response**:
```
Prices can't be negative. Would you like to use a credit note instead?
```

---

## Quick Test Messages

Copy and paste these to test quickly:

```
Hello! What can you do?
```

```
Calculate 15% discount on RM5000
```

```
Create an invoice for Test Customer, 1 item: Services RM1000
```

```
What's RM500 plus RM300 with 10% tax?
```

```
Tell me about Xero integration
```

---

## Expected AI Behavior

### ✅ Good Responses

- Confirms understanding
- Asks for missing info politely
- Shows calculations clearly
- Confirms before creating documents
- Provides Xero invoice URL

### ❌ Avoid

- Creating invoices without confirmation
- Ignoring missing information
- Making up customer names
- Incorrect calculations
- Vague responses

---

## Testing Tips

1. **Start Simple**: Test basic questions first
2. **Test Calculations**: Verify math is correct
3. **Test Missing Info**: See how AI handles incomplete data
4. **Test Xero Connection**: Ensure OAuth works
5. **Test Invoice Creation**: Verify invoices appear in Xero
6. **Test Errors**: Try invalid inputs

---

## Example Full Session

```
User: 👋 Hello!

AI: 👋 Hello! I'm your AI accounting assistant.
     I can help you with:
     - Creating invoices and quotations
     - Answering accounting questions
     - Performing calculations

     What would you like to do?

User: Create an invoice

AI: Sure! I'll need some details:
     1. Customer name
     2. Line items (description, quantity, price)
     3. Date (optional, will use today if not specified)

User: ABC Company, Web Design RM2000, date 2026-01-29

AI: Got it! Creating invoice for ABC Company:
     - Web Design: RM2,000.00
     - Total: RM2,000.00
     - Date: 2026-01-29

     ✅ Invoice created successfully!
     Invoice Number: INV-0042
     View in Xero: [link]

User: Thanks!

AI: You're welcome! Let me know if you need anything else.
```

---

**Use these examples to thoroughly test your chatbot before deployment!**
