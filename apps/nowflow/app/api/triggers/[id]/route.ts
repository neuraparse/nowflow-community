import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow, workflowTrigger } from '@/db/schema'

const logger = createLogger('TriggerAPI')

export const dynamic = 'force-dynamic'

/**
 * GET /api/triggers/[id]
 * Get specific trigger details
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = (await params).id

    const [result] = await db
      .select({
        trigger: workflowTrigger,
        workflow: workflow,
      })
      .from(workflowTrigger)
      .innerJoin(workflow, eq(workflowTrigger.workflowId, workflow.id))
      .where(and(eq(workflowTrigger.id, id), eq(workflow.userId, session.user.id)))
      .limit(1)

    if (!result) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 })
    }

    return NextResponse.json({ trigger: result.trigger, workflow: result.workflow })
  } catch (error: any) {
    logger.error('Error fetching trigger', error)
    return NextResponse.json({ error: 'Failed to fetch trigger' }, { status: 500 })
  }
}

/**
 * DELETE /api/triggers/[id]
 * Delete a trigger
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = (await params).id

    // Verify trigger belongs to user
    const [result] = await db
      .select({
        trigger: workflowTrigger,
        workflow: workflow,
      })
      .from(workflowTrigger)
      .innerJoin(workflow, eq(workflowTrigger.workflowId, workflow.id))
      .where(and(eq(workflowTrigger.id, id), eq(workflow.userId, session.user.id)))
      .limit(1)

    if (!result) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 })
    }

    // Delete trigger
    await db.delete(workflowTrigger).where(eq(workflowTrigger.id, id))

    logger.info(`Deleted trigger ${id} for workflow ${result.workflow.id}`)

    return NextResponse.json({ message: 'Trigger deleted successfully' })
  } catch (error: any) {
    logger.error('Error deleting trigger', error)
    return NextResponse.json({ error: 'Failed to delete trigger' }, { status: 500 })
  }
}

/**
 * PATCH /api/triggers/[id]
 * Update trigger status or configuration
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = (await params).id
    const body = await request.json()

    // Verify trigger belongs to user
    const [result] = await db
      .select({
        trigger: workflowTrigger,
        workflow: workflow,
      })
      .from(workflowTrigger)
      .innerJoin(workflow, eq(workflowTrigger.workflowId, workflow.id))
      .where(and(eq(workflowTrigger.id, id), eq(workflow.userId, session.user.id)))
      .limit(1)

    if (!result) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 })
    }

    // Update trigger
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.config !== undefined) updateData.config = body.config
    if (body.provider !== undefined) updateData.provider = body.provider
    if (body.pollingInterval !== undefined) {
      updateData.pollingInterval = body.pollingInterval
      updateData.nextPollAt = new Date(Date.now() + body.pollingInterval * 60 * 1000)
    }

    const [updatedTrigger] = await db
      .update(workflowTrigger)
      .set(updateData)
      .where(eq(workflowTrigger.id, id))
      .returning()

    logger.info(`Updated trigger ${id}`, updateData)

    return NextResponse.json({ trigger: updatedTrigger, message: 'Trigger updated successfully' })
  } catch (error: any) {
    logger.error('Error updating trigger', error)
    return NextResponse.json({ error: 'Failed to update trigger' }, { status: 500 })
  }
}
