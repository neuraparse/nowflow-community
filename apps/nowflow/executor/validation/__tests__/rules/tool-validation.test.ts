import { describe, expect, it } from 'vitest'
import { validateResponseFormat, validateToolInputs } from '../../rules/tool-validation'

describe('tool-validation', () => {
  describe('validateToolInputs', () => {
    it('should return empty result when tools is missing', () => {
      const r = validateToolInputs(undefined, 'agent')
      expect(r.errors).toEqual([])
      expect(r.warnings).toEqual([])
    })

    it('should return empty result when tools is not an array', () => {
      const r = validateToolInputs({ not: 'an array' } as any, 'agent')
      expect(r.errors).toEqual([])
      expect(r.warnings).toEqual([])
    })

    it('should return empty result when tools is an empty array', () => {
      const r = validateToolInputs([], 'agent')
      expect(r.errors).toEqual([])
      expect(r.warnings).toEqual([])
    })

    it('should error for non-object tool entries', () => {
      const r = validateToolInputs([null, 'string', 42] as any, 'agent')
      expect(r.errors).toHaveLength(3)
      expect(r.errors.every((e) => e.field.startsWith('tools['))).toBe(true)
    })

    it('should error when a tool is missing "type"', () => {
      const r = validateToolInputs([{ title: 'No type here' }], 'agent')
      expect(r.errors.some((e) => e.field === 'tools[0].type')).toBe(true)
    })

    it('should pass for a well-formed built-in tool', () => {
      const r = validateToolInputs(
        [{ type: 'gmail', title: 'Gmail', usageControl: 'auto' }],
        'agent'
      )
      expect(r.errors).toHaveLength(0)
      expect(r.warnings).toHaveLength(0)
    })

    it('should warn on invalid usageControl value', () => {
      const r = validateToolInputs(
        [{ type: 'gmail', title: 'Gmail', usageControl: 'maybe' }],
        'agent'
      )
      expect(r.warnings.some((w) => w.field === 'tools[0].usageControl')).toBe(true)
    })

    it('should accept all valid usageControl values', () => {
      for (const usageControl of ['auto', 'required', 'none']) {
        const r = validateToolInputs([{ type: 'gmail', title: 'Gmail', usageControl }], 'agent')
        expect(r.warnings).toHaveLength(0)
      }
    })

    describe('custom-tool specifics', () => {
      it('should error when custom tool has no schema', () => {
        const r = validateToolInputs([{ type: 'custom-tool', title: 'Mine' }], 'agent')
        expect(r.errors.some((e) => e.field === 'tools[0].schema')).toBe(true)
      })

      it('should error when custom tool schema has no function field', () => {
        const r = validateToolInputs([{ type: 'custom-tool', title: 'Mine', schema: {} }], 'agent')
        expect(r.errors.some((e) => e.field === 'tools[0].schema.function')).toBe(true)
      })

      it('should error when function.name is missing', () => {
        const r = validateToolInputs(
          [
            {
              type: 'custom-tool',
              title: 'Mine',
              schema: {
                function: {
                  parameters: { type: 'object', properties: {} },
                },
              },
            },
          ],
          'agent'
        )
        expect(r.errors.some((e) => e.field === 'tools[0].schema.function.name')).toBe(true)
      })

      it('should error when function.parameters is missing', () => {
        const r = validateToolInputs(
          [
            {
              type: 'custom-tool',
              title: 'Mine',
              schema: {
                function: { name: 'do_thing' },
              },
            },
          ],
          'agent'
        )
        expect(r.errors.some((e) => e.field === 'tools[0].schema.function.parameters')).toBe(true)
      })

      it('should warn when parameters.type is not "object"', () => {
        const r = validateToolInputs(
          [
            {
              type: 'custom-tool',
              title: 'Mine',
              schema: {
                function: {
                  name: 'do_thing',
                  parameters: { type: 'array', properties: {} },
                },
              },
            },
          ],
          'agent'
        )
        expect(r.warnings.some((w) => w.field === 'tools[0].schema.function.parameters.type')).toBe(
          true
        )
      })

      it('should warn when parameters.properties is missing', () => {
        const r = validateToolInputs(
          [
            {
              type: 'custom-tool',
              title: 'Mine',
              schema: {
                function: {
                  name: 'do_thing',
                  parameters: { type: 'object' },
                },
              },
            },
          ],
          'agent'
        )
        expect(
          r.warnings.some((w) => w.field === 'tools[0].schema.function.parameters.properties')
        ).toBe(true)
      })

      it('should warn when tool has empty code string', () => {
        const r = validateToolInputs(
          [
            {
              type: 'custom-tool',
              title: 'Mine',
              code: '   ',
              schema: {
                function: {
                  name: 'do_thing',
                  parameters: { type: 'object', properties: {} },
                },
              },
            },
          ],
          'agent'
        )
        expect(r.warnings.some((w) => w.field === 'tools[0].code')).toBe(true)
      })

      it('should pass for a fully-specified custom tool', () => {
        const r = validateToolInputs(
          [
            {
              type: 'custom-tool',
              title: 'Mine',
              code: 'return args.x',
              schema: {
                function: {
                  name: 'do_thing',
                  description: 'Does a thing',
                  parameters: {
                    type: 'object',
                    properties: { x: { type: 'number' } },
                    required: ['x'],
                  },
                },
              },
            },
          ],
          'agent'
        )
        expect(r.errors).toHaveLength(0)
        expect(r.warnings).toHaveLength(0)
      })
    })

    it('should validate multiple tools independently and accumulate issues', () => {
      const r = validateToolInputs(
        [
          { type: 'gmail', title: 'ok', usageControl: 'auto' },
          { type: 'custom-tool', title: 'broken' }, // missing schema
          { title: 'no-type' }, // missing type
        ],
        'agent'
      )
      expect(r.errors.some((e) => e.field === 'tools[1].schema')).toBe(true)
      expect(r.errors.some((e) => e.field === 'tools[2].type')).toBe(true)
    })
  })

  describe('validateResponseFormat', () => {
    it('should return empty result when responseFormat is null/undefined', () => {
      expect(validateResponseFormat(undefined)).toEqual({
        errors: [],
        warnings: [],
      })
      expect(validateResponseFormat(null)).toEqual({ errors: [], warnings: [] })
    })

    it('should return empty result when responseFormat is an empty/blank string', () => {
      expect(validateResponseFormat('')).toEqual({ errors: [], warnings: [] })
      expect(validateResponseFormat('   \n ')).toEqual({
        errors: [],
        warnings: [],
      })
    })

    it('should error on invalid JSON string', () => {
      const r = validateResponseFormat('{invalid json')
      expect(r.errors.some((e) => e.field === 'responseFormat')).toBe(true)
    })

    it('should error when parsed value is not an object', () => {
      const r = validateResponseFormat('42')
      expect(r.errors.some((e) => e.field === 'responseFormat')).toBe(true)
    })

    it('should warn when root type is not "object"', () => {
      const r = validateResponseFormat({ type: 'array', items: {} })
      expect(r.warnings.some((w) => w.field === 'responseFormat')).toBe(true)
    })

    it('should warn when type is "object" but no properties defined', () => {
      const r = validateResponseFormat({ type: 'object' })
      expect(r.warnings.some((w) => w.field === 'responseFormat')).toBe(true)
    })

    it('should accept a nested schema wrapper (parsed.schema)', () => {
      const r = validateResponseFormat({
        schema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      })
      expect(r.errors).toHaveLength(0)
      expect(r.warnings).toHaveLength(0)
    })

    it('should pass for a well-formed JSON schema object', () => {
      const r = validateResponseFormat({
        type: 'object',
        properties: { answer: { type: 'string' } },
        required: ['answer'],
      })
      expect(r.errors).toHaveLength(0)
      expect(r.warnings).toHaveLength(0)
    })

    it('should pass for a well-formed JSON schema passed as a string', () => {
      const r = validateResponseFormat(
        JSON.stringify({
          type: 'object',
          properties: { answer: { type: 'string' } },
        })
      )
      expect(r.errors).toHaveLength(0)
      expect(r.warnings).toHaveLength(0)
    })
  })
})
