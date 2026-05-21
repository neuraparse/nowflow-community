import { stripe } from '@better-auth/stripe'
import { nextCookies } from 'better-auth/next-js'
import { bearer, captcha, emailOTP, genericOAuth, organization } from 'better-auth/plugins'
import { and, eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { ONBOARDING_FROM, TEAM_FROM } from '@/lib/config/app-urls'
import { renderEmail } from '@/lib/email-templates/service'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { isProd, logger, resend, stripeClient } from './helpers'
import { genericOAuthProviders } from './providers'

/**
 * Build the plugins array for betterAuth configuration.
 */
export function buildPlugins() {
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
  const enabledOAuthProviders = genericOAuthProviders.filter(
    (provider: any) => Boolean(provider.clientId) && Boolean(provider.clientSecret)
  )
  return [
    bearer(),
    // Bot/spam protection: verifies a Cloudflare Turnstile token on the
    // sensitive auth endpoints before the sign-up/sign-in/password-reset
    // handlers ever run. Opt-in via env: if the secret is absent the plugin
    // is skipped so local dev continues to work without a key pair.
    ...(turnstileSecret
      ? [
          captcha({
            provider: 'cloudflare-turnstile',
            secretKey: turnstileSecret,
            endpoints: [
              '/sign-up/email',
              '/sign-in/email',
              '/forget-password',
              '/email-otp/send-verification-otp',
            ],
          }),
        ]
      : []),
    emailOTP({
      sendVerificationOTP: async (data: {
        email: string
        otp: string
        type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email'
      }) => {
        try {
          if (!data.email) {
            throw new Error('Email is required')
          }

          if (data.type === 'change-email') {
            // Better-Auth's emailOTP plugin includes 'change-email' in its
            // type union, but the change-email flow is not enabled in this
            // app — no template exists. Skip silently.
            return
          }

          const rendered = await renderEmail(data.type, { otp: data.otp, email: data.email })

          // Use our SMTP mail server instead of Resend
          const { sendEmail } = await import('../mailer')
          const result = await sendEmail({
            from: ONBOARDING_FROM,
            to: data.email,
            subject: rendered.subject,
            html: rendered.html,
          })

          if (!result.success) {
            throw new Error(`Failed to send verification code: ${result.message}`)
          }
        } catch (error) {
          logger.error('Error sending verification code:', {
            error,
            email: data.email,
          })
          throw error
        }
      },
      sendVerificationOnSignUp: true,
      otpLength: 6, // Explicitly set the OTP length
      expiresIn: 15 * 60, // 15 minutes in seconds
    }),
    genericOAuth({
      config: enabledOAuthProviders as any,
    }),
    // Only include the Stripe plugin in production
    ...(isProd && stripeClient
      ? [
          stripe({
            stripeClient,
            stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
            createCustomerOnSignUp: true,
            onCustomerCreate: async ({ stripeCustomer, user }: any, request: any) => {
              logger.info('Stripe customer created', {
                customerId: stripeCustomer.id,
                userId: user.id,
              })
            },
            subscription: {
              enabled: true,
              plans: [
                {
                  name: 'free',
                  priceId: process.env.STRIPE_FREE_PRICE_ID || '',
                  limits: {
                    cost: process.env.FREE_TIER_COST_LIMIT
                      ? parseInt(process.env.FREE_TIER_COST_LIMIT)
                      : 5,
                    sharingEnabled: 0,
                    multiplayerEnabled: 0,
                    workspaceCollaborationEnabled: 0,
                  },
                },
                {
                  name: 'starter',
                  priceId: process.env.STRIPE_STARTER_PRICE_ID || '',
                  limits: {
                    cost: process.env.STARTER_TIER_COST_LIMIT
                      ? parseInt(process.env.STARTER_TIER_COST_LIMIT)
                      : 10,
                    sharingEnabled: 0,
                    multiplayerEnabled: 0,
                    workspaceCollaborationEnabled: 0,
                  },
                },
                {
                  name: 'mid',
                  priceId: process.env.STRIPE_MID_PRICE_ID || '',
                  limits: {
                    cost: process.env.MID_TIER_COST_LIMIT
                      ? parseInt(process.env.MID_TIER_COST_LIMIT)
                      : 20,
                    sharingEnabled: 1,
                    multiplayerEnabled: 0,
                    workspaceCollaborationEnabled: 0,
                  },
                },
                {
                  name: 'pro',
                  priceId: process.env.STRIPE_PRO_PRICE_ID || '',
                  limits: {
                    cost: process.env.PRO_TIER_COST_LIMIT
                      ? parseInt(process.env.PRO_TIER_COST_LIMIT)
                      : 40,
                    sharingEnabled: 1,
                    multiplayerEnabled: 0,
                    workspaceCollaborationEnabled: 0,
                  },
                },
                {
                  name: 'team',
                  priceId: process.env.STRIPE_TEAM_PRICE_ID || '',
                  limits: {
                    cost: process.env.TEAM_TIER_COST_LIMIT
                      ? parseInt(process.env.TEAM_TIER_COST_LIMIT)
                      : 40, // $40 per seat
                    sharingEnabled: 1,
                    multiplayerEnabled: 1,
                    workspaceCollaborationEnabled: 1,
                  },
                },
              ],
              authorizeReference: async ({ user, referenceId, action }: any) => {
                // User can always manage their own subscriptions
                if (referenceId === user.id) {
                  return true
                }

                // Check if referenceId is an organizationId the user has admin rights to
                const members = await db
                  .select()
                  .from(schema.member)
                  .where(
                    and(
                      eq(schema.member.userId, user.id),
                      eq(schema.member.organizationId, referenceId)
                    )
                  )

                const member = members[0]

                // Allow if the user is an owner or admin of the organization
                return member?.role === 'owner' || member?.role === 'admin'
              },
              getCheckoutSessionParams: async ({ user, plan, subscription }: any, request: any) => {
                if (plan.name === 'team') {
                  return {
                    params: {
                      allow_promotion_codes: true,
                      line_items: [
                        {
                          price: plan.priceId,
                          quantity: subscription?.seats || 1,
                          adjustable_quantity: {
                            enabled: true,
                            minimum: 1,
                            maximum: 50,
                          },
                        },
                      ],
                    },
                  }
                }

                return {
                  params: {
                    allow_promotion_codes: true,
                  },
                }
              },
              onSubscriptionComplete: async ({
                event,
                stripeSubscription,
                subscription,
              }: {
                event: Stripe.Event
                stripeSubscription: Stripe.Subscription
                subscription: any
              }) => {
                logger.info('Subscription created', {
                  subscriptionId: subscription.id,
                  referenceId: subscription.referenceId,
                  plan: subscription.plan,
                  status: subscription.status,
                })
              },
              onSubscriptionUpdate: async ({
                event,
                subscription,
              }: {
                event: Stripe.Event
                subscription: any
              }) => {
                logger.info('Subscription updated', {
                  subscriptionId: subscription.id,
                  status: subscription.status,
                })
              },
              onSubscriptionDeleted: async ({
                event,
                stripeSubscription,
                subscription,
              }: {
                event: Stripe.Event
                stripeSubscription: Stripe.Subscription
                subscription: any
              }) => {
                logger.info('Subscription deleted', {
                  subscriptionId: subscription.id,
                  referenceId: subscription.referenceId,
                })
              },
            },
          }),
          // Add organization plugin as a separate entry in the plugins array
          organization({
            // Allow team plan subscribers to create organizations
            allowUserToCreateOrganization: async (user) => {
              // Get subscription data
              const dbSubscriptions = await db
                .select({
                  status: schema.subscription.status,
                  planName: schema.subscriptionPlan.name,
                })
                .from(schema.subscription)
                .leftJoin(
                  schema.subscriptionPlan,
                  eq(schema.subscription.planId, schema.subscriptionPlan.id)
                )
                .where(eq(schema.subscription.referenceId, user.id))

              // Check if user has active team subscription
              const hasTeamPlan = dbSubscriptions.some(
                (sub: { status: string | null; planName: string | null }) =>
                  sub.status === 'active' && sub.planName === 'team'
              )

              return hasTeamPlan
            },
            // Set a fixed membership limit of 50, but the actual limit will be enforced in the invitation flow
            membershipLimit: 50,
            // Validate seat limits before sending invitations
            beforeInvite: async ({ organization }: { organization: { id: string } }) => {
              // Get subscription for this organization
              const subscriptions = await db
                .select({
                  status: schema.subscription.status,
                  planName: schema.subscriptionPlan.name,
                  seats: schema.subscription.seats,
                })
                .from(schema.subscription)
                .leftJoin(
                  schema.subscriptionPlan,
                  eq(schema.subscription.planId, schema.subscriptionPlan.id)
                )
                .where(
                  and(
                    eq(schema.subscription.referenceId, organization.id),
                    eq(schema.subscription.status, 'active')
                  )
                )

              const teamSubscription = subscriptions.find(
                (sub: { status: string | null; planName: string | null; seats: number | null }) =>
                  sub.planName === 'team' && sub.status === 'active'
              )

              if (!teamSubscription) {
                throw new Error('No active team subscription for this organization')
              }

              // Count current members + pending invitations
              const members = await db
                .select()
                .from(schema.member)
                .where(eq(schema.member.organizationId, organization.id))

              const pendingInvites = await db
                .select()
                .from(schema.invitation)
                .where(
                  and(
                    eq(schema.invitation.organizationId, organization.id),
                    eq(schema.invitation.status, 'pending')
                  )
                )

              const totalCount = members.length + pendingInvites.length
              const seatLimit = teamSubscription.seats || 1

              if (totalCount >= seatLimit) {
                throw new Error(`Organization has reached its seat limit of ${seatLimit}`)
              }
            },
            sendInvitationEmail: async (data: any) => {
              try {
                const { invitation, organization, inviter } = data

                const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.id}`
                const inviterName = inviter.user?.name || 'A team member'

                const rendered = await renderEmail('invitation', {
                  inviterName,
                  organizationName: organization.name,
                  inviteLink: inviteUrl,
                  invitedEmail: invitation.email,
                })

                await resend.emails.send({
                  from: TEAM_FROM,
                  to: invitation.email,
                  subject: rendered.subject,
                  html: rendered.html,
                })
              } catch (error) {
                logger.error('Error sending invitation email', { error })
              }
            },
            organizationCreation: {
              afterCreate: async ({ organization, member, user }: any) => {
                logger.info('Organization created', {
                  organizationId: organization.id,
                  creatorId: user.id,
                })
              },
            },
          }),
        ]
      : []),
    nextCookies(),
  ]
}
