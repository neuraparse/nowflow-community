import Stripe from 'stripe'
import { createLogger } from '@/lib/logs/console-logger'
import { sendEmail } from '@/lib/mailer'

export const logger = createLogger('Auth')

export const isProd = process.env.NODE_ENV === 'production'

// Only initialize Stripe if the key is provided
// This allows local development without a Stripe account
const validStripeKey =
  process.env.STRIPE_SECRET_KEY &&
  process.env.STRIPE_SECRET_KEY.trim() !== '' &&
  process.env.STRIPE_SECRET_KEY !== 'placeholder'

export let stripeClient: Stripe | null = null
if (validStripeKey) {
  stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-02-25.clover',
  })
}

// Always use our SMTP server for emails
export const resend = {
  emails: {
    send: async (emailData: any) => {
      try {
        logger.info('Sending email via SMTP server:', {
          to: emailData.to,
          subject: emailData.subject,
          from: emailData.from,
        })

        const result = await sendEmail({
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          from: emailData.from,
        })

        if (result.success) {
          return { id: 'smtp-' + Date.now() }
        } else {
          throw new Error(result.message)
        }
      } catch (error) {
        logger.error('SMTP email failed:', error)
        throw error
      }
    },
  },
}
