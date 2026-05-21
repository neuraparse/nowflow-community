import Stripe from 'stripe'

export interface OAuthUserInfo {
  id: string
  name: string
  email: string
  image: string | null
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  idToken?: string
}

export interface SubscriptionEvent {
  event: Stripe.Event
  stripeSubscription: Stripe.Subscription
  subscription: any
}
