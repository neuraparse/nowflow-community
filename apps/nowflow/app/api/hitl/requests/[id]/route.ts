import { NextRequest, NextResponse } from 'next/server'
import { and, eq, or } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { respondToRequest } from '@/lib/hitl/hitl-service'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { hitlRequest, workflow } from '@/db/schema'

const logger = createLogger('HITLRequestAPI')

/**
 * Verify the authenticated user has access to a HITL request.
 * Access is granted if the user owns the workflow OR is assigned to the request.
 */
async function verifyHITLAccess(hitlReqData: any, userId: string): Promise<boolean> {
  // If user is explicitly assigned to this request, allow access
  if (hitlReqData.assignedTo === userId) {
    return true
  }

  // Otherwise, check if user owns the workflow
  const [wf] = await db
    .select({ userId: workflow.userId })
    .from(workflow)
    .where(eq(workflow.id, hitlReqData.workflowId))
    .limit(1)

  return wf?.userId === userId
}

/**
 * GET /api/hitl/requests/[id]
 * Get a specific HITL request
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const [hitlReq] = await db.select().from(hitlRequest).where(eq(hitlRequest.id, id)).limit(1)

    if (!hitlReq) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Verify the user has access to this HITL request
    const hasAccess = await verifyHITLAccess(hitlReq, session.user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: hitlReq,
    })
  } catch (error) {
    logger.error('Failed to get HITL request', { error })
    return NextResponse.json({ error: 'Failed to get request' }, { status: 500 })
  }
}

/**
 * POST /api/hitl/requests/[id]
 * Respond to a HITL request
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Fetch the request first to verify access
    const [hitlReq] = await db.select().from(hitlRequest).where(eq(hitlRequest.id, id)).limit(1)

    if (!hitlReq) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Verify the user has access to this HITL request
    const hasAccess = await verifyHITLAccess(hitlReq, session.user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const body = await request.json()

    const result = await respondToRequest({
      requestId: id,
      userId: session.user.id,
      response: body.response,
      status: body.approved ? 'approved' : 'rejected',
      responseNote: body.note,
    })

    // If approved, trigger workflow resume
    let resumeResult: { resumed?: boolean; error?: string } = {}
    if (body.approved) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const resumeResponse = await fetch(`${baseUrl}/api/hitl/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hitlRequestId: id }),
        })

        const resumeData = await resumeResponse.json()
        resumeResult = {
          resumed: resumeData.resumed,
          error: resumeData.error,
        }

        logger.info('Workflow resume triggered after UI approval', {
          requestId: id,
          resumed: resumeData.resumed,
          error: resumeData.error,
        })
      } catch (resumeError: any) {
        logger.error('Failed to trigger workflow resume after UI approval', {
          requestId: id,
          error: resumeError.message,
        })
        resumeResult = { error: resumeError.message }
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: body.approved ? 'Request approved' : 'Request rejected',
      resumed: resumeResult.resumed,
      resumeError: resumeResult.error,
    })
  } catch (error) {
    logger.error('Failed to respond to HITL request', { error })
    return NextResponse.json({ error: 'Failed to respond to request' }, { status: 500 })
  }
}
