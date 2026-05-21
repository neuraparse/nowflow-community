import { NextResponse } from 'next/server'
import { and, desc, eq, gte, ilike, inArray, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { knowledgeEntity, knowledgeSource } from '@/db/schema'

const logger = createLogger('KnowledgeEntitiesAPI')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET - Query entities for a knowledge source or document
 *
 * Query params:
 *   sourceId  - Filter by knowledge source
 *   documentId - Filter by document
 *   label     - Filter by entity label (e.g., "person", "organization")
 *   search    - Search entity text (ILIKE)
 *   limit     - Max results (default 100)
 *   grouped   - If "true", group entities by label with counts
 */
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get('sourceId')
    const documentId = searchParams.get('documentId')
    const label = searchParams.get('label')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const grouped = searchParams.get('grouped') === 'true'

    if (!sourceId && !documentId) {
      return NextResponse.json({ error: 'sourceId or documentId is required' }, { status: 400 })
    }

    // Access check: verify user has access to the source
    if (sourceId) {
      const source = await db
        .select()
        .from(knowledgeSource)
        .where(eq(knowledgeSource.id, sourceId))
        .limit(1)

      if (source.length === 0) {
        return NextResponse.json({ error: 'Source not found' }, { status: 404 })
      }

      const s = source[0]
      const hasAccess =
        s.userId === session.user.id ||
        s.visibility === 'public' ||
        (s.allowedUserIds && s.allowedUserIds.includes(session.user.id))

      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Build query conditions
    const minScore = parseFloat(searchParams.get('minScore') || '0')
    const conditions = []
    if (sourceId) conditions.push(eq(knowledgeEntity.sourceId, sourceId))
    if (documentId) conditions.push(eq(knowledgeEntity.documentId, documentId))
    if (label) conditions.push(eq(knowledgeEntity.label, label))
    if (search) conditions.push(ilike(knowledgeEntity.entityText, `%${search}%`))
    if (minScore > 0) conditions.push(gte(knowledgeEntity.score, minScore))

    if (grouped) {
      // Return entities grouped by label with counts
      const groupedResults = await db
        .select({
          label: knowledgeEntity.label,
          count: sql`cast(count(*) as integer)`.mapWith(Number),
          entities: sql`json_agg(json_build_object(
            'id', ${knowledgeEntity.id},
            'text', ${knowledgeEntity.entityText},
            'score', ${knowledgeEntity.score},
            'occurrenceCount', ${knowledgeEntity.occurrenceCount}
          ) ORDER BY ${knowledgeEntity.occurrenceCount} DESC)`,
        })
        .from(knowledgeEntity)
        .where(and(...conditions))
        .groupBy(knowledgeEntity.label)
        .orderBy(desc(sql`count(*)`))

      return NextResponse.json({
        groups: groupedResults.map((g: any) => ({
          label: g.label,
          count: g.count,
          entities: typeof g.entities === 'string' ? JSON.parse(g.entities) : g.entities,
        })),
      })
    }

    // Return flat entity list
    const entities = await db
      .select({
        id: knowledgeEntity.id,
        documentId: knowledgeEntity.documentId,
        sourceId: knowledgeEntity.sourceId,
        text: knowledgeEntity.entityText,
        label: knowledgeEntity.label,
        score: knowledgeEntity.score,
        occurrenceCount: knowledgeEntity.occurrenceCount,
        chunkIndices: knowledgeEntity.chunkIndices,
        createdAt: knowledgeEntity.createdAt,
      })
      .from(knowledgeEntity)
      .where(and(...conditions))
      .orderBy(desc(knowledgeEntity.occurrenceCount))
      .limit(limit)

    return NextResponse.json({ entities })
  } catch (error: any) {
    logger.error('GET /api/knowledge/entities failed', {
      error: error?.message || error,
      stack: error?.stack,
    })

    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
