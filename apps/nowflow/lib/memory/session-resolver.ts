/**
 * Session context for memory operations
 * Session context for isolated memory operations.
 */
export interface SessionContext {
  /** Primary session identifier - used for all memory operations */
  sessionId: string

  /** Optional authenticated user ID */
  userId?: string

  /** Whether this is an anonymous session */
  isAnonymous: boolean

  /** Session creation timestamp */
  createdAt: number

  /** Session TTL in milliseconds (default: 24 hours) */
  ttl: number

  /** Source of session identifier (for debugging) */
  source: 'userId' | 'sessionToken' | 'header' | 'cookie' | 'generated'

  /** Additional metadata */
  metadata?: Record<string, any>
}

/**
 * Input for session resolution
 */
export interface SessionResolverInput {
  /** Authenticated user ID (highest priority) */
  userId?: string

  /** Explicit session ID from API/workflow */
  sessionId?: string

  /** Session token from X-Session-Token header */
  sessionToken?: string

  /** Session from cookie */
  cookieSession?: string

  /** Chat ID for scoping (optional) */
  chatId?: string

  /** Workflow ID for scoping (optional) */
  workflowId?: string

  /** Custom TTL in milliseconds */
  ttl?: number

  /** Additional metadata to attach */
  metadata?: Record<string, any>
}

/**
 * Session Identifier Resolver
 *
 * Priority order:
 * 1. Authenticated userId (if provided)
 * 2. Explicit sessionId from request body (MOST RELIABLE for cross-domain)
 * 3. Session token from header (if valid)
 * 4. Session from cookie (if valid)
 * 5. Generate new secure UUID v4
 *
 * IMPORTANT: Session tokens from request body take precedence because:
 * - Cross-domain/subdomain scenarios may not share cookies
 * - Each chat interface should maintain its own isolated session
 * - Client generates unique sessionToken per chat subdomain
 */
export class SessionResolver {
  private static readonly DEFAULT_TTL = 24 * 60 * 60 * 1000 // 24 hours
  private static readonly SESSION_ID_REGEX = /^[a-zA-Z0-9_-]{8,128}$/

  /**
   * Resolve session context from multiple sources with fallback
   */
  static resolve(input: SessionResolverInput): SessionContext {
    const now = Date.now()
    const ttl = input.ttl || this.DEFAULT_TTL

    // Priority 1: Authenticated user
    if (input.userId) {
      return {
        sessionId: this.buildSessionId('user', input.userId, input.chatId, input.workflowId),
        userId: input.userId,
        isAnonymous: false,
        createdAt: now,
        ttl,
        source: 'userId',
        metadata: input.metadata,
      }
    }

    // Priority 2: Explicit session ID from request body (MOST RELIABLE)
    // This is the sessionToken sent by the client, unique per chat interface
    if (input.sessionId && this.isValidSessionId(input.sessionId)) {
      // Strip any existing sess_ prefix from deployment-session to avoid double-prefixing
      const cleanId = input.sessionId.replace(/^sess_/, '')
      return {
        sessionId: this.buildSessionId('sess', cleanId, input.chatId, input.workflowId),
        userId: undefined,
        isAnonymous: true,
        createdAt: now,
        ttl,
        source: 'sessionToken',
        metadata: input.metadata,
      }
    }

    // Priority 3: Session token from header
    if (input.sessionToken && this.isValidSessionId(input.sessionToken)) {
      // Strip any existing sess_ prefix to avoid double-prefixing
      const cleanId = input.sessionToken.replace(/^sess_/, '')
      return {
        sessionId: this.buildSessionId('sess', cleanId, input.chatId, input.workflowId),
        userId: undefined,
        isAnonymous: true,
        createdAt: now,
        ttl,
        source: 'header',
        metadata: input.metadata,
      }
    }

    // Priority 4: Cookie session
    if (input.cookieSession && this.isValidSessionId(input.cookieSession)) {
      // Strip any existing sess_ prefix to avoid double-prefixing
      const cleanId = input.cookieSession.replace(/^sess_/, '')
      return {
        sessionId: this.buildSessionId('cookie', cleanId, input.chatId, input.workflowId),
        userId: undefined,
        isAnonymous: true,
        createdAt: now,
        ttl,
        source: 'cookie',
        metadata: input.metadata,
      }
    }

    // Priority 5: Generate new anonymous session
    const anonymousId = this.generateSecureSessionId()
    return {
      sessionId: this.buildSessionId('anon', anonymousId, input.chatId, input.workflowId),
      userId: undefined,
      isAnonymous: true,
      createdAt: now,
      ttl,
      source: 'generated',
      metadata: input.metadata,
    }
  }

