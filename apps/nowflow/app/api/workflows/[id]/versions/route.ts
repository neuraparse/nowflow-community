import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import {
  ChangeType,
  createVersion,
  getVersions,
  getVersionsFiltered,
  SemanticBumpType,
  VersionFilter,
} from '@/lib/workflows/version-service'

const logger = createLogger('WorkflowVersionsAPI')

/**
 * GET /api/workflows/[id]/versions
 * List all versions for a workflow with optional filtering
 *
 * Query params:
 * - limit: number (default 50)
 * - offset: number (default 0)
 * - changeType: comma-separated list of change types
 * - tags: comma-separated list of tags
 * - isPinned: boolean
 * - isLocked: boolean
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 * - search: search query for name/description
 * - createdBy: user ID
 * - semanticVersion: prefix to filter (e.g., "1.0")
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build filter from query params
    const filter: VersionFilter = {}

    const changeTypeParam = searchParams.get('changeType')
    if (changeTypeParam) {
      filter.changeTypes = changeTypeParam.split(',') as ChangeType[]
    }

    const tagsParam = searchParams.get('tags')
    if (tagsParam) {
      filter.tags = tagsParam.split(',')
    }

    const isPinnedParam = searchParams.get('isPinned')
    if (isPinnedParam !== null) {
      filter.isPinned = isPinnedParam === 'true'
    }

    const isLockedParam = searchParams.get('isLocked')
    if (isLockedParam !== null) {
      filter.isLocked = isLockedParam === 'true'
    }

    const dateFromParam = searchParams.get('dateFrom')
    if (dateFromParam) {
      filter.dateFrom = new Date(dateFromParam)
    }

    const dateToParam = searchParams.get('dateTo')
    if (dateToParam) {
      filter.dateTo = new Date(dateToParam)
    }

    const searchParam = searchParams.get('search')
    if (searchParam) {
      filter.searchQuery = searchParam
    }

    const createdByParam = searchParams.get('createdBy')
    if (createdByParam) {
      filter.createdBy = createdByParam
    }

    const semanticVersionParam = searchParams.get('semanticVersion')
    if (semanticVersionParam) {
      filter.semanticVersionPrefix = semanticVersionParam
    }

    // Use filtered query if any filters are present
    const hasFilters = Object.keys(filter).length > 0

    const { versions, total } = hasFilters
      ? await getVersionsFiltered(workflowId, filter, { limit, offset })
      : await getVersions(workflowId, { limit, offset })

    return NextResponse.json({
      success: true,
      data: versions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      filters: hasFilters ? filter : undefined,
    })
  } catch (error) {
    logger.error('Failed to get workflow versions', { error })
    return NextResponse.json({ error: 'Failed to get versions' }, { status: 500 })
  }
}

/**
 * POST /api/workflows/[id]/versions
 * Create a new version manually
 *
 * Body:
 * - name: string (optional)
 * - description: string (optional)
 * - changeType: 'create' | 'update' | 'deploy' | 'restore' | 'auto_save' (default: 'update')
 * - semanticBump: 'major' | 'minor' | 'patch' (default: 'patch')
 * - tags: string[] (optional)
 * - isPinned: boolean (optional)
 * - releaseNotes: string (optional, markdown)
 * - metadata: object (optional)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const body = await request.json()

    // Validate semantic bump type
    const validBumpTypes: SemanticBumpType[] = ['major', 'minor', 'patch']
    if (body.semanticBump && !validBumpTypes.includes(body.semanticBump)) {
      return NextResponse.json(
        { error: 'Invalid semanticBump. Must be one of: major, minor, patch' },
        { status: 400 }
      )
    }

    // Validate change type
    const validChangeTypes: ChangeType[] = ['create', 'update', 'deploy', 'restore', 'auto_save']
    if (body.changeType && !validChangeTypes.includes(body.changeType)) {
      return NextResponse.json({ error: 'Invalid changeType' }, { status: 400 })
    }

    const version = await createVersion({
      workflowId,
      userId: session.user.id,
      name: body.name,
      description: body.description,
      changeType: body.changeType || 'update',
      semanticBump: body.semanticBump || 'patch',
      tags: body.tags || [],
      isPinned: body.isPinned || false,
      releaseNotes: body.releaseNotes,
      metadata: body.metadata || {},
    })

    return NextResponse.json({
      success: true,
      data: version,
    })
  } catch (error) {
    logger.error('Failed to create workflow version', { error })
    return NextResponse.json({ error: 'Failed to create version' }, { status: 500 })
  }
}
