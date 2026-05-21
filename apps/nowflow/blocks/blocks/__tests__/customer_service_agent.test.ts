import { describe, expect, it, vi } from 'vitest'
import { CustomerServiceAgentBlock } from '../customer_service_agent'

vi.mock('@/components/icons', () => ({ HeadphonesIcon: () => null }))
vi.mock('@/lib/ai/provider-config', () => ({ getDefaultModel: () => 'gpt-4o' }))
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/providers/utils', () => ({
  getAllModelProviders: () => ({ 'gpt-4o': 'openai_chat' }),
}))

describe('CustomerServiceAgentBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(CustomerServiceAgentBlock).toBeDefined()
    expect(CustomerServiceAgentBlock.type).toBe('customer_service_agent')
    expect(CustomerServiceAgentBlock.category).toBe('agents')
    expect(CustomerServiceAgentBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
  })

  it('has expected tool access for support tools', () => {
    expect(CustomerServiceAgentBlock.tools.access).toEqual(
      expect.arrayContaining(['hubspot_contacts', 'salesforce_opportunities', 'slack_message'])
    )
  })

  it('tool() resolves provider via getAllModelProviders', () => {
    const tool = CustomerServiceAgentBlock.tools.config!.tool
    expect(tool({ model: 'gpt-4o' })).toBe('openai_chat')
  })

  it('tool() throws if model is unsupported', () => {
    const tool = CustomerServiceAgentBlock.tools.config!.tool
    expect(() => tool({ model: 'no-such-model' })).toThrow(/Invalid model/)
  })

  describe('params transformer', () => {
    const params = CustomerServiceAgentBlock.tools.config!.params!

    it('maps customerMessage into context', () => {
      const result = params({ customerMessage: 'help me' })
      expect(result.context).toBe('help me')
    })

    it('parses string escalationRules into object', () => {
      const result = params({
        customerMessage: 'm',
        escalationRules: '{"keywords":["refund"]}',
      })
      expect(result.escalationRules).toEqual({ keywords: ['refund'] })
    })

    it('builds enhanced system prompt with agent type rules', () => {
      const result = params({ customerMessage: 'm', agentType: 'chatbot' })
      expect(result.systemPrompt).toMatch(/CHATBOT MODE/)
    })

    it('filters tools with usageControl=none', () => {
      const result = params({
        customerMessage: 'm',
        tools: [
          { type: 't', operation: 'op1', title: 'A', usageControl: 'auto' },
          { type: 't', operation: 'op2', title: 'B', usageControl: 'none' },
        ],
      })
      expect(result.tools).toHaveLength(1)
      expect(result.tools[0].id).toBe('op1')
    })
  })
})
