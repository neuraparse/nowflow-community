import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow, workflowTrigger } from '@/db/schema'

const logger = createLogger('TriggersAPI')

export const dynamic = 'force-dynamic'

/**
 * GET /api/triggers
 * Get all triggers for a workflow or user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('workflowId')

    if (workflowId) {
      // Get triggers for specific workflow
      const triggers = await db
        .select({
          trigger: workflowTrigger,
          workflow: workflow,
        })
        .from(workflowTrigger)
        .innerJoin(workflow, eq(workflowTrigger.workflowId, workflow.id))
        .where(
          and(eq(workflowTrigger.workflowId, workflowId), eq(workflow.userId, session.user.id))
        )

      return NextResponse.json({ triggers })
    } else {
      // Get all triggers for user
      const triggers = await db
        .select({
          trigger: workflowTrigger,
          workflow: workflow,
        })
        .from(workflowTrigger)
        .innerJoin(workflow, eq(workflowTrigger.workflowId, workflow.id))
        .where(eq(workflow.userId, session.user.id))

      return NextResponse.json({ triggers })
    }
  } catch (error: any) {
    logger.error('Error fetching triggers', error)
    return NextResponse.json({ error: 'Failed to fetch triggers' }, { status: 500 })
  }
}

/**
 * POST /api/triggers
 * Create a new trigger
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workflowId, triggerType, provider, config, pollingInterval } = body

    if (!workflowId || !triggerType || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: workflowId, triggerType, config' },
        { status: 400 }
      )
    }

    // Verify workflow belongs to user
    const [workflowRecord] = await db
      .select()
      .from(workflow)
      .where(and(eq(workflow.id, workflowId), eq(workflow.userId, session.user.id)))
      .limit(1)

    if (!workflowRecord) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Check if trigger already exists for this workflow
    const [existingTrigger] = await db
      .select()
      .from(workflowTrigger)
      .where(eq(workflowTrigger.workflowId, workflowId))
      .limit(1)

    // Calculate nextPollAt for polling-based triggers (polling and email)
    const needsPolling = (triggerType === 'polling' || triggerType === 'email') && pollingInterval
    const nextPollAt = needsPolling ? new Date(Date.now() + pollingInterval * 60 * 1000) : null

    if (existingTrigger) {
      // Update existing trigger
      const [updatedTrigger] = await db
        .update(workflowTrigger)
        .set({
          triggerType,
          provider,
          config,
          pollingInterval,
          nextPollAt,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(workflowTrigger.id, existingTrigger.id))
        .returning()

      logger.info(`Updated trigger for workflow ${workflowId}`, {
        triggerId: updatedTrigger.id,
        triggerType,
      })

      return NextResponse.json({
        trigger: updatedTrigger,
        message: 'Trigger updated successfully',
      })
    } else {
      // Create new trigger
      const triggerId = uuidv4()
      const [newTrigger] = await db
        .insert(workflowTrigger)
        .values({
          id: triggerId,
          workflowId,
          triggerType,
          provider,
          config,
          pollingInterval,
          nextPollAt,
          isActive: true,
        })
        .returning()

      logger.info(`Created trigger for workflow ${workflowId}`, {
        triggerId,
        triggerType,
      })

      return NextResponse.json({
        trigger: newTrigger,
        message: 'Trigger created successfully',
      })
    }
  } catch (error: any) {
    logger.error('Error creating/updating trigger', error)
    return NextResponse.json({ error: 'Failed to create/update trigger' }, { status: 500 })
  }
}
