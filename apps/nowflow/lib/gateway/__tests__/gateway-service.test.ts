import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import { getRedisClient } from '@/lib/redis'
import { GatewayService, getGatewayService, resetGatewayService } from '../gateway-service'
import { routeMessage, unregisterRules } from '../message-router'
import { createSession, getActiveSessionCount, getSession } from '../session-manager'
import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelType,
  GatewayEvent,
  InboundMessage,
  OutboundMessage,
} from '../types'

// Mock Redis
const mockRedisClient = {
  exists: vi.fn().mockResolvedValue(0),
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  publish: vi.fn().mockResolvedValue(1),
  pipeline: vi.fn(() => ({
    zremrangebyscore: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    srem: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1], // zcard result
      [null, 1],
    ]),
  })),
}

vi.mock('@/lib/redis', () => ({
  getRedisClient: vi.fn(() => mockRedisClient),
}))

// Mock logger
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Mock session manager
vi.mock('../session-manager', () => ({
  createSession: vi.fn().mockResolvedValue({
    id: 'session-1',
    channelId: 'ch-1',
    channelType: 'telegram',
    userId: 'user-1',
    senderId: 'sender-1',
    context: {},
    messageHistory: [],
    createdAt: new Date(),
    lastActivityAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
  }),
  getSession: vi.fn().mockResolvedValue(null),
  addMessageToHistory: vi.fn().mockResolvedValue(null),
  getActiveSessionCount: vi.fn().mockResolvedValue(0),
  updateSession: vi.fn().mockResolvedValue(null),
}))

// Mock message router
vi.mock('../message-router', () => ({
  routeMessage: vi.fn().mockReturnValue({ matched: false }),
  registerRules: vi.fn(),
  unregisterRules: vi.fn(),
}))

// Mock database
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => []) })) })),
    })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => []) })) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => []) })) })),
    })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  },
}))
vi.mock('@/db/schema', () => ({
  workflow: {},
  gatewayChannel: {},
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}))
vi.mock('@/lib/webhooks/utils', () => ({
  executeWorkflowFromPayload: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234'),
}))

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockAdapter(type: ChannelType = 'telegram'): ChannelAdapter {
  return {
    type,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-out-1' }),
    getStatus: vi.fn().mockReturnValue('connected'),
    validateCredentials: vi.fn().mockResolvedValue(true),
  }
}

