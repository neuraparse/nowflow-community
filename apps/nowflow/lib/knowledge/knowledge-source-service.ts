import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import 'server-only'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import {
  agentKnowledgeSource,
  file,
  knowledgeChunk,
  knowledgeDocument,
  knowledgeSource,
} from '@/db/schema'
import type {
  AccessCheckResult,
  BulkOperationResult,
  CreateDocumentInput,
  CreateKnowledgeSourceInput,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeSource,
  KnowledgeSourceVisibility,
  KnowledgeSourceWithStats,
  SemanticSearchQuery,
  SemanticSearchResult,
  UpdateKnowledgeSourceInput,
} from './types'

const logger = createLogger('KnowledgeSourceService')

// db is typed as `any` (see db/index.ts) so transaction's tx is also any

type DbTx = any
type KnowledgeSourceRow = typeof knowledgeSource.$inferSelect
type KnowledgeDocumentRow = typeof knowledgeDocument.$inferSelect
type KnowledgeChunkRow = typeof knowledgeChunk.$inferSelect
type AgentKnowledgeSourceRow = typeof agentKnowledgeSource.$inferSelect

/**
 * Knowledge Source Service
 *
 * Provides CRUD operations and access control for knowledge sources.
 * Handles document management, chunking, and semantic search integration.
 */
export class KnowledgeSourceService {
  constructor(
    private userId: string,
    private workspaceId?: string
  ) {}

  /**
   * Create a new knowledge source
   */
  async createSource(input: CreateKnowledgeSourceInput): Promise<KnowledgeSource> {
    try {
      const result = await db
        .insert(knowledgeSource)
        .values({
          userId: this.userId,
          workspaceId: input.workspaceId || this.workspaceId,
          name: input.name,
          description: input.description,
          icon: input.icon,
          visibility: input.visibility || 'private',
          embeddingModel: input.embeddingModel || 'ollama-nomic-embed-text',
          chunkSize: input.chunkSize || 500,
          chunkOverlap: input.chunkOverlap || 200,
          documentCount: 0,
          totalSize: 0,
          usageCount: 0,
        })
        .returning()

      const source = result[0]

      logger.info('Knowledge source created', {
        sourceId: source.id,
        name: source.name,
        userId: this.userId,
      })

      return this.mapToKnowledgeSource(source)
    } catch (error: any) {
      logger.error('Failed to create knowledge source', {
        error: error?.message || error,
        userId: this.userId,
      })
      throw error
    }
  }

  /**
   * Get knowledge source by ID
   */
  async getSource(sourceId: string): Promise<KnowledgeSource | null> {
    try {
      const result = await db
        .select()
        .from(knowledgeSource)
        .where(eq(knowledgeSource.id, sourceId))
        .limit(1)

      if (result.length === 0) {
        return null
      }

      const source = result[0]

      // Check access
      const access = await this.checkAccess(sourceId)
      if (!access.hasAccess) {
        logger.warn('Access denied to knowledge source', {
          sourceId,
          userId: this.userId,
          reason: access.reason,
        })
        return null
      }

      return this.mapToKnowledgeSource(source)
    } catch (error: any) {
      logger.error('Failed to get knowledge source', {
        error: error?.message || error,
        sourceId,
      })
      throw error
    }
  }

  /**
   * Get knowledge source with statistics
   */
  async getSourceWithStats(sourceId: string): Promise<KnowledgeSourceWithStats | null> {
    const source = await this.getSource(sourceId)
    if (!source) {
      return null
    }

    // Get recent documents
    const recentDocs = await db
      .select()
      .from(knowledgeDocument)
      .where(eq(knowledgeDocument.sourceId, sourceId))
      .orderBy(desc(knowledgeDocument.createdAt))
      .limit(10)

    // Get total chunk count
    const chunkCountResult = await db
      .select({ count: sql`cast(count(*) as integer)` })
      .from(knowledgeChunk)
      .where(eq(knowledgeChunk.sourceId, sourceId))

    const totalChunks = chunkCountResult[0]?.count || 0

    // Get agent count
    const agentCountResult = await db
      .select({ count: sql`cast(count(distinct ${agentKnowledgeSource.agentId}) as integer)` })
      .from(agentKnowledgeSource)
      .where(eq(agentKnowledgeSource.sourceId, sourceId))

    const agentCount = agentCountResult[0]?.count || 0

    return {
      ...source,
      recentDocuments: recentDocs.map(this.mapToKnowledgeDocument),
      totalChunks,
      agentCount,
    }
  }

