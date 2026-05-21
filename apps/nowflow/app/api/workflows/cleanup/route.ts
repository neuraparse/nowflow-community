import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { and, inArray, isNotNull, sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow } from '@/db/schema'

const logger = createLogger('WorkflowCleanupAPI')

/**
 * POST /api/workflows/cleanup
 *
 * Permanently deletes soft-deleted workflows older than 90 days
 * CRITICAL FIX: Extended from 30 to 90 days to provide more recovery time
 * This should be called by a cron job or scheduled task
 *
 * Security: This endpoint should be protected by API key or internal-only access
 */
export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    // Security check: Verify this is an internal request or has valid API key
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.INTERNAL_API_KEY

    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    let isAuthorized = false
    if (expectedKey && bearerToken) {
      try {
        const a = Buffer.from(bearerToken)
        const b = Buffer.from(expectedKey)
        isAuthorized = a.length === b.length && timingSafeEqual(a, b)
      } catch {
        /* noop */
      }
    }
    if (!isAuthorized) {
      logger.warn(`[${requestId}] Unauthorized cleanup attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Calculate the cutoff date (90 days ago - extended from 30 days)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)

    logger.info(
      `[${requestId}] Starting cleanup of workflows deleted before ${cutoffDate.toISOString()}`
    )

    // Find workflows that have been soft-deleted for more than 90 days (extended from 30 days)
    const workflowsToDelete = await db
      .select({ id: workflow.id, name: workflow.name, deletedAt: workflow.deletedAt })
      .from(workflow)
      .where(and(isNotNull(workflow.deletedAt), sql`${workflow.deletedAt} < ${cutoffDate}`))

    if (workflowsToDelete.length === 0) {
      logger.info(`[${requestId}] No workflows to clean up`)
      return NextResponse.json(
        { success: true, message: 'No workflows to clean up', deletedCount: 0 },
        { status: 200 }
      )
    }

    // Permanently delete in a single batch query instead of N+1 loop
    const idsToDelete = workflowsToDelete.map((wf: any) => wf.id)
    await db.delete(workflow).where(inArray(workflow.id, idsToDelete))

    for (const wf of workflowsToDelete) {
      logger.info(
        `[${requestId}] Permanently deleted workflow ${wf.id} (${wf.name}) - deleted at ${wf.deletedAt}`
      )
    }

    logger.info(`[${requestId}] Cleanup complete - deleted ${workflowsToDelete.length} workflows`)

    return NextResponse.json(
      {
        success: true,
        message: `Successfully cleaned up ${workflowsToDelete.length} workflows`,
        deletedCount: workflowsToDelete.length,
        workflows: workflowsToDelete.map((w: any) => ({ id: w.id, name: w.name })),
      },
      { status: 200 }
    )
  } catch (error: any) {
    logger.error(`[${requestId}] Error during workflow cleanup`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * GET /api/workflows/cleanup
 *
 * Preview workflows that would be deleted by cleanup
 * (for testing/verification purposes)
 */
export async function GET(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    // Security check
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.INTERNAL_API_KEY

    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    let isAuthorized = false
    if (expectedKey && bearerToken) {
      try {
        const a = Buffer.from(bearerToken)
        const b = Buffer.from(expectedKey)
        isAuthorized = a.length === b.length && timingSafeEqual(a, b)
      } catch {
        /* noop */
      }
    }
    if (!isAuthorized) {
      logger.warn(`[${requestId}] Unauthorized cleanup preview attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Calculate the cutoff date (90 days ago - extended from 30 days)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)

    // Find workflows that would be deleted
    const workflowsToDelete = await db
      .select({
        id: workflow.id,
        name: workflow.name,
        userId: workflow.userId,
        deletedAt: workflow.deletedAt,
        deletedBy: workflow.deletedBy,
      })
      .from(workflow)
      .where(and(isNotNull(workflow.deletedAt), sql`${workflow.deletedAt} < ${cutoffDate}`))

    logger.info(`[${requestId}] Found ${workflowsToDelete.length} workflows eligible for cleanup`)

    return NextResponse.json(
      {
        cutoffDate: cutoffDate.toISOString(),
        count: workflowsToDelete.length,
        workflows: workflowsToDelete,
      },
      { status: 200 }
    )
  } catch (error: any) {
    logger.error(`[${requestId}] Error previewing workflow cleanup`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
