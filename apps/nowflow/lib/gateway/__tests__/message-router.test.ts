import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getChannelRules,
  registerRules,
  routeMessage,
  type RoutingRule,
  unregisterRules,
} from '../message-router'
import type { ChannelConfig, InboundMessage } from '../types'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMessage(text: string, channelId: string = 'ch-1'): InboundMessage {
  return {
    id: 'msg-1',
    channelId,
    channelType: 'telegram',
    senderId: 'sender-1',
    senderName: 'Test User',
    text,
    metadata: {},
    timestamp: new Date(),
  }
}

function createChannelConfig(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    id: 'ch-1',
    type: 'telegram',
    name: 'Test Channel',
    status: 'connected',
    userId: 'user-1',
    credentials: {},
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('MessageRouter', () => {
  beforeEach(() => {
    // Clean up any registered rules
    unregisterRules('ch-1')
    unregisterRules('ch-2')
  })

  // ── Rule Registration ─────────────────────────────────────────────────

  describe('registerRules()', () => {
    it('should register rules for a channel', () => {
      const rules: RoutingRule[] = [
        { id: 'r1', pattern: 'hello', workflowId: 'wf-1' },
        { id: 'r2', pattern: '/start', workflowId: 'wf-2' },
      ]

      registerRules('ch-1', rules)

      const stored = getChannelRules('ch-1')
      expect(stored).toHaveLength(2)
    })

    it('should filter out disabled rules', () => {
      const rules: RoutingRule[] = [
        { id: 'r1', pattern: 'hello', workflowId: 'wf-1', enabled: true },
        { id: 'r2', pattern: 'bye', workflowId: 'wf-2', enabled: false },
      ]

      registerRules('ch-1', rules)

      const stored = getChannelRules('ch-1')
      expect(stored).toHaveLength(1)
      expect(stored[0].id).toBe('r1')
    })

    it('should sort rules by priority (highest first)', () => {
      const rules: RoutingRule[] = [
        { id: 'r1', pattern: 'low', workflowId: 'wf-1', priority: 1 },
        { id: 'r2', pattern: 'high', workflowId: 'wf-2', priority: 10 },
        { id: 'r3', pattern: 'mid', workflowId: 'wf-3', priority: 5 },
      ]

      registerRules('ch-1', rules)

      const stored = getChannelRules('ch-1')
      expect(stored[0].id).toBe('r2')
      expect(stored[1].id).toBe('r3')
      expect(stored[2].id).toBe('r1')
    })

    it('should treat undefined priority as 0', () => {
      const rules: RoutingRule[] = [
        { id: 'r1', pattern: 'no-priority', workflowId: 'wf-1' },
        { id: 'r2', pattern: 'has-priority', workflowId: 'wf-2', priority: 1 },
      ]

      registerRules('ch-1', rules)

      const stored = getChannelRules('ch-1')
      expect(stored[0].id).toBe('r2')
      expect(stored[1].id).toBe('r1')
    })

    it('should overwrite existing rules for the same channel', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'old', workflowId: 'wf-1' }])
      registerRules('ch-1', [{ id: 'r2', pattern: 'new', workflowId: 'wf-2' }])

      const stored = getChannelRules('ch-1')
      expect(stored).toHaveLength(1)
      expect(stored[0].id).toBe('r2')
    })
  })

  describe('unregisterRules()', () => {
    it('should remove all rules for a channel', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'hello', workflowId: 'wf-1' }])
      unregisterRules('ch-1')

      const stored = getChannelRules('ch-1')
      expect(stored).toHaveLength(0)
    })

    it('should not affect other channels', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'hello', workflowId: 'wf-1' }])
      registerRules('ch-2', [{ id: 'r2', pattern: 'world', workflowId: 'wf-2' }])

      unregisterRules('ch-1')

      expect(getChannelRules('ch-1')).toHaveLength(0)
      expect(getChannelRules('ch-2')).toHaveLength(1)
    })
  })

  describe('getChannelRules()', () => {
    it('should return empty array for channels with no rules', () => {
      expect(getChannelRules('ch-nonexistent')).toEqual([])
    })
  })

  // ── Exact Match ───────────────────────────────────────────────────────

  describe('exact match', () => {
    it('should match exact text (case-insensitive)', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'hello', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('Hello'), createChannelConfig())
      expect(result.matched).toBe(true)
      expect(result.workflowId).toBe('wf-1')
      expect(result.trigger).toBe('hello')
    })

    it('should match exact text regardless of case', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'HELLO', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('hello'), createChannelConfig())
      expect(result.matched).toBe(true)
    })

    it('should not match partial text', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'hello', workflowId: 'wf-1' }])

      const config = createChannelConfig({ settings: {} })
      const result = routeMessage(createMessage('hello world'), config)
      expect(result.matched).toBe(false)
    })

    it('should trim whitespace from message text before matching', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'hello', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('  hello  '), createChannelConfig())
      expect(result.matched).toBe(true)
    })

    it('should not return params for exact matches', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'hello', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('hello'), createChannelConfig())
      expect(result.params).toBeUndefined()
    })
  })

  // ── Command Match ─────────────────────────────────────────────────────

  describe('command match (/ prefix)', () => {
    it('should match a command exactly', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: '/start', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('/start'), createChannelConfig())
      expect(result.matched).toBe(true)
      expect(result.workflowId).toBe('wf-1')
    })

    it('should match a command with trailing arguments', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: '/start', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('/start some args here'), createChannelConfig())
      expect(result.matched).toBe(true)
      expect(result.params?.args).toBe('some args here')
    })

    it('should match commands case-insensitively', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: '/Start', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('/start'), createChannelConfig())
      expect(result.matched).toBe(true)
    })

    it('should not match a command that is a prefix of the text without space', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: '/start', workflowId: 'wf-1' }])

      const config = createChannelConfig({ settings: {} })
      const result = routeMessage(createMessage('/starting'), config)
      expect(result.matched).toBe(false)
    })

    it('should not return params when command has no arguments', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: '/start', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('/start'), createChannelConfig())
      expect(result.params).toBeUndefined()
    })
  })

  // ── Wildcard Match ────────────────────────────────────────────────────

  describe('wildcard match (* suffix)', () => {
    it('should match text starting with the prefix', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'order*', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('order123'), createChannelConfig())
      expect(result.matched).toBe(true)
      expect(result.workflowId).toBe('wf-1')
      expect(result.params?.match).toBe('123')
    })

    it('should match the prefix exactly (empty remainder)', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'order*', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('order'), createChannelConfig())
      expect(result.matched).toBe(true)
      expect(result.params).toBeUndefined()
    })

    it('should be case-insensitive', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'Order*', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('ORDER status'), createChannelConfig())
      expect(result.matched).toBe(true)
      expect(result.params?.match).toBe(' status')
    })

    it('should not match text that does not start with the prefix', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'order*', workflowId: 'wf-1' }])

      const config = createChannelConfig({ settings: {} })
      const result = routeMessage(createMessage('my order'), config)
      expect(result.matched).toBe(false)
    })
  })

  // ── Regex Match ───────────────────────────────────────────────────────

  describe('regex match (/pattern/flags)', () => {
    it('should match using a regex pattern', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: '/^hello\\s+world$/i', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('Hello  World'), createChannelConfig())
      expect(result.matched).toBe(true)
      expect(result.workflowId).toBe('wf-1')
    })

    it('should not match when regex does not match', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: '/^hello$/i', workflowId: 'wf-1' }])

      const config = createChannelConfig({ settings: {} })
      const result = routeMessage(createMessage('hello world'), config)
      expect(result.matched).toBe(false)
    })

    it('should extract named capture groups as params', () => {
      registerRules('ch-1', [
        { id: 'r1', pattern: '/^order (?<orderId>\\d+)$/i', workflowId: 'wf-1' },
      ])

      const result = routeMessage(createMessage('order 12345'), createChannelConfig())
      expect(result.matched).toBe(true)
      expect(result.params?.orderId).toBe('12345')
    })

    it('should not return params when there are no named groups', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: '/hello/i', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('hello'), createChannelConfig())
      expect(result.matched).toBe(true)
      expect(result.params).toBeUndefined()
    })

    it('should handle invalid regex patterns gracefully', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: '/[invalid/i', workflowId: 'wf-1' }])

      const config = createChannelConfig({ settings: {} })
      const result = routeMessage(createMessage('test'), config)
      expect(result.matched).toBe(false)
    })

    it('should support regex without flags', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: '/^test$/', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('test'), createChannelConfig())
      expect(result.matched).toBe(true)
    })

    it('should not match case-sensitively without i flag', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: '/^test$/', workflowId: 'wf-1' }])

      const config = createChannelConfig({ settings: {} })
      const result = routeMessage(createMessage('Test'), config)
      expect(result.matched).toBe(false)
    })
  })

  // ── Rule Priority ─────────────────────────────────────────────────────

  describe('rule priority', () => {
    it('should evaluate higher-priority rules first', () => {
      registerRules('ch-1', [
        { id: 'r1', pattern: 'hello*', workflowId: 'wf-low', priority: 1 },
        { id: 'r2', pattern: 'hello', workflowId: 'wf-high', priority: 10 },
      ])

      const result = routeMessage(createMessage('hello'), createChannelConfig())
      expect(result.workflowId).toBe('wf-high')
    })

    it('should stop at the first matching rule', () => {
      registerRules('ch-1', [
        { id: 'r1', pattern: '/.*/', workflowId: 'wf-catch-all', priority: 1 },
        { id: 'r2', pattern: 'hello', workflowId: 'wf-specific', priority: 10 },
      ])

      const result = routeMessage(createMessage('hello'), createChannelConfig())
      expect(result.workflowId).toBe('wf-specific')
    })

    it('should fall through to lower priority rules when higher ones do not match', () => {
      registerRules('ch-1', [
        { id: 'r1', pattern: '/.*/', workflowId: 'wf-catch-all', priority: 1 },
        { id: 'r2', pattern: '/^specific$/', workflowId: 'wf-specific', priority: 10 },
      ])

      const result = routeMessage(createMessage('not specific'), createChannelConfig())
      expect(result.workflowId).toBe('wf-catch-all')
    })
  })

  // ── Fallback Routing ──────────────────────────────────────────────────

  describe('fallback routing', () => {
    it('should fall back to channel default triggerWorkflowId when no rules match', () => {
      // No rules registered
      const config = createChannelConfig({
        settings: { triggerWorkflowId: 'wf-default' },
      })

      const result = routeMessage(createMessage('anything'), config)
      expect(result.matched).toBe(true)
      expect(result.workflowId).toBe('wf-default')
      expect(result.trigger).toBe('default')
    })

    it('should return unmatched when no rules match and no default workflow', () => {
      const config = createChannelConfig({
        settings: {},
      })

      const result = routeMessage(createMessage('anything'), config)
      expect(result.matched).toBe(false)
      expect(result.workflowId).toBeUndefined()
    })

    it('should prefer routing rules over default workflow', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'hello', workflowId: 'wf-rule' }])

      const config = createChannelConfig({
        settings: { triggerWorkflowId: 'wf-default' },
      })

      const result = routeMessage(createMessage('hello'), config)
      expect(result.workflowId).toBe('wf-rule')
    })

    it('should use default workflow when rules exist but none match', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'hello', workflowId: 'wf-rule' }])

      const config = createChannelConfig({
        settings: { triggerWorkflowId: 'wf-default' },
      })

      const result = routeMessage(createMessage('goodbye'), config)
      expect(result.workflowId).toBe('wf-default')
      expect(result.trigger).toBe('default')
    })
  })

  // ── Channel Isolation ─────────────────────────────────────────────────

  describe('channel isolation', () => {
    it('should only match rules registered for the message channel', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'hello', workflowId: 'wf-ch1' }])
      registerRules('ch-2', [{ id: 'r2', pattern: 'hello', workflowId: 'wf-ch2' }])

      const config = createChannelConfig({ id: 'ch-1', settings: {} })
      const result = routeMessage(createMessage('hello', 'ch-1'), config)
      expect(result.workflowId).toBe('wf-ch1')
    })

    it('should not leak rules across channels', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'secret', workflowId: 'wf-1' }])

      const config = createChannelConfig({ id: 'ch-2', settings: {} })
      const result = routeMessage(createMessage('secret', 'ch-2'), config)
      expect(result.matched).toBe(false)
    })
  })

  // ── Edge Cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty message text', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'hello', workflowId: 'wf-1' }])

      const config = createChannelConfig({ settings: {} })
      const result = routeMessage(createMessage(''), config)
      expect(result.matched).toBe(false)
    })

    it('should handle whitespace-only message text', () => {
      registerRules('ch-1', [{ id: 'r1', pattern: 'hello', workflowId: 'wf-1' }])

      const config = createChannelConfig({ settings: {} })
      const result = routeMessage(createMessage('   '), config)
      expect(result.matched).toBe(false)
    })

    it('should handle a pattern that looks like regex but is a command (// prefix)', () => {
      // Patterns starting with // should be treated as command prefix, not regex
      registerRules('ch-1', [{ id: 'r1', pattern: '//comment', workflowId: 'wf-1' }])

      const result = routeMessage(createMessage('//comment'), createChannelConfig())
      expect(result.matched).toBe(true)
    })

    it('should handle empty rules array', () => {
      registerRules('ch-1', [])

      const config = createChannelConfig({ settings: {} })
      const result = routeMessage(createMessage('hello'), config)
      expect(result.matched).toBe(false)
    })
  })
})
