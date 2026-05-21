import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { getWebhookStats } from '@/lib/webhooks/monitoring'
import { db } from '@/db'
import { webhook, workflow } from '@/db/schema'

const logger = createLogger('WebhookStatsAPI')

/**
 * GET /api/webhooks/[id]/stats
 * Get webhook statistics
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const { id } = await params
    logger.debug(`[${requestId}] Fetching stats for webhook: ${id}`)

    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized stats request`)
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

    // Get webhook statistics
    const stats = await getWebhookStats(id)

    if (!stats) {
      logger.warn(`[${requestId}] Failed to get stats for webhook: ${id}`)
      return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 })
    }

    logger.info(`[${requestId}] Successfully retrieved stats for webhook: ${id}`)
    return NextResponse.json({ stats }, { status: 200 })
  } catch (error) {
    logger.error(`[${requestId}] Error fetching webhook stats`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
