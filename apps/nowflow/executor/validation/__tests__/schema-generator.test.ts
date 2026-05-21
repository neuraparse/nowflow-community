import { describe, expect, it } from 'vitest'
import type { BlockConfig } from '@/blocks/types'
import { generateBlockSchema } from '../schema-generator'

// Minimal mock icon
const MockIcon = () => null

/**
 * Creates a minimal BlockConfig for testing.
 */
function createMockBlockConfig(overrides: Partial<BlockConfig> = {}): BlockConfig {
  return {
    type: 'test_block',
    name: 'Test Block',
    description: 'A test block',
    category: 'blocks',
    bgColor: '#000',
    icon: MockIcon as any,
    subBlocks: [],
    tools: { access: [] },
    inputs: {},
    outputs: { response: { type: 'json' } },
    ...overrides,
  } as BlockConfig
}

describe('generateBlockSchema', () => {
  describe('basic type mapping', () => {
    it('should validate required string fields', () => {
      const config = createMockBlockConfig({
        inputs: {
          name: { type: 'string', required: true },
        },
      })

      const schema = generateBlockSchema(config)

      // Valid input
      expect(schema.safeParse({ name: 'hello' }).success).toBe(true)

      // Empty string should fail (required)
      expect(schema.safeParse({ name: '' }).success).toBe(false)

      // Missing field should fail
      expect(schema.safeParse({}).success).toBe(false)
    })

    it('should validate optional string fields', () => {
      const config = createMockBlockConfig({
        inputs: {
          description: { type: 'string', required: false },
        },
      })

      const schema = generateBlockSchema(config)

      expect(schema.safeParse({ description: 'hello' }).success).toBe(true)
      expect(schema.safeParse({ description: '' }).success).toBe(true)
      expect(schema.safeParse({ description: undefined }).success).toBe(true)
      expect(schema.safeParse({}).success).toBe(true)
    })

    it('should validate required number fields', () => {
      const config = createMockBlockConfig({
        inputs: {
          count: { type: 'number', required: true },
        },
      })

      const schema = generateBlockSchema(config)

      expect(schema.safeParse({ count: 42 }).success).toBe(true)
      expect(schema.safeParse({ count: 0 }).success).toBe(true)
      expect(schema.safeParse({ count: 'not a number' }).success).toBe(false)
    })

    it('should validate boolean fields', () => {
      const config = createMockBlockConfig({
        inputs: {
          enabled: { type: 'boolean', required: true },
        },
      })

      const schema = generateBlockSchema(config)

      expect(schema.safeParse({ enabled: true }).success).toBe(true)
      expect(schema.safeParse({ enabled: false }).success).toBe(true)
      expect(schema.safeParse({ enabled: 'true' }).success).toBe(false)
    })

    it('should validate json fields (string, object, or array)', () => {
      const config = createMockBlockConfig({
        inputs: {
          data: { type: 'json', required: true },
        },
      })

      const schema = generateBlockSchema(config)

      expect(schema.safeParse({ data: '{"key": "value"}' }).success).toBe(true)
      expect(schema.safeParse({ data: { key: 'value' } }).success).toBe(true)
      expect(schema.safeParse({ data: [1, 2, 3] }).success).toBe(true)
    })
  })

  describe('sub-block constraints', () => {
    it('should apply slider min/max constraints', () => {
      const config = createMockBlockConfig({
        inputs: {
          temperature: { type: 'number', required: false },
        },
        subBlocks: [
          {
            id: 'temperature',
            type: 'slider',
            min: 0,
            max: 2,
          },
        ],
      })

      const schema = generateBlockSchema(config)

      expect(schema.safeParse({ temperature: 0.5 }).success).toBe(true)
      expect(schema.safeParse({ temperature: 0 }).success).toBe(true)
      expect(schema.safeParse({ temperature: 2 }).success).toBe(true)

      // Out of range should fail
      const outOfRange = schema.safeParse({ temperature: 3 })
      expect(outOfRange.success).toBe(false)
    })

    it('should apply dropdown enum validation for static options', () => {
      const config = createMockBlockConfig({
        inputs: {
          framework: { type: 'string', required: true },
        },
        subBlocks: [
          {
            id: 'framework',
            type: 'dropdown',
            options: [
              { label: 'Chain of Thought', id: 'cot' },
              { label: 'ReAct', id: 'react' },
            ],
          },
        ],
      })

      const schema = generateBlockSchema(config)

      expect(schema.safeParse({ framework: 'cot' }).success).toBe(true)
      expect(schema.safeParse({ framework: 'react' }).success).toBe(true)
      expect(schema.safeParse({ framework: 'invalid' }).success).toBe(false)
    })

    it('should allow any string for dynamic dropdown options', () => {
      const config = createMockBlockConfig({
        inputs: {
          model: { type: 'string', required: true },
        },
        subBlocks: [
          {
            id: 'model',
            type: 'dropdown',
            options: () => ['gpt-4o', 'claude-3'],
          },
        ],
      })

      const schema = generateBlockSchema(config)

      // Dynamic options should accept any string
      expect(schema.safeParse({ model: 'gpt-4o' }).success).toBe(true)
      expect(schema.safeParse({ model: 'some-custom-model' }).success).toBe(true)
    })
  })

  describe('validation rules', () => {
    it('should apply pattern validation', () => {
      const config = createMockBlockConfig({
        inputs: {
          email: { type: 'string', required: true },
        },
        subBlocks: [
          {
            id: 'email',
            type: 'short-input',
            validation: {
              pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            },
          },
        ],
      })

      const schema = generateBlockSchema(config)

      expect(schema.safeParse({ email: 'test@example.com' }).success).toBe(true)
      expect(schema.safeParse({ email: 'not-an-email' }).success).toBe(false)
    })

    it('should apply minLength/maxLength validation', () => {
      const config = createMockBlockConfig({
        inputs: {
          prompt: { type: 'string', required: true },
        },
        subBlocks: [
          {
            id: 'prompt',
            type: 'long-input',
            validation: {
              minLength: 5,
              maxLength: 1000,
            },
          },
        ],
      })

      const schema = generateBlockSchema(config)

      expect(schema.safeParse({ prompt: 'Hello World' }).success).toBe(true)
      expect(schema.safeParse({ prompt: 'Hi' }).success).toBe(false)
    })

    it('should apply custom validation', () => {
      const config = createMockBlockConfig({
        inputs: {
          value: { type: 'string', required: true },
        },
        subBlocks: [
          {
            id: 'value',
            type: 'short-input',
            validation: {
              custom: (val: any) => {
                if (String(val).startsWith('$')) return true
                return 'Value must start with $'
              },
            },
          },
        ],
      })

      const schema = generateBlockSchema(config)

      expect(schema.safeParse({ value: '$API_KEY' }).success).toBe(true)
      expect(schema.safeParse({ value: 'plain' }).success).toBe(false)
    })
  })

  describe('passthrough behavior', () => {
    it('should allow extra fields not defined in inputs (passthrough)', () => {
      const config = createMockBlockConfig({
        inputs: {
          name: { type: 'string', required: true },
        },
      })

      const schema = generateBlockSchema(config)

      // Extra fields should not cause failure
      expect(schema.safeParse({ name: 'test', extraField: 'ignored' }).success).toBe(true)
    })
  })
})
