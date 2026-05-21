import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow, workflowRun } from '@/db/schema'

const logger = createLogger('WorkflowExecutionsAPI')

export const dynamic = 'force-dynamic'

/**
 * GET /api/workflows/[id]/executions
 * Returns recent execution runs for a workflow (max 20).
 * Requires session auth — the caller must own the workflow.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the workflow belongs to the user
    const [wf] = await db
      .select({ id: workflow.id, userId: workflow.userId })
      .from(workflow)
      .where(eq(workflow.id, id))
      .limit(1)

    if (!wf) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    if (wf.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch recent runs
    const runs = await db
      .select({
        id: workflowRun.id,
        status: workflowRun.status,
        executionTime: workflowRun.executionTime,
        trigger: workflowRun.trigger,
        error: workflowRun.error,
        startedAt: workflowRun.startedAt,
        completedAt: workflowRun.completedAt,
        createdAt: workflowRun.createdAt,
      })
      .from(workflowRun)
      .where(eq(workflowRun.workflowId, id))
      .orderBy(desc(workflowRun.createdAt))
      .limit(20)

    return NextResponse.json({ executions: runs })
  } catch (error: any) {
    logger.error(`Error fetching executions for workflow ${id}:`, error)
    return NextResponse.json({ error: 'Failed to fetch executions' }, { status: 500 })
  }
}