  /**
   * List accessible knowledge sources
   */
  async listSources(filters?: {
    visibility?: KnowledgeSourceVisibility
    search?: string
  }): Promise<KnowledgeSource[]> {
    try {
      let query = db.select().from(knowledgeSource)

      // Access control: private (owned), workspace (same workspace), public (all)
      const conditions = [
        eq(knowledgeSource.userId, this.userId), // Own sources
        eq(knowledgeSource.visibility, 'public'), // Public sources
      ]

      if (this.workspaceId) {
        conditions.push(
          and(
            eq(knowledgeSource.workspaceId, this.workspaceId),
            eq(knowledgeSource.visibility, 'workspace')
          )!
        )
      }

      query = query.where(or(...conditions)!)

      // Apply filters
      if (filters?.visibility) {
        query = query.where(eq(knowledgeSource.visibility, filters.visibility))
      }

      // Search by name/description (basic - can be enhanced with full-text search)
      if (filters?.search) {
        query = query.where(
          or(
            sql`${knowledgeSource.name} ILIKE ${`%${filters.search}%`}`,
            sql`${knowledgeSource.description} ILIKE ${`%${filters.search}%`}`
          )!
        )
      }

      const results = await query.orderBy(desc(knowledgeSource.updatedAt))

      return results.map(this.mapToKnowledgeSource)
    } catch (error: any) {
      logger.error('Failed to list knowledge sources', {
        error: error?.message || error,
        userId: this.userId,
      })
      throw error
    }
  }

