import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig } from '../types'
import { StripePaymentOutput, StripePaymentParams } from './types'

const logger = createLogger('Stripe Payments Tool')

export const stripePaymentsTool: ToolConfig<StripePaymentParams, StripePaymentOutput> = {
  id: 'stripe_payments',
  name: 'Stripe Payments',
  description:
    'Manage payments, customers, and refunds using Stripe API. Supports payment intents, charges, and customer management.',
  version: '1.0.0',

  params: {
    apiKey: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Stripe secret API key',
    },
    operation: {
      type: 'string',
      required: true,
      description: 'Operation to perform',
    },
    amount: {
      type: 'number',
      required: false,
      description: 'Amount in cents (e.g., 1000 = $10.00)',
    },
    currency: {
      type: 'string',
      required: false,
      description: 'Currency code (e.g., usd, eur, gbp)',
    },
    description: {
      type: 'string',
      required: false,
      description: 'Description for the payment',
    },
    paymentIntentId: {
      type: 'string',
      required: false,
      description: 'Payment Intent ID for get/update operations',
    },
    customerId: {
      type: 'string',
      required: false,
      description: 'Stripe Customer ID',
    },
    email: {
      type: 'string',
      required: false,
      description: 'Customer email address',
    },
    name: {
      type: 'string',
      required: false,
      description: 'Customer name',
    },
    chargeId: {
      type: 'string',
      required: false,
      description: 'Charge ID for refund',
    },
    refundAmount: {
      type: 'number',
      required: false,
      description: 'Refund amount in cents (partial refund)',
    },
    limit: {
      type: 'number',
      required: false,
      description: 'Number of results to return (default: 10, max: 100)',
    },
    startingAfter: {
      type: 'string',
      required: false,
      description: 'Cursor for pagination',
    },
  },

  request: {
    url: (params) => {
      const baseUrl = 'https://api.stripe.com/v1'
      switch (params.operation) {
        case 'create_payment_intent':
        case 'list_payment_intents':
          return `${baseUrl}/payment_intents`
        case 'get_payment_intent':
          return `${baseUrl}/payment_intents/${params.paymentIntentId}`
        case 'list_charges':
          return `${baseUrl}/charges`
        case 'create_refund':
          return `${baseUrl}/refunds`
        case 'list_customers':
          return `${baseUrl}/customers`
        case 'create_customer':
          return `${baseUrl}/customers`
        default:
          return `${baseUrl}/payment_intents`
      }
    },
    method: (params) => {
      switch (params.operation) {
        case 'create_payment_intent':
        case 'create_refund':
        case 'create_customer':
          return 'POST'
        default:
          return 'GET'
      }
    },
    headers: (params) => ({
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    }),
    body: (params) => {
      const formData = new URLSearchParams()

      if (params.operation === 'create_payment_intent') {
        if (params.amount) formData.append('amount', params.amount.toString())
        if (params.currency) formData.append('currency', params.currency)
        if (params.description) formData.append('description', params.description)
        if (params.customerId) formData.append('customer', params.customerId)
      } else if (params.operation === 'create_customer') {
        if (params.email) formData.append('email', params.email)
        if (params.name) formData.append('name', params.name)
        if (params.description) formData.append('description', params.description)
      } else if (params.operation === 'create_refund') {
        if (params.chargeId) formData.append('charge', params.chargeId)
        if (params.refundAmount) formData.append('amount', params.refundAmount.toString())
      }

      return { body: formData.toString() }
    },
    query: (params) => {
      const query: Record<string, string> = {}
      if (params.limit) query.limit = params.limit.toString()
      if (params.startingAfter) query.starting_after = params.startingAfter
      return query
    },
  },

  transformResponse: async (response) => {
    const data = await response.json()
    if (!response.ok) {
      logger.error('Stripe API error:', data)
      throw new Error(data.error?.message || `Stripe API error: ${response.status}`)
    }
    return { success: true, data }
  },

  transformError: (error) => {
    logger.error('Stripe tool error:', error)
    return `Stripe operation failed: ${error.message || 'Unknown error'}`
  },
}
