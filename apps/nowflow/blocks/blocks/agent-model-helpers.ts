/**
 * Shared model selection helpers for all agent blocks.
 * Provides consistent model dropdown options, temperature subblocks,
 * and API key subblocks across all agent types.
 */
import { useModelSettingsStore } from '@/stores/model-settings/store'
import { useOllamaStore } from '@/stores/ollama/store'
import { ProviderId } from '@/providers/types'
import { getProviderFromModel, providers } from '@/providers/utils'
import { SubBlockConfig } from '../types'

// Provider display metadata
const PROVIDER_META: Record<string, { label: string; emoji: string }> = {
  openai: { label: 'OpenAI', emoji: '🤖' },
  anthropic: { label: 'Anthropic', emoji: '🧠' },
  google: { label: 'Google', emoji: '🔷' },
  deepseek: { label: 'DeepSeek', emoji: '🔍' },
  xai: { label: 'xAI (Grok)', emoji: '⚡' },
  cerebras: { label: 'Cerebras', emoji: '🧪' },
  groq: { label: 'Groq', emoji: '🚀' },
  ollama: { label: 'Local (Ollama)', emoji: '🦙' },
}

// ─── In-memory caches for model options ───
// These prevent rebuilding large arrays on every render.
// Cache invalidates when Ollama model list changes (the only dynamic part).
let _modelOptionsCache: Array<{ label: string; id: string; group?: string }> | null = null
let _modelOptionsCacheKey: string = ''

let _providersCache: Array<{
  id: ProviderId
  label: string
  emoji: string
  models: string[]
  requiresApiKey: boolean
}> | null = null
let _providersCacheKey: string = ''

/**
 * Returns provider-grouped model options for the model dropdown.
 * Models are grouped by provider with emoji labels.
 * Results are cached and only recomputed when Ollama models change.
 */
export function getModelOptions(): Array<{ label: string; id: string; group?: string }> {
  const ollamaModels = useOllamaStore.getState().models
  const cacheKey = ollamaModels.join(',')

  if (_modelOptionsCache && _modelOptionsCacheKey === cacheKey) {
    return _modelOptionsCache
  }

  const options: Array<{ label: string; id: string; group?: string }> = []

  // Add cloud models grouped by provider
  for (const [providerId, config] of Object.entries(providers)) {
    if (providerId === 'ollama') continue
    const meta = PROVIDER_META[providerId] || { label: providerId, emoji: '?' }

    for (const model of config.models) {
      options.push({
        label: model,
        id: model,
        group: meta.label,
      })
    }
  }

  // Add Ollama (local) models
  if (ollamaModels.length > 0) {
    for (const model of ollamaModels) {
      options.push({
        label: model,
        id: model,
        group: 'Local (Ollama)',
      })
    }
  }

  _modelOptionsCache = options
  _modelOptionsCacheKey = cacheKey
  return options
}

/**
 * Returns the set of SubBlockConfigs shared by all agent blocks:
 * - Model selector (opens modal for model selection, API key & temperature management)
 *
 * Temperature and API key are managed via the Model Settings modal.
 * Values are written to sub-block store programmatically so the executor
 * can still read inputs.apiKey and inputs.temperature.
 */
export function getModelSubBlocks(): SubBlockConfig[] {
  return [
    {
      id: 'model',
      title: 'Model',
      type: 'dropdown',
      layout: 'full',
      options: getModelOptions,
    },
  ]
}

/**
 * Returns provider metadata for UI display
 */
export function getProviderMeta(providerId: string) {
  return PROVIDER_META[providerId] || { label: providerId, emoji: '❓' }
}

/**
 * Pick which model a freshly-opened block should default to.
 * Resolution order:
 *   1. user's saved `defaultPreference.model` (if its provider is reachable)
 *   2. first model of the user's most recently used provider
 *   3. `'gpt-4o'` (universal fallback)
 *
 * Pure read against zustand stores — safe to call from render.
 */
export function getPreferredDefaultModel(): string {
  try {
    const settings = useModelSettingsStore.getState()
    const pref = settings.defaultPreference
    if (pref?.model) return pref.model

    const recent = settings.recentModels[0]
    if (recent?.model) return recent.model
  } catch {
    // SSR / store not initialized — fall through
  }
  return 'gpt-4o'
}

/**
 * Detects strings that should be treated as env-var placeholders rather than
 * literal API keys, so they fall through to executor-side resolution instead
 * of being sent to the provider verbatim.
 *
 * - `{{NAME}}` — NowFlow's tag-style placeholder (matches anywhere)
 * - `$NAME` — shell-style placeholder (must be the *entire* value to avoid
 *   wrongly skipping real keys that happen to start with `$`, which some
 *   self-hosted gateways use as a key prefix).
 */
const ENV_VAR_PLACEHOLDER = /^\$[A-Z_][A-Z0-9_]*$/i
const TAG_PLACEHOLDER = /\{\{[^}]+\}\}/

/**
 * Resolve the actual API key string a block should send to the provider.
 *
 * Resolution order:
 *   1. literal `explicitValue` if supplied (per-block override)
 *   2. additional saved key referenced by `keyId`
 *   3. provider default (legacy single-key slot)
 *
 * Returns `'ollama'` for Ollama (matches existing convention).
 * Returns `undefined` if nothing resolves — callers decide whether to error.
 *
 * Defensive: `explicitValue` may arrive as `null` / non-string at runtime
 * (the `apiKey` subblock is loosely typed). Coerce safely instead of throwing.
 */
export function resolveApiKeyForBlock(
  provider: ProviderId,
  opts: { keyId?: string; explicitValue?: string | null } = {}
): string | undefined {
  if (provider === 'ollama') return 'ollama'

  const raw = opts.explicitValue
  const explicit = typeof raw === 'string' ? raw.trim() : ''
  // Ignore env-var placeholder strings — those are resolved later in the executor
  if (explicit && !TAG_PLACEHOLDER.test(explicit) && !ENV_VAR_PLACEHOLDER.test(explicit)) {
    return explicit
  }

  try {
    return useModelSettingsStore.getState().resolveApiKey(provider, opts.keyId)
  } catch {
    return undefined
  }
}

/**
 * Convenience: given a model name, return its provider id.
 * Wraps `getProviderFromModel` so callers don't have to import from `providers/utils`.
 */
export function providerForModel(model: string): ProviderId {
  return getProviderFromModel(model) as ProviderId
}

/**
 * Returns all available providers with their models for the settings modal.
 * Results are cached and only recomputed when Ollama models change.
 */
export function getProvidersWithModels(): Array<{
  id: ProviderId
  label: string
  emoji: string
  models: string[]
  requiresApiKey: boolean
}> {
  const ollamaModels = useOllamaStore.getState().models
  const cacheKey = ollamaModels.join(',')

  if (_providersCache && _providersCacheKey === cacheKey) {
    return _providersCache
  }

  const result = Object.entries(providers).map(([id, config]) => {
    const meta = PROVIDER_META[id] || { label: id, emoji: '❓' }
    return {
      id: id as ProviderId,
      label: meta.label,
      emoji: meta.emoji,
      // For Ollama, use persisted store models (not the empty providers.ollama.models)
      models: id === 'ollama' ? ollamaModels : config.models,
      requiresApiKey: id !== 'ollama',
    }
  })

  _providersCache = result
  _providersCacheKey = cacheKey
  return result
}
