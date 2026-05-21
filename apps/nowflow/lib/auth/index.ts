import { headers } from 'next/headers'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { and, eq, gt } from 'drizzle-orm'
import { ALL_DOMAINS } from '@/lib/config/app-urls'
import { ensureFreeSubscriptionForUser } from '@/lib/subscription-plan'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { databaseHooks, emailAndPasswordConfig, onAfterSignUp, pages } from './callbacks'
import { logger } from './helpers'
import { buildPlugins } from './plugins'
import { socialProviders, trustedProviders } from './providers'

export const auth = betterAuth({
  baseURL:
    process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  trustedOrigins: () => {
    const origins = [...ALL_DOMAINS]
    if (process.env.NODE_ENV !== 'production') {
      origins.push('http://localhost:3000', 'http://127.0.0.1:3000')
    }
    // Allow extra origins via env for local reverse proxies or companion tools.
    if (process.env.EXTRA_TRUSTED_ORIGINS) {
      origins.push(...process.env.EXTRA_TRUSTED_ORIGINS.split(',').map((s) => s.trim()))
    }
    return origins
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 24 * 60 * 60, // 24 hours in seconds
    },
    expiresIn: 30 * 24 * 60 * 60, // 30 days (how long a session can last overall)
    updateAge: 24 * 60 * 60, // 24 hours (how often to refresh the expiry)
    freshAge: 60 * 60, // 1 hour (or set to 0 to disable completely)
  },
  advanced: {
    cookiePrefix: process.env.AUTH_COOKIE_PREFIX || 'better-auth',
    defaultCookieAttributes: {
      sameSite: 'lax' as const,
    },
    ...(process.env.AUTH_COOKIE_DOMAIN ? { domain: process.env.AUTH_COOKIE_DOMAIN } : {}),
  },
  databaseHooks,
  // Persist rate-limit counters in Postgres so brute-force counters survive
  // container restarts, and tighten sign-in limits beyond the 3/10s default.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: 'database',
    modelName: 'rateLimit',
    customRules: {
      '/sign-in/email': { window: 300, max: 5 },
      '/sign-up/email': { window: 3600, max: 10 },
      '/forget-password': { window: 3600, max: 5 },
      '/reset-password': { window: 3600, max: 5 },
      '/change-password': { window: 3600, max: 10 },
      '/change-email': { window: 3600, max: 5 },
      '/send-verification-email': { window: 3600, max: 5 },
      '/email-otp/send-verification-otp': { window: 3600, max: 5 },
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      allowDifferentEmails: true,
      trustedProviders: [...trustedProviders],
    },
  },
  socialProviders,
  emailAndPassword: emailAndPasswordConfig,
  onAfterSignUp,
  plugins: buildPlugins(),
  pages,
})

/**
 * Extract a Bearer token from the Authorization header.
 * Returns null if no valid Bearer token is present.
 */
function extractBearerToken(reqHeaders: Headers): string | null {
  const authHeader = reqHeaders.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim() || null
}

/**
 * Resolve a session from a raw Bearer token by looking up the session
 * directly in the database. This supports API clients that cannot
 * participate in signed-cookie auth.
 */
async function getSessionFromBearerToken(token: string) {
  try {
    const rows = await db
      .select({
        sessionId: schema.session.id,
        sessionToken: schema.session.token,
        expiresAt: schema.session.expiresAt,
        userId: schema.session.userId,
        userName: schema.user.name,
        userEmail: schema.user.email,
        userEmailVerified: schema.user.emailVerified,
        userImage: schema.user.image,
        userRole: schema.user.role,
        userCreatedAt: schema.user.createdAt,
        userUpdatedAt: schema.user.updatedAt,
      })
      .from(schema.session)
      .innerJoin(schema.user, eq(schema.session.userId, schema.user.id))
      .where(and(eq(schema.session.token, token), gt(schema.session.expiresAt, new Date())))
      .limit(1)

    const result = rows.length > 0 ? rows[0] : null
    logger.info('[getSessionFromBearerToken] DB lookup result:', {
      found: !!result,
      userId: result?.userId ?? 'none',
    })

    if (rows.length === 0) return null

    const row = rows[0]
    return {
      session: {
        id: row.sessionId,
        token: row.sessionToken,
        expiresAt: row.expiresAt,
        userId: row.userId,
      },
      user: {
        id: row.userId,
        name: row.userName,
        email: row.userEmail,
        emailVerified: row.userEmailVerified,
        image: row.userImage,
        role: row.userRole,
        createdAt: row.userCreatedAt,
        updatedAt: row.userUpdatedAt,
      },
    }
  } catch (error) {
    logger.error('Failed to resolve session from Bearer token', { error })
    return null
  }
}

// Server-side auth helpers
export async function getSession() {
  const reqHeaders = await headers()

  // 1. Try the standard better-auth cookie-based session resolution.
  //    This works for browser clients where cookies are signed automatically.
  const session = await auth.api.getSession({
    headers: reqHeaders,
  })

  logger.debug('[getSession] cookie-based result:', {
    hasSession: !!session,
    userId: session?.user?.id ?? 'none',
  })

  // 2. If cookie-based resolution failed, check for a Bearer token.
  //    API clients can send the raw session token via Authorization header.
  const resolvedSession =
    session ??
    (await (async () => {
      const bearerToken = extractBearerToken(new Headers(reqHeaders))
      logger.info('[getSession] trying bearer fallback', { hasBearerToken: !!bearerToken })
      if (!bearerToken) return null
      return getSessionFromBearerToken(bearerToken)
    })())

  if (resolvedSession?.user) {
    try {
      await ensureFreeSubscriptionForUser(resolvedSession.user.id)
    } catch (error) {
      logger.error('Failed to ensure FREE subscription on session fetch', {
        error,
        userId: resolvedSession.user.id,
      })
    }
  }

  return resolvedSession
}

export const signIn = auth.api.signInEmail
export const signUp = auth.api.signUpEmail
