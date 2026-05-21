import { createLogger } from '@/lib/logs/console-logger'
import { getRedisClient } from '@/lib/redis'
import type { ChannelType, GatewaySession } from './types'

const logger = createLogger('SessionManager')

const SESSION_PREFIX = 'gateway:session:'
const SESSION_INDEX_PREFIX = 'gateway:sessions:channel:'
const DEFAULT_SESSION_TTL = 60 * 60 * 24 // 24 hours in seconds
const MAX_MESSAGE_HISTORY = 50

// In-memory fallback for when Redis is unavailable
const inMemorySessions = new Map<string, GatewaySession>()

/**
 * Generate a unique session ID from channel and sender identifiers.
 */
function buildSessionKey(channelId: string, senderId: string): string {
  return `${SESSION_PREFIX}${channelId}:${senderId}`
}

/**
 * Serialize a session for Redis storage.
 * Converts Date objects to ISO strings for JSON compatibility.
 */
function serializeSession(session: GatewaySession): string {
  return JSON.stringify(session, (key, value) => {
    if (value instanceof Date) {
      return value.toISOString()
    }
    return value
  })
}

/**
 * Deserialize a session from Redis storage.
 * Converts ISO date strings back to Date objects.
 */
function deserializeSession(raw: string): GatewaySession {
  return JSON.parse(raw, (key, value) => {
    if (
      typeof value === 'string' &&
      (key === 'createdAt' ||
        key === 'lastActivityAt' ||
        key === 'expiresAt' ||
        key === 'timestamp')
    ) {
      return new Date(value)
    }
    return value
  })
}

/**
 * Create a new gateway session for a channel conversation.
 *
 * @param params Session creation parameters
 * @param ttlSeconds Session time-to-live in seconds (default: 24 hours)
 * @returns The created session
 */
export async function createSession(
  params: {
    channelId: string
    channelType: ChannelType
    userId: string
    senderId: string
    workflowId?: string
  },
  ttlSeconds: number = DEFAULT_SESSION_TTL
): Promise<GatewaySession> {
  const now = new Date()
  const session: GatewaySession = {
    id: `${params.channelId}:${params.senderId}:${now.getTime()}`,
    channelId: params.channelId,
    channelType: params.channelType,
    userId: params.userId,
    senderId: params.senderId,
    workflowId: params.workflowId,
    context: {},
    messageHistory: [],
    createdAt: now,
    lastActivityAt: now,
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
  }

  const key = buildSessionKey(params.channelId, params.senderId)

  try {
    const redis = getRedisClient()
    if (redis) {
      const pipeline = redis.pipeline()
      pipeline.set(key, serializeSession(session), 'EX', ttlSeconds)
      // Maintain an index of sessions per channel for lookup
      pipeline.sadd(`${SESSION_INDEX_PREFIX}${params.channelId}`, key)
      pipeline.expire(`${SESSION_INDEX_PREFIX}${params.channelId}`, ttlSeconds)
      await pipeline.exec()

      logger.debug('Session created in Redis', {
        sessionId: session.id,
        channelId: params.channelId,
        senderId: params.senderId,
      })
    } else {
      inMemorySessions.set(key, session)
      logger.debug('Session created in memory (Redis unavailable)', {
        sessionId: session.id,
      })
    }
  } catch (error) {
    logger.error('Failed to create session in Redis, using in-memory fallback', { error })
    inMemorySessions.set(key, session)
  }

  return session
}

/**
 * Retrieve an existing session by channel and sender ID.
 *
 * @returns The session if found and not expired, null otherwise
 */
export async function getSession(
  channelId: string,
  senderId: string
): Promise<GatewaySession | null> {
  const key = buildSessionKey(channelId, senderId)

  try {
    const redis = getRedisClient()
    if (redis) {
      const raw = await redis.get(key)
      if (!raw) return null

      const session = deserializeSession(raw)

      // Check if session has expired (belt-and-suspenders with Redis TTL)
      if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
        await deleteSession(channelId, senderId)
        return null
      }

      return session
    } else {
      const session = inMemorySessions.get(key)
      if (!session) return null

      if (new Date() > new Date(session.expiresAt)) {
        inMemorySessions.delete(key)
        return null
      }

      return session
    }
  } catch (error) {
    logger.error('Failed to retrieve session', { error, channelId, senderId })

    // Try in-memory fallback
    const session = inMemorySessions.get(key)
    if (session && new Date() <= new Date(session.expiresAt)) {
      return session
    }
    return null
  }
}

