import { describe, expect, it } from 'vitest'
import { EvaluatorBlock } from '../evaluator'

describe('EvaluatorBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(EvaluatorBlock).toBeDefined()
    expect(typeof EvaluatorBlock).toBe('object')
    expect(typeof EvaluatorBlock.type).toBe('string')
    expect(typeof EvaluatorBlock.name).toBe('string')
    expect(typeof EvaluatorBlock.description).toBe('string')
    expect(typeof EvaluatorBlock.category).toBe('string')
    expect(typeof EvaluatorBlock.bgColor).toBe('string')
    expect(EvaluatorBlock.icon).toBeDefined()
    expect(Array.isArray(EvaluatorBlock.subBlocks)).toBe(true)
    expect(EvaluatorBlock.tools).toBeDefined()
  })

  it('has type matching filename (evaluator)', () => {
    expect(EvaluatorBlock.type).toBe('evaluator')
  })

  it('has subBlocks with at minimum id and type per item', () => {
    expect(EvaluatorBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of EvaluatorBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(EvaluatorBlock.tools.access)).toBe(true)
    if (EvaluatorBlock.tools.config) {
      expect(typeof EvaluatorBlock.tools.config.tool).toBe('function')
    }
  })
})
