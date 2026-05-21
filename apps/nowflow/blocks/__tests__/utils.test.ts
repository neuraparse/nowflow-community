import { describe, expect, it } from 'vitest'
import type { SubBlockState } from '@/stores/workflows/workflow/types'
import type { OutputConfig } from '@/blocks/types'
import { resolveOutputType } from '@/blocks/utils'

const makeSubBlock = (
  id: string,
  value: SubBlockState['value'],
  type: SubBlockState['type'] = 'short-input'
): SubBlockState => ({ id, type, value })

describe('resolveOutputType', () => {
  describe('outputs without dependencies', () => {
    it('returns primitive types directly when no dependsOn is configured', () => {
      const outputs: Record<string, OutputConfig> = {
        response: { type: 'string' },
        count: { type: 'number' },
        ok: { type: 'boolean' },
      }

      const result = resolveOutputType(outputs, {})

      expect(result).toEqual({
        response: 'string',
        count: 'number',
        ok: 'boolean',
      })
    })

    it('returns object/json types directly when no dependsOn is configured', () => {
      const outputs: Record<string, OutputConfig> = {
        data: { type: { nested: 'string', items: 'json' } },
      }

      const result = resolveOutputType(outputs, {})

      expect(result).toEqual({
        data: { nested: 'string', items: 'json' },
      })
    })

    it('returns an empty object when given an empty outputs map', () => {
      expect(resolveOutputType({}, {})).toEqual({})
    })
  })

  describe('outputs with dependsOn conditions', () => {
    const outputs: Record<string, OutputConfig> = {
      response: {
        type: 'string',
        dependsOn: {
          subBlockId: 'schema',
          condition: {
            whenEmpty: 'string',
            whenFilled: 'json',
          },
        },
      },
    }

    it('uses whenEmpty when dependent subBlock is missing entirely', () => {
      const result = resolveOutputType(outputs, {})
      expect(result.response).toBe('string')
    })

    it('uses whenEmpty when dependent subBlock value is null', () => {
      const subBlocks = { schema: makeSubBlock('schema', null) }
      expect(resolveOutputType(outputs, subBlocks).response).toBe('string')
    })

    it('uses whenEmpty when dependent subBlock value is an empty string', () => {
      const subBlocks = { schema: makeSubBlock('schema', '') }
      expect(resolveOutputType(outputs, subBlocks).response).toBe('string')
    })

    it('uses whenEmpty when dependent subBlock value is whitespace-only', () => {
      const subBlocks = { schema: makeSubBlock('schema', '   \n\t') }
      expect(resolveOutputType(outputs, subBlocks).response).toBe('string')
    })

    it('uses whenEmpty when dependent subBlock value is an empty array', () => {
      const subBlocks = { schema: makeSubBlock('schema', [] as unknown as string[][]) }
      expect(resolveOutputType(outputs, subBlocks).response).toBe('string')
    })

    it('uses whenFilled when dependent subBlock has a non-empty string', () => {
      const subBlocks = { schema: makeSubBlock('schema', '{"foo":"bar"}') }
      expect(resolveOutputType(outputs, subBlocks).response).toBe('json')
    })

    it('treats numeric zero as a filled (non-empty) value', () => {
      const subBlocks = { schema: makeSubBlock('schema', 0) }
      expect(resolveOutputType(outputs, subBlocks).response).toBe('json')
    })

    it('treats any number as a filled value', () => {
      const subBlocks = { schema: makeSubBlock('schema', 42) }
      expect(resolveOutputType(outputs, subBlocks).response).toBe('json')
    })

    it('uses whenFilled when array has non-empty non-code-editor content', () => {
      const subBlocks = {
        schema: makeSubBlock('schema', [
          ['col1', 'col2'],
          ['val1', 'val2'],
        ]),
      }
      expect(resolveOutputType(outputs, subBlocks).response).toBe('json')
    })
  })

  describe('code-editor array values', () => {
    const outputs: Record<string, OutputConfig> = {
      response: {
        type: 'string',
        dependsOn: {
          subBlockId: 'code',
          condition: {
            whenEmpty: 'string',
            whenFilled: 'json',
          },
        },
      },
    }

    it('treats a code editor value with only blank lines as empty', () => {
      const codeLines = [
        { id: '1', content: '' },
        { id: '2', content: '   ' },
      ] as unknown as string[][]
      const subBlocks = { code: makeSubBlock('code', codeLines, 'code') }
      expect(resolveOutputType(outputs, subBlocks).response).toBe('string')
    })

    it('treats a code editor value with any non-blank line as filled', () => {
      const codeLines = [
        { id: '1', content: '' },
        { id: '2', content: 'return 42' },
      ] as unknown as string[][]
      const subBlocks = { code: makeSubBlock('code', codeLines, 'code') }
      expect(resolveOutputType(outputs, subBlocks).response).toBe('json')
    })

    it('treats a single-line code editor array as filled when content exists', () => {
      const codeLines = [{ id: '1', content: 'x' }] as unknown as string[][]
      const subBlocks = { code: makeSubBlock('code', codeLines, 'code') }
      expect(resolveOutputType(outputs, subBlocks).response).toBe('json')
    })
  })

  describe('mixed outputs', () => {
    it('resolves dependent and non-dependent outputs together', () => {
      const outputs: Record<string, OutputConfig> = {
        raw: { type: 'string' },
        response: {
          type: 'string',
          dependsOn: {
            subBlockId: 'schema',
            condition: {
              whenEmpty: 'string',
              whenFilled: 'json',
            },
          },
        },
      }

      const subBlocks = { schema: makeSubBlock('schema', '{"a":1}') }
      const result = resolveOutputType(outputs, subBlocks)

      expect(result).toEqual({
        raw: 'string',
        response: 'json',
      })
    })
  })
})
