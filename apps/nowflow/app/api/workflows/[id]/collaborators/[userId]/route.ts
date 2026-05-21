import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow } from '@/db/schema'
import { WorkflowCollaborator } from '../route'

const logger = createLogger('WorkflowCollaboratorUpdate')

/**
 * PATCH /api/workflows/[id]/collaborators/[userId]
 * Update a collaborator's role
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: workflowId, userId: collaboratorUserId } = await params
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { role } = body

    // Validate role
    if (!role || !['viewer', 'editor'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be viewer or editor' }, { status: 400 })
    }

    // Get workflow
    const workflowData = await db
      .select({
        id: workflow.id,
        userId: workflow.userId,
        name: workflow.name,
        collaborators: workflow.collaborators,
      })
      .from(workflow)
      .where(eq(workflow.id, workflowId))
      .limit(1)

    if (!workflowData.length) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const wf = workflowData[0]

    // Only owner can update collaborator roles
    if (wf.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only workflow owner can update collaborator roles' },
        { status: 403 }
      )
    }

    // Update collaborator role
    const collaborators = (wf.collaborators as WorkflowCollaborator[]) || []
    const collaboratorIndex = collaborators.findIndex((c) => c.userId === collaboratorUserId)

    if (collaboratorIndex === -1) {
      return NextResponse.json({ error: 'Collaborator not found' }, { status: 404 })
    }

    // Update role
    collaborators[collaboratorIndex].role = role

    // Update workflow
    await db
      .update(workflow)
      .set({
        collaborators,
        updatedAt: new Date(),
      })
      .where(eq(workflow.id, workflowId))

    logger.info('Collaborator role updated', {
      workflowId,
      workflowName: wf.name,
      collaboratorUserId,
      newRole: role,
      updatedBy: session.user.id,
    })

    return NextResponse.json({
      success: true,
      collaborator: collaborators[collaboratorIndex],
    })
  } catch (error: any) {
    logger.error('Failed to update collaborator role', { error: error.message })
    return NextResponse.json({ error: 'Failed to update collaborator role' }, { status: 500 })
  }
}
