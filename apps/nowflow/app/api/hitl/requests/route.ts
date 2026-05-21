import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, or } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createHITLRequest, sendNotifications } from '@/lib/hitl/hitl-service'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { hitlRequest, workflow } from '@/db/schema'

const logger = createLogger('HITLRequestsAPI')

/**
 * GET /api/hitl/requests
 * List HITL requests for the current user
 *
 * Query params:
 * - status: Filter by status (pending, approved, rejected, etc.)
 * - workflowId: Filter by workflow ID
 * - executionId: Filter by execution ID
 * - blockId: Filter by block ID
 * - limit: Max results (default 50)
 * - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const workflowId = searchParams.get('workflowId')
    const executionId = searchParams.get('executionId')
    const blockId = searchParams.get('blockId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Only show requests that are either:
    // 1. Belong to a workflow owned by the current user, OR
    // 2. Explicitly assigned to the current user
    const conditions = [
      or(eq(workflow.userId, session.user.id), eq(hitlRequest.assignedTo, session.user.id)),
    ]

    if (status) {
      conditions.push(eq(hitlRequest.status, status))
    }
    if (workflowId) {
      conditions.push(eq(hitlRequest.workflowId, workflowId))
    }
    if (executionId) {
      conditions.push(eq(hitlRequest.executionId, executionId))
    }
    if (blockId) {
      conditions.push(eq(hitlRequest.blockId, blockId))
    }

    const requests = await db
      .select({
        id: hitlRequest.id,
        workflowId: hitlRequest.workflowId,
        executionId: hitlRequest.executionId,
        blockId: hitlRequest.blockId,
        requestType: hitlRequest.requestType,
        status: hitlRequest.status,
        title: hitlRequest.title,
        description: hitlRequest.description,
        data: hitlRequest.data,
        options: hitlRequest.options,
        priority: hitlRequest.priority,
        timeoutAt: hitlRequest.timeoutAt,
        createdAt: hitlRequest.createdAt,
        respondedAt: hitlRequest.respondedAt,
        response: hitlRequest.response,
        responseNote: hitlRequest.responseNote,
        respondedBy: hitlRequest.respondedBy,
        assignedTo: hitlRequest.assignedTo,
        assignedToEmail: hitlRequest.assignedToEmail,
      })
      .from(hitlRequest)
      .innerJoin(workflow, eq(hitlRequest.workflowId, workflow.id))
      .where(and(...conditions))
      .orderBy(desc(hitlRequest.createdAt))
      .limit(limit)
      .offset(offset)

    return NextResponse.json({
      success: true,
      data: requests,
    })
  } catch (error) {
    logger.error('Failed to get HITL requests', { error })
    return NextResponse.json({ error: 'Failed to get requests' }, { status: 500 })
  }
}

/**
 * POST /api/hitl/requests
 * Create a new HITL request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.workflowId) {
      return NextResponse.json({ error: 'workflowId is required' }, { status: 400 })
    }

    if (!body.title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    // Verify the user owns the workflow before allowing HITL request creation
    const [wf] = await db
      .select({ userId: workflow.userId })
      .from(workflow)
      .where(eq(workflow.id, body.workflowId))
      .limit(1)

    if (!wf || wf.userId !== session.user.id) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Create the HITL request
    const hitlRequestData = await createHITLRequest({
      workflowId: body.workflowId,
      executionId: body.executionId || body.workflowId,
      blockId: body.blockId || 'unknown',
      requestType: body.requestType || 'approval',
      title: body.title,
      description: body.description,
      data: body.data,
      options: body.options,
      assignedTo: body.assignedTo,
      assignedToEmail: body.assignedToEmail,
      timeoutMinutes: body.timeoutMinutes,
      priority: body.priority || 'normal',
      notificationChannels: body.notificationChannels || ['email'],
      metadata: body.metadata,
    })

    // Send notifications asynchronously
    sendNotifications(hitlRequestData.id).catch((err) => {
      logger.warn('Failed to send notifications', { requestId: hitlRequestData.id, error: err })
    })

    return NextResponse.json({
      success: true,
      data: hitlRequestData,
    })
  } catch (error: any) {
    logger.error('Failed to create HITL request', { error })
    return NextResponse.json(
      { error: error.message || 'Failed to create request' },
      { status: 500 }
    )
  }
}
