import { XeroIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const XeroBlock = defineBlock({
  type: 'xero',
  name: 'Xero',
  description: 'Manage accounting and bookkeeping with Xero',
  longDescription:
    'Integrate with Xero accounting software to manage invoices, bills, contacts, bank transactions, and financial reports. Perfect for small businesses and accountants using OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#13B5EA',
  icon: XeroIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'xero',
      serviceId: 'xero',
      requiredScopes: [
        'openid',
        'profile',
        'email',
        'accounting.transactions',
        'accounting.contacts',
        'accounting.settings',
        'offline_access',
      ],
      title: 'Xero Account',
      placeholder: 'Select Xero account',
    }),
    createOperationDropdown({
      operations: [
        { id: 'create_invoice', label: 'Create Invoice' },
        { id: 'get_invoice', label: 'Get Invoice' },
        { id: 'list_invoices', label: 'List Invoices' },
        { id: 'create_contact', label: 'Create Contact' },
        { id: 'get_contact', label: 'Get Contact' },
        { id: 'list_contacts', label: 'List Contacts' },
        { id: 'create_bill', label: 'Create Bill' },
        { id: 'list_bills', label: 'List Bills' },
        { id: 'list_bank_transactions', label: 'List Bank Transactions' },
        { id: 'get_balance_sheet', label: 'Get Balance Sheet' },
      ],
      defaultValue: 'list_invoices',
    }),
    {
      id: 'invoiceId',
      title: 'Invoice ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter invoice ID (GUID)',
      condition: { field: 'operation', value: 'get_invoice' },
    },
    {
      id: 'contactId',
      title: 'Contact ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter contact ID (GUID)',
      condition: { field: 'operation', value: ['get_contact', 'create_invoice', 'create_bill'] },
    },
    {
      id: 'contactName',
      title: 'Contact Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Company Name or Person',
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
      condition: { field: 'operation', value: ['create_invoice', 'create_bill'] },
    },
    {
      id: 'description',
      title: 'Description',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Line item description',
      condition: { field: 'operation', value: ['create_invoice', 'create_bill'] },
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
    access: ['xero_api'],
    config: {
      tool: () => 'xero_api',
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
