import { describe, expect, it, vi } from 'vitest'
import { ReasoningAgentBlock } from '../reasoning_agent'

vi.mock('@/components/icons', () => ({ BrightIcon: () => null }))
vi.mock('@/lib/ai/provider-config', () => ({ getDefaultModel: () => 'gpt-4o' }))
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/providers/utils', () => ({
  getAllModelProviders: () => ({ 'gpt-4o': 'openai_chat' }),
}))

describe('ReasoningAgentBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(ReasoningAgentBlock.type).toBe('reasoning_agent')
    expect(ReasoningAgentBlock.category).toBe('agents')
  })

  it('access list includes major chat tools', () => {
    expect(ReasoningAgentBlock.tools.access).toEqual(
      expect.arrayContaining(['openai_chat', 'anthropic_chat'])
    )
  })

  describe('params transformer', () => {
    const params = ReasoningAgentBlock.tools.config!.params!

    it('defaults to chain_of_thought when no framework provided', () => {
      const result = params({ problem: 'p' })
      expect(result.reasoningFramework).toBe('chain_of_thought')
      expect(result.systemPrompt).toMatch(/Chain-of-Thought reasoning/)
    })

    it('emits framework-specific instruction for ReAct', () => {
      const result = params({ problem: 'p', reasoningFramework: 'react' })
      expect(result.systemPrompt).toMatch(/ReAct framework/)
    })

    it('coerces maxSteps to integer with default 10', () => {
      expect(params({ problem: 'p' }).maxSteps).toBe(10)
      expect(params({ problem: 'p', maxSteps: '15' }).maxSteps).toBe(15)
    })

    it('only forwards tools when reasoningFramework is react', () => {
      const tools = [{ usageControl: 'auto', name: 'a' }]
      const cot = params({ problem: 'p', reasoningFramework: 'chain_of_thought', tools })
      const react = params({ problem: 'p', reasoningFramework: 'react', tools })
      expect(cot.tools).toBeUndefined()
      expect(react.tools).toEqual(tools)
    })

    it('maps problem into context', () => {
      const result = params({ problem: 'solve this' })
      expect(result.context).toBe('solve this')
    })
  })
})
