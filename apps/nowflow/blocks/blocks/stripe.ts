import { StripeIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const StripeBlock = defineBlock({
  type: 'stripe',
  name: 'Stripe',
  description: 'Payment processing, subscriptions, and platform management.',
  longDescription:
    'Connect to Stripe API using OAuth 2.0 Connect to manage payment intents, customers, subscriptions, charges, refunds, and connected accounts. Supports both Standard and Express connected accounts with read_write or read_only scopes. Perfect for platforms, marketplaces, and SaaS applications managing payments on behalf of connected accounts.',
  category: 'tools',
  bgColor: '#635BFF',
  icon: StripeIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'stripe',
      serviceId: 'stripe',
      requiredScopes: ['read_write'],
      title: 'Stripe Account',
      placeholder: 'Select Stripe account',
    }),
    createOperationDropdown({
      operations: [
        { id: 'create_payment_intent', label: 'Create Payment Intent' },
        { id: 'list_payment_intents', label: 'List Payment Intents' },
        { id: 'get_payment_intent', label: 'Get Payment Intent' },
        { id: 'cancel_payment_intent', label: 'Cancel Payment Intent' },
        { id: 'capture_payment_intent', label: 'Capture Payment Intent' },
        { id: 'list_charges', label: 'List Charges' },
        { id: 'get_charge', label: 'Get Charge' },
        { id: 'create_refund', label: 'Create Refund' },
        { id: 'list_refunds', label: 'List Refunds' },
        { id: 'list_customers', label: 'List Customers' },
        { id: 'create_customer', label: 'Create Customer' },
        { id: 'get_customer', label: 'Get Customer' },
        { id: 'update_customer', label: 'Update Customer' },
        { id: 'delete_customer', label: 'Delete Customer' },
        { id: 'create_subscription', label: 'Create Subscription' },
        { id: 'list_subscriptions', label: 'List Subscriptions' },
        { id: 'get_subscription', label: 'Get Subscription' },
        { id: 'cancel_subscription', label: 'Cancel Subscription' },
        { id: 'create_product', label: 'Create Product' },
        { id: 'list_products', label: 'List Products' },
        { id: 'get_product', label: 'Get Product' },
        { id: 'create_price', label: 'Create Price' },
        { id: 'list_prices', label: 'List Prices' },
        { id: 'get_balance', label: 'Get Balance' },
        { id: 'list_balance_transactions', label: 'List Balance Transactions' },
        { id: 'get_account', label: 'Get Account' },
      ],
    }),
    // Payment Intent fields
    {
      id: 'amount',
      title: 'Amount (cents)',
      type: 'short-input',
      layout: 'half',
      placeholder: '1000 = $10.00',
      condition: { field: 'operation', value: 'create_payment_intent' },
    },
    {
      id: 'currency',
      title: 'Currency',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'USD', id: 'usd' },
        { label: 'EUR', id: 'eur' },
        { label: 'GBP', id: 'gbp' },
        { label: 'TRY', id: 'try' },
        { label: 'JPY', id: 'jpy' },
      ],
      condition: { field: 'operation', value: 'create_payment_intent' },
    },
    {
      id: 'description',
      title: 'Description',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Payment description',
      condition: { field: 'operation', value: 'create_payment_intent' },
    },
    {
      id: 'paymentIntentId',
      title: 'Payment Intent ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'pi_...',
      condition: {
        field: 'operation',
        value: ['get_payment_intent', 'cancel_payment_intent', 'capture_payment_intent'],
      },
    },
    // Charge fields
    {
      id: 'chargeId',
      title: 'Charge ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'ch_...',
      condition: { field: 'operation', value: ['get_charge', 'create_refund'] },
    },
    // Customer fields
    {
      id: 'customerId',
      title: 'Customer ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'cus_...',
      condition: {
        field: 'operation',
        value: ['get_customer', 'update_customer', 'delete_customer', 'create_subscription'],
      },
    },
    {
      id: 'email',
      title: 'Email',
      type: 'short-input',
      layout: 'half',
      placeholder: 'customer@example.com',
      condition: { field: 'operation', value: ['create_customer', 'update_customer'] },
    },
    {
      id: 'name',
      title: 'Name',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Customer name',
      condition: { field: 'operation', value: ['create_customer', 'update_customer'] },
    },
    // Refund fields
    {
      id: 'refundAmount',
      title: 'Refund Amount (cents)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Leave empty for full refund',
      condition: { field: 'operation', value: 'create_refund' },
    },
    // Subscription fields
    {
      id: 'subscriptionId',
      title: 'Subscription ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'sub_...',
      condition: { field: 'operation', value: ['get_subscription', 'cancel_subscription'] },
    },
    {
      id: 'priceId',
      title: 'Price ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'price_...',
      condition: { field: 'operation', value: 'create_subscription' },
    },
    // Product fields
    {
      id: 'productId',
      title: 'Product ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'prod_...',
      condition: { field: 'operation', value: ['get_product', 'create_price'] },
    },
    {
      id: 'productName',
      title: 'Product Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'My Product',
      condition: { field: 'operation', value: 'create_product' },
    },
    {
      id: 'productDescription',
      title: 'Product Description',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Product description',
      condition: { field: 'operation', value: 'create_product' },
    },
    // Price fields
    {
      id: 'unitAmount',
      title: 'Unit Amount (cents)',
      type: 'short-input',
      layout: 'half',
      placeholder: '1000 = $10.00',
      condition: { field: 'operation', value: 'create_price' },
    },
    {
      id: 'priceCurrency',
      title: 'Currency',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'USD', id: 'usd' },
        { label: 'EUR', id: 'eur' },
        { label: 'GBP', id: 'gbp' },
        { label: 'TRY', id: 'try' },
        { label: 'JPY', id: 'jpy' },
      ],
      condition: { field: 'operation', value: 'create_price' },
    },
    {
      id: 'recurring',
      title: 'Recurring Interval',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'One-time', id: 'one_time' },
        { label: 'Daily', id: 'day' },
        { label: 'Weekly', id: 'week' },
        { label: 'Monthly', id: 'month' },
        { label: 'Yearly', id: 'year' },
      ],
      condition: { field: 'operation', value: 'create_price' },
    },
    // Pagination
    {
      id: 'limit',
      title: 'Limit',
      type: 'short-input',
      layout: 'half',
      placeholder: '10',
      condition: {
        field: 'operation',
        value: [
          'list_payment_intents',
          'list_charges',
          'list_refunds',
          'list_customers',
          'list_subscriptions',
          'list_products',
          'list_prices',
          'list_balance_transactions',
        ],
      },
    },
  ],
  tools: {
    access: ['stripe_payments'],
    config: {
      tool: () => 'stripe_payments',
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    // Payment Intent fields
    amount: { type: 'number', required: false },
    currency: { type: 'string', required: false },
    description: { type: 'string', required: false },
    paymentIntentId: { type: 'string', required: false },
    // Charge fields
    chargeId: { type: 'string', required: false },
    // Customer fields
    customerId: { type: 'string', required: false },
    email: { type: 'string', required: false },
    name: { type: 'string', required: false },
    // Refund fields
    refundAmount: { type: 'number', required: false },
    // Subscription fields
    subscriptionId: { type: 'string', required: false },
    priceId: { type: 'string', required: false },
    // Product fields
    productId: { type: 'string', required: false },
    productName: { type: 'string', required: false },
    productDescription: { type: 'string', required: false },
    // Price fields
    unitAmount: { type: 'number', required: false },
    priceCurrency: { type: 'string', required: false },
    recurring: { type: 'string', required: false },
    // Pagination
    limit: { type: 'number', required: false },
  },
  outputs: {
    response: {
      type: {
        success: 'boolean',
        data: 'any',
      },
    },
  },
})
