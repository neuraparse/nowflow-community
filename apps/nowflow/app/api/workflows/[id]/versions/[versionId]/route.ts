import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import {
  addVersionTags,
  getVersion,
  getVersionById,
  removeVersionTags,
  restoreVersion,
  toggleVersionLock,
  toggleVersionPin,
  updateVersion,
} from '@/lib/workflows/version-service'

const logger = createLogger('WorkflowVersionAPI')

/**
 * GET /api/workflows/[id]/versions/[versionId]
 * Get a specific version
 * versionId can be either a version number (integer) or version UUID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId, versionId } = await params

    // Check if versionId is a number or UUID
    const versionNumber = parseInt(versionId, 10)
    let version

    if (!isNaN(versionNumber)) {
      version = await getVersion(workflowId, versionNumber)
    } else {
      // Try to get by UUID
      version = await getVersionById(versionId)
      if (version && version.workflowId !== workflowId) {
        return NextResponse.json({ error: 'Version not found' }, { status: 404 })
      }
    }

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: version,
    })
  } catch (error) {
    logger.error('Failed to get version', { error })
    return NextResponse.json({ error: 'Failed to get version' }, { status: 500 })
  }
}

/**
 * POST /api/workflows/[id]/versions/[versionId]
 * Restore a workflow to this version
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId, versionId } = await params
    const versionNumber = parseInt(versionId, 10)

    if (isNaN(versionNumber)) {
      return NextResponse.json({ error: 'Invalid version number' }, { status: 400 })
    }

    const restoredVersion = await restoreVersion(workflowId, versionNumber, session.user.id)

    return NextResponse.json({
      success: true,
      data: restoredVersion,
      message: `Workflow restored to version ${restoredVersion.versionNumber}`,
    })
  } catch (error) {
    logger.error('Failed to restore version', { error })
    return NextResponse.json({ error: 'Failed to restore version' }, { status: 500 })
  }
}

/**
 * PATCH /api/workflows/[id]/versions/[versionId]
 * Update version metadata (name, description, tags, pin, lock, releaseNotes)
 *
 * Body:
 * - name: string (optional)
 * - description: string (optional)
 * - tags: string[] (optional) - replaces all tags
 * - addTags: string[] (optional) - adds to existing tags
 * - removeTags: string[] (optional) - removes from existing tags
 * - isPinned: boolean (optional)
 * - isLocked: boolean (optional)
 * - releaseNotes: string (optional)
 * - metadata: object (optional) - merged with existing metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId, versionId } = await params
    const body = await request.json()

    // Get version by number or ID
    const versionNumber = parseInt(versionId, 10)
    let version

    if (!isNaN(versionNumber)) {
      version = await getVersion(workflowId, versionNumber)
    } else {
      version = await getVersionById(versionId)
      if (version && version.workflowId !== workflowId) {
        return NextResponse.json({ error: 'Version not found' }, { status: 404 })
      }
    }

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    // Handle tag operations separately for addTags/removeTags
    if (body.addTags && body.addTags.length > 0) {
      await addVersionTags(version.id, body.addTags)
    }

    if (body.removeTags && body.removeTags.length > 0) {
      await removeVersionTags(version.id, body.removeTags)
    }

    // Build update object
    const updates: any = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.tags !== undefined) updates.tags = body.tags
    if (body.isPinned !== undefined) updates.isPinned = body.isPinned
    if (body.isLocked !== undefined) updates.isLocked = body.isLocked
    if (body.releaseNotes !== undefined) updates.releaseNotes = body.releaseNotes
    if (body.metadata !== undefined) updates.metadata = body.metadata

    let updatedVersion = version
    if (Object.keys(updates).length > 0) {
      updatedVersion = await updateVersion(version.id, updates)
    } else if (!body.addTags && !body.removeTags) {
      return NextResponse.json({
        success: true,
        data: version,
        message: 'No updates provided',
      })
    } else {
      // Re-fetch to get updated tags
      updatedVersion = (await getVersionById(version.id))!
    }

    return NextResponse.json({
      success: true,
      data: updatedVersion,
    })
  } catch (error: any) {
    logger.error('Failed to update version', { error })
    return NextResponse.json(
      { error: error.message || 'Failed to update version' },
      { status: 500 }
    )
  }
}
