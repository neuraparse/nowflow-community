import { NextResponse } from 'next/server'
import { inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { KnowledgeSourceService } from '@/lib/knowledge'
import type {
  CreateKnowledgeSourceInput,
  KnowledgeSourceVisibility,
  UpdateKnowledgeSourceInput,
} from '@/lib/knowledge/types'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { agentKnowledgeSource, knowledgeChunk } from '@/db/schema'

const logger = createLogger('KnowledgeSourcesAPI')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CreateSourceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().optional(),
  visibility: z.enum(['private', 'workspace', 'public']).optional(),
  workspaceId: z.string().optional(),
  embeddingModel: z.string().optional(),
  chunkSize: z.number().optional(),
  chunkOverlap: z.number().optional(),
})

const UpdateSourceSchema = z.object({
  sourceId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  visibility: z.enum(['private', 'workspace', 'public']).optional(),
  embeddingModel: z.string().optional(),
  chunkSize: z.number().optional(),
  chunkOverlap: z.number().optional(),
})

const DeleteSourceSchema = z.object({
  sourceId: z.string().uuid(),
})

const GetSourceSchema = z.object({
  sourceId: z.string().uuid(),
  withStats: z.boolean().optional(),
})

const ListSourcesSchema = z.object({
  visibility: z.enum(['private', 'workspace', 'public']).optional(),
  search: z.string().optional(),
  workspaceId: z.string().optional(),
})

/**
 * GET - List knowledge sources
 */
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get('sourceId')
    const withStats = searchParams.get('withStats') === 'true'
    const visibility = searchParams.get('visibility') as KnowledgeSourceVisibility | undefined
    const search = searchParams.get('search') || undefined
    const workspaceId = searchParams.get('workspaceId') || undefined

    const service = new KnowledgeSourceService(session.user.id, workspaceId)

    // Single source request
    if (sourceId) {
      const source = withStats
        ? await service.getSourceWithStats(sourceId)
        : await service.getSource(sourceId)

      if (!source) {
        return NextResponse.json({ error: 'Source not found' }, { status: 404 })
      }

      return NextResponse.json({ source })
    }

    // List sources
    const sources = await service.listSources({
      visibility,
      search,
    })

    if (sources.length === 0) {
      return NextResponse.json({ sources: [] })
    }

    const sourceIds = sources.map((source) => source.id)

    const usageRows = await db
      .select({
        sourceId: agentKnowledgeSource.sourceId,
        count: sql`cast(count(distinct ${agentKnowledgeSource.agentId}) as integer)`,
      })
      .from(agentKnowledgeSource)
      .where(inArray(agentKnowledgeSource.sourceId, sourceIds))
      .groupBy(agentKnowledgeSource.sourceId)

    const usageBySource = new Map(usageRows.map((row: any) => [row.sourceId, row.count]))

    let chunksBySource = new Map<string, number>()
    if (withStats) {
      const chunkRows = await db
        .select({
          sourceId: knowledgeChunk.sourceId,
          count: sql`cast(count(*) as integer)`,
        })
        .from(knowledgeChunk)
        .where(inArray(knowledgeChunk.sourceId, sourceIds))
        .groupBy(knowledgeChunk.sourceId)

      chunksBySource = new Map(chunkRows.map((row: any) => [row.sourceId, row.count]))
    }

    const sourcesWithStats = sources.map((source) => ({
      ...source,
      documentCount: source.documentCount ?? 0,
      totalChunks: withStats ? (chunksBySource.get(source.id) ?? 0) : undefined,
      usageCount: usageBySource.get(source.id) ?? 0,
    }))

    return NextResponse.json({ sources: sourcesWithStats })
  } catch (error: any) {
    logger.error('GET /api/knowledge/sources failed', {
      error: error?.message || error,
      stack: error?.stack,
    })

    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST - Create or update knowledge source
 */
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const action = body.action

    const workspaceId = body.workspaceId || undefined
    const service = new KnowledgeSourceService(session.user.id, workspaceId)

    switch (action) {
      case 'create': {
        const parsed = CreateSourceSchema.safeParse(body)
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Invalid request', details: parsed.error.issues },
            { status: 400 }
          )
        }

        const source = await service.createSource(parsed.data as CreateKnowledgeSourceInput)
        return NextResponse.json({ source }, { status: 201 })
      }

      case 'update': {
        const parsed = UpdateSourceSchema.safeParse(body)
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Invalid request', details: parsed.error.issues },
            { status: 400 }
          )
        }

        const { sourceId, ...updates } = parsed.data
        const source = await service.updateSource(sourceId, updates as UpdateKnowledgeSourceInput)
        return NextResponse.json({ source })
      }

      case 'linkAgent': {
        const { agentId, workflowId, sourceId } = body
        if (!agentId || !workflowId || !sourceId) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        await service.linkAgentToSource(agentId, workflowId, sourceId)
        return NextResponse.json({ success: true })
      }

      case 'getAgentSources': {
        const { agentId } = body
        if (!agentId) {
          return NextResponse.json({ error: 'Missing agentId' }, { status: 400 })
        }

        const sources = await service.getAgentSources(agentId)
        return NextResponse.json({ sources })
      }

      case 'setAgentSources': {
        const { agentId, workflowId, sourceIds } = body
        if (!agentId || !workflowId || !Array.isArray(sourceIds)) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        await service.setAgentSources(agentId, workflowId, sourceIds)
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    logger.error('POST /api/knowledge/sources failed', {
      error: error?.message || error,
      stack: error?.stack,
    })

    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE - Delete knowledge source
 */
export async function DELETE(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get('sourceId')

    if (!sourceId) {
      return NextResponse.json({ error: 'Missing sourceId' }, { status: 400 })
    }

    const service = new KnowledgeSourceService(session.user.id)
    await service.deleteSource(sourceId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('DELETE /api/knowledge/sources failed', {
      error: error?.message || error,
      stack: error?.stack,
    })

    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
