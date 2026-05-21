import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculateCost,
  extractAndParseJSON,
  formatCost,
  generateStructuredOutputInstructions,
  getAllModelProviders,
  getAllModels,
  getAllProviderIds,
  getBaseModelProviders,
  getCustomTools,
  getProvider,
  getProviderConfigFromModel,
  getProviderFromModel,
  getProviderModels,
  prepareToolsWithUsageControl,
  providers,
  trackForcedToolUsage,
  transformCustomTool,
  updateOllamaProviderModels,
} from '../utils'

// Mock external SDKs that providers rely on — prevents any side effects during import
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}))
vi.mock('openai', () => ({
  default: vi.fn(),
}))
vi.mock('@cerebras/cerebras_cloud_sdk', () => ({
  default: vi.fn(),
}))
vi.mock('groq-sdk', () => ({
  default: vi.fn(),
}))
vi.mock('ai', () => ({}))

// Mock logger
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock custom tools store (used by getCustomTools)
const mockGetAllTools = vi.fn().mockReturnValue([])
vi.mock('@/stores/custom-tools/store', () => ({
  useCustomToolsStore: {
    getState: () => ({ getAllTools: mockGetAllTools }),
  },
}))

// Mock ollama store (used by ollamaProvider init)
vi.mock('@/stores/ollama/store', () => ({
  useOllamaStore: {
    getState: () => ({ setModels: vi.fn() }),
  },
}))

// Mock environment for calculateCost
vi.mock('@/lib/environment', () => ({
  isHosted: false,
  getCostMultiplier: () => 1,
}))

// Mock executor/tools so provider index imports don't trigger network on import
vi.mock('@/tools', () => ({
  executeTool: vi.fn(),
}))

const fakeLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

beforeEach(() => {
  Object.values(fakeLogger).forEach((m) => m.mockClear?.())
})

describe('providers registry', () => {
  it('exposes all core provider ids', () => {
    const ids = getAllProviderIds()
    expect(ids).toEqual(
      expect.arrayContaining([
        'openai',
        'anthropic',
        'google',
        'deepseek',
        'xai',
        'cerebras',
        'groq',
        'ollama',
      ])
    )
  })

  it('each provider config has models array and modelPatterns when applicable', () => {
    for (const [id, p] of Object.entries(providers)) {
      expect(Array.isArray(p.models), `${id} should have models array`).toBe(true)
    }
  })
})

describe('getProvider', () => {
  it('returns provider by plain id', () => {
    expect(getProvider('openai')).toBe(providers.openai)
    expect(getProvider('anthropic')).toBe(providers.anthropic)
  })

  it('parses "openai/chat" style composite id', () => {
    expect(getProvider('openai/chat')).toBe(providers.openai)
  })

  it('returns undefined for unknown provider', () => {
    expect(getProvider('nope')).toBeUndefined()
  })
})

describe('getProviderFromModel', () => {
  it('resolves by exact model name', () => {
    expect(getProviderFromModel('gpt-4o')).toBe('openai')
    expect(getProviderFromModel('claude-opus-4-6')).toBe('anthropic')
    expect(getProviderFromModel('gemini-2.5-pro')).toBe('google')
    expect(getProviderFromModel('deepseek-chat')).toBe('deepseek')
  })

  it('is case-insensitive', () => {
    expect(getProviderFromModel('GPT-4o')).toBe('openai')
  })

  it('matches by pattern when unknown model name is structurally recognizable', () => {
    expect(getProviderFromModel('gpt-99-new')).toBe('openai')
    expect(getProviderFromModel('claude-future')).toBe('anthropic')
    expect(getProviderFromModel('gemini-future')).toBe('google')
    expect(getProviderFromModel('grok-99')).toBe('xai')
  })

  it('defaults to ollama when nothing matches', () => {
    expect(getProviderFromModel('totally-random-model')).toBe('ollama')
  })
})

describe('getProviderConfigFromModel / getProviderModels', () => {
  it('returns config for a known model', () => {
    const cfg = getProviderConfigFromModel('gpt-4o')
    expect(cfg).toBe(providers.openai)
  })

  it('returns only models for the given provider', () => {
    const models = getProviderModels('anthropic')
    expect(models).toEqual(providers.anthropic.models)
  })
})

