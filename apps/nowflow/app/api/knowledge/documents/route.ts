import { NextResponse } from 'next/server'
import { and, eq, ne } from 'drizzle-orm'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getExtensionFromMime, parseBuffer, parseFile } from '@/lib/file-parsers'
import { KnowledgeSourceService } from '@/lib/knowledge'
import { EmbeddingService } from '@/lib/knowledge/embedding-service'
import { EntityExtractionService } from '@/lib/knowledge/entity-extraction-service'
import { getUserOpenAIKey } from '@/lib/knowledge/get-user-api-key'
import { TextChunker } from '@/lib/knowledge/text-chunker'
import type { CreateDocumentInput, DocumentType, EmbeddingModel } from '@/lib/knowledge/types'
import { createLogger } from '@/lib/logs/console-logger'
import { UPLOAD_DIR } from '@/lib/uploads/setup'
import { db } from '@/db'
import { knowledgeChunk, knowledgeDocument, knowledgeEntity, knowledgeSource } from '@/db/schema'

const logger = createLogger('KnowledgeDocumentsAPI')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AddDocumentSchema = z.object({
  sourceId: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(['file', 'url', 'text']),
  filePath: z.string().optional(),
  fileUrl: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().optional(),
  rawContent: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

const ProcessDocumentSchema = z.object({
  documentId: z.string().uuid(),
})

const DeleteDocumentSchema = z.object({
  documentId: z.string().uuid(),
})

/**
 * GET - List documents for a knowledge source or get single document with chunks
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
    const withChunks = searchParams.get('withChunks') === 'true'

    const service = new KnowledgeSourceService(session.user.id)

    // Get single document with chunks
    if (documentId && withChunks) {
      const document = await service.getDocumentWithChunks(documentId)
      return NextResponse.json({ document })
    }

    // List all documents across all sources
    if (!sourceId) {
      const documents = await service.getAllDocuments()
      return NextResponse.json({ documents })
    }

    // List documents for specific source
    const documents = await service.getDocuments(sourceId)

    // Auto-recover documents stuck in "processing" for >5 minutes
    // This handles cases where the container restarted mid-processing
    const STUCK_THRESHOLD = 5 * 60 * 1000
    const now = Date.now()
    for (const doc of documents) {
      if (
        doc.status === 'processing' &&
        !doc.processedAt &&
        now - new Date(doc.updatedAt).getTime() > STUCK_THRESHOLD
      ) {
        await db
          .update(knowledgeDocument)
          .set({ status: 'pending', updatedAt: new Date() })
          .where(eq(knowledgeDocument.id, doc.id))
        doc.status = 'pending'
        logger.info('Auto-recovered stuck document', { documentId: doc.id })
      }
    }

    return NextResponse.json({ documents })
  } catch (error: any) {
    logger.error('GET /api/knowledge/documents failed', {
      error: error?.message || error,
      stack: error?.stack,
    })

    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST - Add document or process document
 */
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const action = body.action

    const service = new KnowledgeSourceService(session.user.id)

    switch (action) {
      case 'add': {
        const parsed = AddDocumentSchema.safeParse(body)
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Invalid request', details: parsed.error.issues },
            { status: 400 }
          )
        }

        const document = await service.addDocument(parsed.data as CreateDocumentInput)
        return NextResponse.json({ document }, { status: 201 })
      }

      case 'process': {
        const parsed = ProcessDocumentSchema.safeParse(body)
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Invalid request', details: parsed.error.issues },
            { status: 400 }
          )
        }

        // Process document (chunk and generate embeddings)
        const result = await processDocument(parsed.data.documentId, session.user.id)
        return NextResponse.json({ result })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    logger.error('POST /api/knowledge/documents failed', {
      error: error?.message || error,
      stack: error?.stack,
    })

    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE - Delete document
 */
