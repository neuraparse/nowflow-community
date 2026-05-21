import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  createBreakpoint,
  deleteBreakpoint,
  getBreakpoints,
  updateBreakpoint,
} from '@/lib/debug/snapshot-service'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('DebugBreakpointsAPI')

/**
 * GET /api/workflows/[id]/debug/breakpoints
 * List breakpoints for a workflow
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const breakpoints = await getBreakpoints(workflowId, session.user.id)

    return NextResponse.json({
      success: true,
      data: breakpoints,
    })
  } catch (error) {
    logger.error('Failed to get breakpoints', { error })
    return NextResponse.json({ error: 'Failed to get breakpoints' }, { status: 500 })
  }
}

/**
 * POST /api/workflows/[id]/debug/breakpoints
 * Create a breakpoint
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const body = await request.json()

    const breakpoint = await createBreakpoint(
      workflowId,
      session.user.id,
      body.blockId,
      body.condition
    )

    return NextResponse.json({
      success: true,
      data: breakpoint,
    })
  } catch (error) {
    logger.error('Failed to create breakpoint', { error })
    return NextResponse.json({ error: 'Failed to create breakpoint' }, { status: 500 })
  }
}

/**
 * PATCH /api/workflows/[id]/debug/breakpoints
 * Update a breakpoint
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'Breakpoint ID is required' }, { status: 400 })
    }

    await updateBreakpoint(body.id, {
      isEnabled: body.isEnabled,
      condition: body.condition,
    })

    return NextResponse.json({
      success: true,
      message: 'Breakpoint updated',
    })
  } catch (error) {
    logger.error('Failed to update breakpoint', { error })
    return NextResponse.json({ error: 'Failed to update breakpoint' }, { status: 500 })
  }
}

/**
 * DELETE /api/workflows/[id]/debug/breakpoints
 * Delete a breakpoint
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const breakpointId = searchParams.get('id')

    if (!breakpointId) {
      return NextResponse.json({ error: 'Breakpoint ID is required' }, { status: 400 })
    }

    await deleteBreakpoint(breakpointId)

    return NextResponse.json({
      success: true,
      message: 'Breakpoint deleted',
    })
  } catch (error) {
    logger.error('Failed to delete breakpoint', { error })
    return NextResponse.json({ error: 'Failed to delete breakpoint' }, { status: 500 })
  }
}
