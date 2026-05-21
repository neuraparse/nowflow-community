import { LemonSqueezyIcon } from '@/components/icons'
import { createOperationDropdown, createSimpleToolConfig, defineBlock } from '../helpers'

export const LemonSqueezyBlock = defineBlock({
  type: 'lemonsqueezy',
  name: 'Lemon Squeezy',
  description: 'Modern payment platform for SaaS and digital products',
  longDescription:
    'Integrate with Lemon Squeezy (acquired by Stripe) for subscription billing, license keys, VAT handling, digital downloads, and payment processing. Perfect for SaaS businesses with API key authentication.',
  category: 'tools',
  bgColor: '#FFC233',
  icon: LemonSqueezyIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Lemon Squeezy API Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your Lemon Squeezy API key',
    },
    createOperationDropdown({
      operations: [
        { id: 'list_products', label: 'List Products' },
        { id: 'get_product', label: 'Get Product' },
        { id: 'list_subscriptions', label: 'List Subscriptions' },
        { id: 'get_subscription', label: 'Get Subscription' },
        { id: 'cancel_subscription', label: 'Cancel Subscription' },
        { id: 'list_orders', label: 'List Orders' },
        { id: 'get_order', label: 'Get Order' },
        { id: 'list_license_keys', label: 'List License Keys' },
        { id: 'validate_license', label: 'Validate License Key' },
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
      condition: { field: 'operation', value: ['get_subscription', 'cancel_subscription'] },
    },
    {
      id: 'orderId',
      title: 'Order ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter order ID',
      condition: { field: 'operation', value: 'get_order' },
    },
    {
      id: 'licenseKey',
      title: 'License Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter license key to validate',
      condition: { field: 'operation', value: 'validate_license' },
    },
  ],
  tools: {
    access: ['lemonsqueezy_api'],
    config: createSimpleToolConfig('lemonsqueezy_api'),
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    productId: { type: 'string', required: false },
    subscriptionId: { type: 'string', required: false },
    orderId: { type: 'string', required: false },
    licenseKey: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
