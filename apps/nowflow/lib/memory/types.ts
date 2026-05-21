/**
 * Memory entry stored in database
 * Memory data model for scoped, searchable agent context.
 */
export interface MemoryEntry {
  /** Unique identifier for this memory */
  id: string

  /** Session identifier (for user isolation) */
  sessionId: string

  /** Optional authenticated user ID */
  userId?: string

  /** Agent identifier */
  agentId: string

  /** Agent type (customer_service, research, sales, etc.) */
  agentType: string

  /** Execution context */
  context: {
    workflowId: string
    blockId: string
    executionId: string
    sessionToken?: string
  }

  /** Memory content */
  content: {
    role: 'user' | 'assistant' | 'system'
    message: string
    metadata?: Record<string, any>
  }

  /** Agent-specific structured data */
  agentData?: Record<string, any>

  /** Tags for categorization */
  tags?: string[]

  /** Importance score (0-1) for relevance ranking */
  importance?: number

  /** Vector embedding for semantic search (optional) */
  embedding?: number[]

  /** Timestamps */
  createdAt: Date
  updatedAt: Date
  expiresAt?: Date
}

/**
 * Query parameters for memory retrieval
 */
export interface MemoryQuery {
  /** Session identifier (REQUIRED for user isolation) */
  sessionId: string

  /** Optional user ID filter */
  userId?: string

  /** Agent ID filter */
  agentId?: string

  /** Agent type filter */
  agentType?: string

  /** Semantic search query */
  query?: string

  /** Result limit */
  limit?: number

  /** Start date filter */
  startDate?: Date

  /** End date filter */
  endDate?: Date

  /** Tag filters (AND condition) */
  tags?: string[]

  /** Minimum importance score */
  minImportance?: number

  /** Include expired memories */
  includeExpired?: boolean
}

/**
 * Memory storage provider interface
 * Supports multiple backends (PostgreSQL, Redis, etc.)
 */
export interface MemoryStorageProvider {
  /** Save a single memory entry */
  save(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>

  /** Save multiple memory entries in batch */
  saveBatch(entries: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<string[]>

  /** Get memory by ID */
  get(id: string, sessionId: string): Promise<MemoryEntry | null>

  /** Query memories */
  query(query: MemoryQuery): Promise<MemoryEntry[]>

  /** Semantic search (requires vector embeddings) */
  searchSemantic?(query: string, sessionId: string, limit: number): Promise<MemoryEntry[]>

  /** Update memory entry */
  update(id: string, sessionId: string, updates: Partial<MemoryEntry>): Promise<void>

  /** Delete memory by ID */
  delete(id: string, sessionId: string): Promise<void>

  /** Delete all memories for a session */
  deleteSession(sessionId: string): Promise<number>

  /** Delete expired memories */
  deleteExpired(): Promise<number>

  /** Get memory count for session */
  count(sessionId: string): Promise<number>
}

/**
 * Memory configuration options
 */
export interface MemoryConfig {
  /** Agent identifier */
  agentId: string

  /** Agent type */
  agentType: string

  /** Session identifier */
  sessionId: string

  /** Optional user ID */
  userId?: string

  /** Workflow ID */
  workflowId: string

  /** Enable memory persistence (default: true) */
  enabled?: boolean

  /** Maximum memories to retrieve (default: 10) */
  limit?: number

  /** Minimum importance threshold (default: 0.3) */
  minImportance?: number

  /** Memory TTL in milliseconds (default: 24 hours) */
  ttl?: number

  /** Enable semantic search (default: false, requires embeddings) */
  semanticSearch?: boolean

  /** Tags to attach to saved memories */
  tags?: string[]
}

/**
 * Memory service response
 */
export interface MemoryResponse {
  success: boolean
  memories?: MemoryEntry[]
  count?: number
  error?: string
}