function createMockChannelConfig(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    id: 'ch-1',
    type: 'telegram',
    name: 'Test Channel',
    status: 'disconnected',
    userId: 'user-1',
    credentials: { token: 'test-token' },
    settings: {
      triggerWorkflowId: 'wf-1',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function createMockInboundMessage(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    id: 'msg-1',
    channelId: 'ch-1',
    channelType: 'telegram',
    senderId: 'sender-1',
    senderName: 'Test User',
    text: 'Hello world',
    metadata: {},
    timestamp: new Date(),
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GatewayService', () => {
  let gateway: ReturnType<typeof getGatewayService>

  beforeEach(async () => {
    vi.clearAllMocks()
    await resetGatewayService()
    gateway = getGatewayService()
  })

  afterEach(async () => {
    await resetGatewayService()
  })

  // ── Singleton ──────────────────────────────────────────────────────────

  describe('getGatewayService()', () => {
    it('should return the same instance on multiple calls', async () => {
      await resetGatewayService()
      const a = getGatewayService()
      const b = getGatewayService()
      expect(a).toBe(b)
    })

    it('should return a new instance after resetGatewayService', async () => {
      const first = getGatewayService()
      await resetGatewayService()
      const second = getGatewayService()
      expect(first).not.toBe(second)
    })
  })

  // ── Adapter Registration ──────────────────────────────────────────────

  describe('registerAdapter()', () => {
    it('should register an adapter for a channel type', () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)
      expect(gateway.getAdapter('telegram')).toBe(adapter)
    })

    it('should overwrite an existing adapter for the same type', () => {
      const adapter1 = createMockAdapter('telegram')
      const adapter2 = createMockAdapter('telegram')
      gateway.registerAdapter(adapter1)
      gateway.registerAdapter(adapter2)
      expect(gateway.getAdapter('telegram')).toBe(adapter2)
    })

    it('should support multiple adapters for different types', () => {
      const telegramAdapter = createMockAdapter('telegram')
      const slackAdapter = createMockAdapter('slack')
      gateway.registerAdapter(telegramAdapter)
      gateway.registerAdapter(slackAdapter)
      expect(gateway.getAdapter('telegram')).toBe(telegramAdapter)
      expect(gateway.getAdapter('slack')).toBe(slackAdapter)
    })
  })

  describe('unregisterAdapter()', () => {
    it('should remove a registered adapter', () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)
      gateway.unregisterAdapter('telegram')
      expect(gateway.getAdapter('telegram')).toBeUndefined()
    })

    it('should not throw when unregistering a non-existent adapter', () => {
      expect(() => gateway.unregisterAdapter('discord')).not.toThrow()
    })
  })

  // ── Channel Lifecycle ─────────────────────────────────────────────────

  describe('connectChannel()', () => {
    it('should return error when no adapter is registered for the channel type', async () => {
      const config = createMockChannelConfig()
      const result = await gateway.connectChannel(config)
      expect(result.success).toBe(false)
      expect(result.error).toContain('No adapter registered')
    })

    it('should validate credentials before connecting', async () => {
      const adapter = createMockAdapter('telegram')
      ;(adapter.validateCredentials as Mock).mockResolvedValue(false)
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig()
      const result = await gateway.connectChannel(config)

      expect(adapter.validateCredentials).toHaveBeenCalledWith(config.credentials)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid channel credentials')
    })

    it('should handle credential validation errors', async () => {
      const adapter = createMockAdapter('telegram')
      ;(adapter.validateCredentials as Mock).mockRejectedValue(new Error('Network error'))
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig()
      const result = await gateway.connectChannel(config)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Credential validation error')
    })

    it('should call adapter.connect() and return success on valid credentials', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig()
      const result = await gateway.connectChannel(config)

      expect(adapter.connect).toHaveBeenCalledWith(config)
      expect(result.success).toBe(true)
    })

    it('should set channel status to connected after successful connect', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig()
      await gateway.connectChannel(config)

      const storedConfig = gateway.getChannelConfig(config.id)
      expect(storedConfig?.status).toBe('connected')
    })

    it('should set channel status to error when adapter.connect() throws', async () => {
      const adapter = createMockAdapter('telegram')
      ;(adapter.connect as Mock).mockRejectedValue(new Error('Connection refused'))
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig()
      const result = await gateway.connectChannel(config)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Connection refused')

      const storedConfig = gateway.getChannelConfig(config.id)
      expect(storedConfig?.status).toBe('error')
    })

    it('should emit channel_connected event on success', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const events: GatewayEvent[] = []
      gateway.on('channel_connected', (e) => events.push(e))

      const config = createMockChannelConfig()
      await gateway.connectChannel(config)

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('channel_connected')
      expect(events[0].channelId).toBe(config.id)
    })

    it('should emit channel_error event on failure', async () => {
      const adapter = createMockAdapter('telegram')
      ;(adapter.connect as Mock).mockRejectedValue(new Error('Boom'))
      gateway.registerAdapter(adapter)

      const events: GatewayEvent[] = []
      gateway.on('channel_error', (e) => events.push(e))

      const config = createMockChannelConfig()
      await gateway.connectChannel(config)

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('channel_error')
      expect(events[0].data.error).toBe('Boom')
    })
  })

  describe('disconnectChannel()', () => {
    it('should do nothing for an unknown channel', async () => {
      await expect(gateway.disconnectChannel('nonexistent')).resolves.toBeUndefined()
    })

    it('should call adapter.disconnect() and set status to disconnected', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig()
      await gateway.connectChannel(config)

      await gateway.disconnectChannel(config.id)

      expect(adapter.disconnect).toHaveBeenCalledWith(config.id)

      const storedConfig = gateway.getChannelConfig(config.id)
      expect(storedConfig?.status).toBe('disconnected')
    })

    it('should unregister routing rules for the channel', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig()
      await gateway.connectChannel(config)
      await gateway.disconnectChannel(config.id)

      expect(unregisterRules).toHaveBeenCalledWith(config.id)
    })

    it('should emit channel_disconnected event', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const events: GatewayEvent[] = []
      gateway.on('channel_disconnected', (e) => events.push(e))

      const config = createMockChannelConfig()
      await gateway.connectChannel(config)
      await gateway.disconnectChannel(config.id)

      expect(events).toHaveLength(1)
      expect(events[0].channelId).toBe(config.id)
    })

    it('should handle adapter.disconnect() errors gracefully', async () => {
      const adapter = createMockAdapter('telegram')
      ;(adapter.disconnect as Mock).mockRejectedValue(new Error('cleanup failed'))
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig()
      await gateway.connectChannel(config)

      // Should not throw
      await expect(gateway.disconnectChannel(config.id)).resolves.toBeUndefined()
    })
  })

  // ── Channel Queries ───────────────────────────────────────────────────

  describe('getChannels()', () => {
    it('should return all channels when no type filter is given', async () => {
      const telegramAdapter = createMockAdapter('telegram')
      const slackAdapter = createMockAdapter('slack')
      gateway.registerAdapter(telegramAdapter)
      gateway.registerAdapter(slackAdapter)

      await gateway.connectChannel(createMockChannelConfig({ id: 'ch-tg', type: 'telegram' }))
      await gateway.connectChannel(createMockChannelConfig({ id: 'ch-sl', type: 'slack' }))

      const channels = gateway.getChannels()
      expect(channels).toHaveLength(2)
    })

    it('should filter channels by type', async () => {
      const telegramAdapter = createMockAdapter('telegram')
      const slackAdapter = createMockAdapter('slack')
      gateway.registerAdapter(telegramAdapter)
      gateway.registerAdapter(slackAdapter)

      await gateway.connectChannel(createMockChannelConfig({ id: 'ch-tg', type: 'telegram' }))
      await gateway.connectChannel(createMockChannelConfig({ id: 'ch-sl', type: 'slack' }))

      const telegramChannels = gateway.getChannels('telegram')
      expect(telegramChannels).toHaveLength(1)
      expect(telegramChannels[0].id).toBe('ch-tg')
    })

    it('should return empty array when no channels match the type', () => {
      const channels = gateway.getChannels('discord')
      expect(channels).toEqual([])
    })
  })

  describe('getChannelStatus()', () => {
    it('should return disconnected for unknown channels', () => {
      expect(gateway.getChannelStatus('nonexistent')).toBe('disconnected')
    })

    it('should delegate to adapter.getStatus() when adapter is available', async () => {
      const adapter = createMockAdapter('telegram')
      ;(adapter.getStatus as Mock).mockReturnValue('connected')
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig()
      await gateway.connectChannel(config)

      expect(gateway.getChannelStatus(config.id)).toBe('connected')
      expect(adapter.getStatus).toHaveBeenCalledWith(config.id)
    })
  })

  // ── Message Handling ──────────────────────────────────────────────────

  describe('handleInboundMessage()', () => {
    beforeEach(async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig()
      await gateway.connectChannel(config)

      vi.clearAllMocks()

      // Re-set up default mock returns after clearAllMocks
      mockRedisClient.exists.mockResolvedValue(0)
      mockRedisClient.set.mockResolvedValue('OK')
      mockRedisClient.publish.mockResolvedValue(1)
      ;(getSession as Mock).mockResolvedValue(null)
      ;(createSession as Mock).mockResolvedValue({
        id: 'session-1',
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
        context: {},
        messageHistory: [],
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      })
      ;(routeMessage as Mock).mockReturnValue({ matched: false })
    })

    it('should skip duplicate messages', async () => {
      // Simulate Redis indicating the message already exists
      mockRedisClient.exists.mockResolvedValueOnce(1)

      const msg = createMockInboundMessage()
      const result = await gateway.handleInboundMessage(msg)

      expect(result.handled).toBe(false)
      expect(result.error).toBe('duplicate')
    })

    it('should reject messages for unknown channels', async () => {
      const msg = createMockInboundMessage({ channelId: 'unknown-channel' })
      const result = await gateway.handleInboundMessage(msg)

      expect(result.handled).toBe(false)
      expect(result.error).toBe('unknown_channel')
    })

    it('should create a new session when none exists', async () => {
      ;(getSession as Mock).mockResolvedValue(null)

      const msg = createMockInboundMessage()
      await gateway.handleInboundMessage(msg)

      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'ch-1',
          senderId: 'sender-1',
        })
      )
    })

    it('should route messages through routeMessage', async () => {
      ;(routeMessage as Mock).mockReturnValue({
        matched: true,
        workflowId: 'wf-1',
        trigger: '/start',
      })

      const msg = createMockInboundMessage()
      const result = await gateway.handleInboundMessage(msg)

      expect(result.handled).toBe(true)
      expect(result.workflowId).toBe('wf-1')
      expect(routeMessage).toHaveBeenCalled()
    })

    it('should return handled=true even when no workflow matches', async () => {
      ;(routeMessage as Mock).mockReturnValue({ matched: false })

      const msg = createMockInboundMessage()
      const result = await gateway.handleInboundMessage(msg)

      expect(result.handled).toBe(true)
      expect(result.workflowId).toBeUndefined()
    })

    it('should emit message_received event', async () => {
      const events: GatewayEvent[] = []
      gateway.on('message_received', (e) => events.push(e))

      const msg = createMockInboundMessage()
      await gateway.handleInboundMessage(msg)

      expect(events).toHaveLength(1)
      expect(events[0].data.messageId).toBe('msg-1')
    })

    it('should emit workflow_triggered event when a route matches', async () => {
      ;(routeMessage as Mock).mockReturnValue({
        matched: true,
        workflowId: 'wf-1',
        trigger: 'default',
      })

      const events: GatewayEvent[] = []
      gateway.on('workflow_triggered', (e) => events.push(e))

      const msg = createMockInboundMessage()
      await gateway.handleInboundMessage(msg)

      expect(events).toHaveLength(1)
      expect(events[0].data.workflowId).toBe('wf-1')
    })

    it('should emit session_created event for new sessions', async () => {
      ;(getSession as Mock).mockResolvedValue(null)

      const events: GatewayEvent[] = []
      gateway.on('session_created', (e) => events.push(e))

      const msg = createMockInboundMessage()
      await gateway.handleInboundMessage(msg)

      expect(events).toHaveLength(1)
      expect(events[0].data.senderId).toBe('sender-1')
    })
  })

  // ── Rate Limiting ─────────────────────────────────────────────────────

  describe('rate limiting', () => {
    it('should reject messages when rate limit is exceeded', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig({
        settings: {
          triggerWorkflowId: 'wf-1',
          rateLimitPerMinute: 5,
        },
      })
      await gateway.connectChannel(config)
      vi.clearAllMocks()

      mockRedisClient.exists.mockResolvedValue(0)
      mockRedisClient.set.mockResolvedValue('OK')

      // Simulate rate limit exceeded: zcard returns count > limit
      mockRedisClient.pipeline.mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        sadd: vi.fn().mockReturnThis(),
        del: vi.fn().mockReturnThis(),
        srem: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0],
          [null, 1],
          [null, 10], // exceeds limit of 5
          [null, 1],
        ]),
      })

      const msg = createMockInboundMessage()
      const result = await gateway.handleInboundMessage(msg)

      expect(result.handled).toBe(false)
      expect(result.error).toBe('rate_limited')
    })

    it('should allow messages within rate limit', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig({
        settings: {
          triggerWorkflowId: 'wf-1',
          rateLimitPerMinute: 10,
        },
      })
      await gateway.connectChannel(config)
      vi.clearAllMocks()

      mockRedisClient.exists.mockResolvedValue(0)
      mockRedisClient.set.mockResolvedValue('OK')
      mockRedisClient.publish.mockResolvedValue(1)
      ;(getSession as Mock).mockResolvedValue(null)
      ;(createSession as Mock).mockResolvedValue({
        id: 'session-1',
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
        context: {},
        messageHistory: [],
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      })
      ;(routeMessage as Mock).mockReturnValue({ matched: false })

      mockRedisClient.pipeline.mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        sadd: vi.fn().mockReturnThis(),
        del: vi.fn().mockReturnThis(),
        srem: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0],
          [null, 1],
          [null, 3], // within limit of 10
          [null, 1],
        ]),
      })

      const msg = createMockInboundMessage()
      const result = await gateway.handleInboundMessage(msg)

      expect(result.handled).toBe(true)
    })

    it('should allow requests when Redis is unavailable (fail open)', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig({
        settings: {
          triggerWorkflowId: 'wf-1',
          rateLimitPerMinute: 5,
        },
      })
      await gateway.connectChannel(config)
      vi.clearAllMocks()

      // No Redis
      ;(getRedisClient as Mock).mockReturnValue(null)
      ;(getSession as Mock).mockResolvedValue(null)
      ;(createSession as Mock).mockResolvedValue({
        id: 'session-1',
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
        context: {},
        messageHistory: [],
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      })
      ;(routeMessage as Mock).mockReturnValue({ matched: false })

      const msg = createMockInboundMessage()
      const result = await gateway.handleInboundMessage(msg)

      expect(result.handled).toBe(true)
    })
  })

  // ── Allowed Users ─────────────────────────────────────────────────────

  describe('allowed users', () => {
    it('should reject messages from unauthorized senders', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig({
        settings: {
          triggerWorkflowId: 'wf-1',
          allowedUsers: ['allowed-sender'],
        },
      })
      await gateway.connectChannel(config)
      vi.clearAllMocks()

      mockRedisClient.exists.mockResolvedValue(0)
      mockRedisClient.set.mockResolvedValue('OK')

      const msg = createMockInboundMessage({ senderId: 'unauthorized-sender' })
      const result = await gateway.handleInboundMessage(msg)

      expect(result.handled).toBe(false)
      expect(result.error).toBe('unauthorized_sender')
    })

    it('should allow messages from authorized senders', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const config = createMockChannelConfig({
        settings: {
          triggerWorkflowId: 'wf-1',
          allowedUsers: ['sender-1'],
        },
      })
      await gateway.connectChannel(config)
      vi.clearAllMocks()

      mockRedisClient.exists.mockResolvedValue(0)
      mockRedisClient.set.mockResolvedValue('OK')
      mockRedisClient.publish.mockResolvedValue(1)
      ;(getSession as Mock).mockResolvedValue(null)
      ;(createSession as Mock).mockResolvedValue({
        id: 'session-1',
        channelId: 'ch-1',
        channelType: 'telegram',
        userId: 'user-1',
        senderId: 'sender-1',
        context: {},
        messageHistory: [],
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      })
      ;(routeMessage as Mock).mockReturnValue({ matched: false })

      const msg = createMockInboundMessage({ senderId: 'sender-1' })
      const result = await gateway.handleInboundMessage(msg)

      expect(result.handled).toBe(true)
    })
  })

  // ── Send Message ──────────────────────────────────────────────────────

  describe('sendMessage()', () => {
    it('should return error when no adapter is registered for the channel type', async () => {
      const msg: OutboundMessage = {
        channelId: 'ch-1',
        channelType: 'telegram',
        recipientId: 'recipient-1',
        text: 'Hello!',
      }

      const result = await gateway.sendMessage(msg)
      expect(result.success).toBe(false)
      expect(result.error).toContain('No adapter')
    })

    it('should delegate to the correct adapter', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      // Need a connected channel for message history
      await gateway.connectChannel(createMockChannelConfig())

      const msg: OutboundMessage = {
        channelId: 'ch-1',
        channelType: 'telegram',
        recipientId: 'recipient-1',
        text: 'Hello!',
      }

      const result = await gateway.sendMessage(msg)

      expect(adapter.sendMessage).toHaveBeenCalledWith(msg)
      expect(result.success).toBe(true)
      expect(result.messageId).toBe('msg-out-1')
    })

    it('should emit message_sent event on success', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const events: GatewayEvent[] = []
      gateway.on('message_sent', (e) => events.push(e))

      const msg: OutboundMessage = {
        channelId: 'ch-1',
        channelType: 'telegram',
        recipientId: 'recipient-1',
        text: 'Hello!',
      }

      await gateway.sendMessage(msg)

      expect(events).toHaveLength(1)
      expect(events[0].data.recipientId).toBe('recipient-1')
    })

    it('should handle adapter sendMessage errors gracefully', async () => {
      const adapter = createMockAdapter('telegram')
      ;(adapter.sendMessage as Mock).mockRejectedValue(new Error('Send failed'))
      gateway.registerAdapter(adapter)

      const msg: OutboundMessage = {
        channelId: 'ch-1',
        channelType: 'telegram',
        recipientId: 'recipient-1',
        text: 'Hello!',
      }

      const result = await gateway.sendMessage(msg)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Send failed')
    })

    it('should not emit message_sent event when adapter returns failure', async () => {
      const adapter = createMockAdapter('telegram')
      ;(adapter.sendMessage as Mock).mockResolvedValue({ success: false, error: 'Blocked' })
      gateway.registerAdapter(adapter)

      const events: GatewayEvent[] = []
      gateway.on('message_sent', (e) => events.push(e))

      const msg: OutboundMessage = {
        channelId: 'ch-1',
        channelType: 'telegram',
        recipientId: 'recipient-1',
        text: 'Hello!',
      }

      await gateway.sendMessage(msg)

      expect(events).toHaveLength(0)
    })
  })

  // ── Event System ──────────────────────────────────────────────────────

  describe('event system', () => {
    it('should support wildcard listeners that receive all events', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const events: GatewayEvent[] = []
      gateway.on('*', (e) => events.push(e))

      const config = createMockChannelConfig()
      await gateway.connectChannel(config)

      // Should have received the channel_connected event
      expect(events.some((e) => e.type === 'channel_connected')).toBe(true)
    })

    it('should return an unsubscribe function', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      const events: GatewayEvent[] = []
      const unsub = gateway.on('channel_connected', (e) => events.push(e))

      const config1 = createMockChannelConfig({ id: 'ch-1' })
      await gateway.connectChannel(config1)
      expect(events).toHaveLength(1)

      unsub()

      const config2 = createMockChannelConfig({ id: 'ch-2' })
      await gateway.connectChannel(config2)
      // Should still be 1 since we unsubscribed
      expect(events).toHaveLength(1)
    })

    it('should not throw when a listener throws', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      gateway.on('channel_connected', () => {
        throw new Error('Listener exploded')
      })

      const config = createMockChannelConfig()
      // Should not throw despite the listener error
      await expect(gateway.connectChannel(config)).resolves.toEqual({ success: true })
    })
  })

  // ── Shutdown ──────────────────────────────────────────────────────────

  describe('shutdown()', () => {
    it('should disconnect all channels and clear internal state', async () => {
      const adapter = createMockAdapter('telegram')
      gateway.registerAdapter(adapter)

      await gateway.connectChannel(createMockChannelConfig({ id: 'ch-1' }))
      await gateway.connectChannel(createMockChannelConfig({ id: 'ch-2' }))

      await gateway.shutdown()

      expect(adapter.disconnect).toHaveBeenCalledTimes(2)
      expect(gateway.getChannels()).toHaveLength(0)
      expect(gateway.getAdapter('telegram')).toBeUndefined()
    })
  })
})
