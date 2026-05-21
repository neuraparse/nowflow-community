import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { pullFromGit, pushToGit } from '@/lib/workflows/git-sync-service'

const logger = createLogger('WorkflowGitSyncAPI')

/**
 * POST /api/workflows/[id]/git/sync
 * Sync workflow with Git (push or pull)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const body = await request.json()
    const direction = body.direction || 'push'
    const commitMessage = body.commitMessage

    let result
    if (direction === 'push') {
      result = await pushToGit(workflowId, session.user.id, commitMessage)
    } else if (direction === 'pull') {
      result = await pullFromGit(workflowId, session.user.id)
    } else {
      return NextResponse.json(
        { error: 'Invalid direction. Use "push" or "pull"' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: `Successfully ${direction === 'push' ? 'pushed to' : 'pulled from'} Git`,
    })
  } catch (error) {
    logger.error('Failed to sync with Git', { error })
    return NextResponse.json({ error: 'Failed to sync with Git' }, { status: 500 })
  }
}
