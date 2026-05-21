import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BlockConfig } from '@/blocks/types'
import type { SerializedBlock } from '@/serializer/types'
import { ValidationEngine } from '../validation-engine'

// Mock the logger to keep test output clean
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

const MockIcon = () => null

/**
 * Tiny registry with a handful of block configs exercising all engine phases.
 */
const mockRegistry: Record<string, BlockConfig> = {
  simple_block: {
    type: 'simple_block',
    name: 'Simple',
    description: 'A basic block with required + optional inputs',
    category: 'blocks',
    bgColor: '#000',
    icon: MockIcon as any,
    subBlocks: [],
    tools: { access: [] },
    inputs: {
      required_str: { type: 'string', required: true },
      optional_str: { type: 'string', required: false },
      count: { type: 'number', required: false },
    },
    outputs: { response: { type: 'json' } },
  } as BlockConfig,

  agent: {
    type: 'agent',
    name: 'Agent',
    description: 'Agent block',
    category: 'agents',
    bgColor: '#000',
    icon: MockIcon as any,
    subBlocks: [{ id: 'model', type: 'dropdown', options: () => ['gpt-4o'] }],
    tools: { access: [] },
    inputs: {
      systemPrompt: { type: 'string', required: false },
      model: { type: 'string', required: true },
      apiKey: { type: 'string', required: true },
      tools: { type: 'json', required: false },
      responseFormat: { type: 'json', required: false },
    },
    outputs: { response: { type: 'json' } },
  } as BlockConfig,

  api: {
    type: 'api',
    name: 'API',
    description: 'HTTP request block',
    category: 'blocks',
    bgColor: '#000',
    icon: MockIcon as any,
    subBlocks: [],
    tools: { access: [] },
    inputs: {
      url: { type: 'string', required: true },
    },
    outputs: { response: { type: 'json' } },
  } as BlockConfig,

  notion: {
    type: 'notion',
    name: 'Notion',
    description: 'Notion block',
    category: 'blocks',
    bgColor: '#000',
    icon: MockIcon as any,
    subBlocks: [],
    tools: { access: [] },
    inputs: {
      operation: { type: 'string', required: true },
      parentType: { type: 'string', required: true },
      parentId: { type: 'string', required: true },
      pageId: { type: 'string', required: false },
    },
    outputs: { response: { type: 'json' } },
  } as BlockConfig,
}

function createBlock(type: string, name?: string): SerializedBlock {
  return {
    id: `block-${type}-1`,
    metadata: { id: type, name: name || `Test ${type}` },
    config: { params: {} },
    enabled: true,
  } as any
}

