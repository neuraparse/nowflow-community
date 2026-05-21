import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { importVersion, VersionExportData } from '@/lib/workflows/version-service'

const logger = createLogger('WorkflowVersionImportAPI')

/**
 * POST /api/workflows/[id]/versions/import
 * Import a previously exported version
 *
 * Body: VersionExportData (exported JSON)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const body = await request.json()

    // Validate import data structure
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid import data' }, { status: 400 })
    }

    if (!body.version || !body.state || !body.exportVersion) {
      return NextResponse.json(
        {
          error:
            'Invalid export data format. Missing required fields: version, state, exportVersion',
        },
        { status: 400 }
      )
    }

    // Validate export version compatibility
    const supportedExportVersions = ['1.0']
    if (!supportedExportVersions.includes(body.exportVersion)) {
      return NextResponse.json(
        {
          error: `Unsupported export version: ${body.exportVersion}. Supported: ${supportedExportVersions.join(', ')}`,
        },
        { status: 400 }
      )
    }

    const importedVersion = await importVersion(
      workflowId,
      body as VersionExportData,
      session.user.id
    )

    return NextResponse.json({
      success: true,
      data: importedVersion,
      message: `Successfully imported as version ${importedVersion.versionNumber}`,
    })
  } catch (error: any) {
    logger.error('Failed to import version', { error })
    return NextResponse.json(
      { error: error.message || 'Failed to import version' },
      { status: 500 }
    )
  }
}
