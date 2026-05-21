import { ProviderId } from '@/providers/types'

/**
 * The legacy / default API key for a provider.
 * One per provider. This is the slot that all the existing
 * code paths read from (modal, dropdown auto-fill, executor).
 *
 * Kept in this exact shape for backward compatibility with
 * code that does `apiKeys[provider]?.apiKey`.
 */
export type ProviderApiKeyConfig = {
  apiKey: string
  isValid?: boolean
  lastTested?: string
}

/**
 * An additional, labeled API key for a provider.
 * Users can add multiple of these; blocks pick which one to use
 * via `apiKeyId`. Kept separate from the default slot so legacy
 * call sites keep working.
 */
export type ProviderApiKey = {
  id: string
  label: string
  apiKey: string
  isValid?: boolean
  lastTested?: string
  createdAt: string
}

/**
 * Snapshot used for "list all keys for this provider" — merges the
 * default slot and the additional keys into a single uniform shape.
 * The default key is always reported with `id: 'default'`.
 */
export type CombinedApiKey = ProviderApiKey & { isDefault: boolean }

export type ModelPreference = {
  provider: ProviderId
  model: string
  /**
   * Optional reference to which saved key should be used when
   * the user creates a new block from this preference.
   * `undefined` / `'default'` → use the default slot for the provider.
   */
  apiKeyId?: string
  temperature?: number
}

export type ModelSettingsState = {
  // ─── Single-slot legacy storage (default key per provider) ───
  apiKeys: Partial<Record<ProviderId, ProviderApiKeyConfig>>

  // ─── Additional named keys per provider (multi-key support) ───
  additionalApiKeys: Partial<Record<ProviderId, ProviderApiKey[]>>

  // ─── Default model preference (used when a new block has no model) ───
  defaultPreference: ModelPreference | null

  // ─── Recently used models (for quick access) ───
  recentModels: { provider: ProviderId; model: string }[]

  // ─── Persisted temperature default per provider ───
  providerTemperatures: Partial<Record<ProviderId, number>>

  // ─── Legacy single-key actions (preserved exactly) ───
  setApiKey: (provider: ProviderId, apiKey: string) => void
  getApiKey: (provider: ProviderId) => string | undefined
  removeApiKey: (provider: ProviderId) => void
  hasApiKey: (provider: ProviderId) => boolean
  markApiKeyValid: (provider: ProviderId, isValid: boolean) => void

  // ─── Multi-key actions ───
  /** Add a new additional key. Returns the generated id. */
  addAdditionalKey: (provider: ProviderId, label: string, apiKey: string) => string
  /** Patch an existing additional key (label/value). Resets validation status. */
  updateAdditionalKey: (
    provider: ProviderId,
    id: string,
    patch: Partial<Pick<ProviderApiKey, 'label' | 'apiKey'>>
  ) => void
  /** Remove a labeled key. */
  removeAdditionalKey: (provider: ProviderId, id: string) => void
  /** Mark an additional key valid/invalid (also stamps lastTested). */
  markAdditionalKeyValid: (provider: ProviderId, id: string, isValid: boolean) => void
  /** Promote an additional key to the default slot. Old default becomes additional (kept). */
  promoteAdditionalKeyToDefault: (provider: ProviderId, id: string) => void

  // ─── Combined readers ───
  /** Return all keys for a provider in a uniform shape. Default first. */
  listAllKeys: (provider: ProviderId) => CombinedApiKey[]
  /** Resolve an API key string by id. `'default'` / undefined → default slot. */
  resolveApiKey: (provider: ProviderId, id?: string) => string | undefined

  // ─── Default preference / recents / temps ───
  setDefaultPreference: (preference: ModelPreference) => void
  addRecentModel: (provider: ProviderId, model: string) => void
  setProviderTemperature: (provider: ProviderId, temperature: number) => void
  getProviderTemperature: (provider: ProviderId) => number | undefined
}
