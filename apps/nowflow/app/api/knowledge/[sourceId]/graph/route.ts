import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import {
  buildKnowledgeGraph,
  getGraphStats,
  getSubgraph,
  graphSearch,
  mergeEntities,
  queryGraph,
} from '@/lib/knowledge/graph-rag-service'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { knowledgeSource } from '@/db/schema'

const logger = createLogger('KnowledgeGraphAPI')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Verify user has access to the knowledge source.
 */
async function verifyAccess(sourceId: string, userId: string) {
  const [source] = await db
    .select()
    .from(knowledgeSource)
    .where(eq(knowledgeSource.id, sourceId))
    .limit(1)

  if (!source) {
    return { error: 'Source not found', status: 404 }
  }

  const hasAccess =
    source.userId === userId ||
    source.visibility === 'public' ||
    (source.allowedUserIds && source.allowedUserIds.includes(userId))

  if (!hasAccess) {
    return { error: 'Access denied', status: 403 }
  }

  return { source }
}

/**
 * GET - Get graph data for a knowledge source
 *
 * Query params:
 *   action    - "stats" | "query" | "subgraph" | "search" (default: "stats")
 *   q         - Search/query string (for action=query and action=search)
 *   nodeId    - Center node ID (for action=subgraph)
 *   depth     - Traversal depth (for action=subgraph, default 2)
 *   maxNodes  - Max nodes to return (default 20)
 *   maxResults - Max chunk results for search (default 10)
 */
export async function GET(request: Request, { params }: { params: Promise<{ sourceId: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sourceId } = await params
    const access = await verifyAccess(sourceId, session.user.id)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'stats'

    switch (action) {
      case 'stats': {
        const stats = await getGraphStats(sourceId)
        return NextResponse.json({ stats })
      }

      case 'query': {
        const q = searchParams.get('q')
        if (!q) {
          return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
        }
        const maxNodes = parseInt(searchParams.get('maxNodes') || '20')
        const result = await queryGraph(sourceId, q, maxNodes)
        return NextResponse.json(result)
      }

      case 'subgraph': {
        const nodeId = searchParams.get('nodeId')
        if (!nodeId) {
          return NextResponse.json(
            { error: 'Query parameter "nodeId" is required' },
            { status: 400 }
          )
        }
        const depth = parseInt(searchParams.get('depth') || '2')
        const maxNodes = parseInt(searchParams.get('maxNodes') || '50')
        const result = await getSubgraph(sourceId, nodeId, depth, maxNodes)
        return NextResponse.json(result)
      }

      case 'search': {
        const q = searchParams.get('q')
        if (!q) {
          return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
        }
        const maxResults = parseInt(searchParams.get('maxResults') || '10')
        const result = await graphSearch(sourceId, q, maxResults)
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error: any) {
    logger.error('GET /api/knowledge/[sourceId]/graph failed', {
      error: error?.message || error,
      stack: error?.stack,
    })
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST - Build/rebuild graph for a knowledge source
 *
 * Body:
 *   action - "build" | "merge" (default: "build")
 *   similarityThreshold - For merge action (default 0.85)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sourceId } = await params
    const access = await verifyAccess(sourceId, session.user.id)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action || 'build'

    switch (action) {
      case 'build': {
        const result = await buildKnowledgeGraph(sourceId)
        return NextResponse.json({
          message: 'Knowledge graph built successfully',
          ...result,
        })
      }

      case 'merge': {
        const threshold = body.similarityThreshold ?? 0.85
        const result = await mergeEntities(sourceId, threshold)
        return NextResponse.json({
          message: 'Entity merge completed',
          ...result,
        })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error: any) {
    logger.error('POST /api/knowledge/[sourceId]/graph failed', {
      error: error?.message || error,
      stack: error?.stack,
    })
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
