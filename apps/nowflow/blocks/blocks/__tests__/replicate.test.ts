import { describe, expect, it, vi } from 'vitest'
import { ReplicateBlock } from '../replicate'

vi.mock('@/components/icons', () => ({ ReplicateIcon: () => null }))

describe('ReplicateBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(ReplicateBlock.type).toBe('replicate')
    expect(ReplicateBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(ReplicateBlock.subBlocks)).toBe(true)
  })

  it('exposes replicate_api tool access', () => {
    expect(ReplicateBlock.tools.access).toContain('replicate_api')
    expect(ReplicateBlock.tools.config!.tool({})).toBe('replicate_api')
  })

  it('subBlocks include credential, operation, model fields', () => {
    const ids = ReplicateBlock.subBlocks.map((s) => s.id)
    expect(ids).toEqual(expect.arrayContaining(['credential', 'operation', 'model']))
  })

  describe('params transformer', () => {
    const params = ReplicateBlock.tools.config!.params!

    it('parses input JSON string into object', () => {
      const result = params({
        credential: 'tok',
        operation: 'run_prediction',
        model: 'a/b',
        input: '{"prompt":"hi"}',
      })
      expect(result.input).toEqual({ prompt: 'hi' })
    })

    it('passes through non-json fields unchanged', () => {
      const result = params({
        credential: 'tok',
        operation: 'get_prediction',
        predictionId: 'pid',
      })
      expect(result.predictionId).toBe('pid')
    })
  })
})
