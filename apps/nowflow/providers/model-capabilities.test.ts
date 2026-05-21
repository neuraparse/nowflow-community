import { describe, expect, it } from 'vitest'
import {
  getMaxTemperature,
  PROVIDERS_WITH_TOOL_USAGE_CONTROL,
  supportsTemperature,
  supportsToolUsageControl,
} from './model-capabilities'

describe('supportsToolUsageControl', () => {
  it('should return true for providers that support tool usage control', () => {
    // Test each provider that should support tool usage control
    for (const provider of PROVIDERS_WITH_TOOL_USAGE_CONTROL) {
      expect(supportsToolUsageControl(provider)).toBe(true)
    }
  })

  it('should return false for providers that do not support tool usage control', () => {
    const unsupportedProviders = ['google', 'ollama', 'non-existent-provider']

    for (const provider of unsupportedProviders) {
      expect(supportsToolUsageControl(provider)).toBe(false)
    }
  })
})

describe('supportsTemperature', () => {
  it('should return true for models that support temperature', () => {
    const supportedModels = [
      'gpt-4o',
      'gemini-2.5-pro',
      'claude-opus-4-6',
      'grok-4-latest',
      'grok-3',
    ]

    for (const model of supportedModels) {
      expect(supportsTemperature(model)).toBe(true)
    }
  })

  it('should return false for reasoning models that do not support temperature', () => {
    const unsupportedModels = ['gpt-5', 'o4-mini', 'o3-mini', 'deepseek-reasoner']

    for (const model of unsupportedModels) {
      expect(supportsTemperature(model)).toBe(false)
    }
  })

  it('should return true for unknown models (e.g. Ollama)', () => {
    expect(supportsTemperature('llama3:latest')).toBe(true)
  })
})

describe('getMaxTemperature', () => {
  it('should return 2 for models with temperature range 0-2', () => {
    const models = ['gpt-4o', 'gemini-2.5-flash', 'deepseek-chat', 'grok-4-latest']

    for (const model of models) {
      expect(getMaxTemperature(model)).toBe(2)
    }
  })

  it('should return 1 for models with temperature range 0-1', () => {
    const models = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']

    for (const model of models) {
      expect(getMaxTemperature(model)).toBe(1)
    }
  })

  it('should return undefined for reasoning models that do not support temperature', () => {
    expect(getMaxTemperature('gpt-5')).toBeUndefined()
    expect(getMaxTemperature('o3-mini')).toBeUndefined()
    expect(getMaxTemperature('deepseek-reasoner')).toBeUndefined()
  })

  it('should return 1 (default) for unknown models like Ollama', () => {
    expect(getMaxTemperature('llama3:latest')).toBe(1)
  })
})