describe('getAllModels / getAllModelProviders / getBaseModelProviders', () => {
  it('flattens all registered model names', () => {
    const all = getAllModels()
    expect(all.length).toBeGreaterThan(0)
    expect(all).toContain('gpt-4o')
    expect(all).toContain('claude-opus-4-6')
  })

  it('getAllModelProviders maps lowercased model -> provider id', () => {
    const map = getAllModelProviders()
    expect(map['gpt-4o']).toBe('openai')
    expect(map['claude-opus-4-6']).toBe('anthropic')
  })

  it('getBaseModelProviders excludes ollama', () => {
    const map = getBaseModelProviders()
    // ollama models are empty by default anyway; ensure no non-empty ollama entries
    const values = Object.values(map)
    expect(values).not.toContain('ollama')
  })
})

describe('updateOllamaProviderModels', () => {
  it('sets the ollama.models list', () => {
    updateOllamaProviderModels(['llama3.1', 'gemma2'])
    expect(providers.ollama.models).toEqual(['llama3.1', 'gemma2'])
    // cleanup
    updateOllamaProviderModels([])
  })
})

describe('calculateCost', () => {
  it('computes input and output costs per pricing table', () => {
    const cost = calculateCost('gpt-4o', 1_000_000, 1_000_000, false)
    expect(cost.input).toBeCloseTo(2.5, 5)
    expect(cost.output).toBeCloseTo(10.0, 5)
    expect(cost.total).toBeCloseTo(12.5, 5)
  })

  it('uses cached input pricing when flag is set', () => {
    const regular = calculateCost('gpt-4o', 1_000_000, 0, false)
    const cached = calculateCost('gpt-4o', 1_000_000, 0, true)
    expect(cached.input).toBeLessThan(regular.input)
  })

  it('returns zero cost for zero tokens', () => {
    const cost = calculateCost('gpt-4o', 0, 0)
    expect(cost.input).toBe(0)
    expect(cost.output).toBe(0)
    expect(cost.total).toBe(0)
  })

  it('includes pricing object in result', () => {
    const cost = calculateCost('gpt-4o', 100, 100)
    expect(cost.pricing).toBeDefined()
    expect(cost.pricing.input).toBeGreaterThan(0)
  })
})

describe('formatCost', () => {
  it('returns em dash for undefined/null', () => {
    expect(formatCost(undefined as unknown as number)).toBe('—')
    expect(formatCost(null as unknown as number)).toBe('—')
  })

  it('formats zero as $0', () => {
    expect(formatCost(0)).toBe('$0')
  })

  it('formats costs >= $1 with two decimals', () => {
    expect(formatCost(1.2345)).toBe('$1.23')
  })

  it('formats cents with three decimals', () => {
    expect(formatCost(0.1234)).toBe('$0.123')
  })

  it('formats sub-cent with four decimals', () => {
    expect(formatCost(0.0012)).toBe('$0.0012')
  })

  it('formats very small costs with extra precision', () => {
    const formatted = formatCost(0.00001)
    expect(formatted.startsWith('$0.')).toBe(true)
    // no scientific notation
    expect(formatted.toLowerCase()).not.toContain('e')
  })
})

describe('generateStructuredOutputInstructions', () => {
  it('returns empty string for schema-style response formats', () => {
    expect(generateStructuredOutputInstructions({ schema: {} })).toBe('')
    expect(generateStructuredOutputInstructions({ type: 'object', properties: {} })).toBe('')
  })

  it('returns empty string when no fields provided', () => {
    expect(generateStructuredOutputInstructions({})).toBe('')
    expect(generateStructuredOutputInstructions({ fields: null })).toBe('')
  })

  it('renders instructions for legacy fields array', () => {
    const output = generateStructuredOutputInstructions({
      fields: [
        { name: 'score', type: 'number', description: 'Score 0-10' },
        { name: 'reason', type: 'string', description: 'Reason text' },
      ],
    })
    expect(output).toContain('"score": 0')
    expect(output).toContain('"reason": "value"')
    expect(output).toContain('Score 0-10')
    expect(output).toContain('Reason text')
  })

  it('handles object-typed fields with nested properties', () => {
    const output = generateStructuredOutputInstructions({
      fields: [
        {
          name: 'metric',
          type: 'object',
          properties: {
            value: { type: 'number', description: 'n' },
            label: { type: 'string', description: 's' },
          },
        },
      ],
    })
    expect(output).toContain('"value": 0')
    expect(output).toContain('"label": "value"')
  })
})

