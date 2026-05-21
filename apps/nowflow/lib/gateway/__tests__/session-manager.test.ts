import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import {
  addMessageToHistory,
  createSession,
  deleteSession,
  getActiveSessionCount,
  getSession,
  updateSession,
  updateSessionContext,
} from '../session-manager'

// Mock Redis - start with null to test in-memory fallback by default
let mockRedisClient: any = null

vi.mock('@/lib/redis', () => ({
  getRedisClient: vi.fn(() => mockRedisClient),
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to in-memory mode by default
    mockRedisClient = null
  })

  // ── createSession ─────────────────────────────────────────────────────

  describe('createSession()', () => {
    it('should create a session with correct fields', async () => {
      const session = await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
        workflowId: 'wf-1',
      })

      expect(session.channelId).toBe('ch-1')
      expect(session.channelType).toBe('telegram')
      expect(session.userId).toBe('user-1')
      expect(session.senderId).toBe('sender-1')
      expect(session.workflowId).toBe('wf-1')
      expect(session.context).toEqual({})
      expect(session.messageHistory).toEqual([])
      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.lastActivityAt).toBeInstanceOf(Date)
      expect(session.expiresAt).toBeInstanceOf(Date)
    })

    it('should generate a unique session id', async () => {
      const session = await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
      })

      expect(session.id).toContain('ch-1')
      expect(session.id).toContain('sender-1')
    })

    it('should set expiresAt based on the provided TTL', async () => {
      const before = Date.now()
      const ttl = 3600 // 1 hour
      const session = await createSession(
        {
          channelId: 'ch-1',
          channelType: 'telegram',
          userId: 'user-1',
          senderId: 'sender-1',
        },
        ttl
      )

      const expectedMin = before + ttl * 1000
      const expectedMax = Date.now() + ttl * 1000
      expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin - 100)
      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax + 100)
    })

    it('should use default TTL of 24 hours when not specified', async () => {
      const before = Date.now()
      const session = await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
      })

      const defaultTTL = 60 * 60 * 24 // 24 hours
      const expectedMin = before + defaultTTL * 1000
      expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin - 100)
    })

    it('should store session in Redis when available', async () => {
      const mockPipeline = {
        set: vi.fn().mockReturnThis(),
        sadd: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      }
      mockRedisClient = {
        pipeline: vi.fn(() => mockPipeline),
      }

      await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
      })

      expect(mockRedisClient.pipeline).toHaveBeenCalled()
      expect(mockPipeline.set).toHaveBeenCalled()
      expect(mockPipeline.sadd).toHaveBeenCalled()
      expect(mockPipeline.exec).toHaveBeenCalled()
    })

    it('should fall back to in-memory storage on Redis error', async () => {
      const mockPipeline = {
        set: vi.fn().mockReturnThis(),
        sadd: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error('Redis down')),
      }
      mockRedisClient = {
        pipeline: vi.fn(() => mockPipeline),
      }

      const session = await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
      })

      // Session should still be created successfully via in-memory fallback
      expect(session.channelId).toBe('ch-1')

      // Now set Redis to null to verify in-memory retrieval works
      mockRedisClient = null
      const retrieved = await getSession('ch-1', 'sender-1')
      expect(retrieved).not.toBeNull()
      expect(retrieved?.channelId).toBe('ch-1')
    })
  })

  // ── getSession ────────────────────────────────────────────────────────

  describe('getSession()', () => {
    it('should return null for a non-existent session', async () => {
      const session = await getSession('ch-nonexistent', 'sender-nonexistent')
      expect(session).toBeNull()
    })

    it('should retrieve a previously created session (in-memory)', async () => {
      await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
        workflowId: 'wf-1',
      })

      const session = await getSession('ch-1', 'sender-1')
      expect(session).not.toBeNull()
      expect(session?.channelId).toBe('ch-1')
      expect(session?.senderId).toBe('sender-1')
      expect(session?.workflowId).toBe('wf-1')
    })

    it('should return null for expired sessions (in-memory)', async () => {
      // Create session with very short TTL
      await createSession(
        {
          channelId: 'ch-1',
          channelType: 'telegram',
          userId: 'user-1',
          senderId: 'sender-expired',
        },
        0 // Expires immediately
      )

      // Wait a tiny bit to ensure expiry
      await new Promise((resolve) => setTimeout(resolve, 10))

      const session = await getSession('ch-1', 'sender-expired')
      expect(session).toBeNull()
    })

    it('should retrieve session from Redis when available', async () => {
      const sessionData = {
        id: 'ch-1:sender-1:123',
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
        context: {},
        messageHistory: [],
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }

      mockRedisClient = {
        get: vi.fn().mockResolvedValue(JSON.stringify(sessionData)),
      }

      const session = await getSession('ch-1', 'sender-1')
      expect(session).not.toBeNull()
      expect(session?.channelId).toBe('ch-1')
      expect(mockRedisClient.get).toHaveBeenCalled()
    })

    it('should return null when Redis returns expired session', async () => {
      const sessionData = {
        id: 'ch-1:sender-1:123',
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
        context: {},
        messageHistory: [],
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Already expired
      }

      const mockPipeline = {
        del: vi.fn().mockReturnThis(),
        srem: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      }
      mockRedisClient = {
        get: vi.fn().mockResolvedValue(JSON.stringify(sessionData)),
        pipeline: vi.fn(() => mockPipeline),
      }

      const session = await getSession('ch-1', 'sender-1')
      expect(session).toBeNull()
    })

    it('should fall back to in-memory on Redis error', async () => {
      // First create a session in-memory
      mockRedisClient = null
      await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-fallback',
      })

      // Now set Redis that throws
      mockRedisClient = {
        get: vi.fn().mockRejectedValue(new Error('Redis error')),
      }

      const session = await getSession('ch-1', 'sender-fallback')
      expect(session).not.toBeNull()
      expect(session?.senderId).toBe('sender-fallback')
    })
  })

  // ── updateSession ─────────────────────────────────────────────────────

  describe('updateSession()', () => {
    it('should return null when session does not exist', async () => {
      const result = await updateSession('ch-nonexistent', 'sender-nonexistent', {
        workflowId: 'wf-2',
      })
      expect(result).toBeNull()
    })

    it('should update the workflowId', async () => {
      await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
        workflowId: 'wf-1',
      })

      const updated = await updateSession('ch-1', 'sender-1', {
        workflowId: 'wf-2',
      })

      expect(updated?.workflowId).toBe('wf-2')
    })

    it('should update the executionId', async () => {
      await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
      })

      const updated = await updateSession('ch-1', 'sender-1', {
        executionId: 'exec-123',
      })

      expect(updated?.executionId).toBe('exec-123')
    })

    it('should merge context values without overwriting existing ones', async () => {
      await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
      })

      // First update with initial context
      await updateSession('ch-1', 'sender-1', {
        context: { key1: 'value1' },
      })

      // Second update should merge
      const updated = await updateSession('ch-1', 'sender-1', {
        context: { key2: 'value2' },
      })

      expect(updated?.context).toEqual({ key1: 'value1', key2: 'value2' })
    })

    it('should refresh lastActivityAt and expiresAt', async () => {
      const session = await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
      })

      const originalActivity = session.lastActivityAt

      // Small delay to ensure timestamps differ
      await new Promise((resolve) => setTimeout(resolve, 10))

      const updated = await updateSession('ch-1', 'sender-1', {
        workflowId: 'wf-2',
      })

      expect(updated?.lastActivityAt.getTime()).toBeGreaterThan(originalActivity.getTime())
    })
  })

  // ── addMessageToHistory ───────────────────────────────────────────────

  describe('addMessageToHistory()', () => {
    it('should return null when session does not exist', async () => {
      const result = await addMessageToHistory(
        'ch-nonexistent',
        'sender-nonexistent',
        'user',
        'Hello'
      )
      expect(result).toBeNull()
    })

    it('should append a user message to history', async () => {
      await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
      })

      const updated = await addMessageToHistory('ch-1', 'sender-1', 'user', 'Hello there')

      expect(updated?.messageHistory).toHaveLength(1)
      expect(updated?.messageHistory[0].role).toBe('user')
      expect(updated?.messageHistory[0].content).toBe('Hello there')
      expect(updated?.messageHistory[0].timestamp).toBeInstanceOf(Date)
    })

    it('should append an assistant message to history', async () => {
      await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
      })

      await addMessageToHistory('ch-1', 'sender-1', 'user', 'Hello')
      const updated = await addMessageToHistory(
        'ch-1',
        'sender-1',
        'assistant',
        'Hi! How can I help?'
      )

      expect(updated?.messageHistory).toHaveLength(2)
      expect(updated?.messageHistory[1].role).toBe('assistant')
      expect(updated?.messageHistory[1].content).toBe('Hi! How can I help?')
    })

    it('should trim history to MAX_MESSAGE_HISTORY (50)', async () => {
      await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
      })

      // Add 55 messages
      for (let i = 0; i < 55; i++) {
        await addMessageToHistory('ch-1', 'sender-1', 'user', `Message ${i}`)
      }

      const session = await getSession('ch-1', 'sender-1')
      expect(session?.messageHistory).toHaveLength(50)
      // The oldest messages should have been trimmed
      expect(session?.messageHistory[0].content).toBe('Message 5')
      expect(session?.messageHistory[49].content).toBe('Message 54')
    })

    it('should refresh lastActivityAt', async () => {
      const session = await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
      })

      const originalActivity = session.lastActivityAt
      await new Promise((resolve) => setTimeout(resolve, 10))

      const updated = await addMessageToHistory('ch-1', 'sender-1', 'user', 'Hello')
      expect(updated?.lastActivityAt.getTime()).toBeGreaterThan(originalActivity.getTime())
    })
  })

  // ── deleteSession ─────────────────────────────────────────────────────

  describe('deleteSession()', () => {
    it('should delete a session from in-memory storage', async () => {
      await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
      })

      await deleteSession('ch-1', 'sender-1')

      const session = await getSession('ch-1', 'sender-1')
      expect(session).toBeNull()
    })

    it('should not throw when deleting a non-existent session', async () => {
      await expect(deleteSession('ch-nonexistent', 'sender-nonexistent')).resolves.toBeUndefined()
    })

    it('should delete session from Redis when available', async () => {
      const mockPipeline = {
        del: vi.fn().mockReturnThis(),
        srem: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      }
      mockRedisClient = {
        pipeline: vi.fn(() => mockPipeline),
      }

      await deleteSession('ch-1', 'sender-1')

      expect(mockRedisClient.pipeline).toHaveBeenCalled()
      expect(mockPipeline.del).toHaveBeenCalled()
      expect(mockPipeline.srem).toHaveBeenCalled()
      expect(mockPipeline.exec).toHaveBeenCalled()
    })

    it('should fall back to in-memory deletion on Redis error', async () => {
      // Create in-memory first
      mockRedisClient = null
      await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-del',
      })

      // Now try with failing Redis
      const mockPipeline = {
        del: vi.fn().mockReturnThis(),
        srem: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error('Redis error')),
      }
      mockRedisClient = {
        pipeline: vi.fn(() => mockPipeline),
      }

      await deleteSession('ch-1', 'sender-del')

      // Verify session is deleted from in-memory
      mockRedisClient = null
      const session = await getSession('ch-1', 'sender-del')
      expect(session).toBeNull()
    })
  })

  // ── getActiveSessionCount ─────────────────────────────────────────────

  describe('getActiveSessionCount()', () => {
    it('should return 0 when no sessions exist', async () => {
      const count = await getActiveSessionCount('ch-nonexistent')
      expect(count).toBe(0)
    })

    it('should count active sessions in-memory', async () => {
      // Use unique channel ID to isolate from other tests
      const chId = 'ch-count-active'
      await createSession({
        channelId: chId,
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-a',
      })

      await createSession({
        channelId: chId,
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-b',
      })

      const count = await getActiveSessionCount(chId)
      expect(count).toBe(2)
    })

    it('should not count sessions from other channels', async () => {
      const chId = 'ch-count-isolation'
      const otherChId = 'ch-count-other'
      await createSession({
        channelId: chId,
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-a',
      })

      await createSession({
        channelId: otherChId,
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-b',
      })

      const count = await getActiveSessionCount(chId)
      expect(count).toBe(1)
    })

    it('should not count expired sessions in-memory', async () => {
      const chId = 'ch-count-expired'
      await createSession(
        {
          channelId: chId,
          channelType: 'telegram',
          userId: 'user-1',
          senderId: 'sender-expired',
        },
        0 // Immediate expiry
      )

      await createSession({
        channelId: chId,
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-active',
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      const count = await getActiveSessionCount(chId)
      expect(count).toBe(1)
    })

    it('should use Redis scard when available', async () => {
      mockRedisClient = {
        scard: vi.fn().mockResolvedValue(5),
      }

      const count = await getActiveSessionCount('ch-1')

      expect(count).toBe(5)
      expect(mockRedisClient.scard).toHaveBeenCalled()
    })

    it('should return 0 on Redis error', async () => {
      mockRedisClient = {
        scard: vi.fn().mockRejectedValue(new Error('Redis down')),
      }

      const count = await getActiveSessionCount('ch-1')
      expect(count).toBe(0)
    })
  })

  // ── updateSessionContext ──────────────────────────────────────────────

  describe('updateSessionContext()', () => {
    it('should update only the context field', async () => {
      await createSession({
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
        workflowId: 'wf-1',
      })

      const updated = await updateSessionContext('ch-1', 'sender-1', {
        language: 'en',
        step: 3,
      })

      expect(updated?.context).toEqual({ language: 'en', step: 3 })
      expect(updated?.workflowId).toBe('wf-1') // Should remain unchanged
    })

    it('should return null for non-existent sessions', async () => {
      const result = await updateSessionContext('ch-nonexistent', 'sender-nonexistent', {
        key: 'value',
      })
      expect(result).toBeNull()
    })
  })
})
