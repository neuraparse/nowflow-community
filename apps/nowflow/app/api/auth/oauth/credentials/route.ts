import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { jwtDecode } from 'jwt-decode'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { parseProvider } from '@/lib/oauth'
import { OAuthService } from '@/lib/oauth'
import { db } from '@/db'
import { account, user } from '@/db/schema'
import { fetchProviderDisplayName } from '../utils'

const logger = createLogger('OAuthCredentialsAPI')

interface OAuthIdToken {
  email?: string
  sub?: string
  name?: string
  preferred_username?: string // Microsoft-specific claim
}

/**
 * Get credentials for a specific provider
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    // Get the session
    const session = await getSession()

    // Check if the user is authenticated
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthenticated credentials request rejected`)
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Get the provider from the query params
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider') as OAuthService | null

    if (!provider) {
      logger.warn(`[${requestId}] Missing provider parameter`)
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 })
    }

    // Parse the provider to get base provider and feature type
    const { baseProvider } = parseProvider(provider)

    // Get all accounts for this user and provider
    const accounts = await db
      .select()
      .from(account)
      .where(and(eq(account.userId, session.user.id), eq(account.providerId, provider)))

    // Transform accounts into credentials
    const credentials = await Promise.all(
      accounts.map(async (acc: any) => {
        // Extract the feature type from providerId (e.g., 'google-default' -> 'default')
        const [_, featureType = 'default'] = acc.providerId.split('-')

        // Try multiple methods to get a user-friendly display name
        let displayName = ''

        // Method 1: Try to extract email from ID token (works for Google, Microsoft, etc.)
        if (acc.idToken) {
          try {
            const decoded = jwtDecode<OAuthIdToken>(acc.idToken)
            if (decoded.email) {
              displayName = decoded.email
            } else if (decoded.preferred_username) {
              displayName = decoded.preferred_username
            } else if (decoded.name) {
              displayName = decoded.name
            }
          } catch (error) {
            logger.warn(`[${requestId}] Error decoding ID token`, {
              accountId: acc.id,
            })
          }
        }

        // Method 2: For providers without ID token, fetch display name from provider API
        if (!displayName && acc.accessToken) {
          displayName = await fetchProviderDisplayName(baseProvider, acc.accessToken)
        }

        // Method 4: Try to get the user's email from our database
        if (!displayName) {
          try {
            const userRecord = await db
              .select({ email: user.email })
              .from(user)
              .where(eq(user.id, acc.userId))
              .limit(1)

            if (userRecord.length > 0) {
              displayName = userRecord[0].email
            }
          } catch (error) {
            logger.warn(`[${requestId}] Error fetching user email`, {
              userId: acc.userId,
            })
          }
        }

        // Fallback: Use accountId with provider type as context
        if (!displayName) {
          displayName = `${acc.accountId} (${baseProvider})`
        }

        return {
          id: acc.id,
          name: displayName,
          provider,
          lastUsed: acc.updatedAt.toISOString(),
          isDefault: featureType === 'default',
        }
      })
    )

    return NextResponse.json(
      { credentials },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    )
  } catch (error) {
    logger.error(`[${requestId}] Error fetching OAuth credentials`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