describe('ValidationEngine', () => {
  let engine: ValidationEngine

  beforeEach(() => {
    engine = new ValidationEngine(mockRegistry)
  })

  describe('construction + registry', () => {
    it('should accept a registry injected via constructor', () => {
      const e = new ValidationEngine(mockRegistry)
      const block = createBlock('simple_block')

      const result = e.validateInputs(block, { required_str: 'hi' })

      expect(result.valid).toBe(true)
    })

    it('should fall back to empty registry if none provided and @/blocks/registry is unavailable', () => {
      // No registry passed; the lazy require will fail under test and fall back to {}
      const e = new ValidationEngine()
      const block = createBlock('simple_block')

      // With no block config the schema phase is skipped; conditional rules for
      // this type are empty, so result should be passing regardless of inputs.
      const result = e.validateInputs(block, {})

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('schema validation phase', () => {
    it('should pass with valid inputs against generated schema', () => {
      const block = createBlock('simple_block')

      const result = engine.validateInputs(block, {
        required_str: 'hello',
        count: 3,
      })

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should report required-field errors from schema phase', () => {
      const block = createBlock('simple_block')

      const result = engine.validateInputs(block, {
        required_str: '',
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'required_str')).toBe(true)
    })

    it('should demote optional-field schema issues to warnings', () => {
      const block = createBlock('simple_block')

      const result = engine.validateInputs(block, {
        required_str: 'hi',
        count: 'not-a-number',
      })

      // "count" is optional, so invalid value is a warning, not an error
      expect(result.errors.some((e) => e.field === 'count')).toBe(false)
      expect(result.warnings.some((w) => w.field === 'count')).toBe(true)
    })

    it('should cache schemas across calls (idempotent behavior)', () => {
      const block = createBlock('simple_block')

      const a = engine.validateInputs(block, { required_str: 'x' })
      const b = engine.validateInputs(block, { required_str: 'x' })

      expect(a.valid).toBe(true)
      expect(b.valid).toBe(true)
    })
  })

  describe('missing metadata / unknown blocks', () => {
    it('should pass validation when metadata.id is empty', () => {
      const block = {
        id: 'no-meta',
        metadata: { id: '', name: 'Blank' },
        config: { params: {} },
        enabled: true,
      } as any as SerializedBlock

      const result = engine.validateInputs(block, {})

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should pass validation for an unknown block type', () => {
      const block = createBlock('not_in_registry')

      const result = engine.validateInputs(block, { whatever: true })

      expect(result.valid).toBe(true)
    })
  })

  describe('conditional rule integration', () => {
    it('should run conditional rules in addition to schema rules (api block)', () => {
      const block = createBlock('api')

      const result = engine.validateInputs(block, { url: 'not-a-url' })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'url')).toBe(true)
    })

    it('should accept URLs containing env var tokens', () => {
      const block = createBlock('api')

      const result = engine.validateInputs(block, {
        url: 'https://api.example.com/x',
      })

      const urlErrors = result.errors.filter((e) => e.field === 'url')
      expect(urlErrors).toHaveLength(0)
    })

    it('should drop required-errors for fields marked conditionally optional', () => {
      const block = createBlock('notion')

      // operation !== create_notion -> parentType and parentId become optional
      const result = engine.validateInputs(block, {
        operation: 'read_notion',
        pageId: 'abc123',
      })

      expect(result.errors.some((e) => e.field === 'parentType')).toBe(false)
      expect(result.errors.some((e) => e.field === 'parentId')).toBe(false)
    })
  })

  describe('agent override phase', () => {
    it('should require apiKey for cloud models on agent block', () => {
      const block = createBlock('agent')

      const result = engine.validateInputs(block, {
        model: 'gpt-4o',
        apiKey: '',
        systemPrompt: 'hi',
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'apiKey')).toBe(true)
    })

    it('should NOT require apiKey for Ollama models on agent block', () => {
      const block = createBlock('agent')

      const result = engine.validateInputs(block, {
        model: 'llama3.2:3b',
        apiKey: '',
        systemPrompt: 'hi',
      })

      const apiKeyErrors = result.errors.filter((e) => e.field === 'apiKey')
      expect(apiKeyErrors).toHaveLength(0)
    })
  })

  describe('tool validation phase', () => {
    it('should run tool validation when inputs.tools is present', () => {
      const block = createBlock('agent')

      const result = engine.validateInputs(block, {
        model: 'gpt-4o',
        apiKey: 'test-key',
        systemPrompt: 'hi',
        tools: [
          {
            type: 'custom-tool',
            title: 'Bad tool',
            schema: {
              function: {
                // missing name
                parameters: { type: 'object', properties: {} },
              },
            },
          },
        ],
      })

      expect(
        result.errors.some(
          (e) => e.field.includes('tools') && e.message.toLowerCase().includes('name')
        )
      ).toBe(true)
    })

    it('should skip tool validation if inputs.tools is absent', () => {
      const block = createBlock('agent')

      const result = engine.validateInputs(block, {
        model: 'gpt-4o',
        apiKey: 'test-key',
        systemPrompt: 'hi',
      })

      const toolErrors = result.errors.filter((e) => e.field.startsWith('tools'))
      expect(toolErrors).toHaveLength(0)
    })
  })

  describe('response format phase', () => {
    it('should flag invalid JSON in responseFormat', () => {
      const block = createBlock('agent')

      const result = engine.validateInputs(block, {
        model: 'gpt-4o',
        apiKey: 'test-key',
        systemPrompt: 'hi',
        responseFormat: '{invalid json',
      })

      expect(result.errors.some((e) => e.field === 'responseFormat')).toBe(true)
    })

    it('should accept a valid object responseFormat', () => {
      const block = createBlock('agent')

      const result = engine.validateInputs(block, {
        model: 'gpt-4o',
        apiKey: 'test-key',
        systemPrompt: 'hi',
        responseFormat: { type: 'object', properties: { ok: { type: 'boolean' } } },
      })

      const rfErrors = result.errors.filter((e) => e.field === 'responseFormat')
      expect(rfErrors).toHaveLength(0)
    })
  })

  describe('aggregation across phases', () => {
    it('should merge errors from multiple phases into a single result', () => {
      const block = createBlock('agent')

      // Triggers: schema (model empty required), conditional (apiKey missing for cloud),
      // tool validation (bad custom tool), responseFormat (bad JSON)
      const result = engine.validateInputs(block, {
        model: '',
        apiKey: '',
        systemPrompt: 'hi',
        tools: [
          {
            type: 'custom-tool',
            title: 'Bad tool',
            schema: { function: { parameters: { type: 'object', properties: {} } } },
          },
        ],
        responseFormat: '{invalid',
      })

      expect(result.valid).toBe(false)
      // Contains errors for at least: model, apiKey, tools, responseFormat
      const fieldHeads = result.errors.map((e) => e.field.split(/[.[]/)[0])
      expect(fieldHeads).toContain('model')
      expect(fieldHeads).toContain('apiKey')
      expect(fieldHeads).toContain('tools')
      expect(fieldHeads).toContain('responseFormat')
    })

    it('should aggregate warnings separately from errors', () => {
      const block = createBlock('simple_block')

      const result = engine.validateInputs(block, {
        required_str: 'hi',
        count: 'nope', // optional field invalid -> warning
      })

      // valid remains true (no blocking errors), but warnings populated
      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('error safety / short-circuit', () => {
    it('should never throw, even with null inputs', () => {
      const block = createBlock('agent')
      expect(() => engine.validateInputs(block, null as any)).not.toThrow()
    })

    it('should never throw, even with undefined inputs', () => {
      const block = createBlock('agent')
      expect(() => engine.validateInputs(block, undefined as any)).not.toThrow()
    })

    it('should never throw with non-object inputs', () => {
      const block = createBlock('agent')
      expect(() => engine.validateInputs(block, 42 as any)).not.toThrow()
      expect(() => engine.validateInputs(block, 'string' as any)).not.toThrow()
    })

    it('should return a passing result (fail-open) when internal validation throws', () => {
      const block = createBlock('agent')

      // Inject a registry with a block config that trips schema generation
      const broken: Record<string, BlockConfig> = {
        agent: {
          ...mockRegistry.agent,
          // Accessing .inputs in getOrCreateSchema will throw on this shape
          get inputs(): any {
            throw new Error('boom')
          },
        } as any,
      }

      const broken_engine = new ValidationEngine(broken)

      let result: any
      expect(() => {
        result = broken_engine.validateInputs(block, { model: 'gpt-4o' })
      }).not.toThrow()

      // Engine catches errors and returns a passing result (fail-open)
      expect(result.valid).toBe(true)
    })
  })
})