  /**
   * Build scoped session ID
   * Format: {prefix}-{id}[-chat-{chatId}][-workflow-{workflowId}]
   *
   * Examples:
   * - user-123 (authenticated user)
   * - user-123-chat-abc (user in specific chat)
   * - sess-abc123-workflow-xyz (session token based)
   * - anon-a1b2c3d4-workflow-xyz (anonymous generated)
   * - cookie-xyz789-workflow-xyz (cookie based fallback)
   */
  private static buildSessionId(
    prefix: 'user' | 'sess' | 'cookie' | 'anon',
    id: string,
    chatId?: string,
    workflowId?: string
  ): string {
    let sessionId = `${prefix}-${id}`

    if (chatId) {
      sessionId += `-chat-${chatId}`
    }

    if (workflowId) {
      sessionId += `-workflow-${workflowId}`
    }

    return sessionId
  }

  /**
   * Generate cryptographically secure session ID
   * Uses crypto.randomUUID() for security (not Math.random()!)
   *
   * Warning: Never use UUIDv1 (timestamp-based) for sessions
   * Reference: https://coalfire.com/the-coalfire-blog/appsec-concerns-uuid-generation
   */
  private static generateSecureSessionId(): string {
    const uuid = this.generateUuid()
    return uuid.replace(/-/g, '').substring(0, 16) // 16 chars for shorter IDs
  }

  /**
   * Validate session ID format
   * Prevents injection attacks and ensures reasonable length
   * Note: Accepts both sess_xxx (from deployment-session) and clean xxx formats
   */
  private static isValidSessionId(sessionId: string): boolean {
    if (!sessionId || typeof sessionId !== 'string') {
      return false
    }

    // Strip sess_ prefix for validation if present
    const cleanId = sessionId.replace(/^sess_/, '')

    // Check format (alphanumeric, hyphens, underscores only)
    if (!this.SESSION_ID_REGEX.test(cleanId)) {
      return false
    }

    // Additional security checks
    if (sessionId.includes('..') || sessionId.includes('//')) {
      return false
    }

    return true
  }

  /**
   * Extract user ID from session ID if present
   * Format: user-{userId}[-...]
   */
  static extractUserId(sessionId: string): string | undefined {
    if (sessionId.startsWith('user-')) {
      const parts = sessionId.split('-')
      return parts[1] // Return the user ID part
    }
    return undefined
  }

  /**
   * Check if session is anonymous
   */
  static isAnonymous(sessionId: string): boolean {
    return sessionId.startsWith('anon-')
  }

  /**
   * Check if session is expired
   */
  static isExpired(createdAt: number, ttl: number): boolean {
    return Date.now() > createdAt + ttl
  }

  /**
   * Migrate anonymous session to authenticated user
   * Used when user logs in after starting as anonymous
   */
  static migrateToUser(anonymousSessionId: string, userId: string): string {
    // Extract scope info (chat, workflow) from anonymous session
    const parts = anonymousSessionId.split('-')

    let chatId: string | undefined
    let workflowId: string | undefined

    // Find chat and workflow IDs in the anonymous session
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'chat' && parts[i + 1]) {
        chatId = parts[i + 1]
      }
      if (parts[i] === 'workflow' && parts[i + 1]) {
        workflowId = parts[i + 1]
      }
    }

    // Build new session with user ID
    return this.buildSessionId('user', userId, chatId, workflowId)
  }

  /**
   * Get session namespace for memory storage
   * Used for organizing memories in storage backends
   *
   * Format: ("users", userId, "memories")
   */
  static getMemoryNamespace(sessionContext: SessionContext): string[] {
    if (sessionContext.userId) {
      return ['users', sessionContext.userId, 'memories']
    }
    // Anonymous users get session-scoped namespace
    return ['sessions', sessionContext.sessionId, 'memories']
  }

  /**
   * Get thread ID for memory checkpoints.
   * Format: {sessionId}-{timestamp}
   */
  static getThreadId(sessionContext: SessionContext): string {
    return `${sessionContext.sessionId}-${sessionContext.createdAt}`
  }

  private static generateUuid(): string {
    if (typeof globalThis !== 'undefined') {
      const cryptoObj = (globalThis as typeof globalThis & { crypto?: Crypto }).crypto
      if (cryptoObj?.randomUUID) {
        return cryptoObj.randomUUID()
      }
    }

    return `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }
}
