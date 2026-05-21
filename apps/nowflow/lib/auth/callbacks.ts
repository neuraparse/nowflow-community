import { eq } from 'drizzle-orm'
import { TEAM_FROM } from '@/lib/config/app-urls'
import { isDisposableEmail } from '@/lib/disposable-email'
import { renderEmail } from '@/lib/email-templates/service'
import { ensureFreeSubscriptionForUser } from '@/lib/subscription-plan'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { logger } from './helpers'

/**
 * Database hooks for betterAuth configuration.
 */
export const databaseHooks = {
  user: {
    create: {
      // Last line of defense against signup-email-bomb abuse: if a request
      // ever makes it past Cloudflare WAF + Turnstile + Better Auth rate
      // limits, we still reject disposable-provider emails before the user
      // row is created and the OTP mailer is triggered. This runs inside
      // Better Auth's transaction so a rejection produces a clean
      // 400-series response to the client.
      before: async (user: any) => {
        if (isDisposableEmail(user?.email)) {
          logger.warn('Rejected signup with disposable email domain', {
            email: user?.email,
          })
          throw new Error('This email provider is not supported. Please use a work email.')
        }
        return { data: user }
      },
    },
  },
  session: {
    create: {
      before: async (session: any) => {
        try {
          // Find the first organization this user is a member of
          const members = await db
            .select()
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .limit(1)

          if (members.length > 0) {
            logger.debug('Found organization for user', {
              userId: session.userId,
              organizationId: members[0].organizationId,
            })

            return {
              data: {
                ...session,
                activeOrganizationId: members[0].organizationId,
              },
            }
          } else {
            logger.info('No organizations found for user', { userId: session.userId })
            return { data: session }
          }
        } catch (error) {
          logger.error('Error setting active organization', { error, userId: session.userId })
          return { data: session }
        }
      },
    },
  },
}

/**
 * Email and password configuration for betterAuth.
 */
export const emailAndPasswordConfig = {
  enabled: true,
  requireEmailVerification: false,
  sendVerificationOnSignUp: false,
  throwOnMissingCredentials: true,
  throwOnInvalidCredentials: true,
  sendResetPassword: async ({ user, url, token }: any, request: any) => {
    const username = user.name || ''
    const rendered = await renderEmail('reset-password', { username, resetLink: url })

    // Use our mailer service instead of direct Resend
    const { sendEmail } = await import('../mailer')
    const result = await sendEmail({
      from: TEAM_FROM,
      to: user.email,
      subject: rendered.subject,
      html: rendered.html,
    })

    if (!result.success) {
      throw new Error(`Failed to send reset password email: ${result.message}`)
    }
  },
}

/**
 * After sign-up hook to ensure free subscription.
 */
export const onAfterSignUp = async (user: any) => {
  try {
    logger.info('New user signed up, ensuring FREE subscription', {
      userId: user.id,
      email: user.email,
    })

    await ensureFreeSubscriptionForUser(user.id)
  } catch (error) {
    logger.error('Error creating FREE subscription for new user:', error)
  }
}

/**
 * Auth pages configuration.
 */
export const pages = {
  signIn: '/login',
  signUp: '/signup',
  error: '/error',
  verify: '/verify',
  verifyRequest: '/verify-request',
}
