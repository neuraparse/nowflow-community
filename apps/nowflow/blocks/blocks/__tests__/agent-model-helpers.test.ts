/**
 * Tests for the helper functions that orchestrate model + key resolution
 * across blocks.
 *
 * `resolveApiKeyForBlock` is the single source of truth used by the dropdown
 * auto-fill and the modal's "Use Model" handler — every block goes through
 * here, so the resolution order matters a lot.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useModelSettingsStore } from '@/stores/model-settings/store'
import {
  getPreferredDefaultModel,
  providerForModel,
  resolveApiKeyForBlock,
} from '@/blocks/blocks/agent-model-helpers'

vi.mock('@/stores/safe-storage', () => ({
  safeStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

// Ollama store is queried by getModelOptions; tests don't care about its contents
vi.mock('@/stores/ollama/store', () => ({
  useOllamaStore: {
    getState: () => ({
      models: [],
      isLoading: false,
      refreshModels: vi.fn(),
      refreshIfNeeded: vi.fn(),
    }),
  },
}))

describe('resolveApiKeyForBlock', () => {
  beforeEach(() => {
    useModelSettingsStore.setState(
      (prev) => ({
        ...prev,
        apiKeys: {},
        additionalApiKeys: {},
        defaultPreference: null,
        recentModels: [],
        providerTemperatures: {},
      }),
      true
    )
  })

  it("returns 'ollama' for the ollama provider regardless of options", () => {
    expect(resolveApiKeyForBlock('ollama')).toBe('ollama')
    expect(resolveApiKeyForBlock('ollama', { keyId: 'whatever' })).toBe('ollama')
    expect(resolveApiKeyForBlock('ollama', { explicitValue: 'temp-key' })).toBe('ollama')
  })

  it('honors a literal explicit value over store data', () => {
    useModelSettingsStore.getState().setApiKey('openai', 'store-key')
    expect(resolveApiKeyForBlock('openai', { explicitValue: 'block-override-key' })).toBe(
      'block-override-key'
    )
  })

  it('ignores env-var placeholder explicit values and falls through to store', () => {
    useModelSettingsStore.getState().setApiKey('openai', 'store-key')
    // {{...}} placeholder — resolved later by the executor, not here
    expect(resolveApiKeyForBlock('openai', { explicitValue: '{{OPENAI_API_KEY}}' })).toBe(
      'store-key'
    )
    // $VAR placeholder
    expect(resolveApiKeyForBlock('openai', { explicitValue: '$OPENAI_API_KEY' })).toBe('store-key')
  })

  it('ignores empty/whitespace explicit values', () => {
    useModelSettingsStore.getState().setApiKey('openai', 'store-key')
    expect(resolveApiKeyForBlock('openai', { explicitValue: '' })).toBe('store-key')
    expect(resolveApiKeyForBlock('openai', { explicitValue: '   ' })).toBe('store-key')
  })

  it('falls back to the default key when no keyId / no explicit value', () => {
    useModelSettingsStore.getState().setApiKey('anthropic', 'key-ant-default')
    expect(resolveApiKeyForBlock('anthropic')).toBe('key-ant-default')
  })

  it('resolves a specific labeled key by id', () => {
    const id = useModelSettingsStore.getState().addAdditionalKey('openai', 'Work', 'work-key')
    expect(resolveApiKeyForBlock('openai', { keyId: id })).toBe('work-key')
  })

  it('returns undefined when neither default nor labeled key matches', () => {
    expect(resolveApiKeyForBlock('openai')).toBeUndefined()
    expect(resolveApiKeyForBlock('openai', { keyId: 'nope' })).toBeUndefined()
  })

  it('keeps default and labeled keys independent', () => {
    useModelSettingsStore.getState().setApiKey('openai', 'default-key')
    const id = useModelSettingsStore.getState().addAdditionalKey('openai', 'Work', 'work-key')

    // No keyId → default
    expect(resolveApiKeyForBlock('openai')).toBe('default-key')
    // keyId='default' explicit → default
    expect(resolveApiKeyForBlock('openai', { keyId: 'default' })).toBe('default-key')
    // keyId=<labeled id> → labeled
    expect(resolveApiKeyForBlock('openai', { keyId: id })).toBe('work-key')
  })

  it('tolerates null / non-string explicit values without throwing', () => {
    useModelSettingsStore.getState().setApiKey('openai', 'store-key')
    // The `apiKey` subblock is loosely typed — `null`/`undefined` arrive at
    // runtime in legacy workflows. Must coerce, not crash.
    expect(() => resolveApiKeyForBlock('openai', { explicitValue: null as any })).not.toThrow()
    expect(resolveApiKeyForBlock('openai', { explicitValue: null as any })).toBe('store-key')
    expect(resolveApiKeyForBlock('openai', { explicitValue: undefined })).toBe('store-key')
  })

  it('treats $ENV_VAR (whole-string) as placeholder, not literal', () => {
    useModelSettingsStore.getState().setApiKey('openai', 'store-key')
    expect(resolveApiKeyForBlock('openai', { explicitValue: '$OPENAI_API_KEY' })).toBe('store-key')
  })

  it('does NOT mistreat literal keys that contain $ as placeholders', () => {
    // Some self-hosted gateways prefix keys with `$`. The old over-broad
    // `startsWith('$')` check would have wrongly skipped these.
    useModelSettingsStore.getState().setApiKey('openai', 'store-key')
    // 'key-$abc123' contains $ but isn't a $ENV pattern — should be treated as a literal
    expect(resolveApiKeyForBlock('openai', { explicitValue: 'key-$abc123' })).toBe('key-$abc123')
  })

  it('treats {{TAG}} as placeholder', () => {
    useModelSettingsStore.getState().setApiKey('openai', 'store-key')
    expect(resolveApiKeyForBlock('openai', { explicitValue: '{{OPENAI_API_KEY}}' })).toBe(
      'store-key'
    )
  })
})

describe('getPreferredDefaultModel', () => {
  beforeEach(() => {
    useModelSettingsStore.setState(
      (prev) => ({
        ...prev,
        apiKeys: {},
        additionalApiKeys: {},
        defaultPreference: null,
        recentModels: [],
        providerTemperatures: {},
      }),
      true
    )
  })

  it("falls back to 'gpt-4o' when nothing is saved", () => {
    expect(getPreferredDefaultModel()).toBe('gpt-4o')
  })

  it('uses the saved default preference when set', () => {
    useModelSettingsStore.getState().setDefaultPreference({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    })
    expect(getPreferredDefaultModel()).toBe('claude-sonnet-4-6')
  })

  it('falls back to the most recent model when no default preference exists', () => {
    useModelSettingsStore.getState().addRecentModel('xai', 'grok-4-latest')
    expect(getPreferredDefaultModel()).toBe('grok-4-latest')
  })

  it('preference takes precedence over recents', () => {
    useModelSettingsStore.getState().addRecentModel('xai', 'grok-4-latest')
    useModelSettingsStore.getState().setDefaultPreference({
      provider: 'openai',
      model: 'gpt-4o',
    })
    expect(getPreferredDefaultModel()).toBe('gpt-4o')
  })
})

describe('providerForModel', () => {
  it('maps a known OpenAI model to its provider', () => {
    // gpt-4o is registered with openai in providers/utils
    expect(providerForModel('gpt-4o')).toBe('openai')
  })
})
