import { PayPalIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const PayPalBlock = defineBlock({
  type: 'paypal',
  name: 'PayPal',
  description: 'Process payments and manage transactions with PayPal',
  longDescription:
    'Integrate with PayPal to process payments, create invoices, manage subscriptions, handle refunds, and access transaction data. Accept payments from 400M+ PayPal users worldwide using OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#003087',
  icon: PayPalIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'paypal',
      serviceId: 'paypal',
      requiredScopes: [
        'https://uri.paypal.com/services/payments/payment',
        'https://uri.paypal.com/services/payments/refund',
        'https://uri.paypal.com/services/invoicing',
      ],
      title: 'PayPal Account',
      placeholder: 'Select PayPal account',
    }),
    createOperationDropdown({
      operations: [
        { id: 'create_payment', label: 'Create Payment' },
        { id: 'capture_payment', label: 'Capture Payment' },
        { id: 'refund_payment', label: 'Refund Payment' },
        { id: 'create_invoice', label: 'Create Invoice' },
        { id: 'get_invoice', label: 'Get Invoice' },
        { id: 'list_invoices', label: 'List Invoices' },
        { id: 'create_subscription', label: 'Create Subscription' },
        { id: 'get_subscription', label: 'Get Subscription' },
      ],
      defaultValue: 'create_payment',
    }),
    {
      id: 'amount',
      title: 'Amount',
      type: 'short-input',
      layout: 'half',
      placeholder: '100.00',
      condition: { field: 'operation', value: ['create_payment', 'refund_payment'] },
    },
    {
      id: 'currency',
      title: 'Currency',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'USD', label: 'USD' },
        { id: 'EUR', label: 'EUR' },
        { id: 'GBP', label: 'GBP' },
        { id: 'CAD', label: 'CAD' },
        { id: 'AUD', label: 'AUD' },
        { id: 'JPY', label: 'JPY' },
      ],
      value: () => 'USD',
      condition: { field: 'operation', value: ['create_payment', 'refund_payment'] },
    },
    {
      id: 'paymentId',
      title: 'Payment ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'PAYID-XXXXXX',
      condition: { field: 'operation', value: ['capture_payment', 'refund_payment'] },
    },
    {
      id: 'invoiceId',
      title: 'Invoice ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'INV2-XXXX-XXXX-XXXX',
      condition: { field: 'operation', value: ['get_invoice'] },
    },
    {
      id: 'description',
      title: 'Description',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Payment for services',
      condition: { field: 'operation', value: ['create_payment', 'create_invoice'] },
    },
  ],
  tools: {
    access: ['paypal_api'],
    config: {
      tool: () => 'paypal_api',
      params: (params) => {
        const { credential, ...rest } = params as Record<string, any>
        return {
          credential,
          ...rest,
        }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    amount: { type: 'string', required: false },
    currency: { type: 'string', required: false },
    paymentId: { type: 'string', required: false },
    invoiceId: { type: 'string', required: false },
    description: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
