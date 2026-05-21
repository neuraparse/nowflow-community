/**
 * Tests for the model-settings Zustand store.
 * Covers: initial state, api key CRUD, default preference, recent models (with dedupe + cap),
 * provider temperatures, and key validity marking.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useModelSettingsStore } from '@/stores/model-settings/store'

vi.mock('@/stores/safe-storage', () => ({
  safeStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

describe('useModelSettingsStore', () => {
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

  describe('initial state', () => {
    it('has empty defaults', () => {
      const state = useModelSettingsStore.getState()
      expect(state.apiKeys).toEqual({})
      expect(state.additionalApiKeys).toEqual({})
      expect(state.defaultPreference).toBeNull()
      expect(state.recentModels).toEqual([])
      expect(state.providerTemperatures).toEqual({})
    })
  })

  describe('setApiKey', () => {
    it('stores an api key for a provider', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'test-key')
      const state = useModelSettingsStore.getState()
      expect(state.apiKeys.openai?.apiKey).toBe('test-key')
      expect(state.apiKeys.openai?.isValid).toBeUndefined()
      expect(state.apiKeys.openai?.lastTested).toBeUndefined()
    })

    it('overrides a previous key and clears validation status', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'first-key')
      useModelSettingsStore.getState().markApiKeyValid('openai', true)
      useModelSettingsStore.getState().setApiKey('openai', 'second-key')
      const config = useModelSettingsStore.getState().apiKeys.openai
      expect(config?.apiKey).toBe('second-key')
      expect(config?.isValid).toBeUndefined()
      expect(config?.lastTested).toBeUndefined()
    })

    it('does not affect other providers', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'key-a')
      useModelSettingsStore.getState().setApiKey('anthropic', 'key-b')
      const state = useModelSettingsStore.getState()
      expect(state.apiKeys.openai?.apiKey).toBe('key-a')
      expect(state.apiKeys.anthropic?.apiKey).toBe('key-b')
    })
  })

  describe('getApiKey', () => {
    it('returns the key for a provider', () => {
      useModelSettingsStore.getState().setApiKey('anthropic', 'key-ant')
      expect(useModelSettingsStore.getState().getApiKey('anthropic')).toBe('key-ant')
    })

    it('returns undefined when no key is stored', () => {
      expect(useModelSettingsStore.getState().getApiKey('openai')).toBeUndefined()
    })

    it("always returns 'ollama' for the ollama provider", () => {
      expect(useModelSettingsStore.getState().getApiKey('ollama')).toBe('ollama')
    })
  })

  describe('removeApiKey', () => {
    it('removes a stored key', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'test-key')
      useModelSettingsStore.getState().removeApiKey('openai')
      expect(useModelSettingsStore.getState().apiKeys.openai).toBeUndefined()
    })

    it('is a no-op when key does not exist', () => {
      useModelSettingsStore.getState().removeApiKey('openai')
      expect(useModelSettingsStore.getState().apiKeys).toEqual({})
    })

    it('does not affect other providers', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'key-a')
      useModelSettingsStore.getState().setApiKey('anthropic', 'key-b')
      useModelSettingsStore.getState().removeApiKey('openai')
      expect(useModelSettingsStore.getState().apiKeys.anthropic?.apiKey).toBe('key-b')
    })
  })

  describe('setDefaultPreference', () => {
    it('saves the default preference', () => {
      const preference = { provider: 'openai' as const, model: 'gpt-4o', temperature: 0.5 }
      useModelSettingsStore.getState().setDefaultPreference(preference)
      expect(useModelSettingsStore.getState().defaultPreference).toEqual(preference)
    })

    it('replaces the existing preference', () => {
      useModelSettingsStore.getState().setDefaultPreference({
        provider: 'openai',
        model: 'gpt-4o',
      })
      useModelSettingsStore.getState().setDefaultPreference({
        provider: 'anthropic',
        model: 'claude-4',
      })
      expect(useModelSettingsStore.getState().defaultPreference).toEqual({
        provider: 'anthropic',
        model: 'claude-4',
      })
    })
  })

  describe('addRecentModel', () => {
    it('adds a new entry at the top', () => {
      useModelSettingsStore.getState().addRecentModel('openai', 'gpt-4o')
      expect(useModelSettingsStore.getState().recentModels).toEqual([
        { provider: 'openai', model: 'gpt-4o' },
      ])
    })

    it('deduplicates by moving an existing entry to the front', () => {
      useModelSettingsStore.getState().addRecentModel('openai', 'gpt-4o')
      useModelSettingsStore.getState().addRecentModel('anthropic', 'claude-4')
      useModelSettingsStore.getState().addRecentModel('openai', 'gpt-4o')
      expect(useModelSettingsStore.getState().recentModels).toEqual([
        { provider: 'openai', model: 'gpt-4o' },
        { provider: 'anthropic', model: 'claude-4' },
      ])
    })

    it('caps the recent list at 5 entries', () => {
      const store = useModelSettingsStore.getState()
      store.addRecentModel('openai', 'm1')
      store.addRecentModel('openai', 'm2')
      store.addRecentModel('openai', 'm3')
      store.addRecentModel('openai', 'm4')
      store.addRecentModel('openai', 'm5')
      store.addRecentModel('openai', 'm6')
      const recents = useModelSettingsStore.getState().recentModels
      expect(recents).toHaveLength(5)
      expect(recents[0]).toEqual({ provider: 'openai', model: 'm6' })
      expect(recents.find((r) => r.model === 'm1')).toBeUndefined()
    })
  })

  describe('markApiKeyValid', () => {
    it('marks a stored key valid and stamps lastTested', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'test-key')
      useModelSettingsStore.getState().markApiKeyValid('openai', true)
      const config = useModelSettingsStore.getState().apiKeys.openai
      expect(config?.isValid).toBe(true)
      expect(typeof config?.lastTested).toBe('string')
      expect(() => new Date(config!.lastTested!)).not.toThrow()
    })

    it('marks a key invalid', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'test-key')
      useModelSettingsStore.getState().markApiKeyValid('openai', false)
      expect(useModelSettingsStore.getState().apiKeys.openai?.isValid).toBe(false)
    })

    it('is a no-op when the provider has no stored key', () => {
      const before = useModelSettingsStore.getState().apiKeys
      useModelSettingsStore.getState().markApiKeyValid('openai', true)
      expect(useModelSettingsStore.getState().apiKeys).toEqual(before)
    })
  })

  describe('hasApiKey', () => {
    it('returns false for providers without a stored key', () => {
      expect(useModelSettingsStore.getState().hasApiKey('openai')).toBe(false)
    })

    it('returns true for providers with a non-empty stored key', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'test-key')
      expect(useModelSettingsStore.getState().hasApiKey('openai')).toBe(true)
    })

    it('returns false when the stored key is an empty/whitespace string', () => {
      useModelSettingsStore.getState().setApiKey('openai', '   ')
      expect(useModelSettingsStore.getState().hasApiKey('openai')).toBe(false)
    })

    it('always returns true for ollama', () => {
      expect(useModelSettingsStore.getState().hasApiKey('ollama')).toBe(true)
    })
  })

  // ─── Multi-key API ────────────────────────────────────────────────

  describe('addAdditionalKey', () => {
    it('returns a new id and stores the key', () => {
      const id = useModelSettingsStore
        .getState()
        .addAdditionalKey('openai', 'Personal', 'personal-key')
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
      const list = useModelSettingsStore.getState().additionalApiKeys.openai
      expect(list).toHaveLength(1)
      expect(list?.[0].label).toBe('Personal')
      expect(list?.[0].apiKey).toBe('personal-key')
      expect(list?.[0].id).toBe(id)
      expect(list?.[0].createdAt).toBeTruthy()
    })

    it('falls back to "Untitled" when label is empty/whitespace', () => {
      useModelSettingsStore.getState().addAdditionalKey('openai', '   ', 'temp-key')
      expect(useModelSettingsStore.getState().additionalApiKeys.openai?.[0].label).toBe('Untitled')
    })

    it('appends to an existing list rather than replacing', () => {
      const a = useModelSettingsStore.getState().addAdditionalKey('openai', 'A', 'key-a')
      const b = useModelSettingsStore.getState().addAdditionalKey('openai', 'B', 'key-b')
      const list = useModelSettingsStore.getState().additionalApiKeys.openai!
      expect(list).toHaveLength(2)
      expect(list[0].id).toBe(a)
      expect(list[1].id).toBe(b)
    })

    it('keeps providers isolated', () => {
      useModelSettingsStore.getState().addAdditionalKey('openai', 'A', 'key-a')
      useModelSettingsStore.getState().addAdditionalKey('anthropic', 'B', 'key-b')
      expect(useModelSettingsStore.getState().additionalApiKeys.openai).toHaveLength(1)
      expect(useModelSettingsStore.getState().additionalApiKeys.anthropic).toHaveLength(1)
    })

    it('does not affect the legacy default slot', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'default-key')
      useModelSettingsStore.getState().addAdditionalKey('openai', 'Extra', 'extra-key')
      expect(useModelSettingsStore.getState().apiKeys.openai?.apiKey).toBe('default-key')
      expect(useModelSettingsStore.getState().additionalApiKeys.openai).toHaveLength(1)
    })
  })

  describe('updateAdditionalKey', () => {
    it('updates the label without resetting validation', () => {
      const id = useModelSettingsStore.getState().addAdditionalKey('openai', 'Old', 'temp-key')
      useModelSettingsStore.getState().markAdditionalKeyValid('openai', id, true)
      useModelSettingsStore.getState().updateAdditionalKey('openai', id, { label: 'New' })
      const k = useModelSettingsStore.getState().additionalApiKeys.openai?.[0]
      expect(k?.label).toBe('New')
      expect(k?.isValid).toBe(true)
    })

    it('resets validation when the key value changes', () => {
      const id = useModelSettingsStore.getState().addAdditionalKey('openai', 'X', 'old-key')
      useModelSettingsStore.getState().markAdditionalKeyValid('openai', id, true)
      useModelSettingsStore.getState().updateAdditionalKey('openai', id, { apiKey: 'new-key' })
      const k = useModelSettingsStore.getState().additionalApiKeys.openai?.[0]
      expect(k?.apiKey).toBe('new-key')
      expect(k?.isValid).toBeUndefined()
      expect(k?.lastTested).toBeUndefined()
    })

    it('is a no-op for unknown id', () => {
      useModelSettingsStore.getState().addAdditionalKey('openai', 'X', 'temp-key')
      const before = useModelSettingsStore.getState().additionalApiKeys.openai
      useModelSettingsStore.getState().updateAdditionalKey('openai', 'nope', { label: 'Y' })
      expect(useModelSettingsStore.getState().additionalApiKeys.openai).toEqual(before)
    })
  })

  describe('removeAdditionalKey', () => {
    it('removes one key and leaves others intact', () => {
      const a = useModelSettingsStore.getState().addAdditionalKey('openai', 'A', 'key-a')
      const b = useModelSettingsStore.getState().addAdditionalKey('openai', 'B', 'key-b')
      useModelSettingsStore.getState().removeAdditionalKey('openai', a)
      const list = useModelSettingsStore.getState().additionalApiKeys.openai
      expect(list).toHaveLength(1)
      expect(list?.[0].id).toBe(b)
    })

    it('deletes the provider entry entirely when last key is removed', () => {
      const id = useModelSettingsStore.getState().addAdditionalKey('openai', 'A', 'key-a')
      useModelSettingsStore.getState().removeAdditionalKey('openai', id)
      expect(useModelSettingsStore.getState().additionalApiKeys.openai).toBeUndefined()
    })

    it('is a no-op for unknown provider/id', () => {
      useModelSettingsStore.getState().removeAdditionalKey('openai', 'nope')
      expect(useModelSettingsStore.getState().additionalApiKeys).toEqual({})
    })
  })

  describe('promoteAdditionalKeyToDefault', () => {
    it('moves an additional key into the default slot', () => {
      const id = useModelSettingsStore.getState().addAdditionalKey('openai', 'A', 'key-a')
      useModelSettingsStore.getState().promoteAdditionalKeyToDefault('openai', id)
      expect(useModelSettingsStore.getState().apiKeys.openai?.apiKey).toBe('key-a')
      // Old default was empty, so the additional list should now be empty
      expect(useModelSettingsStore.getState().additionalApiKeys.openai).toBeUndefined()
    })

    it('demotes the previous default into the additional list (preserving it)', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'old-default-key')
      const id = useModelSettingsStore.getState().addAdditionalKey('openai', 'New', 'new-key')
      useModelSettingsStore.getState().promoteAdditionalKeyToDefault('openai', id)
      expect(useModelSettingsStore.getState().apiKeys.openai?.apiKey).toBe('new-key')
      const list = useModelSettingsStore.getState().additionalApiKeys.openai
      expect(list).toBeDefined()
      expect(list!.some((k) => k.apiKey === 'old-default-key')).toBe(true)
    })

    it('labels the demoted previous-default distinctly (no label collision)', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'old-default-key')
      const id = useModelSettingsStore.getState().addAdditionalKey('openai', 'Work', 'new-key')
      useModelSettingsStore.getState().promoteAdditionalKeyToDefault('openai', id)

      const list = useModelSettingsStore.getState().additionalApiKeys.openai!
      const demoted = list.find((k) => k.apiKey === 'old-default-key')
      expect(demoted).toBeDefined()
      // Critical: do NOT reuse the promoted key's label ('Work') for the
      // demoted one — that would produce two indistinguishable rows.
      expect(demoted!.label).not.toBe('Work')
      expect(demoted!.label).toBe('Previous default')
    })

    it('is a no-op for unknown id', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'original-key')
      useModelSettingsStore.getState().promoteAdditionalKeyToDefault('openai', 'nope')
      expect(useModelSettingsStore.getState().apiKeys.openai?.apiKey).toBe('original-key')
    })
  })

  describe('listAllKeys', () => {
    it('returns an empty array when nothing is stored', () => {
      expect(useModelSettingsStore.getState().listAllKeys('openai')).toEqual([])
    })

    it('returns the default key with id="default" when only the default is set', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'default-key')
      const all = useModelSettingsStore.getState().listAllKeys('openai')
      expect(all).toHaveLength(1)
      expect(all[0].id).toBe('default')
      expect(all[0].label).toBe('Default')
      expect(all[0].apiKey).toBe('default-key')
      expect(all[0].isDefault).toBe(true)
    })

    it('puts default first, then additional keys in insertion order', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'default-key')
      const a = useModelSettingsStore.getState().addAdditionalKey('openai', 'A', 'key-a')
      const b = useModelSettingsStore.getState().addAdditionalKey('openai', 'B', 'key-b')
      const all = useModelSettingsStore.getState().listAllKeys('openai')
      expect(all.map((k) => k.id)).toEqual(['default', a, b])
      expect(all[0].isDefault).toBe(true)
      expect(all[1].isDefault).toBe(false)
      expect(all[2].isDefault).toBe(false)
    })

    it('skips the default slot when it has an empty value', () => {
      useModelSettingsStore.getState().setApiKey('openai', '')
      useModelSettingsStore.getState().addAdditionalKey('openai', 'A', 'key-a')
      const all = useModelSettingsStore.getState().listAllKeys('openai')
      expect(all.map((k) => k.id)).toEqual([all[0].id])
      expect(all[0].label).toBe('A')
    })
  })

  describe('resolveApiKey', () => {
    it('returns the default key value when no id is provided', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'default-key')
      expect(useModelSettingsStore.getState().resolveApiKey('openai')).toBe('default-key')
    })

    it('returns the default key when id="default" is passed explicitly', () => {
      useModelSettingsStore.getState().setApiKey('openai', 'default-key')
      expect(useModelSettingsStore.getState().resolveApiKey('openai', 'default')).toBe(
        'default-key'
      )
    })

    it('returns the matching additional key value by id', () => {
      const id = useModelSettingsStore.getState().addAdditionalKey('openai', 'A', 'key-a')
      expect(useModelSettingsStore.getState().resolveApiKey('openai', id)).toBe('key-a')
    })

    it('returns undefined for unknown ids', () => {
      expect(useModelSettingsStore.getState().resolveApiKey('openai', 'nope')).toBeUndefined()
    })

    it("always returns 'ollama' for the ollama provider", () => {
      expect(useModelSettingsStore.getState().resolveApiKey('ollama')).toBe('ollama')
      expect(useModelSettingsStore.getState().resolveApiKey('ollama', 'anything')).toBe('ollama')
    })
  })

  describe('markAdditionalKeyValid', () => {
    it('stamps lastTested and isValid', () => {
      const id = useModelSettingsStore.getState().addAdditionalKey('openai', 'A', 'key-a')
      useModelSettingsStore.getState().markAdditionalKeyValid('openai', id, true)
      const k = useModelSettingsStore.getState().additionalApiKeys.openai?.[0]
      expect(k?.isValid).toBe(true)
      expect(typeof k?.lastTested).toBe('string')
    })

    it('is a no-op for unknown id', () => {
      useModelSettingsStore.getState().addAdditionalKey('openai', 'A', 'key-a')
      const before = useModelSettingsStore.getState().additionalApiKeys.openai
      useModelSettingsStore.getState().markAdditionalKeyValid('openai', 'nope', true)
      expect(useModelSettingsStore.getState().additionalApiKeys.openai).toEqual(before)
    })
  })

  describe('cross-block persistence guarantee', () => {
    it('a key added in one place is visible to all other code paths', () => {
      // Simulates: user opens block A, adds key. Then opens block B — sees same key.
      useModelSettingsStore.getState().setApiKey('openai', 'shared-key')
      useModelSettingsStore.getState().addAdditionalKey('openai', 'Work', 'work-key')

      // Pretend "block B" reads via a different code path
      const all = useModelSettingsStore.getState().listAllKeys('openai')
      expect(all.map((k) => k.apiKey)).toEqual(['shared-key', 'work-key'])

      // Removing the default doesn't drop the named key
      useModelSettingsStore.getState().removeApiKey('openai')
      const after = useModelSettingsStore.getState().listAllKeys('openai')
      expect(after.map((k) => k.apiKey)).toEqual(['work-key'])
    })

    it('remembers default preference across reads', () => {
      useModelSettingsStore.getState().setDefaultPreference({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
      })
      // Simulate a "fresh read" — the state is the same store instance
      const pref = useModelSettingsStore.getState().defaultPreference
      expect(pref?.provider).toBe('anthropic')
      expect(pref?.model).toBe('claude-sonnet-4-6')
    })
  })

  describe('provider temperatures', () => {
    it('setProviderTemperature stores the value', () => {
      useModelSettingsStore.getState().setProviderTemperature('openai', 0.7)
      expect(useModelSettingsStore.getState().providerTemperatures.openai).toBe(0.7)
    })

    it('setProviderTemperature overrides existing value', () => {
      useModelSettingsStore.getState().setProviderTemperature('openai', 0.3)
      useModelSettingsStore.getState().setProviderTemperature('openai', 0.9)
      expect(useModelSettingsStore.getState().providerTemperatures.openai).toBe(0.9)
    })

    it('getProviderTemperature returns the stored value', () => {
      useModelSettingsStore.getState().setProviderTemperature('anthropic', 0.2)
      expect(useModelSettingsStore.getState().getProviderTemperature('anthropic')).toBe(0.2)
    })

    it('getProviderTemperature returns undefined when unset', () => {
      expect(useModelSettingsStore.getState().getProviderTemperature('openai')).toBeUndefined()
    })

    it('temperatures are stored per-provider', () => {
      useModelSettingsStore.getState().setProviderTemperature('openai', 0.1)
      useModelSettingsStore.getState().setProviderTemperature('anthropic', 0.9)
      const temps = useModelSettingsStore.getState().providerTemperatures
      expect(temps.openai).toBe(0.1)
      expect(temps.anthropic).toBe(0.9)
    })
  })
})
