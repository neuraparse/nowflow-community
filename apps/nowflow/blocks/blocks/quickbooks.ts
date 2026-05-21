import { QuickBooksIcon } from '@/components/icons'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  createParamTransformer,
  defineBlock,
} from '../helpers'

export const QuickBooksBlock = defineBlock({
  type: 'quickbooks',
  name: 'QuickBooks',
  description: 'Manage accounting and financial data with QuickBooks',
  longDescription:
    'Integrate with QuickBooks Online to manage invoices, customers, vendors, expenses, and financial reports. Access comprehensive accounting features for small and medium businesses using OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#2CA01C',
  icon: QuickBooksIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'quickbooks',
      serviceId: 'quickbooks',
      requiredScopes: ['com.intuit.quickbooks.accounting'],
      title: 'QuickBooks Account',
      placeholder: 'Select QuickBooks account',
    }),
    createOperationDropdown({
      operations: [
        { id: 'create_invoice', label: 'Create Invoice' },
        { id: 'get_invoice', label: 'Get Invoice' },
        { id: 'list_invoices', label: 'List Invoices' },
        { id: 'create_customer', label: 'Create Customer' },
        { id: 'get_customer', label: 'Get Customer' },
        { id: 'list_customers', label: 'List Customers' },
        { id: 'create_expense', label: 'Create Expense' },
        { id: 'list_expenses', label: 'List Expenses' },
        { id: 'create_payment', label: 'Create Payment' },
        { id: 'get_profit_loss', label: 'Get Profit & Loss Report' },
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
      id: 'customerId',
      title: 'Customer ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter customer ID',
      condition: { field: 'operation', value: ['get_customer', 'create_invoice'] },
    },
    {
      id: 'customerName',
      title: 'Customer Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'John Doe',
      condition: { field: 'operation', value: 'create_customer' },
    },
    {
      id: 'amount',
      title: 'Amount',
      type: 'short-input',
      layout: 'half',
      placeholder: '100.00',
      condition: {
        field: 'operation',
        value: ['create_invoice', 'create_expense', 'create_payment'],
      },
    },
    {
      id: 'description',
      title: 'Description',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Description of the transaction',
      condition: {
        field: 'operation',
        value: ['create_invoice', 'create_expense', 'create_payment'],
      },
    },
    {
      id: 'startDate',
      title: 'Start Date',
      type: 'short-input',
      layout: 'half',
      placeholder: 'YYYY-MM-DD',
      condition: { field: 'operation', value: 'get_profit_loss' },
    },
    {
      id: 'endDate',
      title: 'End Date',
      type: 'short-input',
      layout: 'half',
      placeholder: 'YYYY-MM-DD',
      condition: { field: 'operation', value: 'get_profit_loss' },
    },
  ],
  tools: {
    access: ['quickbooks_api'],
    config: {
      tool: () => 'quickbooks_api',
      params: createParamTransformer({ amount: 'number' }),
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    invoiceId: { type: 'string', required: false },
    customerId: { type: 'string', required: false },
    customerName: { type: 'string', required: false },
    amount: { type: 'string', required: false },
    description: { type: 'string', required: false },
    startDate: { type: 'string', required: false },
    endDate: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
