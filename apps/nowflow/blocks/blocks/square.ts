import { SquareIcon } from '@/components/icons'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  createParamTransformer,
  defineBlock,
} from '../helpers'

export const SquareBlock = defineBlock({
  type: 'square',
  name: 'Square',
  description: 'Accept payments and manage business operations with Square',
  longDescription:
    'Integrate with Square to process payments, manage inventory, create invoices, and handle customer data. Perfect for small businesses and retailers with POS integration using OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#000000',
  icon: SquareIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'square',
      serviceId: 'square',
      requiredScopes: ['PAYMENTS_WRITE', 'PAYMENTS_READ', 'ORDERS_WRITE', 'ORDERS_READ'],
      title: 'Square Account',
      placeholder: 'Select Square account',
    }),
    createOperationDropdown({
      operations: [
        { id: 'create_payment', label: 'Create Payment' },
        { id: 'get_payment', label: 'Get Payment' },
        { id: 'list_payments', label: 'List Payments' },
        { id: 'refund_payment', label: 'Refund Payment' },
        { id: 'create_order', label: 'Create Order' },
        { id: 'get_order', label: 'Get Order' },
        { id: 'update_order', label: 'Update Order' },
        { id: 'create_checkout', label: 'Create Checkout' },
      ],
      defaultValue: 'create_payment',
    }),
    {
      id: 'amount',
      title: 'Amount (in cents)',
      type: 'short-input',
      layout: 'half',
      placeholder: '10000',
      condition: { field: 'operation', value: ['create_payment', 'refund_payment'] },
    },
    {
      id: 'currency',
      title: 'Currency',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'USD', label: 'USD' },
        { id: 'CAD', label: 'CAD' },
        { id: 'GBP', label: 'GBP' },
        { id: 'EUR', label: 'EUR' },
        { id: 'AUD', label: 'AUD' },
        { id: 'JPY', label: 'JPY' },
      ],
      value: () => 'USD',
      condition: {
        field: 'operation',
        value: ['create_payment', 'refund_payment', 'create_order'],
      },
    },
    {
      id: 'paymentId',
      title: 'Payment ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter payment ID',
      condition: { field: 'operation', value: ['get_payment', 'refund_payment'] },
    },
    {
      id: 'orderId',
      title: 'Order ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter order ID',
      condition: { field: 'operation', value: ['get_order', 'update_order'] },
    },
    {
      id: 'sourceId',
      title: 'Source ID (Card Nonce)',
      type: 'short-input',
      layout: 'full',
      placeholder: 'cnon:...',
      condition: { field: 'operation', value: 'create_payment' },
    },
    {
      id: 'note',
      title: 'Note',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Payment note',
      condition: { field: 'operation', value: ['create_payment', 'create_order'] },
    },
  ],
  tools: {
    access: ['square_api'],
    config: {
      tool: () => 'square_api',
      params: createParamTransformer({ amount: 'number' }),
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    amount: { type: 'string', required: false },
    currency: { type: 'string', required: false },
    paymentId: { type: 'string', required: false },
    orderId: { type: 'string', required: false },
    sourceId: { type: 'string', required: false },
    note: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