  /**
   * Update knowledge source
   */
  async updateSource(
    sourceId: string,
    input: UpdateKnowledgeSourceInput
  ): Promise<KnowledgeSource> {
    // Check access
    const access = await this.checkAccess(sourceId)
    if (!access.hasAccess) {
      throw new Error(`Access denied: ${access.reason}`)
    }

    // Check ownership for updates
    const source = await db
      .select()
      .from(knowledgeSource)
      .where(eq(knowledgeSource.id, sourceId))
      .limit(1)

    if (source.length === 0 || source[0].userId !== this.userId) {
      throw new Error('Only the owner can update a knowledge source')
    }

    const result = await db
      .update(knowledgeSource)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSource.id, sourceId))
      .returning()

    logger.info('Knowledge source updated', { sourceId, userId: this.userId })

    return this.mapToKnowledgeSource(result[0])
  }

  /**
   * Delete knowledge source
   */
  async deleteSource(sourceId: string): Promise<void> {
    // Check ownership
    const source = await db
      .select()
      .from(knowledgeSource)
      .where(eq(knowledgeSource.id, sourceId))
      .limit(1)

    if (source.length === 0 || source[0].userId !== this.userId) {
      throw new Error('Only the owner can delete a knowledge source')
    }

    await db.delete(knowledgeSource).where(eq(knowledgeSource.id, sourceId))

    logger.info('Knowledge source deleted', { sourceId, userId: this.userId })
  }

  /**
   * Add document to knowledge source
   */
  async addDocument(input: CreateDocumentInput): Promise<KnowledgeDocument> {
    // Check access
    const access = await this.checkAccess(input.sourceId)
    if (!access.hasAccess) {
      throw new Error(`Access denied: ${access.reason}`)
    }

    // Insert document + update source counts atomically
    const document = await db.transaction(async (tx: DbTx) => {
      const result = await tx
        .insert(knowledgeDocument)
        .values({
          sourceId: input.sourceId,
          name: input.name,
          type: input.type,
          filePath: input.filePath,
          fileUrl: input.fileUrl,
          fileType: input.fileType,
          fileSize: input.fileSize,
          rawContent: input.rawContent,
          processedContent: input.rawContent, // Initial - will be processed
          status: 'pending',
          metadata: input.metadata,
        })
        .returning()

      await tx
        .update(knowledgeSource)
        .set({
          documentCount: sql`${knowledgeSource.documentCount} + 1`,
          totalSize: sql`${knowledgeSource.totalSize} + ${input.fileSize || 0}`,
          updatedAt: new Date(),
        })
        .where(eq(knowledgeSource.id, input.sourceId))

      return result[0]
    })

    logger.info('Document added to knowledge source', {
      documentId: document.id,
      sourceId: input.sourceId,
      name: input.name,
    })

    return this.mapToKnowledgeDocument(document)
  }

  /**
   * Get documents for a source with chunk stats
   */
  async getDocuments(sourceId: string): Promise<KnowledgeDocument[]> {
    // Check access
    const access = await this.checkAccess(sourceId)
    if (!access.hasAccess) {
      throw new Error(`Access denied: ${access.reason}`)
    }

    // Get documents with chunk statistics
    const results = await db
      .select({
        document: knowledgeDocument,
        chunkCount: sql`COALESCE(COUNT(${knowledgeChunk.id}), 0)::int`,
        totalTokens: sql`COALESCE(SUM(${knowledgeChunk.tokenCount}), 0)::int`,
      })
      .from(knowledgeDocument)
      .leftJoin(knowledgeChunk, eq(knowledgeChunk.documentId, knowledgeDocument.id))
      .where(eq(knowledgeDocument.sourceId, sourceId))
      .groupBy(knowledgeDocument.id)
      .orderBy(desc(knowledgeDocument.createdAt))

    return results.map(
      (row: { document: KnowledgeDocumentRow; chunkCount: unknown; totalTokens: unknown }) => ({
        ...this.mapToKnowledgeDocument(row.document),
        chunkCount: row.chunkCount,
        totalTokens: row.totalTokens,
      })
    )
  }

  /**
   * Get all documents across all sources user has access to
   */
  async getAllDocuments(): Promise<Array<KnowledgeDocument & { sourceName?: string }>> {
    try {
      // Get all sources user has access to
      const sources = await this.listSources()

      if (sources.length === 0) {
        return []
      }

      const sourceIds = sources.map((s) => s.id)
      const sourceMap = new Map(sources.map((s) => [s.id, s.name]))

      // Get all documents from accessible sources with chunk statistics
      const results = await db
        .select({
          document: knowledgeDocument,
          chunkCount: sql`COALESCE(COUNT(${knowledgeChunk.id}), 0)::int`,
          totalTokens: sql`COALESCE(SUM(${knowledgeChunk.tokenCount}), 0)::int`,
        })
        .from(knowledgeDocument)
        .leftJoin(knowledgeChunk, eq(knowledgeChunk.documentId, knowledgeDocument.id))
        .where(inArray(knowledgeDocument.sourceId, sourceIds))
        .groupBy(knowledgeDocument.id)
        .orderBy(desc(knowledgeDocument.createdAt))

      return results.map(
        (row: { document: KnowledgeDocumentRow; chunkCount: unknown; totalTokens: unknown }) => ({
          ...this.mapToKnowledgeDocument(row.document),
          sourceName: sourceMap.get(row.document.sourceId),
          chunkCount: row.chunkCount,
          totalTokens: row.totalTokens,
        })
      )
    } catch (error: any) {
      logger.error('Failed to get all documents', {
        error: error?.message || error,
        userId: this.userId,
      })
      throw error
    }
  }

  /**
   * Get document by ID with chunks
   */
  async getDocumentWithChunks(documentId: string): Promise<KnowledgeDocument & { chunks: any[] }> {
    // Get document
    const docs = await db
      .select()
      .from(knowledgeDocument)
      .where(eq(knowledgeDocument.id, documentId))
      .limit(1)

    if (docs.length === 0) {
      throw new Error('Document not found')
    }

    const doc = docs[0]

    // Check access
    const access = await this.checkAccess(doc.sourceId)
    if (!access.hasAccess) {
      throw new Error(`Access denied: ${access.reason}`)
    }

    // Get chunks (without embeddings for performance)
    const chunks = await db
      .select({
        id: knowledgeChunk.id,
        chunkIndex: knowledgeChunk.chunkIndex,
        content: knowledgeChunk.content,
        tokenCount: knowledgeChunk.tokenCount,
        metadata: knowledgeChunk.metadata,
        createdAt: knowledgeChunk.createdAt,
      })
      .from(knowledgeChunk)
      .where(eq(knowledgeChunk.documentId, documentId))
      .orderBy(knowledgeChunk.chunkIndex)

    return {
      ...this.mapToKnowledgeDocument(doc),
      chunkCount: chunks.length,
      totalTokens: chunks.reduce(
        (sum: number, c: KnowledgeChunkRow) => sum + (c.tokenCount || 0),
        0
      ),
      chunks,
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<void> {
    // Get document
    const doc = await db
      .select()
      .from(knowledgeDocument)
      .where(eq(knowledgeDocument.id, documentId))
      .limit(1)

    if (doc.length === 0) {
      throw new Error('Document not found')
    }

    const document = doc[0]

    // Check access to parent source
    const access = await this.checkAccess(document.sourceId)
    if (!access.hasAccess) {
      throw new Error(`Access denied: ${access.reason}`)
    }

    // Delete document + file + update counts atomically
    const source = await db.transaction(async (tx: DbTx) => {
      await tx.delete(knowledgeDocument).where(eq(knowledgeDocument.id, documentId))
      await tx.delete(file).where(eq(file.knowledgeDocumentId, documentId))

      const sources = await tx
        .select()
        .from(knowledgeSource)
        .where(eq(knowledgeSource.id, document.sourceId))
        .limit(1)

      await tx
        .update(knowledgeSource)
        .set({
          documentCount: sql`GREATEST(${knowledgeSource.documentCount} - 1, 0)`,
          totalSize: sql`GREATEST(${knowledgeSource.totalSize} - ${document.fileSize || 0}, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(knowledgeSource.id, document.sourceId))

      return sources[0]
    })

    // Update workspace storage usage
    const workspaceId = source?.workspaceId || this.workspaceId
    if (workspaceId && document.fileSize) {
      try {
        const { StorageLimitService } = await import('@/lib/storage/storage-limit-service')
        const storageService = new StorageLimitService(this.userId, workspaceId)
        await storageService.updateStorageUsage(-document.fileSize)
      } catch (error) {
        logger.error('Failed to update storage usage on document delete', { error })
      }
    }

    logger.info('Document deleted', { documentId, sourceId: document.sourceId })
  }

  /**
   * Check if user has access to a knowledge source
   */
  async checkAccess(sourceId: string): Promise<AccessCheckResult> {
    const result = await db
      .select()
      .from(knowledgeSource)
      .where(eq(knowledgeSource.id, sourceId))
      .limit(1)

    if (result.length === 0) {
      return { hasAccess: false, reason: 'Source not found' }
    }

    const source = result[0]

    // Owner has full access
    if (source.userId === this.userId) {
      return { hasAccess: true }
    }

    // Public sources - everyone has access
    if (source.visibility === 'public') {
      return { hasAccess: true }
    }

    // Workspace sources - same workspace users have access
    if (source.visibility === 'workspace' && this.workspaceId === source.workspaceId) {
      return { hasAccess: true }
    }

    // Check if user is in allowed list
    if (source.allowedUserIds && source.allowedUserIds.includes(this.userId)) {
      return { hasAccess: true }
    }

    return { hasAccess: false, reason: 'Insufficient permissions' }
  }

  /**
   * Link agent to knowledge source
   */
  async linkAgentToSource(agentId: string, workflowId: string, sourceId: string): Promise<void> {
    // Check access
    const access = await this.checkAccess(sourceId)
    if (!access.hasAccess) {
      throw new Error(`Access denied: ${access.reason}`)
    }

    const insertResult = await db
      .insert(agentKnowledgeSource)
      .values({
        agentId,
        workflowId,
        sourceId,
        searchEnabled: true,
        maxResults: 5,
        similarityThreshold: 0.7,
      })
      .onConflictDoNothing()
      .returning({ agentId: agentKnowledgeSource.agentId })

    if (insertResult.length > 0) {
      await db
        .update(knowledgeSource)
        .set({
          usageCount: sql`${knowledgeSource.usageCount} + 1`,
        })
        .where(eq(knowledgeSource.id, sourceId))
    }

    logger.info('Agent linked to knowledge source', { agentId, sourceId })
  }

  /**
   * Set knowledge sources for an agent (add new, remove missing)
   */
  async setAgentSources(agentId: string, workflowId: string, sourceIds: string[]): Promise<void> {
    const existingLinks = await db
      .select({ sourceId: agentKnowledgeSource.sourceId })
      .from(agentKnowledgeSource)
      .where(
        and(
          eq(agentKnowledgeSource.agentId, agentId),
          eq(agentKnowledgeSource.workflowId, workflowId)
        )
      )

    const existingIds = new Set(existingLinks.map((link: { sourceId: string }) => link.sourceId))
    const nextIds = new Set(sourceIds)

    const toAdd = sourceIds.filter((id) => !existingIds.has(id))
    const toRemove = existingLinks
      .map((link: { sourceId: string }) => link.sourceId)
      .filter((id: string) => !nextIds.has(id))

    if (toAdd.length > 0) {
      for (const sourceId of toAdd) {
        const access = await this.checkAccess(sourceId)
        if (!access.hasAccess) {
          throw new Error(`Access denied: ${access.reason}`)
        }
      }

      const insertResult = await db
        .insert(agentKnowledgeSource)
        .values(
          toAdd.map((sourceId) => ({
            agentId,
            workflowId,
            sourceId,
            searchEnabled: true,
            maxResults: 5,
            similarityThreshold: 0.7,
          }))
        )
        .onConflictDoNothing()
        .returning({ sourceId: agentKnowledgeSource.sourceId })

      if (insertResult.length > 0) {
        await db
          .update(knowledgeSource)
          .set({
            usageCount: sql`${knowledgeSource.usageCount} + 1`,
          })
          .where(
            inArray(
              knowledgeSource.id,
              insertResult.map((row: { sourceId: string }) => row.sourceId)
            )
          )
      }
    }

    if (toRemove.length > 0) {
      await db
        .delete(agentKnowledgeSource)
        .where(
          and(
            eq(agentKnowledgeSource.agentId, agentId),
            eq(agentKnowledgeSource.workflowId, workflowId),
            inArray(agentKnowledgeSource.sourceId, toRemove)
          )
        )

      await db
        .update(knowledgeSource)
        .set({
          usageCount: sql`GREATEST(${knowledgeSource.usageCount} - 1, 0)`,
        })
        .where(inArray(knowledgeSource.id, toRemove))
    }

    logger.info('Agent knowledge sources updated', {
      agentId,
      workflowId,
      added: toAdd.length,
      removed: toRemove.length,
    })
  }

  /**
   * Get knowledge sources for an agent
   */
  async getAgentSources(agentId: string): Promise<KnowledgeSource[]> {
    const links = await db
      .select()
      .from(agentKnowledgeSource)
      .where(eq(agentKnowledgeSource.agentId, agentId))

    if (links.length === 0) {
      return []
    }

    const sourceIds = links.map((link: { sourceId: string }) => link.sourceId)

    const sources = await db
      .select()
      .from(knowledgeSource)
      .where(inArray(knowledgeSource.id, sourceIds))

    return sources.map(this.mapToKnowledgeSource)
  }

  /**
   * Map database row to KnowledgeSource type
   */
  private mapToKnowledgeSource(row: any): KnowledgeSource {
    return {
      id: row.id,
      userId: row.userId,
      workspaceId: row.workspaceId,
      name: row.name,
      description: row.description,
      icon: row.icon,
      visibility: row.visibility,
      allowedUserIds: row.allowedUserIds,
      documentCount: row.documentCount,
      totalSize: row.totalSize,
      usageCount: row.usageCount,
      embeddingModel: row.embeddingModel,
      chunkSize: row.chunkSize,
      chunkOverlap: row.chunkOverlap,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  /**
   * Map database row to KnowledgeDocument type
   */
  private mapToKnowledgeDocument(row: any): KnowledgeDocument {
    return {
      id: row.id,
      sourceId: row.sourceId,
      name: row.name,
      type: row.type,
      filePath: row.filePath,
      fileUrl: row.fileUrl,
      fileType: row.fileType,
      fileSize: row.fileSize,
      rawContent: row.rawContent,
      processedContent: row.processedContent,
      status: row.status,
      errorMessage: row.errorMessage,
      metadata: row.metadata,
      createdAt: row.createdAt,
      processedAt: row.processedAt,
      updatedAt: row.updatedAt,
    }
  }
}
