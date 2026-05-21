'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Thermometer,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'
import { ModelIcon, PROVIDER_COLORS, ProviderIcon } from '@/components/icons/model-icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useModelSettingsStore } from '@/stores/model-settings/store'
import type { CombinedApiKey } from '@/stores/model-settings/types'
import { useOllamaStore } from '@/stores/ollama/store'
import { useSubscription } from '@/hooks/use-subscription'
import { getProvidersWithModels } from '@/blocks/blocks/agent-model-helpers'
import { getMaxTemperature, supportsTemperature } from '@/providers/model-capabilities'
import { ProviderId } from '@/providers/types'
import { getProviderFromModel } from '@/providers/utils'
import { getTemperatureColor, getTemperatureLabel } from '../../../utils/temperature-utils'

// API key placeholder hints per provider
const API_KEY_HINTS: Partial<Record<ProviderId, string>> = {
  openai: 'API key',
  anthropic: 'API key',
  google: 'API key',
  deepseek: 'API key',
  xai: 'API key',
  cerebras: 'API key',
  groq: 'API key',
}

// Provider descriptions
const PROVIDER_DESCRIPTIONS: Partial<Record<ProviderId, string>> = {
  openai: 'GPT-4o, GPT-5, O3 and more',
  anthropic: 'Claude Opus, Sonnet, Haiku',
  google: 'Gemini Pro, Flash, Lite',
  deepseek: 'DeepSeek Chat & Reasoner',
  xai: 'Grok 3, Grok 4',
  cerebras: 'Ultra-fast inference',
  groq: 'Lightning-fast LPU inference',
  ollama: 'Run models locally',
}

