import { describe, expect, it, vi } from 'vitest'
import { FunctionCallingAgentBlock } from '../function_calling_agent'

vi.mock('@/components/icons', () => ({ CodeIcon: () => null }))
vi.mock('@/lib/ai/provider-config', () => ({ getDefaultModel: () => 'gpt-4o' }))
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/providers/utils', () => ({
  getAllModelProviders: () => ({ 'gpt-4o': 'openai_chat' }),
}))

describe('FunctionCallingAgentBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(FunctionCallingAgentBlock.type).toBe('function_calling_agent')
    expect(FunctionCallingAgentBlock.category).toBe('agents')
  })

  it('access includes function_execute and json_processor', () => {
    expect(FunctionCallingAgentBlock.tools.access).toEqual(
      expect.arrayContaining(['function_execute', 'json_processor'])
    )
  })

  it('tool() resolves model provider', () => {
    expect(FunctionCallingAgentBlock.tools.config!.tool({ model: 'gpt-4o' })).toBe('openai_chat')
  })

  it('tool() throws when no model', () => {
    expect(() => FunctionCallingAgentBlock.tools.config!.tool({ model: 'unknown' })).toThrow()
  })

  describe('params transformer', () => {
    const params = FunctionCallingAgentBlock.tools.config!.params!

    it('parses JSON-string functions array', () => {
      const result = params({
        userInput: 'q',
        functions: '[{"name":"a","description":"x"}]',
      })
      expect(result.functions).toEqual([{ name: 'a', description: 'x' }])
    })

    it('defaults maxFunctionCalls to 5 and parallelExecution to false', () => {
      const result = params({ userInput: 'q' })
      expect(result.maxFunctionCalls).toBe(5)
      expect(result.parallelExecution).toBe(false)
    })

    it('coerces maxFunctionCalls to integer', () => {
      const result = params({ userInput: 'q', maxFunctionCalls: '7' })
      expect(result.maxFunctionCalls).toBe(7)
    })

    it('maps userInput into context', () => {
      const result = params({ userInput: 'tell me about X' })
      expect(result.context).toBe('tell me about X')
    })
  })
})
