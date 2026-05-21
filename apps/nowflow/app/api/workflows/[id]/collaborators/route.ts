import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { user, workflow } from '@/db/schema'

const logger = createLogger('WorkflowCollaborators')

export interface WorkflowCollaborator {
  userId: string
  email: string
  name: string
  role: 'viewer' | 'editor'
  addedAt: string
  addedBy: string
}

/**
 * GET /api/workflows/[id]/collaborators
 * Get all collaborators for a workflow
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workflowId } = await params
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workflow
    const workflowData = await db
      .select({
        id: workflow.id,
        userId: workflow.userId,
        collaborators: workflow.collaborators,
      })
      .from(workflow)
      .where(eq(workflow.id, workflowId))
      .limit(1)

    if (!workflowData.length) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const wf = workflowData[0]

    // Check if user is owner or collaborator
    const collaborators = (wf.collaborators as WorkflowCollaborator[]) || []
    const isOwner = wf.userId === session.user.id
    const isCollaborator = collaborators.some((c) => c.userId === session.user.id)

    if (!isOwner && !isCollaborator) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      owner: wf.userId,
      collaborators,
    })
  } catch (error: any) {
    logger.error('Failed to get collaborators', { error: error.message })
    return NextResponse.json({ error: 'Failed to get collaborators' }, { status: 500 })
  }
}

/**
 * POST /api/workflows/[id]/collaborators
 * Add a collaborator to a workflow
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workflowId } = await params
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { email, role = 'viewer' } = body

    // Validate input
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Validate role
    if (!['viewer', 'editor'].includes(role)) {
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

    // Only owner can add collaborators
    if (wf.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only workflow owner can add collaborators' },
        { status: 403 }
      )
    }

    // Find user by email
    const targetUser = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
      })
      .from(user)
      .where(eq(user.email, email))
      .limit(1)

    if (!targetUser.length) {
      return NextResponse.json({ error: 'User not found with this email' }, { status: 404 })
    }

    const collaboratorUser = targetUser[0]

    // Check if user is the owner
    if (collaboratorUser.id === wf.userId) {
      return NextResponse.json(
        { error: 'Cannot add workflow owner as collaborator' },
        { status: 400 }
      )
    }

    // Check if already a collaborator
    const collaborators = (wf.collaborators as WorkflowCollaborator[]) || []
    const existingCollaborator = collaborators.find((c) => c.userId === collaboratorUser.id)

    if (existingCollaborator) {
      return NextResponse.json({ error: 'User is already a collaborator' }, { status: 400 })
    }

    // Add collaborator
    const newCollaborator: WorkflowCollaborator = {
      userId: collaboratorUser.id,
      email: collaboratorUser.email,
      name: collaboratorUser.name,
      role,
      addedAt: new Date().toISOString(),
      addedBy: session.user.id,
    }

    const updatedCollaborators = [...collaborators, newCollaborator]

    // Update workflow
    await db
      .update(workflow)
      .set({
        collaborators: updatedCollaborators,
        updatedAt: new Date(),
      })
      .where(eq(workflow.id, workflowId))

    logger.info('Collaborator added', {
      workflowId,
      workflowName: wf.name,
      collaboratorEmail: email,
      role,
      addedBy: session.user.id,
    })

    return NextResponse.json({
      success: true,
      collaborator: newCollaborator,
    })
  } catch (error: any) {
    logger.error('Failed to add collaborator', { error: error.message })
    return NextResponse.json({ error: 'Failed to add collaborator' }, { status: 500 })
  }
}

/**
 * DELETE /api/workflows/[id]/collaborators
 * Remove a collaborator from a workflow
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workflowId } = await params
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const collaboratorUserId = searchParams.get('userId')

    if (!collaboratorUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
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

    const isOwner = wf.userId === session.user.id
    const isSelf = collaboratorUserId === session.user.id

    // Check permissions: owner can remove anyone, user can remove themselves
    if (!isOwner && !isSelf) {
      return NextResponse.json(
        { error: 'You can only remove yourself or must be the workflow owner' },
        { status: 403 }
      )
    }

    // Remove collaborator
    const collaborators = (wf.collaborators as WorkflowCollaborator[]) || []
    const updatedCollaborators = collaborators.filter((c) => c.userId !== collaboratorUserId)

    if (collaborators.length === updatedCollaborators.length) {
      return NextResponse.json({ error: 'Collaborator not found' }, { status: 404 })
    }

    // Update workflow
    await db
      .update(workflow)
      .set({
        collaborators: updatedCollaborators,
        updatedAt: new Date(),
      })
      .where(eq(workflow.id, workflowId))

    logger.info('Collaborator removed', {
      workflowId,
      workflowName: wf.name,
      collaboratorUserId,
      removedBy: session.user.id,
      isSelfRemoval: isSelf,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Failed to remove collaborator', { error: error.message })
    return NextResponse.json({ error: 'Failed to remove collaborator' }, { status: 500 })
  }
}
