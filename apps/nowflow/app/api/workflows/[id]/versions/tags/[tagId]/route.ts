import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { deleteWorkflowTag, updateWorkflowTag } from '@/lib/workflows/version-tag-service'

const logger = createLogger('WorkflowVersionTagAPI')

/**
 * PATCH /api/workflows/[id]/versions/tags/[tagId]
 * Update a custom tag
 *
 * Body:
 * - name: string (optional)
 * - color: string (optional, hex color)
 * - description: string (optional)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tagId } = await params
    const body = await request.json()

    // Validate color format if provided
    if (body.color && !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      return NextResponse.json(
        { error: 'Invalid color format. Use hex format like #FF0000' },
        { status: 400 }
      )
    }

    const updates: any = {}
    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.color !== undefined) updates.color = body.color
    if (body.description !== undefined) updates.description = body.description

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const tag = await updateWorkflowTag(tagId, updates)

    return NextResponse.json({
      success: true,
      data: tag,
    })
  } catch (error: any) {
    logger.error('Failed to update workflow tag', { error })
    return NextResponse.json({ error: error.message || 'Failed to update tag' }, { status: 500 })
  }
}

/**
 * DELETE /api/workflows/[id]/versions/tags/[tagId]
 * Delete a custom tag
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tagId } = await params

    await deleteWorkflowTag(tagId)

    return NextResponse.json({
      success: true,
      message: 'Tag deleted successfully',
    })
  } catch (error: any) {
    logger.error('Failed to delete workflow tag', { error })
    return NextResponse.json({ error: error.message || 'Failed to delete tag' }, { status: 500 })
  }
}