export async function DELETE(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
    }

    const service = new KnowledgeSourceService(session.user.id)
    await service.deleteDocument(documentId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('DELETE /api/knowledge/documents failed', {
      error: error?.message || error,
      stack: error?.stack,
    })

    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * Process document - chunk and prepare for semantic search
 * Exported for use by upload route (background processing)
 */
export async function processDocument(documentId: string, userId?: string) {
  try {
    // Atomic lock: only proceed if NOT already processing (prevents duplicate runs)
    const updated = await db
      .update(knowledgeDocument)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(and(eq(knowledgeDocument.id, documentId), ne(knowledgeDocument.status, 'processing')))
      .returning()

    if (updated.length === 0) {
      // Either not found or already processing
      const existing = await db
        .select()
        .from(knowledgeDocument)
        .where(eq(knowledgeDocument.id, documentId))
        .limit(1)
      if (existing.length === 0) throw new Error('Document not found')
      logger.info('Document already processing, skipping duplicate', { documentId })
      return { documentId, status: 'already_processing', skipped: true }
    }

    const document = updated[0]

    // Clean up chunks/entities from any previous processing attempt (prevents duplicates)
    await db.delete(knowledgeChunk).where(eq(knowledgeChunk.documentId, documentId))
    await db.delete(knowledgeEntity).where(eq(knowledgeEntity.documentId, documentId))

    // Get source config
    const sources = await db
      .select()
      .from(knowledgeSource)
      .where(eq(knowledgeSource.id, document.sourceId))
      .limit(1)

    if (sources.length === 0) {
      throw new Error('Source not found')
    }

    const source = sources[0]

    // Always re-parse file on process — ensures latest OCR cleaning is applied
    let content = ''

    if (document.filePath) {
      logger.info('No content found, parsing file...', {
        documentId,
        filePath: document.filePath,
        fileType: document.fileType,
      })

      try {
        // Extract filename from filePath (e.g., /api/files/serve/uuid.pdf -> uuid.pdf)
        const fileName = document.filePath.split('/').pop() || ''
        const localFilePath = join(UPLOAD_DIR, fileName)

        logger.info('Reading file from:', localFilePath)
        const buffer = await readFile(localFilePath)

        // Get extension from original filename or filePath
        const extension =
          document.name.split('.').pop()?.toLowerCase() ||
          fileName.split('.').pop()?.toLowerCase() ||
          ''

        logger.info('Parsing file with extension:', extension)
        const parseResult = await parseBuffer(buffer, extension)
        // Strip null bytes and control chars — PostgreSQL text columns reject \0
        content = parseResult.content
          .replace(/\0/g, '')
          .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')

        logger.info('File parsed successfully', {
          documentId,
          contentLength: content.length,
          metadata: parseResult.metadata,
        })

        // Update document with parsed content
        await db
          .update(knowledgeDocument)
          .set({
            processedContent: content,
            updatedAt: new Date(),
          })
          .where(eq(knowledgeDocument.id, documentId))
      } catch (parseError: any) {
        logger.error('Failed to parse file', {
          documentId,
          error: parseError?.message || parseError,
        })
        throw new Error(`Failed to parse file: ${parseError?.message}`)
      }
    }

    // Fallback to existing content if file re-parse didn't produce anything
    if (!content) {
      content = (document.processedContent || document.rawContent || '')
        .replace(/\0/g, '')
        .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')
    }

    // Validate content - ensure it's a non-empty string
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('No content to process - file may be empty or unsupported format')
    }

    const pageMarkerPattern = /--- Page (\d+) ---\n/

    // Chunk the document — use page-aware chunking for OCR'd PDFs
    const chunkOpts = {
      chunkSize: source.chunkSize,
      chunkOverlap: source.chunkOverlap,
      embeddingModel: source.embeddingModel as any,
    }
    const chunkMeta = {
      documentId: document.id,
      documentName: document.name,
      sourceId: source.id,
    }
    let chunkResult
    if (pageMarkerPattern.test(content)) {
      // OCR'd document with page markers — chunk per page for better search
      const pageSections = content.split(/--- Page \d+ ---\n/).filter((s) => s.trim().length > 0)
      const pages = pageSections.map((text, i) => ({ pageNumber: i + 1, content: text.trim() }))
      logger.info('Using page-aware chunking', { pages: pages.length })
      chunkResult = TextChunker.chunkWithPages(pages, chunkOpts)
    } else {
      chunkResult = TextChunker.chunk(content, chunkOpts, chunkMeta)
    }

    // Generate embeddings for all chunks
    logger.info('Generating embeddings for chunks...', {
      documentId,
      chunkCount: chunkResult.chunks.length,
      embeddingModel: source.embeddingModel,
    })

    const embeddingModel = (source.embeddingModel || 'ollama-nomic-embed-text') as EmbeddingModel
    const chunkTexts = chunkResult.chunks.map((chunk) => chunk.content)

    // Load user's OpenAI API key if using OpenAI model
    const apiKey =
      embeddingModel.startsWith('openai-') && userId ? await getUserOpenAIKey(userId) : undefined

    let embeddings: number[][] = []
    try {
      embeddings = await EmbeddingService.generateEmbeddings(chunkTexts, embeddingModel, apiKey)
      logger.info('Embeddings generated successfully', {
        documentId,
        embeddingCount: embeddings.length,
        dimensions: embeddings[0]?.length || 0,
      })
    } catch (embeddingError: any) {
      logger.warn('Failed to generate embeddings, saving chunks without embeddings', {
        documentId,
        error: embeddingError?.message,
      })
      // Continue without embeddings - they can be generated later
    }

    // Normalize embeddings to 1536 dimensions (OpenAI standard)
    // Pad smaller embeddings (like Ollama's 768 dim) with zeros
    const normalizedEmbeddings = embeddings.map((emb) => {
      if (emb.length >= 1536) {
        return emb.slice(0, 1536)
      }
      // Pad with zeros
      return [...emb, ...new Array(1536 - emb.length).fill(0)]
    })

    // Save chunks to database with embeddings
    const chunkValues = chunkResult.chunks.map((chunk, idx) => ({
      documentId: document.id,
      sourceId: document.sourceId,
      content: chunk.content,
      chunkIndex: chunk.index,
      tokenCount: chunk.tokenCount,
      metadata: chunk.metadata,
      embedding: normalizedEmbeddings[idx] || null,
    }))

    if (chunkValues.length > 0) {
      await db.insert(knowledgeChunk).values(chunkValues)
    }

    // --- Entity Extraction ---
    // Community Edition keeps this pipeline inert unless an external extension provides entities.
    let entityCount = 0
    try {
      const entityOptions = {
        labels:
          (source as any).entityLabels?.length > 0
            ? ((source as any).entityLabels as string[])
            : undefined, // undefined = use service defaults
        threshold: (source as any).entityThreshold ?? undefined,
      }

      logger.info('Extracting entities from chunks...', {
        documentId,
        chunkCount: chunkResult.chunks.length,
        labels: entityOptions.labels || 'defaults',
        threshold: entityOptions.threshold || 'default',
      })

      const entityResult = await EntityExtractionService.extractFromChunks(
        chunkResult.chunks.map((c) => ({ content: c.content, chunkIndex: c.index })),
        entityOptions
      )

      if (entityResult.entities.length > 0) {
        // Save deduplicated entities to DB
        const entityValues = entityResult.entities.map((entity) => ({
          documentId: document.id,
          sourceId: document.sourceId,
          entityText: entity.text,
          label: entity.label,
          score: entity.score,
          occurrenceCount:
            entityResult.entityChunkMap[`${entity.label}::${entity.text}`]?.length || 1,
          chunkIndices: entityResult.entityChunkMap[`${entity.label}::${entity.text}`] || [],
          metadata: null,
        }))

        // Insert in batches to avoid hitting parameter limits
        const insertBatchSize = 100
        for (let i = 0; i < entityValues.length; i += insertBatchSize) {
          const batch = entityValues.slice(i, i + insertBatchSize)
          await db.insert(knowledgeEntity).values(batch).onConflictDoNothing()
        }

        entityCount = entityResult.entities.length

        // Build chunk index → metadata lookup for safe access
        const chunkMetaByIndex = new Map(chunkValues.map((cv) => [cv.chunkIndex, cv.metadata]))

        // Enrich chunk metadata with entity info
        for (const [chunkIdxStr, chunkEntities] of Object.entries(entityResult.perChunkEntities)) {
          const chunkIdx = parseInt(chunkIdxStr)
          const existingMeta = (chunkMetaByIndex.get(chunkIdx) as Record<string, any>) || {}
          await db
            .update(knowledgeChunk)
            .set({
              metadata: {
                ...existingMeta,
                entities: chunkEntities.map((e) => ({
                  text: e.text,
                  label: e.label,
                  score: e.score,
                })),
              },
            })
            .where(
              and(
                eq(knowledgeChunk.documentId, document.id),
                eq(knowledgeChunk.chunkIndex, chunkIdx)
              )
            )
        }

        logger.info('Entity extraction completed', {
          documentId,
          entityCount,
          labels: [...new Set(entityResult.entities.map((e) => e.label))],
        })
      }
    } catch (entityError: any) {
      // Entity extraction is non-blocking — don't fail the whole pipeline
      logger.warn('Entity extraction failed (non-blocking)', {
        documentId,
        error: entityError?.message || entityError,
      })
    }

    // Update document status
    await db
      .update(knowledgeDocument)
      .set({
        status: 'ready',
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeDocument.id, documentId))

    logger.info('Document processed successfully', {
      documentId,
      chunkCount: chunkResult.totalChunks,
      totalTokens: chunkResult.totalTokens,
      entityCount,
    })

    return {
      documentId,
      status: 'ready',
      chunkCount: chunkResult.totalChunks,
      totalTokens: chunkResult.totalTokens,
      entityCount,
    }
  } catch (error: any) {
    // Update document status to failed
    await db
      .update(knowledgeDocument)
      .set({
        status: 'failed',
        errorMessage: (error?.message || 'Processing failed').slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeDocument.id, documentId))

    logger.error('Document processing failed', {
      documentId,
      error: error?.message || error,
      stack: error?.stack,
    })

    throw error
  }
}
