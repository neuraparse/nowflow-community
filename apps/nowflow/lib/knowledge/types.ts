/**
 * Knowledge Sources Type Definitions
 *
 * This module defines the core types for the knowledge sources system,
 * which provides document storage, semantic search, and agent integration.
 */

/**
 * Knowledge Source visibility levels
 */
export type KnowledgeSourceVisibility = 'private' | 'workspace' | 'public'

/**
 * Document types supported
 */
export type DocumentType = 'file' | 'url' | 'text'

/**
 * Document processing status
 */
export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed'

/**
 * Supported embedding models
 */
export type EmbeddingModel =
  | 'openai-ada-002'
  | 'openai-text-embedding-3-small'
  | 'openai-text-embedding-3-large'
  | 'ollama-nomic-embed-text'

/**
 * Knowledge Source entity
 */
export interface KnowledgeSource {
  id: string
  userId: string
  workspaceId?: string | null

  // Display
  name: string
  description?: string | null
  icon?: string | null

  // Access Control
  visibility: KnowledgeSourceVisibility
  allowedUserIds?: string[] | null

  // Metadata
  documentCount: number
  totalSize: number // bytes
  usageCount: number // number of agents using this source

  // Embedding Config
  embeddingModel: string
  chunkSize: number
  chunkOverlap: number

  // Entity Extraction Config
  entityLabels?: string[] | null
  entityThreshold?: number | null

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

/**
 * Knowledge Document entity
 */
export interface KnowledgeDocument {
  id: string
  sourceId: string

  // Document info
  name: string
  type: DocumentType

  // File info
  filePath?: string | null
  fileUrl?: string | null
  fileType?: string | null
  fileSize?: number | null

  // Content
  rawContent?: string | null
  processedContent?: string | null

  // Processing
  status: DocumentStatus
  errorMessage?: string | null

  // Chunk stats (populated from aggregation)
  chunkCount?: number
  totalTokens?: number

  // Metadata
  metadata?: Record<string, any> | null

  // Timestamps
  createdAt: Date
  processedAt?: Date | null
  updatedAt: Date
}

/**
 * Document with chunks for detail view
 */
export interface KnowledgeDocumentWithChunks extends KnowledgeDocument {
  chunks: KnowledgeChunk[]
}

/**
 * Knowledge Chunk entity (for semantic search)
 */
export interface KnowledgeChunk {
  id: string
  documentId: string
  sourceId: string

  // Chunk data
  content: string
  chunkIndex: number

  // Vector embedding (optional - requires pgvector)
  embedding?: number[]

  // Metadata
  metadata?: Record<string, any> | null
  tokenCount?: number | null

  // Timestamps
  createdAt: Date
}

/**
 * Agent Knowledge Source link
 */
export interface AgentKnowledgeSource {
  id: string
  agentId: string
  workflowId: string
  sourceId: string

  // Search config
  searchEnabled: boolean
  maxResults: number
  similarityThreshold: number

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

/**
 * Create Knowledge Source input
 */
export interface CreateKnowledgeSourceInput {
  name: string
  description?: string
  icon?: string
  visibility?: KnowledgeSourceVisibility
  workspaceId?: string
  embeddingModel?: EmbeddingModel
  chunkSize?: number
  chunkOverlap?: number
  entityLabels?: string[]
  entityThreshold?: number
}

/**
 * Update Knowledge Source input
 */
export interface UpdateKnowledgeSourceInput {
  name?: string
  description?: string
  icon?: string
  visibility?: KnowledgeSourceVisibility
  embeddingModel?: EmbeddingModel
  chunkSize?: number
  chunkOverlap?: number
  entityLabels?: string[]
  entityThreshold?: number
}

/**
 * Create Document input
 */
export interface CreateDocumentInput {
  sourceId: string
  name: string
  type: DocumentType
  filePath?: string
  fileUrl?: string
  fileType?: string
  fileSize?: number
  rawContent?: string
  metadata?: Record<string, any>
}

/**
 * Semantic search query
 */
export interface SemanticSearchQuery {
  query: string
  sourceIds: string[]
  maxResults?: number
  similarityThreshold?: number
  filters?: {
    documentIds?: string[]
    metadata?: Record<string, any>
  }
}

/**
 * Semantic search result (supports hybrid search)
 */
export interface SemanticSearchResult {
  chunk: KnowledgeChunk
  document: KnowledgeDocument
  source: KnowledgeSource
  /** Combined hybrid score (vector + text) */
  similarity: number
  /** Optional: Pure vector similarity score (0-1) */
  vectorScore?: number
  /** Optional: Full-text relevance score (BM25-like) */
  textScore?: number
}

/**
 * Document processing result
 */
export interface DocumentProcessingResult {
  documentId: string
  status: DocumentStatus
  chunkCount?: number
  errorMessage?: string
  processedAt?: Date
}

/**
 * Access check result
 */
export interface AccessCheckResult {
  hasAccess: boolean
  reason?: string
}

/**
 * Knowledge source with statistics
 */
export interface KnowledgeSourceWithStats extends KnowledgeSource {
  documents?: KnowledgeDocument[]
  recentDocuments?: KnowledgeDocument[]
  agentCount?: number
  totalChunks?: number
}

/**
 * Chunk creation options
 */
export interface ChunkCreationOptions {
  chunkSize: number
  chunkOverlap: number
  embeddingModel: EmbeddingModel
  generateEmbeddings?: boolean
}

/**
 * Text chunking result
 */
export interface ChunkingResult {
  chunks: Array<{
    content: string
    index: number
    tokenCount: number
    metadata?: Record<string, any>
  }>
  totalChunks: number
  totalTokens: number
}

/**
 * Knowledge source service options
 */
export interface KnowledgeSourceServiceOptions {
  userId: string
  workspaceId?: string
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  success: number
  failed: number
  errors: Array<{
    id: string
    error: string
  }>
}

/**
 * Extracted entity from NER
 */
export interface ExtractedEntity {
  text: string
  label: string
  score: number
  start: number
  end: number
}

/**
 * Entity extraction options
 */
export interface EntityExtractionOptions {
  labels?: string[]
  threshold?: number
  batchSize?: number
}

/**
 * Result of entity extraction from document chunks
 */
export interface EntityExtractionResult {
  /** Deduplicated entities sorted by frequency */
  entities: ExtractedEntity[]
  /** Map of entity key -> chunk indices where it appears */
  entityChunkMap: Record<string, number[]>
  /** Per-chunk entity lists for metadata enrichment */
  perChunkEntities: Record<number, ExtractedEntity[]>
}

/**
 * Knowledge Entity (stored in DB)
 */
export interface KnowledgeEntity {
  id: string
  documentId: string
  sourceId: string
  text: string
  label: string
  score: number
  occurrenceCount: number
  chunkIndices: number[]
  metadata?: Record<string, any> | null
  createdAt: Date
}