describe('extractAndParseJSON', () => {
  it('parses a clean JSON object', () => {
    expect(extractAndParseJSON('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' })
  })

  it('extracts JSON wrapped in surrounding text', () => {
    expect(extractAndParseJSON('Here is: {"x":1} - thanks')).toEqual({ x: 1 })
  })

  it('recovers from trailing commas', () => {
    expect(extractAndParseJSON('{"a":1,}')).toEqual({ a: 1 })
  })

  it('throws when no JSON braces found', () => {
    expect(() => extractAndParseJSON('no json here')).toThrow(/No JSON object/)
  })
})

describe('transformCustomTool', () => {
  it('shapes a custom tool into a provider tool config', () => {
    const customTool = {
      id: 'abc',
      schema: {
        function: {
          name: 'myTool',
          description: 'does a thing',
          parameters: {
            type: 'object',
            properties: { x: { type: 'string' } },
            required: ['x'],
          },
        },
      },
    }

    const result = transformCustomTool(customTool)
    expect(result.id).toBe('custom_abc')
    expect(result.name).toBe('myTool')
    expect(result.description).toBe('does a thing')
    expect(result.parameters.type).toBe('object')
    expect(result.parameters.required).toEqual(['x'])
  })

  it('defaults required to [] when missing', () => {
    const result = transformCustomTool({
      id: 'x',
      schema: {
        function: {
          name: 'f',
          parameters: { type: 'object', properties: {} },
        },
      },
    })
    expect(result.parameters.required).toEqual([])
  })

  it('throws on invalid schema', () => {
    expect(() => transformCustomTool({})).toThrow(/Invalid custom tool schema/)
    expect(() => transformCustomTool({ schema: {} })).toThrow(/Invalid custom tool schema/)
  })
})

