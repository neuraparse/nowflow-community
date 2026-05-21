import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getSnapshotAtStep, getSnapshots } from '@/lib/debug/snapshot-service'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('DebugSnapshotsAPI')

/**
 * GET /api/workflows/[id]/debug/snapshots
 * Get execution snapshots for debugging
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const { searchParams } = new URL(request.url)
    const executionId = searchParams.get('executionId')
    const stepIndex = searchParams.get('stepIndex')

    if (!executionId) {
      return NextResponse.json({ error: 'executionId is required' }, { status: 400 })
    }

    if (stepIndex) {
      const snapshot = await getSnapshotAtStep(executionId, parseInt(stepIndex))
      return NextResponse.json({
        success: true,
        data: snapshot,
      })
    }

    const { snapshots, total } = await getSnapshots(executionId)

    return NextResponse.json({
      success: true,
      data: { snapshots, total },
    })
  } catch (error) {
    logger.error('Failed to get snapshots', { error })
    return NextResponse.json({ error: 'Failed to get snapshots' }, { status: 500 })
  }
}
