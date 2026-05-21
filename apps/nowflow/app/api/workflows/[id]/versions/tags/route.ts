import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import {
  createWorkflowTag,
  getAllAvailableTags,
  getWorkflowTags,
} from '@/lib/workflows/version-tag-service'

const logger = createLogger('WorkflowVersionTagsAPI')

/**
 * GET /api/workflows/[id]/versions/tags
 * List all available tags for a workflow (default + custom)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const { defaultTags, customTags } = await getAllAvailableTags(workflowId)

    return NextResponse.json({
      success: true,
      data: {
        defaultTags,
        customTags,
        allTags: [
          ...defaultTags.map((t) => ({ ...t, isDefault: true })),
          ...customTags.map((t) => ({ ...t, isDefault: false })),
        ],
      },
    })
  } catch (error) {
    logger.error('Failed to get workflow tags', { error })
    return NextResponse.json({ error: 'Failed to get tags' }, { status: 500 })
  }
}

/**
 * POST /api/workflows/[id]/versions/tags
 * Create a new custom tag for the workflow
 *
 * Body:
 * - name: string (required)
 * - color: string (optional, hex color)
 * - description: string (optional)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const body = await request.json()

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
    }

    // Validate color format if provided
    if (body.color && !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      return NextResponse.json(
        { error: 'Invalid color format. Use hex format like #FF0000' },
        { status: 400 }
      )
    }

    const tag = await createWorkflowTag(
      workflowId,
      {
        name: body.name.trim(),
        color: body.color,
        description: body.description,
      },
      session.user.id
    )

    return NextResponse.json({
      success: true,
      data: tag,
    })
  } catch (error: any) {
    logger.error('Failed to create workflow tag', { error })
    return NextResponse.json({ error: error.message || 'Failed to create tag' }, { status: 500 })
  }
}
