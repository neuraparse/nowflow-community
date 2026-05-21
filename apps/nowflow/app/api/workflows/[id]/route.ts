import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { publishWorkflowUpdate } from '@/lib/redis-pubsub'
import { canEditWorkflow } from '@/lib/workflows/permissions'
import { db } from '@/db'
import { workflow } from '@/db/schema'
import { WorkflowCollaborator } from './collaborators/route'

const logger = createLogger('WorkflowAPI')

// Schema for workflow metadata updates
const WorkflowUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  icon: z.string().min(1).max(50).optional(),
})

// PATCH /api/workflows/[id] - Update workflow metadata
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()

    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized workflow update attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 })
    }

    logger.info(`[${requestId}] Updating workflow metadata: ${id}`)

    // Check if workflow exists
    const [existingWorkflow] = await db
      .select({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        color: workflow.color,
        icon: workflow.icon,
        userId: workflow.userId,
        collaborators: workflow.collaborators,
      })
      .from(workflow)
      .where(eq(workflow.id, id))
      .limit(1)

    if (!existingWorkflow) {
      logger.warn(`[${requestId}] Workflow not found: ${id}`)
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Parse collaborators
    let collaborators: WorkflowCollaborator[] = []
    try {
      if (existingWorkflow.collaborators) {
        collaborators = Array.isArray(existingWorkflow.collaborators)
          ? existingWorkflow.collaborators
          : JSON.parse(existingWorkflow.collaborators as string)
      }
    } catch (error) {
      logger.error(`[${requestId}] Failed to parse collaborators`, { error })
    }

    // Check if user has edit permission (owner or editor)
    if (!canEditWorkflow(session.user.id, existingWorkflow.userId, collaborators)) {
      logger.warn(
        `[${requestId}] User ${session.user.id} does not have edit permission for workflow ${id}`
      )
      return NextResponse.json(
        { error: 'You do not have permission to edit this workflow' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const updateData = WorkflowUpdateSchema.parse(body)

    logger.info(`[${requestId}] Updating workflow with data:`, updateData)

    // Update workflow metadata
    const [updatedWorkflow] = await db
      .update(workflow)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(workflow.id, id))
      .returning({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        color: workflow.color,
        icon: workflow.icon,
        updatedAt: workflow.updatedAt,
      })

    logger.info(`[${requestId}] Successfully updated workflow: ${id}`)

    // Notify other tabs/devices via Redis Pub/Sub
    await publishWorkflowUpdate(id, session.user.id, 'workflow_updated')

    return NextResponse.json({
      success: true,
      workflow: updatedWorkflow,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn(`[${requestId}] Invalid workflow update data`, {
        errors: error.issues,
      })
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.issues,
        },
        { status: 400 }
      )
    }

    logger.error(`[${requestId}] Workflow update error`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/workflows/[id] - Alias for PATCH
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return PATCH(request, { params })
}

// DELETE /api/workflows/[id] - Explicitly delete a workflow (soft delete)
// This is the ONLY way to delete a workflow - sync will NEVER auto-delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()

    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized workflow delete attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 })
    }

    logger.info(`[${requestId}] EXPLICIT DELETE request for workflow: ${id}`)

    // Check if workflow exists and belongs to user
    const [existingWorkflow] = await db
      .select({
        id: workflow.id,
        name: workflow.name,
        userId: workflow.userId,
        deletedAt: workflow.deletedAt,
      })
      .from(workflow)
      .where(eq(workflow.id, id))
      .limit(1)

    if (!existingWorkflow) {
      logger.warn(`[${requestId}] Workflow not found for deletion: ${id}`)
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Check ownership - only owner can delete
    if (existingWorkflow.userId !== session.user.id) {
      logger.warn(
        `[${requestId}] User ${session.user.id} attempted to delete workflow ${id} owned by ${existingWorkflow.userId}`
      )
      return NextResponse.json(
        { error: 'You do not have permission to delete this workflow' },
        { status: 403 }
      )
    }

    // Check if already deleted
    if (existingWorkflow.deletedAt) {
      logger.info(`[${requestId}] Workflow ${id} is already deleted`)
      return NextResponse.json({
        success: true,
        message: 'Workflow already deleted',
        workflow: { id, deletedAt: existingWorkflow.deletedAt },
      })
    }

    // Soft delete - set deletedAt timestamp
    const now = new Date()
    await db
      .update(workflow)
      .set({
        deletedAt: now,
        deletedBy: session.user.id,
        updatedAt: now,
      })
      .where(eq(workflow.id, id))

    logger.info(`[${requestId}] Successfully DELETED workflow: ${id} (${existingWorkflow.name})`)

    return NextResponse.json({
      success: true,
      message: 'Workflow deleted successfully',
      workflow: {
        id,
        name: existingWorkflow.name,
        deletedAt: now,
      },
    })
  } catch (error: any) {
    logger.error(`[${requestId}] Workflow delete error`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/workflows/[id] - Get workflow metadata
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 })
    }

    // Get workflow metadata
    const [workflowData] = await db
      .select({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        color: workflow.color,
        icon: workflow.icon,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        isDeployed: workflow.isDeployed,
        deployedAt: workflow.deployedAt,
      })
      .from(workflow)
      .where(and(eq(workflow.id, id), eq(workflow.userId, session.user.id)))
      .limit(1)

    if (!workflowData) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      workflow: workflowData,
    })
  } catch (error: any) {
    logger.error(`[${requestId}] Workflow fetch error`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
