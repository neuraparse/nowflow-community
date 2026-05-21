import { describe, expect, it, vi } from 'vitest'
import { JSONProcessorBlock } from '../json_processor'

vi.mock('@/components/icons', () => ({ CodeIcon: () => null }))

describe('JSONProcessorBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(JSONProcessorBlock.type).toBe('json_processor')
    expect(JSONProcessorBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(JSONProcessorBlock.isUtility).toBe(true)
    expect(JSONProcessorBlock.category).toBe('blocks')
  })

  it('exposes json_processor tool access (passthrough)', () => {
    expect(JSONProcessorBlock.tools.access).toContain('json_processor')
    expect(JSONProcessorBlock.tools.config!.tool({})).toBe('json_processor')
  })

  it('subBlocks include input, operation and output format', () => {
    const ids = JSONProcessorBlock.subBlocks.map((s) => s.id)
    expect(ids).toEqual(expect.arrayContaining(['inputData', 'operation', 'outputFormat']))
  })

  it('params transformer is identity', () => {
    const params = JSONProcessorBlock.tools.config!.params!
    const input = { operation: 'minify', inputData: '{}' }
    expect(params(input)).toBe(input)
  })

  it('operation dropdown has at least 10 supported ops', () => {
    const op = JSONProcessorBlock.subBlocks.find((s) => s.id === 'operation') as any
    expect(op.options.length).toBeGreaterThanOrEqual(10)
  })
})
