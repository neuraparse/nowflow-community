import { createLogger } from '@/lib/logs/console-logger'
import { refreshAccessTokenIfNeeded } from '@/app/api/auth/oauth/utils'

const logger = createLogger('OutlookSubscription')

const GRAPH_API = 'https://graph.microsoft.com/v1.0'

export interface OutlookSubscriptionInfo {
  subscriptionId: string
  expirationDateTime: string
  clientState: string
}

/**
 * Create a Microsoft Graph webhook subscription for new emails in a folder.
 * Graph validates the notificationUrl during creation (POST with validationToken).
 */
export async function createOutlookSubscription(
  triggerId: string,
  credentialId: string,
  userId: string,
  folder: string = 'Inbox'
): Promise<OutlookSubscriptionInfo | null> {
  const requestId = crypto.randomUUID().slice(0, 8)

  const accessToken = await refreshAccessTokenIfNeeded(credentialId, userId, requestId)
  if (!accessToken) {
    logger.error(`[${requestId}] No access token for subscription creation`)
    return null
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!baseUrl || baseUrl.includes('localhost')) {
    logger.warn(
      `[${requestId}] No public URL configured, skipping webhook subscription (polling fallback)`
    )
    return null
  }

  const notificationUrl = `${baseUrl}/api/triggers/webhook/outlook/${triggerId}`
  const clientState = crypto.randomUUID()

  // Microsoft Graph allows max 4230 minutes (~2.94 days) for mail subscriptions
  const expiration = new Date()
  expiration.setMinutes(expiration.getMinutes() + 4200) // ~2.9 days

  const resource =
    folder.toLowerCase() === 'inbox'
      ? "me/mailFolders('Inbox')/messages"
      : `me/mailFolders('${folder}')/messages`

  try {
    const response = await fetch(`${GRAPH_API}/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        changeType: 'created',
        notificationUrl,
        resource,
        expirationDateTime: expiration.toISOString(),
        clientState,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[${requestId}] Subscription creation failed (${response.status}): ${errorText}`)
      return null
    }

    const data = await response.json()
    logger.info(`[${requestId}] Created Outlook subscription ${data.id} for trigger ${triggerId}`)

    return {
      subscriptionId: data.id,
      expirationDateTime: data.expirationDateTime,
      clientState,
    }
  } catch (error) {
    logger.error(`[${requestId}] Error creating Outlook subscription`, error)
    return null
  }
}

/**
 * Renew an existing subscription before it expires (extend by ~3 days).
 */
export async function renewOutlookSubscription(
  subscriptionId: string,
  credentialId: string,
  userId: string
): Promise<string | null> {
  const requestId = crypto.randomUUID().slice(0, 8)

  const accessToken = await refreshAccessTokenIfNeeded(credentialId, userId, requestId)
  if (!accessToken) return null

  const expiration = new Date()
  expiration.setMinutes(expiration.getMinutes() + 4200)

  try {
    const response = await fetch(`${GRAPH_API}/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expirationDateTime: expiration.toISOString(),
      }),
    })

    if (!response.ok) {
      logger.error(`[${requestId}] Renewal failed for ${subscriptionId} (${response.status})`)
      return null
    }

    const data = await response.json()
    logger.info(
      `[${requestId}] Renewed subscription ${subscriptionId}, expires ${data.expirationDateTime}`
    )
    return data.expirationDateTime
  } catch (error) {
    logger.error(`[${requestId}] Error renewing subscription`, error)
    return null
  }
}

/**
 * Delete a subscription (cleanup on credential change or trigger deactivation).
 */
export async function deleteOutlookSubscription(
  subscriptionId: string,
  credentialId: string,
  userId: string
): Promise<void> {
  const requestId = crypto.randomUUID().slice(0, 8)

  const accessToken = await refreshAccessTokenIfNeeded(credentialId, userId, requestId)
  if (!accessToken) return

  try {
    await fetch(`${GRAPH_API}/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    logger.info(`[${requestId}] Deleted subscription ${subscriptionId}`)
  } catch (error) {
    logger.error(`[${requestId}] Error deleting subscription`, error)
  }
}

/**
 * List all Graph subscriptions for this token and delete any that point
 * to our webhook URL but aren't tracked in the DB.
 * This cleans up orphaned subscriptions that keep sending notifications.
 */
export async function cleanupOrphanSubscriptions(
  credentialId: string,
  userId: string,
  knownSubscriptionIds: Set<string>
): Promise<number> {
  const requestId = crypto.randomUUID().slice(0, 8)

  const accessToken = await refreshAccessTokenIfNeeded(credentialId, userId, requestId)
  if (!accessToken) return 0

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!baseUrl) return 0

  try {
    const response = await fetch(`${GRAPH_API}/subscriptions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      logger.warn(`[${requestId}] Failed to list subscriptions (${response.status})`)
      return 0
    }

    const data = await response.json()
    const subscriptions = data.value || []
    let deleted = 0

    for (const sub of subscriptions) {
      // Only touch subscriptions pointing to OUR webhook URL
      const isOurs = sub.notificationUrl?.startsWith(`${baseUrl}/api/triggers/webhook/outlook/`)
      if (!isOurs) continue

      // If this subscription ID is tracked in DB, keep it
      if (knownSubscriptionIds.has(sub.id)) continue

      // Orphan found — delete it
      try {
        await fetch(`${GRAPH_API}/subscriptions/${sub.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        logger.info(
          `[${requestId}] Deleted orphan subscription ${sub.id} (notificationUrl: ${sub.notificationUrl})`
        )
        deleted++
      } catch (err) {
        logger.warn(`[${requestId}] Failed to delete orphan subscription ${sub.id}`, err)
      }
    }

    if (deleted > 0) {
      logger.info(`[${requestId}] Cleaned up ${deleted} orphan subscription(s)`)
    }

    return deleted
  } catch (error) {
    logger.error(`[${requestId}] Error during orphan subscription cleanup`, error)
    return 0
  }
}
