import { PaddleIcon } from '@/components/icons'
import { createOperationDropdown, createSimpleToolConfig, defineBlock } from '../helpers'

export const PaddleBlock = defineBlock({
  type: 'paddle',
  name: 'Paddle',
  description: 'Merchant of Record for SaaS subscription billing',
  longDescription:
    'Integrate with Paddle for complete payment infrastructure, tax handling, subscription management, and global compliance. Perfect for SaaS companies scaling internationally with API key authentication.',
  category: 'tools',
  bgColor: '#5C41D1',
  icon: PaddleIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Paddle API Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your Paddle API key',
    },
    createOperationDropdown({
      operations: [
        { id: 'list_products', label: 'List Products' },
        { id: 'get_product', label: 'Get Product' },
        { id: 'list_prices', label: 'List Prices' },
        { id: 'list_subscriptions', label: 'List Subscriptions' },
        { id: 'get_subscription', label: 'Get Subscription' },
        { id: 'update_subscription', label: 'Update Subscription' },
        { id: 'cancel_subscription', label: 'Cancel Subscription' },
        { id: 'list_transactions', label: 'List Transactions' },
        { id: 'get_customer', label: 'Get Customer' },
      ],
      defaultValue: 'list_products',
    }),
    {
      id: 'productId',
      title: 'Product ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter product ID',
      condition: { field: 'operation', value: 'get_product' },
    },
    {
      id: 'subscriptionId',
      title: 'Subscription ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter subscription ID',
      condition: {
        field: 'operation',
        value: ['get_subscription', 'update_subscription', 'cancel_subscription'],
      },
    },
    {
      id: 'customerId',
      title: 'Customer ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter customer ID',
      condition: { field: 'operation', value: 'get_customer' },
    },
  ],
  tools: {
    access: ['paddle_api'],
    config: createSimpleToolConfig('paddle_api'),
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    productId: { type: 'string', required: false },
    subscriptionId: { type: 'string', required: false },
    customerId: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
