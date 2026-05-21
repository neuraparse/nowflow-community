import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNotNull } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow } from '@/db/schema'

const logger = createLogger('WorkflowRecoveryAPI')

/**
 * GET /api/workflows/recover
 *
 * Fetches soft-deleted workflows for the authenticated user
 * These workflows can be recovered within 30 days of deletion
 */
export async function GET(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized recovery access attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch soft-deleted workflows for this user
    const deletedWorkflows = await db
      .select({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        color: workflow.color,
        icon: workflow.icon,
        deletedAt: workflow.deletedAt,
        deletedBy: workflow.deletedBy,
        createdAt: workflow.createdAt,
        workspaceId: workflow.workspaceId,
      })
      .from(workflow)
      .where(and(eq(workflow.userId, userId), isNotNull(workflow.deletedAt)))

    logger.info(
      `[${requestId}] Found ${deletedWorkflows.length} deleted workflows for user ${userId}`
    )

    return NextResponse.json({ data: deletedWorkflows }, { status: 200 })
  } catch (error: any) {
    logger.error(`[${requestId}] Error fetching deleted workflows`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/workflows/recover
 *
 * Recovers a soft-deleted workflow by clearing the deletedAt timestamp
 * Body: { workflowId: string }
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized recovery attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await req.json()
    const { workflowId } = body

    if (!workflowId) {
      return NextResponse.json({ error: 'workflowId is required' }, { status: 400 })
    }

    // Verify the workflow exists, is deleted, and belongs to this user
    const deletedWorkflow = await db
      .select()
      .from(workflow)
      .where(
        and(eq(workflow.id, workflowId), eq(workflow.userId, userId), isNotNull(workflow.deletedAt))
      )
      .then((rows: any) => rows[0])

    if (!deletedWorkflow) {
      logger.warn(`[${requestId}] Workflow ${workflowId} not found or not deleted`)
      return NextResponse.json({ error: 'Workflow not found or not deleted' }, { status: 404 })
    }

    // Recover the workflow by clearing soft delete fields
    await db
      .update(workflow)
      .set({
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(workflow.id, workflowId))

    logger.info(`[${requestId}] Successfully recovered workflow ${workflowId} for user ${userId}`)

    return NextResponse.json(
      { success: true, message: 'Workflow recovered successfully' },
      { status: 200 }
    )
  } catch (error: any) {
    logger.error(`[${requestId}] Error recovering workflow`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/workflows/recover
 *
 * Permanently deletes a soft-deleted workflow (hard delete)
 * This is irreversible - use with caution
 * Body: { workflowId: string }
 */
export async function DELETE(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized permanent delete attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await req.json()
    const { workflowId } = body

    if (!workflowId) {
      return NextResponse.json({ error: 'workflowId is required' }, { status: 400 })
    }

    // Verify the workflow exists, is deleted, and belongs to this user
    const deletedWorkflow = await db
      .select()
      .from(workflow)
      .where(
        and(eq(workflow.id, workflowId), eq(workflow.userId, userId), isNotNull(workflow.deletedAt))
      )
      .then((rows: any) => rows[0])

    if (!deletedWorkflow) {
      logger.warn(`[${requestId}] Workflow ${workflowId} not found or not deleted`)
      return NextResponse.json({ error: 'Workflow not found or not deleted' }, { status: 404 })
    }

    // HARD DELETE - permanently remove from database
    await db.delete(workflow).where(eq(workflow.id, workflowId))

    logger.info(`[${requestId}] Permanently deleted workflow ${workflowId} for user ${userId}`)

    return NextResponse.json(
      { success: true, message: 'Workflow permanently deleted' },
      { status: 200 }
    )
  } catch (error: any) {
    logger.error(`[${requestId}] Error permanently deleting workflow`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
