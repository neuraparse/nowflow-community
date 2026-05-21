import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { getGitConfig, saveGitConfig } from '@/lib/workflows/git-sync-service'

const logger = createLogger('WorkflowGitAPI')

/**
 * GET /api/workflows/[id]/git
 * Get Git configuration for a workflow
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const config = await getGitConfig(workflowId)

    return NextResponse.json({
      success: true,
      data: config,
    })
  } catch (error) {
    logger.error('Failed to get Git config', { error })
    return NextResponse.json({ error: 'Failed to get Git configuration' }, { status: 500 })
  }
}

/**
 * POST /api/workflows/[id]/git
 * Save Git configuration for a workflow
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const body = await request.json()

    const config = await saveGitConfig(workflowId, {
      enabled: body.enabled,
      repositoryUrl: body.repositoryUrl,
      branch: body.branch,
      filePath: body.filePath,
      authType: body.authType,
      credentials: body.credentials,
      autoSync: body.autoSync,
      syncOnDeploy: body.syncOnDeploy,
    })

    return NextResponse.json({
      success: true,
      data: config,
    })
  } catch (error) {
    logger.error('Failed to save Git config', { error })
    return NextResponse.json({ error: 'Failed to save Git configuration' }, { status: 500 })
  }
}
