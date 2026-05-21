import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { exportVersion } from '@/lib/workflows/version-service'

const logger = createLogger('WorkflowVersionExportAPI')

/**
 * GET /api/workflows/[id]/versions/export
 * Export a version for backup or sharing
 *
 * Query params:
 * - version: version number to export (required)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const { searchParams } = new URL(request.url)
    const versionParam = searchParams.get('version')

    if (!versionParam) {
      return NextResponse.json({ error: 'Version number is required' }, { status: 400 })
    }

    const versionNumber = parseInt(versionParam, 10)
    if (isNaN(versionNumber)) {
      return NextResponse.json({ error: 'Invalid version number' }, { status: 400 })
    }

    const exportData = await exportVersion(workflowId, versionNumber)

    // Return as downloadable JSON file
    const fileName = `workflow-${workflowId}-v${versionNumber}-export.json`

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: any) {
    logger.error('Failed to export version', { error })
    return NextResponse.json(
      { error: error.message || 'Failed to export version' },
      { status: 500 }
    )
  }
}
