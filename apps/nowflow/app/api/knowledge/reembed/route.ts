import { NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { EmbeddingService } from '@/lib/knowledge/embedding-service'
import { getUserOpenAIKey } from '@/lib/knowledge/get-user-api-key'
import type { EmbeddingModel } from '@/lib/knowledge/types'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { knowledgeChunk, knowledgeSource } from '@/db/schema'

const logger = createLogger('ReembedAPI')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large re-embedding jobs

/**
 * POST - Re-embed all chunks for specified sources using Ollama
 */
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sourceIds } = body

    if (!sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
      return NextResponse.json({ error: 'sourceIds required' }, { status: 400 })
    }

    logger.info('Starting re-embedding job', { sourceIds, userId: session.user.id })

    // Get sources owned by user
    const sources = await db
      .select()
      .from(knowledgeSource)
      .where(inArray(knowledgeSource.id, sourceIds))

    const userSources = sources.filter((s: any) => s.userId === session.user.id)
    if (userSources.length === 0) {
      return NextResponse.json({ error: 'No sources found' }, { status: 404 })
    }

    // Load user's API key for OpenAI models
    const apiKey = await getUserOpenAIKey(session.user.id)

    // Map sourceId -> embedding model so we can group chunks by model after the bulk fetch
    const sourceModelById = new Map<string, EmbeddingModel>()
    for (const source of userSources) {
      sourceModelById.set(
        source.id,
        (source.embeddingModel || 'ollama-nomic-embed-text') as EmbeddingModel
      )
    }

    // Single query: load every chunk across every requested source
    const allChunks = await db
      .select()
      .from(knowledgeChunk)
      .where(
        inArray(
          knowledgeChunk.sourceId,
          userSources.map((s: any) => s.id)
        )
      )

    const totalChunks = allChunks.length
    logger.info('Loaded chunks for re-embedding', {
      totalChunks,
      sourceCount: userSources.length,
    })

    // Group chunks by target model so each provider sees one batched call set
    const chunksByModel = new Map<EmbeddingModel, typeof allChunks>()
    for (const chunk of allChunks) {
      const model = sourceModelById.get(chunk.sourceId) || 'ollama-nomic-embed-text'
      const bucket = chunksByModel.get(model) || []
      bucket.push(chunk)
      chunksByModel.set(model, bucket)
    }

    let processedChunks = 0
    const errors: string[] = []

    for (const [model, chunks] of chunksByModel) {
      if (chunks.length === 0) continue

      logger.info('Embedding batch', { model, count: chunks.length })

      let vectors: number[][] = []
      try {
        vectors = await EmbeddingService.embedBatch(
          chunks.map((c: any) => c.content),
          model,
          model.startsWith('openai-') ? apiKey : undefined
        )
      } catch (err: any) {
        const msg = `Batch embed failed for model ${model}: ${err?.message || err}`
        errors.push(msg)
        logger.error('Batch embed failed', { model, error: err?.message || err })
        continue
      }

      // Write back in parallel — Promise.all over individual UPDATEs avoids the per-row
      // sequential await without needing a CASE WHEN giant SQL string.
      const now = new Date()
      const writeResults = await Promise.allSettled(
        chunks.map((chunk: any, i: any) =>
          db
            .update(knowledgeChunk)
            .set({ embedding: vectors[i], updatedAt: now })
            .where(eq(knowledgeChunk.id, chunk.id))
        )
      )

      for (let i = 0; i < writeResults.length; i++) {
        const result = writeResults[i]
        if (result.status === 'fulfilled') {
          processedChunks++
        } else {
          const reason: any = result.reason
          errors.push(`Chunk ${chunks[i].id}: ${reason?.message || reason}`)
          logger.error('Failed to write embedding', {
            chunkId: chunks[i].id,
            error: reason?.message || reason,
          })
        }
      }
    }

    logger.info('Re-embedding completed', {
      totalChunks,
      processedChunks,
      errors: errors.length,
    })

    return NextResponse.json({
      success: true,
      totalChunks,
      processedChunks,
      progress: `${processedChunks} of ${totalChunks}`,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    logger.error('Re-embed API failed', {
      error: error?.message || error,
      stack: error?.stack,
    })
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
