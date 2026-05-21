import { type NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { isAllowedRedirectUri } from '@/lib/oauth/redirect-allowlist'
import { db } from '@/db'
import { workflow } from '@/db/schema'
import { getCredential, refreshTokenIfNeeded } from '../utils'

const logger = createLogger('OAuthTokenAPI')

/**
 * Resolve the effective userId for a token request.
 *
 * SECURITY (Phase -1 S4): This endpoint now REQUIRES an authenticated session.
 * Previously, a `workflowId` parameter alone could be used to resolve a userId
 * on the server, letting any caller request tokens for any workflow. We now
 * always use the session user's id and, if a workflowId is supplied, verify
 * that the session user owns that workflow before trusting the workflow-scoped
 * path.
 */
async function resolveAuthorizedUserId(
  requestId: string,
  sessionUserId: string,
  workflowId: string | undefined
): Promise<{ userId: string } | { error: string; status: number }> {
  if (!workflowId) {
    return { userId: sessionUserId }
  }

  const workflows = await db
    .select({ userId: workflow.userId })
    .from(workflow)
    .where(eq(workflow.id, workflowId))
    .limit(1)

  if (!workflows.length) {
    logger.warn(`[${requestId}] Workflow not found`)
    return { error: 'Workflow not found', status: 404 }
  }

  if (workflows[0].userId !== sessionUserId) {
    logger.warn(`[${requestId}] Session user does not own workflow ${workflowId}`)
    return { error: 'Forbidden', status: 403 }
  }

  return { userId: sessionUserId }
}

/**
 * Get an access token for a specific credential.
 *
 * Requires an authenticated session. If `workflowId` is provided, the session
 * user must own that workflow. Any `redirectUri` supplied by the client must
 * appear in the server-side allowlist (see `lib/oauth/redirect-allowlist.ts`).
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthenticated request rejected`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { credentialId, workflowId, redirectUri } = body

    if (!credentialId) {
      logger.warn(`[${requestId}] Credential ID is required`)
      return NextResponse.json({ error: 'Credential ID is required' }, { status: 400 })
    }

    if (redirectUri !== undefined && !isAllowedRedirectUri(redirectUri)) {
      logger.warn(`[${requestId}] Rejected redirect URI not on allowlist`)
      return NextResponse.json({ error: 'Invalid redirect URI' }, { status: 400 })
    }

    const resolution = await resolveAuthorizedUserId(requestId, session.user.id, workflowId)
    if ('error' in resolution) {
      return NextResponse.json({ error: resolution.error }, { status: resolution.status })
    }

    const credential = await getCredential(requestId, credentialId, resolution.userId)

    if (!credential) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    try {
      const { accessToken } = await refreshTokenIfNeeded(requestId, credential, credentialId)
      return NextResponse.json({ accessToken }, { status: 200 })
    } catch (_error) {
      return NextResponse.json({ error: 'Failed to refresh access token' }, { status: 401 })
    }
  } catch (error) {
    logger.error(`[${requestId}] Error getting access token`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Get the access token for a specific credential (session only).
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthenticated request rejected`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const credentialId = searchParams.get('credentialId')
    const redirectUri = searchParams.get('redirectUri')

    if (!credentialId) {
      logger.warn(`[${requestId}] Missing credential ID`)
      return NextResponse.json({ error: 'Credential ID is required' }, { status: 400 })
    }

    if (redirectUri !== null && !isAllowedRedirectUri(redirectUri)) {
      logger.warn(`[${requestId}] Rejected redirect URI not on allowlist`)
      return NextResponse.json({ error: 'Invalid redirect URI' }, { status: 400 })
    }

    const credential = await getCredential(requestId, credentialId, session.user.id)

    if (!credential) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    if (!credential.accessToken) {
      logger.warn(`[${requestId}] No access token available for credential`)
      return NextResponse.json({ error: 'No access token available' }, { status: 400 })
    }

    try {
      const { accessToken } = await refreshTokenIfNeeded(requestId, credential, credentialId)
      return NextResponse.json({ accessToken }, { status: 200 })
    } catch (_error) {
      return NextResponse.json({ error: 'Failed to refresh access token' }, { status: 401 })
    }
  } catch (error) {
    logger.error(`[${requestId}] Error fetching access token`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
