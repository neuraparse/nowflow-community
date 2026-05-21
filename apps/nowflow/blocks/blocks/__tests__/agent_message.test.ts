import { describe, expect, it, vi } from 'vitest'
import { AgentMessageBlock } from '../agent_message'

vi.mock('@/components/icons', () => ({ ChatBubbleLeftRightIcon: () => null }))

describe('AgentMessageBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(AgentMessageBlock).toBeDefined()
    expect(typeof AgentMessageBlock.type).toBe('string')
    expect(AgentMessageBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(AgentMessageBlock.subBlocks)).toBe(true)
  })

  it('has type agent_message', () => {
    expect(AgentMessageBlock.type).toBe('agent_message')
  })

  it('has agents category', () => {
    expect(AgentMessageBlock.category).toBe('agents')
  })

  it('exposes agent_message tool access', () => {
    expect(AgentMessageBlock.tools.access).toContain('agent_message')
    expect(AgentMessageBlock.tools.config!.tool({})).toBe('agent_message')
  })

  describe('params transformer', () => {
    const params = AgentMessageBlock.tools.config!.params!

    it('applies sensible defaults when minimal input provided', () => {
      const result = params({ content: 'hi' })
      expect(result.messageType).toBe('request')
      expect(result.contentType).toBe('text')
      expect(result.priority).toBe('normal')
      expect(result.waitForResponse).toBe(false)
      expect(result.timeout).toBe(30)
      expect(result.metadata).toEqual({})
    })

    it('parses metadata JSON when provided', () => {
      const result = params({
        content: 'task',
        metadata: '{"correlationId":"c1","tags":["a"]}',
      })
      expect(result.metadata).toEqual({ correlationId: 'c1', tags: ['a'] })
    })

    it('coerces timeout from string to integer', () => {
      const result = params({ content: 'x', timeout: '120' })
      expect(result.timeout).toBe(120)
    })

    it('passes through targetAgent and channel verbatim', () => {
      const result = params({
        content: 'x',
        messageType: 'request',
        targetAgent: 'agent-1',
        channel: 'general',
      })
      expect(result.targetAgent).toBe('agent-1')
      expect(result.channel).toBe('general')
    })

    it('respects explicit waitForResponse=true', () => {
      const result = params({ content: 'x', waitForResponse: true })
      expect(result.waitForResponse).toBe(true)
    })

    it('throws on malformed metadata JSON', () => {
      expect(() => params({ content: 'x', metadata: '{not-json' })).toThrow()
    })
  })
})