// Model tier badges
function getModelTier(model: string): { label: string; color: string } | null {
  const m = model.toLowerCase()
  if (m.includes('opus') || m.includes('gpt-5.4') || m.includes('gpt-5.2') || m.includes('grok-4'))
    return { label: 'Flagship', color: 'bg-amber-500/15 text-amber-500 border-amber-500/20' }
  if (
    m.includes('sonnet') ||
    (m.includes('gpt-4o') && !m.includes('mini')) ||
    (m.includes('gpt-4.1') && !m.includes('mini')) ||
    m.includes('pro') ||
    (m.includes('grok-3') && !m.includes('mini'))
  )
    return { label: 'Pro', color: 'bg-violet-500/15 text-violet-500 border-violet-500/20' }
  if (
    m.includes('haiku') ||
    m.includes('mini') ||
    m.includes('flash') ||
    m.includes('lite') ||
    m.includes('nano')
  )
    return { label: 'Fast', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20' }
  return null
}

// Check if model is a reasoning model (no temperature)
function isReasoningModel(model: string): boolean {
  return !supportsTemperature(model)
}

interface ModelSettingsModalProps {
  blockId?: string
  onModelSelect?: (model: string) => void
  trigger?: React.ReactNode
}

export function ModelSettingsModal({ blockId, onModelSelect, trigger }: ModelSettingsModalProps) {
  const [open, setOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({})
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedModel, setHighlightedModel] = useState<string | null>(null)
  // Multi-key UI state
  const [activeKeyId, setActiveKeyId] = useState<string>('default')
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const { isPro, loading: subLoading } = useSubscription()

  const {
    setApiKey,
    removeApiKey,
    markApiKeyValid,
    addAdditionalKey,
    updateAdditionalKey,
    removeAdditionalKey,
    markAdditionalKeyValid,
    promoteAdditionalKeyToDefault,
    listAllKeys,
    resolveApiKey,
    recentModels,
    setProviderTemperature,
    getProviderTemperature,
  } = useModelSettingsStore()

  const { models: ollamaModels, isLoading: ollamaLoading, refreshModels } = useOllamaStore()

  const providersList = getProvidersWithModels()

  // Update ollama models in the providers list and gate Ollama for non-Pro
  const providersWithOllama = providersList
    .map((p) => {
      if (p.id === 'ollama') {
        return { ...p, models: ollamaModels }
      }
      return p
    })
    .filter((p) => {
      if (p.id === 'ollama' && !isPro && !subLoading) return false
      return true
    })

  const toggleKeyVisibility = useCallback((providerId: string) => {
    setShowKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }))
  }, [])

  // Build a stable composite test-result key — survives across providers since
  // multiple providers can have keys with id 'default'.
  const tkey = (provider: ProviderId, id: string) => `${provider}:${id}`

  // Update the value of an existing key (default slot or labeled extra).
  //
  // Important UX rule: do NOT delete the saved key entry just because the input
  // went empty mid-edit (the user might be select-all + retyping). Empty value
  // is a transient state — only the explicit trash button removes the key.
  //
  // Cross-block guarantee: this handler ONLY mutates the model-settings store
  // and the *active* block's per-block apiKey value. It never writes to
  // `setToolParam` (a global per-provider override) — that would silently
  // overwrite the apiKey of every other block on the workspace using this
  // provider whenever the user edits ANY saved key. Toolparam writes happen
  // only in `handleConfirmModel` after explicit user confirmation.
  const handleApiKeyValueChange = useCallback(
    (providerId: ProviderId, keyId: string, value: string) => {
      if (keyId === 'default') {
        // Empty default → store an empty placeholder so the input row stays
        // visible. The user can clear it for real with the trash button.
        setApiKey(providerId, value)
      } else {
        updateAdditionalKey(providerId, keyId, { apiKey: value })
      }
      setTestResults((prev) => ({ ...prev, [tkey(providerId, keyId)]: null }))
      setSavedFeedback(tkey(providerId, keyId))
      setTimeout(
        () => setSavedFeedback((prev) => (prev === tkey(providerId, keyId) ? null : prev)),
        2000
      )

      // Mirror the active key's value into the *current block only* so the
      // executor sees it without requiring the user to re-confirm.
      if (value.trim() !== '' && keyId === activeKeyId && blockId) {
        try {
          const { useSubBlockStore } = require('@/stores/workflows/subblock/store')
          useSubBlockStore.getState().setValue(blockId, 'apiKey', value)
        } catch {
          /* sub-block store optional in non-workflow contexts */
        }
      }
    },
    [setApiKey, updateAdditionalKey, blockId, activeKeyId]
  )

  // Test an arbitrary key by id
  const handleTestKey = useCallback(
    async (providerId: ProviderId, keyId: string) => {
      const key = resolveApiKey(providerId, keyId)
      if (!key) return

      const composite = tkey(providerId, keyId)
      setTestingKeyId(composite)
      setTestResults((prev) => ({ ...prev, [composite]: null }))

      try {
        const response = await fetch('/api/ai/test-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: providerId, apiKey: key }),
        })

        const data = await response.json()
        const isValid = data.success === true
        if (keyId === 'default') {
          markApiKeyValid(providerId, isValid)
        } else {
          markAdditionalKeyValid(providerId, keyId, isValid)
        }
        setTestResults((prev) => ({ ...prev, [composite]: isValid ? 'success' : 'error' }))
      } catch {
        if (keyId === 'default') {
          markApiKeyValid(providerId, false)
        } else {
          markAdditionalKeyValid(providerId, keyId, false)
        }
        setTestResults((prev) => ({ ...prev, [composite]: 'error' }))
      } finally {
        setTestingKeyId(null)
      }
    },
    [resolveApiKey, markApiKeyValid, markAdditionalKeyValid]
  )

  // Add a new labeled key
  const handleAddKey = useCallback(() => {
    if (!selectedProvider) return
    const label = newKeyLabel.trim() || 'Untitled'
    const value = newKeyValue.trim()
    if (!value) return
    const id = addAdditionalKey(selectedProvider, label, value)
    setActiveKeyId(id)
    setShowAddForm(false)
    setNewKeyLabel('')
    setNewKeyValue('')
    setSavedFeedback(tkey(selectedProvider, id))
    setTimeout(
      () => setSavedFeedback((prev) => (prev === tkey(selectedProvider, id) ? null : prev)),
      2000
    )
  }, [selectedProvider, newKeyLabel, newKeyValue, addAdditionalKey])

  // Begin renaming a key
  const handleStartEditLabel = useCallback((keyId: string, currentLabel: string) => {
    setEditingKeyId(keyId)
    setEditingLabel(currentLabel)
  }, [])

  const handleSaveLabel = useCallback(() => {
    if (!selectedProvider || !editingKeyId) return
    if (editingKeyId !== 'default') {
      updateAdditionalKey(selectedProvider, editingKeyId, {
        label: editingLabel.trim() || 'Untitled',
      })
    }
    setEditingKeyId(null)
    setEditingLabel('')
  }, [selectedProvider, editingKeyId, editingLabel, updateAdditionalKey])

  // Promote a labeled key to be the provider's default
  const handlePromoteToDefault = useCallback(
    (keyId: string) => {
      if (!selectedProvider || keyId === 'default') return
      promoteAdditionalKeyToDefault(selectedProvider, keyId)
      setActiveKeyId('default')
    },
    [selectedProvider, promoteAdditionalKeyToDefault]
  )

  // Delete a key entirely
  const handleDeleteKey = useCallback(
    (keyId: string) => {
      if (!selectedProvider) return
      if (keyId === 'default') {
        removeApiKey(selectedProvider)
      } else {
        removeAdditionalKey(selectedProvider, keyId)
      }
      setTestResults((prev) => ({ ...prev, [tkey(selectedProvider, keyId)]: null }))
      if (activeKeyId === keyId) setActiveKeyId('default')
    },
    [selectedProvider, removeApiKey, removeAdditionalKey, activeKeyId]
  )

  // Highlight model on click (don't close modal)
  const handleModelClick = useCallback((model: string) => {
    setHighlightedModel((prev) => (prev === model ? null : model))
  }, [])

  // Confirm selection and close modal — writes BOTH the literal apiKey value
  // AND the apiKeyId reference into the block's subblock store. Persisting the
  // id (not just the literal) is what lets us re-bind the block to the same
  // saved key after a reload, even if the user has multiple keys with the same
  // value. The id is the source of truth on hydration.
  const handleConfirmModel = useCallback(() => {
    if (!highlightedModel || !onModelSelect) return

    if (blockId && selectedProvider && selectedProvider !== 'ollama') {
      const keyValue = resolveApiKey(selectedProvider, activeKeyId)
      if (keyValue && keyValue.trim() !== '') {
        try {
          const { useSubBlockStore } = require('@/stores/workflows/subblock/store')
          const sbs = useSubBlockStore.getState()
          sbs.setValue(blockId, 'apiKey', keyValue)
          sbs.setValue(blockId, 'apiKeyId', activeKeyId)
          // Toolparam mirrors the chosen key for other blocks reading the same
          // provider — confirms reflect deliberate user intent so this is safe
          // (unlike the per-key edit path).
          sbs.setToolParam(selectedProvider, 'apiKey', keyValue)
        } catch {
          // sub-block store unavailable in non-workflow contexts — non-fatal
        }
      }
    }

    onModelSelect(highlightedModel)
    setOpen(false)
  }, [highlightedModel, onModelSelect, blockId, selectedProvider, activeKeyId, resolveApiKey])

  const handleTemperatureChange = useCallback(
    (providerId: ProviderId, temp: number) => {
      setProviderTemperature(providerId, temp)
      // Sync to sub-block store for executor
      if (blockId) {
        const { useSubBlockStore } = require('@/stores/workflows/subblock/store')
        useSubBlockStore.getState().setValue(blockId, 'temperature', temp)
      }
    },
    [setProviderTemperature, blockId]
  )

  const handleRefreshOllama = useCallback(async () => {
    await refreshModels()
  }, [refreshModels])

  // Auto-select first provider on open, or the provider of the current model
  // Also hydrate modelSettingsStore from subblock store if keys exist there but not here
  useEffect(() => {
    if (open) {
      setSearchQuery('')
      // Try to detect provider from current block's model
      if (blockId) {
        try {
          const { useSubBlockStore } = require('@/stores/workflows/subblock/store')
          const subBlockStore = useSubBlockStore.getState()
          const currentModel = subBlockStore.getValue(blockId, 'model')
          if (currentModel && typeof currentModel === 'string') {
            const provider = getProviderFromModel(currentModel)
            setSelectedProvider(provider)
            setHighlightedModel(currentModel)

            // Hydrate: if modelSettingsStore has no key but subblock store does, sync it
            const modalStore = useModelSettingsStore.getState()
            if (!modalStore.hasApiKey(provider) && provider !== 'ollama') {
              // Check per-block apiKey value
              const blockApiKey = subBlockStore.getValue(blockId, 'apiKey')
              if (blockApiKey && typeof blockApiKey === 'string' && blockApiKey.trim() !== '') {
                modalStore.setApiKey(provider, blockApiKey)
              } else {
                // Check toolParams (global per-provider key from DB)
                const toolParamKey = subBlockStore.getToolParam(provider, 'apiKey')
                if (
                  toolParamKey &&
                  typeof toolParamKey === 'string' &&
                  toolParamKey.trim() !== '' &&
                  !toolParamKey.startsWith('{{')
                ) {
                  modalStore.setApiKey(provider, toolParamKey)
                }
              }
            }
            return
          }
        } catch {}
      }
      if (!selectedProvider) {
        setSelectedProvider('openai')
      }

      // Hydrate all providers from subblock store toolParams
      try {
        const { useSubBlockStore } = require('@/stores/workflows/subblock/store')
        const subBlockStore = useSubBlockStore.getState()
        const modalStore = useModelSettingsStore.getState()
        const providerIds: ProviderId[] = [
          'openai',
          'anthropic',
          'google',
          'deepseek',
          'xai',
          'cerebras',
          'groq',
        ]
        for (const pid of providerIds) {
          if (!modalStore.hasApiKey(pid)) {
            const toolParamKey = subBlockStore.getToolParam(pid, 'apiKey')
            if (
              toolParamKey &&
              typeof toolParamKey === 'string' &&
              toolParamKey.trim() !== '' &&
              !toolParamKey.startsWith('{{')
            ) {
              modalStore.setApiKey(pid, toolParamKey)
            }
          }
        }
      } catch {}
    }
  }, [open, blockId])

  // Auto-refresh Ollama models when Ollama panel is selected (Pro only)
  useEffect(() => {
    if (open && selectedProvider === 'ollama' && isPro) {
      useOllamaStore.getState().refreshIfNeeded()
    }
  }, [open, selectedProvider, isPro])

  // Clear highlighted model + reset active key when switching providers.
  // Reset the active key to whichever value matches the block's stored apiKey
  // (so the right radio is pre-selected when reopening the modal). Falls back
  // to 'default'.
  useEffect(() => {
    setHighlightedModel(null)
    setEditingKeyId(null)
    setShowAddForm(false)
    if (!selectedProvider) {
      setActiveKeyId('default')
      return
    }
    let resolved: string = 'default'
    try {
      if (blockId) {
        const { useSubBlockStore } = require('@/stores/workflows/subblock/store')
        const sbs = useSubBlockStore.getState()
        const all = useModelSettingsStore.getState().listAllKeys(selectedProvider)

        // Source of truth: the explicit `apiKeyId` written on confirm. If the
        // referenced key was deleted, fall back through literal match → default.
        const storedKeyId = sbs.getValue(blockId, 'apiKeyId')
        if (
          storedKeyId &&
          typeof storedKeyId === 'string' &&
          all.some((k) => k.id === storedKeyId)
        ) {
          resolved = storedKeyId
        } else {
          // Legacy / never-confirmed blocks: best-effort literal match.
          const blockApiKey = sbs.getValue(blockId, 'apiKey')
          if (blockApiKey && typeof blockApiKey === 'string' && blockApiKey.trim() !== '') {
            const match = all.find((k) => k.apiKey === blockApiKey)
            if (match) resolved = match.id
          }
        }
      }
    } catch {}
    setActiveKeyId(resolved)
  }, [selectedProvider, blockId])

  const selectedProviderData = providersWithOllama.find((p) => p.id === selectedProvider)

  // Filter models by search query
  const filteredModels = useMemo(() => {
    if (!selectedProviderData) return []
    if (!searchQuery.trim()) return selectedProviderData.models
    const q = searchQuery.toLowerCase()
    return selectedProviderData.models.filter((m) => m.toLowerCase().includes(q))
  }, [selectedProviderData, searchQuery])

  const providerColors = selectedProvider ? PROVIDER_COLORS[selectedProvider] : null

  // Check temperature support for this provider's models
  const providerHasTempSupport = useMemo(() => {
    if (!selectedProviderData) return false
    return selectedProviderData.models.some((m) => supportsTemperature(m))
  }, [selectedProviderData])

  // Count how many models don't support temperature
  const noTempModelCount = useMemo(() => {
    if (!selectedProviderData) return 0
    return selectedProviderData.models.filter((m) => !supportsTemperature(m)).length
  }, [selectedProviderData])

  // Get temperature for current provider
  const currentTemp = selectedProvider ? getProviderTemperature(selectedProvider) : undefined
  const tempValue = currentTemp ?? 0.7
  // Get max temp from first model that supports temperature
  const firstTempModel = selectedProviderData?.models.find((m) => supportsTemperature(m))
  const maxTemp = firstTempModel ? (getMaxTemperature(firstTempModel) ?? 1) : 1

  // Highlighted model is selectable if any key resolves for the active selection
  // (default slot OR the chosen labeled key) — or the provider needs no key.
  const canConfirm = (() => {
    if (!highlightedModel || !selectedProviderData) return false
    if (!selectedProviderData.requiresApiKey) return true
    const resolved = resolveApiKey(selectedProviderData.id, activeKeyId)
    return !!resolved && resolved.trim() !== ''
  })()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 hover:bg-accent/80 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="community-ui-block-modal sm:max-w-[760px] max-h-[82vh] overflow-hidden flex flex-col p-0 gap-0 rounded-[16px]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
              <div className="community-ui-modal-frame-icon p-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              Model Configuration
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/60">
              Select a model, manage API keys, and fine-tune generation parameters.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Provider Sidebar */}
          <div className="community-ui-modal-sidebar w-[200px] shrink-0 border-r border-border/40 bg-muted/20 overflow-y-auto py-2 px-2">
            <div className="px-2 py-1.5 mb-1">
              <span className="community-ui-modal-nav-group-label text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Providers
              </span>
            </div>
            {providersWithOllama.map((provider) => {
              const allKeys = listAllKeys(provider.id)
              const isConfigured = allKeys.length > 0 || provider.id === 'ollama'
              const isSelected = selectedProvider === provider.id
              // Aggregate validation: any verified-valid → green; any verified-invalid → red;
              // otherwise unverified amber.
              const validationState = allKeys.some((k) => k.isValid === true)
                ? true
                : allKeys.some((k) => k.isValid === false)
                  ? false
                  : undefined
              const colors = PROVIDER_COLORS[provider.id]
              const keyCountSuffix = allKeys.length > 1 ? ` · ${allKeys.length} keys` : ''

              return (
                <button
                  key={provider.id}
                  onClick={() => {
                    setSelectedProvider(provider.id)
                    setSearchQuery('')
                  }}
                  data-active={isSelected}
                  className={cn(
                    'community-ui-modal-nav-button w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all duration-200 group',
                    isSelected
                      ? 'bg-background shadow-sm border border-border/60 text-foreground'
                      : 'hover:bg-background/50 text-muted-foreground hover:text-foreground border border-transparent'
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 shrink-0',
                      isSelected ? colors?.bg : colors?.bg || 'bg-muted/50 group-hover:bg-muted'
                    )}
                  >
                    <ProviderIcon providerId={provider.id} className="w-3.5 h-3.5" colored />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium text-[12px] truncate">{provider.label}</div>
                    <div className="text-[9px] text-muted-foreground/70 truncate">
                      {provider.models.length} model{provider.models.length !== 1 ? 's' : ''}
                      {keyCountSuffix}
                    </div>
                  </div>
                  {provider.requiresApiKey && (
                    <span className="shrink-0">
                      {isConfigured ? (
                        validationState === true ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        ) : validationState === false ? (
                          <XCircle className="h-3 w-3 text-red-400" />
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        )
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                      )}
                    </span>
                  )}
                  {!provider.requiresApiKey && provider.models.length > 0 && (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  )}
                </button>
              )
            })}

            {/* Locked Ollama entry for non-Pro users */}
            {!isPro && !subLoading && !providersWithOllama.some((p) => p.id === 'ollama') && (
              <div
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm',
                  'text-muted-foreground/30 cursor-not-allowed border border-transparent'
                )}
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted/30 shrink-0">
                  <ProviderIcon
                    providerId="ollama"
                    className="w-3.5 h-3.5 text-muted-foreground/30"
                    colored={false}
                  />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-[12px]">Ollama</div>
                  <div className="text-[9px]">Local models</div>
                </div>
                <span className="shrink-0 flex items-center gap-1">
                  <Lock className="h-2.5 w-2.5" />
                  <span className="text-[8px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    Pro
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Provider Detail */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {selectedProviderData && (
              <div className="flex-1 overflow-y-auto">
                <div className="p-5 space-y-4">
                  {/* Provider Header */}
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex items-center justify-center w-9 h-9 rounded-xl shrink-0',
                        providerColors?.bg
                      )}
                    >
                      <ProviderIcon
                        providerId={selectedProviderData.id}
                        className="w-4.5 h-4.5"
                        colored
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">{selectedProviderData.label}</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {PROVIDER_DESCRIPTIONS[selectedProviderData.id] ||
                          `${selectedProviderData.models.length} models available`}
                      </p>
                    </div>
                  </div>

                  {/* API Key Section — multi-key */}
                  {selectedProviderData.requiresApiKey && (
                    <div className="community-ui-modal-panel space-y-2.5 p-3.5 rounded-xl bg-muted/25 border border-border/25">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Key className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[11px] font-medium text-muted-foreground">
                            API Keys
                          </span>
                          <span className="text-[9px] text-muted-foreground/60">
                            ({listAllKeys(selectedProviderData.id).length})
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowAddForm((prev) => !prev)
                            setNewKeyLabel('')
                            setNewKeyValue('')
                          }}
                          className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add key
                        </Button>
                      </div>

                      {/* Saved keys list — default first, then labeled extras.
                          When the list is empty, show an inline empty-default row so the
                          user can still type an api key into the default slot. */}
                      <div className="space-y-1.5">
                        {(() => {
                          const allKeys = listAllKeys(selectedProviderData.id)
                          // Always render at least the default slot so users with no
                          // saved keys can still enter one.
                          const rows =
                            allKeys.length > 0
                              ? allKeys
                              : [
                                  {
                                    id: 'default',
                                    label: 'Default',
                                    apiKey: '',
                                    isDefault: true,
                                    createdAt: '',
                                  } as CombinedApiKey,
                                ]
                          return rows.map((row) => {
                            const composite = tkey(selectedProviderData.id, row.id)
                            const isShown = !!showKeys[composite]
                            const isActive = activeKeyId === row.id
                            const isEditingThis = editingKeyId === row.id
                            return (
                              <div
                                key={row.id}
                                className={cn(
                                  'rounded-lg border transition-colors',
                                  isActive
                                    ? 'border-primary/40 bg-primary/[0.04]'
                                    : 'border-border/25 bg-background/30 hover:border-border/40'
                                )}
                              >
                                <div className="flex items-center gap-1.5 px-2 py-1.5">
                                  {/* Active radio */}
                                  <button
                                    type="button"
                                    onClick={() => setActiveKeyId(row.id)}
                                    title="Use this key for the current block"
                                    className={cn(
                                      'h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                                      isActive
                                        ? 'border-primary bg-primary'
                                        : 'border-border/60 hover:border-primary/60'
                                    )}
                                  >
                                    {isActive && (
                                      <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                                    )}
                                  </button>

                                  {/* Label / rename */}
                                  <div className="min-w-0 flex-1">
                                    {isEditingThis && row.id !== 'default' ? (
                                      <Input
                                        value={editingLabel}
                                        onChange={(e) => setEditingLabel(e.target.value)}
                                        onBlur={handleSaveLabel}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveLabel()
                                          if (e.key === 'Escape') {
                                            setEditingKeyId(null)
                                            setEditingLabel('')
                                          }
                                        }}
                                        autoFocus
                                        className="h-6 text-[11px] px-2"
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          row.id !== 'default' &&
                                          handleStartEditLabel(row.id, row.label)
                                        }
                                        disabled={row.id === 'default'}
                                        className={cn(
                                          'flex items-center gap-1 text-[11px] truncate text-left',
                                          row.id === 'default'
                                            ? 'text-foreground/80 font-medium cursor-default'
                                            : 'text-foreground/70 hover:text-foreground'
                                        )}
                                      >
                                        {row.isDefault && (
                                          <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                                        )}
                                        <span className="truncate">{row.label}</span>
                                        {row.id !== 'default' && (
                                          <Edit3 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60" />
                                        )}
                                      </button>
                                    )}
                                  </div>

                                  {/* Validation status pill */}
                                  {row.isValid === true && (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                  )}
                                  {row.isValid === false && (
                                    <XCircle className="h-3 w-3 text-red-400" />
                                  )}
                                </div>

                                {/* Key input row */}
                                <div className="flex gap-1 px-2 pb-2">
                                  <div className="relative flex-1">
                                    <Input
                                      type={isShown ? 'text' : 'password'}
                                      value={row.apiKey}
                                      onChange={(e) =>
                                        handleApiKeyValueChange(
                                          selectedProviderData.id,
                                          row.id,
                                          e.target.value
                                        )
                                      }
                                      placeholder={
                                        API_KEY_HINTS[selectedProviderData.id] || 'Enter API key...'
                                      }
                                      className="pr-8 font-mono text-[11px] bg-background/50 border-border/30 focus:border-primary/40 h-7"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => toggleKeyVisibility(composite)}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
                                    >
                                      {isShown ? (
                                        <EyeOff className="h-3 w-3" />
                                      ) : (
                                        <Eye className="h-3 w-3" />
                                      )}
                                    </button>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTestKey(selectedProviderData.id, row.id)}
                                    disabled={
                                      !row.apiKey ||
                                      row.apiKey.trim() === '' ||
                                      testingKeyId === composite
                                    }
                                    className="h-7 px-2 text-[10px] border-border/30"
                                  >
                                    {testingKeyId === composite ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      'Verify'
                                    )}
                                  </Button>
                                  {!row.isDefault && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handlePromoteToDefault(row.id)}
                                      title="Make this the default key"
                                      className="h-7 w-7 text-muted-foreground/70 hover:text-amber-500"
                                    >
                                      <Star className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {row.apiKey && row.apiKey.trim() !== '' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteKey(row.id)}
                                      className="h-7 w-7 text-muted-foreground/70 hover:text-red-400"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>

                                {/* Saved feedback / test result */}
                                {savedFeedback === composite && (
                                  <div className="px-2 pb-1.5">
                                    <span className="text-[9px] text-emerald-500 flex items-center gap-1 animate-in fade-in-0 duration-200">
                                      <CheckCircle2 className="h-2.5 w-2.5" />
                                      Saved
                                    </span>
                                  </div>
                                )}
                                {testResults[composite] === 'success' && (
                                  <div className="px-2 pb-1.5">
                                    <p className="text-[9px] text-emerald-500 flex items-center gap-1">
                                      <CheckCircle2 className="h-2.5 w-2.5" />
                                      Verified
                                    </p>
                                  </div>
                                )}
                                {testResults[composite] === 'error' && (
                                  <div className="px-2 pb-1.5">
                                    <p className="text-[9px] text-red-400 flex items-center gap-1">
                                      <XCircle className="h-2.5 w-2.5" />
                                      Verification failed
                                    </p>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        })()}

                        {/* Add-new form */}
                        {showAddForm && (
                          <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-2 space-y-1.5">
                            <Input
                              value={newKeyLabel}
                              onChange={(e) => setNewKeyLabel(e.target.value)}
                              placeholder="Label (e.g. Personal, Work)"
                              className="h-7 text-[11px]"
                            />
                            <Input
                              type="password"
                              value={newKeyValue}
                              onChange={(e) => setNewKeyValue(e.target.value)}
                              placeholder={
                                API_KEY_HINTS[selectedProviderData.id] || 'Enter API key...'
                              }
                              className="h-7 font-mono text-[11px]"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddKey()
                              }}
                            />
                            <div className="flex justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setShowAddForm(false)
                                  setNewKeyLabel('')
                                  setNewKeyValue('')
                                }}
                                className="h-7 px-2 text-[10px]"
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleAddKey}
                                disabled={!newKeyValue.trim()}
                                className="h-7 px-3 text-[10px]"
                              >
                                Save key
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <p className="text-[9px] text-muted-foreground/70">
                        Keys persist across sessions in your browser. Manage them globally in{' '}
                        <button
                          type="button"
                          onClick={() => {
                            window.dispatchEvent(
                              new CustomEvent('open-settings', { detail: { tab: 'aiproviders' } })
                            )
                          }}
                          className="underline hover:text-foreground"
                        >
                          Settings → AI Providers
                        </button>
                        . Also accepts env{' '}
                        <code className="px-1 py-0.5 bg-background/50 rounded text-[8px] font-mono">
                          {selectedProviderData.id.toUpperCase()}_API_KEY
                        </code>
                      </p>
                    </div>
                  )}

                  {/* Ollama-specific refresh */}
                  {selectedProviderData.id === 'ollama' && (
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/25 border border-border/25">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Local Instance
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshOllama}
                        disabled={ollamaLoading}
                        className="h-7 text-[11px] border-border/30"
                      >
                        {ollamaLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1.5" />
                        )}
                        Refresh
                      </Button>
                    </div>
                  )}

                  {/* Temperature Control */}
                  {selectedProviderData.models.length > 0 && (
                    <div className="space-y-2.5 p-3.5 rounded-xl bg-muted/25 border border-border/25">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Thermometer className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Temperature
                          </span>
                        </div>
                        {providerHasTempSupport ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                              style={{ color: getTemperatureColor(tempValue) }}
                            >
                              {getTemperatureLabel(tempValue)}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-7 text-right">
                              {tempValue.toFixed(1)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded-md">
                            Not adjustable
                          </span>
                        )}
                      </div>
                      {providerHasTempSupport ? (
                        <>
                          <Slider
                            value={[tempValue]}
                            onValueChange={([val]) =>
                              handleTemperatureChange(selectedProviderData.id, val)
                            }
                            min={0}
                            max={maxTemp}
                            step={0.1}
                            className="w-full"
                          />
                          <div className="flex items-center justify-between text-[9px] text-muted-foreground/70">
                            <span>Precise</span>
                            <span>{maxTemp <= 1 ? 'Creative' : 'Experimental'}</span>
                          </div>
                          {noTempModelCount > 0 && (
                            <p className="text-[9px] text-amber-500 flex items-center gap-1">
                              <Thermometer className="h-2.5 w-2.5" />
                              {noTempModelCount} reasoning model{noTempModelCount > 1 ? 's' : ''}{' '}
                              ignore temperature
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-[9px] text-muted-foreground/70">
                          All models from this provider are reasoning models with fixed temperature.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Models Section */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Models
                        <span className="ml-1.5 text-muted-foreground/60">
                          {filteredModels.length}
                        </span>
                      </span>
                      {selectedProviderData.models.length > 4 && (
                        <div className="relative w-40">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
                          <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter models..."
                            className="h-7 pl-7 text-[11px] bg-background/50 border-border/25 focus:border-primary/30"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-0.5 max-h-[220px] overflow-y-auto pr-1 -mr-1">
                      {filteredModels.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="w-9 h-9 rounded-full bg-muted/40 flex items-center justify-center mb-2">
                            <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
                          </div>
                          <p className="text-[11px] text-muted-foreground/70">
                            {searchQuery
                              ? 'No models match your search'
                              : selectedProviderData.requiresApiKey &&
                                  listAllKeys(selectedProviderData.id).length === 0
                                ? 'Add an API key to use these models'
                                : 'No models available'}
                          </p>
                        </div>
                      ) : (
                        filteredModels.map((model) => {
                          const isRecent = recentModels.some(
                            (r) => r.model === model && r.provider === selectedProviderData.id
                          )
                          const canSelect =
                            !selectedProviderData.requiresApiKey ||
                            listAllKeys(selectedProviderData.id).length > 0
                          const tier = getModelTier(model)
                          const isReasoning = isReasoningModel(model)
                          const isHighlighted = highlightedModel === model

                          return (
                            <button
                              key={model}
                              onClick={() => canSelect && handleModelClick(model)}
                              disabled={!canSelect}
                              className={cn(
                                'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left transition-all duration-150 group',
                                canSelect
                                  ? 'cursor-pointer active:scale-[0.995]'
                                  : 'opacity-35 cursor-not-allowed',
                                isHighlighted
                                  ? 'bg-primary/8 border-primary/30 shadow-sm shadow-primary/5'
                                  : 'hover:bg-muted/40 border-transparent',
                                'border'
                              )}
                            >
                              {/* Selection indicator */}
                              <div
                                className={cn(
                                  'flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-all duration-150',
                                  isHighlighted
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : canSelect
                                      ? providerColors?.bg
                                      : 'bg-muted/20',
                                  !isHighlighted && 'group-hover:shadow-sm'
                                )}
                              >
                                {isHighlighted ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <ModelIcon
                                    modelId={model}
                                    providerId={selectedProviderData.id}
                                    className="w-3.5 h-3.5"
                                    colored
                                  />
                                )}
                              </div>

                              {/* Model Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      'font-mono text-[11px] truncate',
                                      isHighlighted
                                        ? 'font-semibold text-foreground'
                                        : 'font-medium text-foreground/80'
                                    )}
                                  >
                                    {model}
                                  </span>
                                  {isReasoning && (
                                    <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 bg-blue-500/12 text-blue-500 border-blue-500/15">
                                      Reasoning
                                    </span>
                                  )}
                                  {tier && (
                                    <span
                                      className={cn(
                                        'text-[8px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0',
                                        tier.color
                                      )}
                                    >
                                      {tier.label}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right side indicators */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isRecent && (
                                  <span className="flex items-center gap-1 text-[8px] text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded-md">
                                    <Clock className="h-2 w-2" />
                                    Recent
                                  </span>
                                )}
                                {!isHighlighted && onModelSelect && canSelect && (
                                  <ChevronRight className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom bar with confirm button */}
            {onModelSelect && (
              <div className="shrink-0 border-t border-border/40 bg-muted/15 px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {highlightedModel ? (
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'flex items-center justify-center w-5 h-5 rounded-md shrink-0',
                            providerColors?.bg
                          )}
                        >
                          <ModelIcon
                            modelId={highlightedModel}
                            providerId={selectedProvider!}
                            className="w-2.5 h-2.5"
                            colored
                          />
                        </div>
                        <span className="text-[11px] font-mono font-medium truncate">
                          {highlightedModel}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/70">
                        Select a model from the list above
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={handleConfirmModel}
                    disabled={!canConfirm}
                    size="sm"
                    className={cn(
                      'h-8 px-4 text-[11px] font-medium transition-all duration-200',
                      canConfirm
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground/60'
                    )}
                  >
                    <Check className="h-3 w-3 mr-1.5" />
                    Use Model
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
