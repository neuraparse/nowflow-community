export interface StripePaymentParams {
  apiKey: string
  operation:
    | 'create_payment_intent'
    | 'list_payment_intents'
    | 'get_payment_intent'
    | 'list_charges'
    | 'create_refund'
    | 'list_customers'
    | 'create_customer'
  // Payment Intent params
  amount?: number
  currency?: string
  description?: string
  paymentIntentId?: string
  // Customer params
  customerId?: string
  email?: string
  name?: string
  // Refund params
  chargeId?: string
  refundAmount?: number
  // Pagination
  limit?: number
  startingAfter?: string
}

export interface StripePaymentOutput {
  success: boolean
  data?: any
  error?: string
}
