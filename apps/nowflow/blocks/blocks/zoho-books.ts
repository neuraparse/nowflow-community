import { ZohoBooksIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const ZohoBooksBlock = defineBlock({
  type: 'zoho_books',
  name: 'Zoho Books',
  description: 'Comprehensive accounting within Zoho ecosystem',
  longDescription:
    'Integrate with Zoho Books for comprehensive accounting automation, invoice management, expense tracking, and financial reporting. Perfect for businesses in the Zoho ecosystem with OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#C8202F',
  icon: ZohoBooksIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'zoho_books',
      serviceId: 'zoho_books',
      requiredScopes: ['ZohoBooks.fullaccess.all'],
      title: 'Zoho Books Account',
      placeholder: 'Select Zoho Books account',
    }),
    createOperationDropdown({
      operations: [
        { id: 'create_invoice', label: 'Create Invoice' },
        { id: 'get_invoice', label: 'Get Invoice' },
        { id: 'list_invoices', label: 'List Invoices' },
        { id: 'create_contact', label: 'Create Contact' },
        { id: 'get_contact', label: 'Get Contact' },
        { id: 'list_contacts', label: 'List Contacts' },
        { id: 'create_expense', label: 'Create Expense' },
        { id: 'list_expenses', label: 'List Expenses' },
        { id: 'create_bill', label: 'Create Bill' },
        { id: 'list_bills', label: 'List Bills' },
        { id: 'create_payment', label: 'Create Payment' },
        { id: 'get_balance_sheet', label: 'Get Balance Sheet' },
      ],
      defaultValue: 'list_invoices',
    }),
    {
      id: 'invoiceId',
      title: 'Invoice ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter invoice ID',
      condition: { field: 'operation', value: 'get_invoice' },
    },
    {
      id: 'contactId',
      title: 'Contact ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter contact ID',
      condition: { field: 'operation', value: ['get_contact', 'create_invoice', 'create_bill'] },
    },
    {
      id: 'contactName',
      title: 'Contact Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Company or Person Name',
      condition: { field: 'operation', value: 'create_contact' },
    },
    {
      id: 'email',
      title: 'Email',
      type: 'short-input',
      layout: 'half',
      placeholder: 'contact@example.com',
      condition: { field: 'operation', value: 'create_contact' },
    },
    {
      id: 'amount',
      title: 'Amount',
      type: 'short-input',
      layout: 'half',
      placeholder: '100.00',
      condition: {
        field: 'operation',
        value: ['create_invoice', 'create_bill', 'create_expense', 'create_payment'],
      },
    },
    {
      id: 'description',
      title: 'Description',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Line item description',
      condition: {
        field: 'operation',
        value: ['create_invoice', 'create_bill', 'create_expense'],
      },
    },
    {
      id: 'dueDate',
      title: 'Due Date',
      type: 'short-input',
      layout: 'half',
      placeholder: 'YYYY-MM-DD',
      condition: { field: 'operation', value: ['create_invoice', 'create_bill'] },
    },
  ],
  tools: {
    access: ['zoho_books_api'],
    config: {
      tool: () => 'zoho_books_api',
      params: (params) => {
        const { credential, amount, ...rest } = params as Record<string, any>
        return {
          credential,
          amount: amount ? parseFloat(amount) : undefined,
          ...rest,
        }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    invoiceId: { type: 'string', required: false },
    contactId: { type: 'string', required: false },
    contactName: { type: 'string', required: false },
    email: { type: 'string', required: false },
    amount: { type: 'string', required: false },
    description: { type: 'string', required: false },
    dueDate: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
