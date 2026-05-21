import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { getWebhookLogs } from '@/lib/webhooks/monitoring'
import { db } from '@/db'
import { webhook, workflow } from '@/db/schema'

const logger = createLogger('WebhookLogsAPI')

/**
 * GET /api/webhooks/[id]/logs
 * Get webhook logs
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)

    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const successOnly = searchParams.get('successOnly') === 'true'
    const failedOnly = searchParams.get('failedOnly') === 'true'
    const since = searchParams.get('since') ? new Date(searchParams.get('since')!) : undefined

    logger.debug(`[${requestId}] Fetching logs for webhook: ${id}`)

    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized logs request`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Verify webhook ownership
    const webhooks = await db
      .select({
        webhook: webhook,
        workflow: {
          id: workflow.id,
          userId: workflow.userId,
        },
      })
      .from(webhook)
      .innerJoin(workflow, eq(webhook.workflowId, workflow.id))
      .where(eq(webhook.id, id))
      .limit(1)

    if (webhooks.length === 0) {
      logger.warn(`[${requestId}] Webhook not found: ${id}`)
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    if (webhooks[0].workflow.userId !== userId) {
      logger.warn(`[${requestId}] Unauthorized access to webhook: ${id}`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get webhook logs
    const logs = await getWebhookLogs(id, {
      limit,
      offset,
      successOnly,
      failedOnly,
      since,
    })

    logger.info(`[${requestId}] Successfully retrieved ${logs.length} logs for webhook: ${id}`)
    return NextResponse.json({ logs }, { status: 200 })
  } catch (error) {
    logger.error(`[${requestId}] Error fetching webhook logs`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
