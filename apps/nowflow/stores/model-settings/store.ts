import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '@/stores/safe-storage'
import { ProviderId } from '@/providers/types'
import {
  CombinedApiKey,
  ModelPreference,
  ModelSettingsState,
  ProviderApiKey,
  ProviderApiKeyConfig,
} from './types'

const MAX_RECENT_MODELS = 5

const generateKeyId = () =>
  `key_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export const useModelSettingsStore = create<ModelSettingsState>()(
  persist(
    (set, get) => ({
      apiKeys: {},
      additionalApiKeys: {},
      defaultPreference: null,
      recentModels: [],
      providerTemperatures: {},

      // ─── Legacy single-key actions ───────────────────────────────

      setApiKey: (provider: ProviderId, apiKey: string) => {
        set((state) => ({
          apiKeys: {
            ...state.apiKeys,
            [provider]: {
              ...(state.apiKeys[provider] || {}),
              apiKey,
              isValid: undefined,
              lastTested: undefined,
            } as ProviderApiKeyConfig,
          },
        }))
      },

      getApiKey: (provider: ProviderId) => {
        if (provider === 'ollama') return 'ollama'
        return get().apiKeys[provider]?.apiKey
      },

      removeApiKey: (provider: ProviderId) => {
        set((state) => {
          const newApiKeys = { ...state.apiKeys }
          delete newApiKeys[provider]
          return { apiKeys: newApiKeys }
        })
      },

      hasApiKey: (provider: ProviderId) => {
        if (provider === 'ollama') return true
        const key = get().apiKeys[provider]?.apiKey
        return !!key && key.trim() !== ''
      },

      markApiKeyValid: (provider: ProviderId, isValid: boolean) => {
        set((state) => {
          const existing = state.apiKeys[provider]
          if (!existing) return state
          return {
            apiKeys: {
              ...state.apiKeys,
              [provider]: {
                ...existing,
                isValid,
                lastTested: new Date().toISOString(),
              },
            },
          }
        })
      },

      // ─── Multi-key actions ────────────────────────────────────────

      addAdditionalKey: (provider: ProviderId, label: string, apiKey: string) => {
        const id = generateKeyId()
        const newKey: ProviderApiKey = {
          id,
          label: label.trim() || 'Untitled',
          apiKey,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({
          additionalApiKeys: {
            ...state.additionalApiKeys,
            [provider]: [...(state.additionalApiKeys[provider] || []), newKey],
          },
        }))
        return id
      },

      updateAdditionalKey: (provider, id, patch) => {
        set((state) => {
          const list = state.additionalApiKeys[provider]
          if (!list) return state
          return {
            additionalApiKeys: {
              ...state.additionalApiKeys,
              [provider]: list.map((k) =>
                k.id === id
                  ? {
                      ...k,
                      ...patch,
                      // Resetting key value invalidates prior validation status
                      isValid: patch.apiKey !== undefined ? undefined : k.isValid,
                      lastTested: patch.apiKey !== undefined ? undefined : k.lastTested,
                    }
                  : k
              ),
            },
          }
        })
      },

      removeAdditionalKey: (provider, id) => {
        set((state) => {
          const list = state.additionalApiKeys[provider]
          if (!list) return state
          const next = list.filter((k) => k.id !== id)
          const updated = { ...state.additionalApiKeys }
          if (next.length === 0) {
            delete updated[provider]
          } else {
            updated[provider] = next
          }
          return { additionalApiKeys: updated }
        })
      },

      markAdditionalKeyValid: (provider, id, isValid) => {
        set((state) => {
          const list = state.additionalApiKeys[provider]
          if (!list) return state
          return {
            additionalApiKeys: {
              ...state.additionalApiKeys,
              [provider]: list.map((k) =>
                k.id === id ? { ...k, isValid, lastTested: new Date().toISOString() } : k
              ),
            },
          }
        })
      },

      promoteAdditionalKeyToDefault: (provider, id) => {
        const state = get()
        const list = state.additionalApiKeys[provider] || []
        const target = list.find((k) => k.id === id)
        if (!target) return

        const oldDefault = state.apiKeys[provider]
        const newDefault: ProviderApiKeyConfig = {
          apiKey: target.apiKey,
          isValid: target.isValid,
          lastTested: target.lastTested,
        }

        // Remove the promoted key from additional list
        const remaining = list.filter((k) => k.id !== id)

        // If there was an old default with a value, demote it into additional.
        // Use a distinct fallback label so the demoted row is easy to tell apart
        // from the newly-promoted one (which kept its original label as default).
        const demoted: ProviderApiKey[] =
          oldDefault?.apiKey && oldDefault.apiKey.trim() !== ''
            ? [
                {
                  id: generateKeyId(),
                  label: 'Previous default',
                  apiKey: oldDefault.apiKey,
                  isValid: oldDefault.isValid,
                  lastTested: oldDefault.lastTested,
                  createdAt: new Date().toISOString(),
                },
                ...remaining,
              ]
            : remaining

        const additional = { ...state.additionalApiKeys }
        if (demoted.length === 0) {
          delete additional[provider]
        } else {
          additional[provider] = demoted
        }

        set({
          apiKeys: { ...state.apiKeys, [provider]: newDefault },
          additionalApiKeys: additional,
        })
      },

      // ─── Combined readers ─────────────────────────────────────────

      listAllKeys: (provider): CombinedApiKey[] => {
        const state = get()
        const out: CombinedApiKey[] = []
        const def = state.apiKeys[provider]
        if (def?.apiKey && def.apiKey.trim() !== '') {
          out.push({
            id: 'default',
            label: 'Default',
            apiKey: def.apiKey,
            isValid: def.isValid,
            lastTested: def.lastTested,
            createdAt: '', // legacy slot has no createdAt
            isDefault: true,
          })
        }
        for (const k of state.additionalApiKeys[provider] || []) {
          out.push({ ...k, isDefault: false })
        }
        return out
      },

      resolveApiKey: (provider, id) => {
        if (provider === 'ollama') return 'ollama'
        if (!id || id === 'default') {
          return get().apiKeys[provider]?.apiKey
        }
        const list = get().additionalApiKeys[provider] || []
        return list.find((k) => k.id === id)?.apiKey
      },

      // ─── Default preference / recents / temps ─────────────────────

      setDefaultPreference: (preference: ModelPreference) => {
        set({ defaultPreference: preference })
      },

      addRecentModel: (provider: ProviderId, model: string) => {
        set((state) => {
          const filtered = state.recentModels.filter(
            (r) => !(r.provider === provider && r.model === model)
          )
          return {
            recentModels: [{ provider, model }, ...filtered].slice(0, MAX_RECENT_MODELS),
          }
        })
      },

      setProviderTemperature: (provider: ProviderId, temperature: number) => {
        set((state) => ({
          providerTemperatures: {
            ...state.providerTemperatures,
            [provider]: temperature,
          },
        }))
      },

      getProviderTemperature: (provider: ProviderId) => {
        return get().providerTemperatures[provider]
      },
    }),
    {
      name: 'model-settings-store',
      // SSR-safe storage adapter — `localStorage` direct access crashes on the
      // Next.js server render. `safeStorage` no-ops on the server.
      storage: safeStorage,
      version: 2,
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        additionalApiKeys: state.additionalApiKeys,
        defaultPreference: state.defaultPreference,
        recentModels: state.recentModels,
        providerTemperatures: state.providerTemperatures,
      }),
      // v1 → v2 migration: existing users had no `additionalApiKeys` field.
      // Initialize it to `{}` so multi-key reads don't crash.
      // Guard: arrays satisfy `typeof === 'object'` and would pollute the shape
      // (and shadow `apiKeys` via numeric indices) when spread, so reject them.
      migrate: (persisted: any, fromVersion) => {
        if (!persisted || typeof persisted !== 'object' || Array.isArray(persisted)) {
          return undefined
        }
        if (fromVersion < 2) {
          return { ...persisted, additionalApiKeys: persisted.additionalApiKeys ?? {} }
        }
        return persisted
      },
    }
  )
)
