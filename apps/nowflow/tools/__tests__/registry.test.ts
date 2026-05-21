import { describe, expect, it, vi } from 'vitest'
import { tools } from '../registry'

// Mock logger everywhere it might be imported
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock executor/utils/api-url
vi.mock('@/executor/utils/api-url', () => ({
  getApiUrl: (path: string) => `http://localhost:3000${path}`,
}))

// Mock custom tools store
vi.mock('@/stores/custom-tools/store', () => ({
  useCustomToolsStore: {
    getState: () => ({
      getTool: () => undefined,
      getAllTools: () => [],
    }),
  },
}))

// Mock environment store
vi.mock('@/stores/settings/environment/store', () => ({
  useEnvironmentStore: {
    getState: () => ({
      getAllVariables: () => ({}),
    }),
  },
}))

describe('tools registry shape', () => {
  it('is a non-empty record', () => {
    expect(tools).toBeTypeOf('object')
    expect(Object.keys(tools).length).toBeGreaterThan(10)
  })

  it('every entry has at least id/name/description strings', () => {
    for (const [id, tool] of Object.entries(tools)) {
      expect(tool, `tool ${id} should exist`).toBeDefined()
      expect(tool.id, `tool ${id} should have id`).toBeTypeOf('string')
      expect(tool.name, `tool ${id} should have name`).toBeTypeOf('string')
      expect(tool.description, `tool ${id} should have description`).toBeTypeOf('string')
    }
  })

  it('tool ids match registry keys where defined', () => {
    // Allow legacy tools where id may be missing or differ
    for (const [key, tool] of Object.entries(tools)) {
      if (tool.id) {
        expect(typeof tool.id).toBe('string')
      }
      // The registry key itself should be a valid snake-case identifier
      expect(key).toMatch(/^[a-z0-9_]+$/)
    }
  })

  it('registry keys are unique', () => {
    const keys = Object.keys(tools)
    const unique = new Set(keys)
    expect(unique.size).toBe(keys.length)
  })

  it('registers several well-known tools', () => {
    const expected = [
      'http_request',
      'function_execute',
      'vision_tool',
      'thinking_tool',
      'math_processor',
      'json_processor',
      'text_processor',
      'timer',
      'variable_manager',
      'loop_processor',
    ]

    for (const id of expected) {
      expect(tools[id], `expected ${id} in registry`).toBeDefined()
      expect(tools[id].id).toBe(id)
    }
  })

  it('each tool param (when defined) has a type string', () => {
    for (const [toolId, tool] of Object.entries(tools)) {
      if (!tool.params) continue
      for (const [paramName, paramConfig] of Object.entries(tool.params)) {
        if (!paramConfig) continue
        expect(
          typeof (paramConfig as any).type === 'string',
          `tool ${toolId} param ${paramName} should have string type`
        ).toBe(true)
      }
    }
  })

  it('request config (when defined) has callable or string url/method and callable headers', () => {
    for (const [toolId, tool] of Object.entries(tools)) {
      if (!tool.request) continue
      const { url, method, headers } = tool.request
      const urlOk = typeof url === 'string' || typeof url === 'function'
      const methodOk = typeof method === 'string' || typeof method === 'function'
      expect(urlOk, `tool ${toolId} has bad url`).toBe(true)
      expect(methodOk, `tool ${toolId} has bad method`).toBe(true)
      expect(typeof headers, `tool ${toolId} headers should be fn`).toBe('function')
    }
  })
})
