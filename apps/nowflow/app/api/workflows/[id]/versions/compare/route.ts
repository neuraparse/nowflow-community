import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { compareVersions } from '@/lib/workflows/version-service'

const logger = createLogger('WorkflowVersionCompareAPI')

/**
 * GET /api/workflows/[id]/versions/compare
 * Compare two versions
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const { searchParams } = new URL(request.url)
    const fromVersionStr = searchParams.get('from')
    const toVersionStr = searchParams.get('to')

    if (!fromVersionStr || !toVersionStr) {
      return NextResponse.json(
        { error: 'Both from and to version numbers are required' },
        { status: 400 }
      )
    }

    const fromVersion = parseInt(fromVersionStr, 10)
    const toVersion = parseInt(toVersionStr, 10)

    if (isNaN(fromVersion) || isNaN(toVersion)) {
      return NextResponse.json({ error: 'Version numbers must be valid integers' }, { status: 400 })
    }

    const comparison = await compareVersions(workflowId, fromVersion, toVersion)

    return NextResponse.json({
      success: true,
      data: comparison,
    })
  } catch (error) {
    logger.error('Failed to compare versions', { error })
    return NextResponse.json({ error: 'Failed to compare versions' }, { status: 500 })
  }
}