describe('getCustomTools', () => {
  it('returns transformed tools from the store', () => {
    mockGetAllTools.mockReturnValueOnce([
      {
        id: '1',
        schema: {
          function: {
            name: 'one',
            description: 'first',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        },
      },
    ])
    const result = getCustomTools()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('custom_1')
    expect(result[0].name).toBe('one')
  })

  it('returns empty array when store is empty', () => {
    mockGetAllTools.mockReturnValueOnce([])
    expect(getCustomTools()).toEqual([])
  })
})

describe('prepareToolsWithUsageControl', () => {
  it('returns undefined when no tools given', () => {
    const result = prepareToolsWithUsageControl(undefined, undefined, fakeLogger)
    expect(result.tools).toBeUndefined()
    expect(result.toolChoice).toBeUndefined()
    expect(result.hasFilteredTools).toBe(false)
  })

  it('filters out tools marked as usageControl=none', () => {
    const tools = [{ function: { name: 'a' } }, { function: { name: 'b' } }]
    const providerTools = [
      { id: 'a', usageControl: 'auto' },
      { id: 'b', usageControl: 'none' },
    ]
    const result = prepareToolsWithUsageControl(tools, providerTools, fakeLogger)
    expect(result.tools).toHaveLength(1)
    expect(result.hasFilteredTools).toBe(true)
  })

  it('returns empty when all tools are filtered out', () => {
    const tools = [{ function: { name: 'a' } }]
    const providerTools = [{ id: 'a', usageControl: 'none' }]
    const result = prepareToolsWithUsageControl(tools, providerTools, fakeLogger)
    expect(result.tools).toBeUndefined()
    expect(result.toolChoice).toBeUndefined()
    expect(result.hasFilteredTools).toBe(true)
  })

  it('forces OpenAI-style tool_choice when usageControl=force', () => {
    const tools = [{ function: { name: 'a' } }]
    const providerTools = [{ id: 'a', usageControl: 'force' }]
    const result = prepareToolsWithUsageControl(tools, providerTools, fakeLogger)
    expect(result.toolChoice).toEqual({
      type: 'function',
      function: { name: 'a' },
    })
    expect(result.forcedTools).toEqual(['a'])
  })

  it('forces Anthropic-style tool_choice', () => {
    const tools = [{ function: { name: 'a' } }]
    const providerTools = [{ id: 'a', usageControl: 'force' }]
    const result = prepareToolsWithUsageControl(tools, providerTools, fakeLogger, 'anthropic')
    expect(result.toolChoice).toEqual({ type: 'tool', name: 'a' })
  })

  it('builds Google toolConfig when forcing', () => {
    const tools = [{ function: { name: 'a' } }, { function: { name: 'b' } }]
    const providerTools = [
      { id: 'a', usageControl: 'force' },
      { id: 'b', usageControl: 'force' },
    ]
    const result = prepareToolsWithUsageControl(tools, providerTools, fakeLogger, 'google')
    expect(result.toolConfig).toEqual({
      mode: 'ANY',
      allowed_function_names: ['a', 'b'],
    })
    expect(result.toolChoice).toBe('auto')
  })

  it('defaults to auto when no forced tools', () => {
    const tools = [{ function: { name: 'a' } }]
    const providerTools = [{ id: 'a', usageControl: 'auto' }]
    const result = prepareToolsWithUsageControl(tools, providerTools, fakeLogger)
    expect(result.toolChoice).toBe('auto')
    expect(result.forcedTools).toEqual([])
  })

  it('sets google toolConfig mode=AUTO when no forced tools', () => {
    const tools = [{ function: { name: 'a' } }]
    const providerTools = [{ id: 'a', usageControl: 'auto' }]
    const result = prepareToolsWithUsageControl(tools, providerTools, fakeLogger, 'google')
    expect(result.toolConfig).toEqual({ mode: 'AUTO' })
  })
})

describe('trackForcedToolUsage', () => {
  it('passes through when no forced tools configured', () => {
    const result = trackForcedToolUsage(
      [{ function: { name: 'a' } }],
      'auto',
      fakeLogger,
      'openai',
      [],
      []
    )
    expect(result.hasUsedForcedTool).toBe(false)
    expect(result.nextToolChoice).toBe('auto')
  })

  it('detects usage of forced tool and advances to next for OpenAI format', () => {
    const forced = ['toolA', 'toolB']
    const result = trackForcedToolUsage(
      [{ function: { name: 'toolA' } }],
      { type: 'function', function: { name: 'toolA' } },
      fakeLogger,
      'openai',
      forced,
      []
    )
    expect(result.hasUsedForcedTool).toBe(true)
    expect(result.usedForcedTools).toContain('toolA')
    expect(result.nextToolChoice).toEqual({
      type: 'function',
      function: { name: 'toolB' },
    })
  })

  it('switches to auto once all forced tools used (OpenAI)', () => {
    const forced = ['toolA']
    const result = trackForcedToolUsage(
      [{ function: { name: 'toolA' } }],
      { type: 'function', function: { name: 'toolA' } },
      fakeLogger,
      'openai',
      forced,
      []
    )
    expect(result.hasUsedForcedTool).toBe(true)
    expect(result.nextToolChoice).toBe('auto')
  })

  it('switches to null once all forced tools used (Anthropic)', () => {
    const forced = ['toolA']
    const result = trackForcedToolUsage(
      [{ name: 'toolA' }],
      { type: 'tool', name: 'toolA' },
      fakeLogger,
      'anthropic',
      forced,
      []
    )
    expect(result.hasUsedForcedTool).toBe(true)
    expect(result.nextToolChoice).toBeNull()
  })

  it('builds next Google toolConfig with remaining forced tools', () => {
    const forced = ['toolA', 'toolB']
    const result = trackForcedToolUsage(
      [{ name: 'toolA' }],
      { allowed_function_names: ['toolA', 'toolB'] },
      fakeLogger,
      'google',
      forced,
      []
    )
    expect(result.hasUsedForcedTool).toBe(true)
    expect(result.nextToolConfig).toEqual({
      mode: 'ANY',
      allowed_function_names: ['toolB'],
    })
  })

  it('Google: switches to AUTO once all tools used', () => {
    const forced = ['toolA']
    const result = trackForcedToolUsage(
      [{ name: 'toolA' }],
      { allowed_function_names: ['toolA'] },
      fakeLogger,
      'google',
      forced,
      []
    )
    expect(result.hasUsedForcedTool).toBe(true)
    expect(result.nextToolConfig).toEqual({ mode: 'AUTO' })
  })
})