/**
 * Update an existing session with new data and refresh the TTL.
 *
 * @param channelId Channel identifier
 * @param senderId Sender identifier
 * @param updates Partial session data to merge
 * @param ttlSeconds Updated TTL in seconds
 * @returns The updated session, or null if not found
 */
export async function updateSession(
  channelId: string,
  senderId: string,
  updates: Partial<Pick<GatewaySession, 'workflowId' | 'executionId' | 'context'>>,
  ttlSeconds: number = DEFAULT_SESSION_TTL
): Promise<GatewaySession | null> {
  const session = await getSession(channelId, senderId)
  if (!session) {
    logger.warn('Attempted to update non-existent session', { channelId, senderId })
    return null
  }

  const now = new Date()
  const updatedSession: GatewaySession = {
    ...session,
    ...updates,
    context: updates.context ? { ...session.context, ...updates.context } : session.context,
    lastActivityAt: now,
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
  }

  const key = buildSessionKey(channelId, senderId)

  try {
    const redis = getRedisClient()
    if (redis) {
      await redis.set(key, serializeSession(updatedSession), 'EX', ttlSeconds)
    } else {
      inMemorySessions.set(key, updatedSession)
    }
  } catch (error) {
    logger.error('Failed to update session', { error, channelId, senderId })
    inMemorySessions.set(key, updatedSession)
  }

  return updatedSession
}

/**
 * Append a message to the session's history, maintaining the maximum history size.
 *
 * @param channelId Channel identifier
 * @param senderId Sender identifier
 * @param role Message role (user or assistant)
 * @param content Message content
 * @returns The updated session, or null if session not found
 */
export async function addMessageToHistory(
  channelId: string,
  senderId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<GatewaySession | null> {
  const session = await getSession(channelId, senderId)
  if (!session) {
    logger.warn('Cannot add message to non-existent session', { channelId, senderId })
    return null
  }

  const message = { role, content, timestamp: new Date() }
  const history = [...session.messageHistory, message]

  // Trim to keep only the most recent messages
  if (history.length > MAX_MESSAGE_HISTORY) {
    history.splice(0, history.length - MAX_MESSAGE_HISTORY)
  }

  const now = new Date()
  const updatedSession: GatewaySession = {
    ...session,
    messageHistory: history,
    lastActivityAt: now,
    expiresAt: new Date(now.getTime() + DEFAULT_SESSION_TTL * 1000),
  }

  const key = buildSessionKey(channelId, senderId)

  try {
    const redis = getRedisClient()
    if (redis) {
      await redis.set(key, serializeSession(updatedSession), 'EX', DEFAULT_SESSION_TTL)
    } else {
      inMemorySessions.set(key, updatedSession)
    }
  } catch (error) {
    logger.error('Failed to add message to session history', { error, channelId, senderId })
    inMemorySessions.set(key, updatedSession)
  }

  return updatedSession
}

/**
 * Delete a session and remove it from the channel index.
 */
export async function deleteSession(channelId: string, senderId: string): Promise<void> {
  const key = buildSessionKey(channelId, senderId)

  try {
    const redis = getRedisClient()
    if (redis) {
      const pipeline = redis.pipeline()
      pipeline.del(key)
      pipeline.srem(`${SESSION_INDEX_PREFIX}${channelId}`, key)
      await pipeline.exec()

      logger.debug('Session deleted from Redis', { channelId, senderId })
    } else {
      inMemorySessions.delete(key)
    }
  } catch (error) {
    logger.error('Failed to delete session', { error, channelId, senderId })
    inMemorySessions.delete(key)
  }
}

/**
 * Get the count of active sessions for a specific channel.
 * Useful for enforcing maxConcurrentSessions limits.
 */
export async function getActiveSessionCount(channelId: string): Promise<number> {
  try {
    const redis = getRedisClient()
    if (redis) {
      return await redis.scard(`${SESSION_INDEX_PREFIX}${channelId}`)
    } else {
      let count = 0
      const prefix = `${SESSION_PREFIX}${channelId}:`
      for (const [key, session] of inMemorySessions.entries()) {
        if (key.startsWith(prefix) && new Date() <= new Date(session.expiresAt)) {
          count++
        }
      }
      return count
    }
  } catch (error) {
    logger.error('Failed to get active session count', { error, channelId })
    return 0
  }
}

/**
 * Update session context (merge new values into existing context).
 * Convenience wrapper around updateSession for context-only updates.
 */
export async function updateSessionContext(
  channelId: string,
  senderId: string,
  context: Record<string, any>
): Promise<GatewaySession | null> {
  return updateSession(channelId, senderId, { context })
}
