'use client'

/**
 * Settings → AI Providers
 *
 * Centralized view of every AI provider configured in the workspace:
 *   - lists all saved API keys per provider (default + labeled extras)
 *   - lets the user add / rename / promote / delete keys
 *   - lets the user pick a workspace-wide "default model" preference
 *
 * This screen reads/writes `useModelSettingsStore`, which is the same store
 * used by the in-block ModelSettingsModal — so changes here propagate to
 * every block that uses an LLM.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  Edit3,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Plus,
  Sparkles,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { ProviderIcon } from '@/components/icons/model-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useModelSettingsStore } from '@/stores/model-settings/store'
import type {
  CombinedApiKey,
  ModelSettingsState,
  ProviderApiKey,
  ProviderApiKeyConfig,
} from '@/stores/model-settings/types'
import { getProvidersWithModels } from '@/blocks/blocks/agent-model-helpers'
import type { ProviderId } from '@/providers/types'

const API_KEY_HINTS: Partial<Record<ProviderId, string>> = {
  openai: 'API key',
  anthropic: 'API key',
  google: 'API key',
  deepseek: 'API key',
  xai: 'API key',
  cerebras: 'API key',
  groq: 'API key',
}

type TestState = 'idle' | 'testing' | 'success' | 'error'
type ProviderWithModels = ReturnType<typeof getProvidersWithModels>[number]

const EMPTY_PROVIDER_API_KEYS: ProviderApiKey[] = []
const EMPTY_COMBINED_KEYS: CombinedApiKey[] = []
const EMPTY_MODEL_OPTIONS: string[] = []
const EMPTY_DEFAULT_ROWS: CombinedApiKey[] = [
  {
    id: 'default',
    label: 'Default',
    apiKey: '',
    isDefault: true,
    createdAt: '',
  },
]

function selectTotalConfiguredKeys(state: ModelSettingsState) {
  let total = 0

  for (const [provider, config] of Object.entries(state.apiKeys)) {
    if (provider !== 'ollama' && config?.apiKey?.trim()) {
      total += 1
    }
  }

  for (const [provider, keys] of Object.entries(state.additionalApiKeys)) {
    if (provider !== 'ollama' && Array.isArray(keys)) {
      total += keys.length
    }
  }

  return total
}

function getCombinedProviderKeys(
  defaultKey?: ProviderApiKeyConfig,
  additionalKeys: ProviderApiKey[] = EMPTY_PROVIDER_API_KEYS
): CombinedApiKey[] {
  const hasDefaultKey = !!defaultKey?.apiKey?.trim()

  if (!hasDefaultKey && additionalKeys.length === 0) {
    return EMPTY_COMBINED_KEYS
  }

  const keys: CombinedApiKey[] = []

  if (defaultKey?.apiKey?.trim()) {
    keys.push({
      id: 'default',
      label: 'Default',
      apiKey: defaultKey.apiKey,
      isValid: defaultKey.isValid,
      lastTested: defaultKey.lastTested,
      createdAt: '',
      isDefault: true,
    })
  }

  for (const key of additionalKeys) {
    keys.push({ ...key, isDefault: false })
  }

  return keys
}

export function AIProviders() {
  const {
    setApiKey,
    removeApiKey,
    markApiKeyValid,
    addAdditionalKey,
    updateAdditionalKey,
    removeAdditionalKey,
    markAdditionalKeyValid,
    promoteAdditionalKeyToDefault,
    defaultPreference,
    setDefaultPreference,
  } = useModelSettingsStore(
    useShallow((state) => ({
      setApiKey: state.setApiKey,
      removeApiKey: state.removeApiKey,
      markApiKeyValid: state.markApiKeyValid,
      addAdditionalKey: state.addAdditionalKey,
      updateAdditionalKey: state.updateAdditionalKey,
      removeAdditionalKey: state.removeAdditionalKey,
      markAdditionalKeyValid: state.markAdditionalKeyValid,
      promoteAdditionalKeyToDefault: state.promoteAdditionalKeyToDefault,
      defaultPreference: state.defaultPreference,
      setDefaultPreference: state.setDefaultPreference,
    }))
  )

  const totalKeys = useModelSettingsStore(selectTotalConfiguredKeys)
  const providersList = useMemo(() => getProvidersWithModels(), [])
  const providersById = useMemo(
    () => new Map(providersList.map((provider) => [provider.id, provider])),
    [providersList]
  )
  const providersRequiringKeys = useMemo(
    () => providersList.filter((provider) => provider.requiresApiKey),
    [providersList]
  )

  // ─── Default preference (provider + model) ────────────────────────
  const handleDefaultProviderChange = useCallback(
    (providerId: string) => {
      const provider = providerId as ProviderId
      const provData = providersById.get(provider)
      const firstModel = provData?.models?.[0]
      if (!firstModel) return
      setDefaultPreference({ provider, model: firstModel })
    },
    [providersById, setDefaultPreference]
  )

  const handleDefaultModelChange = useCallback(
    (model: string) => {
      const provider = defaultPreference?.provider
      if (!provider) return
      setDefaultPreference({ provider, model })
    },
    [defaultPreference?.provider, setDefaultPreference]
  )

  // ─── Key value editing ───────────────────────────────────────────
  // Empty value is treated as a transient mid-edit state and the key entry is
  // preserved (label, validation history). Removal happens only via the trash
  // button. This matches the in-block modal's behavior and prevents accidental
  // data loss during select-all + retype.
  const handleKeyValueChange = useCallback(
    (provider: ProviderId, keyId: string, value: string) => {
      if (keyId === 'default') {
        setApiKey(provider, value)
      } else {
        updateAdditionalKey(provider, keyId, { apiKey: value })
      }
    },
    [setApiKey, updateAdditionalKey]
  )

  const handleAddKey = useCallback(
    (provider: ProviderId, label: string, apiKey: string) => {
      const value = apiKey.trim()
      if (!value) return
      addAdditionalKey(provider, label.trim() || 'Untitled', value)
    },
    [addAdditionalKey]
  )

  const handleRename = useCallback(
    (provider: ProviderId, id: string, label: string) => {
      if (id === 'default') return
      updateAdditionalKey(provider, id, {
        label: label.trim() || 'Untitled',
      })
    },
    [updateAdditionalKey]
  )

  const handlePromote = useCallback(
    (provider: ProviderId, id: string) => {
      promoteAdditionalKeyToDefault(provider, id)
    },
    [promoteAdditionalKeyToDefault]
  )

  const handleDelete = useCallback(
    (provider: ProviderId, id: string) => {
      if (id === 'default') removeApiKey(provider)
      else removeAdditionalKey(provider, id)
    },
    [removeApiKey, removeAdditionalKey]
  )

  const handleTest = useCallback(
    async (provider: ProviderId, id: string, apiKey: string): Promise<TestState> => {
      const key = apiKey.trim()
      if (!key) return 'idle'
      try {
        const res = await fetch('/api/ai/test-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, apiKey: key }),
        })
        const data = await res.json()
        const ok = data.success === true
        if (id === 'default') markApiKeyValid(provider, ok)
        else markAdditionalKeyValid(provider, id, ok)
        return ok ? 'success' : 'error'
      } catch {
        if (id === 'default') markApiKeyValid(provider, false)
        else markAdditionalKeyValid(provider, id, false)
        return 'error'
      }
    },
    [markApiKeyValid, markAdditionalKeyValid]
  )

  const defaultProvData = defaultPreference
    ? providersById.get(defaultPreference.provider)
    : undefined
  const defaultModelOptions = defaultProvData?.models || EMPTY_MODEL_OPTIONS

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="border-b border-border/40 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">AI Providers</h2>
            <p className="text-[11px] text-muted-foreground/70">
              Manage API keys and the default model used by every AI block.{' '}
              <span className="text-muted-foreground">
                {totalKeys} key{totalKeys === 1 ? '' : 's'} configured
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        {/* Default model preference */}
        <section className="rounded-lg border border-border/50 bg-muted/15 p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-1.5">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            <h3 className="text-[12px] font-semibold">Default Model</h3>
          </div>
          <p className="mb-3 text-[11px] text-muted-foreground/80">
            Newly added blocks open with this provider/model selected. Each block can still be
            overridden individually.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <Label className="text-[10px] text-muted-foreground">Provider</Label>
              <Select
                value={defaultPreference?.provider || ''}
                onValueChange={handleDefaultProviderChange}
              >
                <SelectTrigger className="mt-1.5 h-9 rounded-md border-border/60 bg-background text-xs shadow-none">
                  <SelectValue placeholder="Select provider..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {providersList.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label className="text-[10px] text-muted-foreground">Model</Label>
              <Select
                value={defaultPreference?.model || ''}
                onValueChange={handleDefaultModelChange}
                disabled={!defaultProvData}
              >
                <SelectTrigger className="mt-1.5 h-9 rounded-md border-border/60 bg-background text-xs shadow-none">
                  <SelectValue placeholder="Select model..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {defaultModelOptions.map((m) => (
                    <SelectItem key={m} value={m} className="font-mono text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Per-provider key management */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-[12px] font-semibold">
            <Key className="h-3 w-3" />
            Saved Keys by Provider
          </h3>
          {providersRequiringKeys.map((provider) => (
            <ProviderKeyCard
              key={provider.id}
              provider={provider}
              onValueChange={handleKeyValueChange}
              onAddKey={handleAddKey}
              onRename={handleRename}
              onPromote={handlePromote}
              onDelete={handleDelete}
              onTest={handleTest}
            />
          ))}
        </section>
      </div>
    </div>
  )
}

// ─── ProviderKeyCard ───────────────────────────────────────────────

type ProviderKeyCardProps = {
  provider: ProviderWithModels
  onValueChange: (provider: ProviderId, id: string, value: string) => void
  onAddKey: (provider: ProviderId, label: string, apiKey: string) => void
  onRename: (provider: ProviderId, id: string, label: string) => void
  onPromote: (provider: ProviderId, id: string) => void
  onDelete: (provider: ProviderId, id: string) => void
  onTest: (provider: ProviderId, id: string, apiKey: string) => Promise<TestState>
}

const ProviderKeyCard = memo(function ProviderKeyCard({
  provider,
  onValueChange,
  onAddKey,
  onRename,
  onPromote,
  onDelete,
  onTest,
}: ProviderKeyCardProps) {
  const { defaultKey, additionalKeys } = useModelSettingsStore(
    useShallow((state) => ({
      defaultKey: state.apiKeys[provider.id],
      additionalKeys: state.additionalApiKeys[provider.id] || EMPTY_PROVIDER_API_KEYS,
    }))
  )

  const [collapsed, setCollapsed] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [testState, setTestState] = useState<Record<string, TestState>>({})
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newValue, setNewValue] = useState('')
  const [savedFlash, setSavedFlash] = useState<string | null>(null)
  const savedFlashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const allKeys = useMemo(
    () => getCombinedProviderKeys(defaultKey, additionalKeys),
    [additionalKeys, defaultKey]
  )
  const rows = allKeys.length > 0 ? allKeys : EMPTY_DEFAULT_ROWS
  const activeEditing = editing && allKeys.some((key) => key.id === editing.id) ? editing : null

  useEffect(() => {
    return () => {
      if (savedFlashTimeout.current) {
        clearTimeout(savedFlashTimeout.current)
      }
    }
  }, [])

  const showSavedFlash = useCallback((id: string) => {
    if (savedFlashTimeout.current) {
      clearTimeout(savedFlashTimeout.current)
    }

    setSavedFlash(id)
    savedFlashTimeout.current = setTimeout(() => {
      setSavedFlash((current) => (current === id ? null : current))
    }, 1200)
  }, [])

  const handleValueChange = useCallback(
    (id: string, value: string) => {
      onValueChange(provider.id, id, value)
      setTestState((prev) => (prev[id] ? { ...prev, [id]: 'idle' } : prev))
      showSavedFlash(id)
    },
    [onValueChange, provider.id, showSavedFlash]
  )

  const handleRenameCommit = useCallback(() => {
    if (!activeEditing) return
    onRename(provider.id, activeEditing.id, activeEditing.label)
    setEditing(null)
  }, [activeEditing, onRename, provider.id])

  const openAddForm = useCallback(() => {
    setAdding(true)
    setNewLabel('')
    setNewValue('')
  }, [])

  const closeAddForm = useCallback(() => {
    setAdding(false)
    setNewLabel('')
    setNewValue('')
  }, [])

  const submitNewKey = useCallback(() => {
    const value = newValue.trim()
    if (!value) return
    onAddKey(provider.id, newLabel, value)
    closeAddForm()
  }, [closeAddForm, newLabel, newValue, onAddKey, provider.id])

  const handleTestClick = useCallback(
    async (row: CombinedApiKey) => {
      if (!row.apiKey.trim()) return
      setTestState((prev) => ({ ...prev, [row.id]: 'testing' }))
      const result = await onTest(provider.id, row.id, row.apiKey)
      setTestState((prev) => ({ ...prev, [row.id]: result }))
    },
    [onTest, provider.id]
  )

  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-background shadow-sm">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2.5 px-4 py-3.5 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <ProviderIcon providerId={provider.id} className="h-4 w-4 shrink-0" colored />
        <div className="min-w-0 flex-1 text-left">
          <div className="text-[12px] font-medium">{provider.label}</div>
          <div className="text-[10px] text-muted-foreground/70">
            {allKeys.length === 0
              ? 'No keys saved'
              : `${allKeys.length} key${allKeys.length === 1 ? '' : 's'} saved`}{' '}
            · {provider.models.length} models
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform',
            collapsed && '-rotate-90'
          )}
        />
      </button>

      {!collapsed && (
        <div className="space-y-2 border-t border-border/30 px-4 py-3">
          {rows.map((row) => {
            const isShown = !!showKeys[row.id]
            const tState = testState[row.id] || 'idle'
            const isEditingThis = activeEditing?.id === row.id && row.id !== 'default'
            return (
              <div
                key={row.id}
                className="space-y-2 rounded-md border border-border/40 bg-muted/[0.08] p-2.5"
              >
                <div className="flex items-center gap-2">
                  {isEditingThis ? (
                    <Input
                      value={activeEditing.label}
                      onChange={(e) =>
                        setEditing((current) =>
                          current ? { ...current, label: e.target.value } : current
                        )
                      }
                      onBlur={handleRenameCommit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameCommit()
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      autoFocus
                      className="h-7 flex-1 rounded-md border-border/60 bg-background text-[11px] shadow-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        row.id !== 'default' &&
                        setEditing({
                          id: row.id,
                          label: row.label,
                        })
                      }
                      disabled={row.id === 'default'}
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-1.5 truncate text-left text-[11px]',
                        row.id === 'default'
                          ? 'cursor-default text-foreground/80 font-medium'
                          : 'text-foreground/70 hover:text-foreground'
                      )}
                    >
                      {row.isDefault && (
                        <Star className="h-2.5 w-2.5 shrink-0 fill-amber-500 text-amber-500" />
                      )}
                      <span className="truncate">{row.label}</span>
                      {row.id !== 'default' && (
                        <Edit3 className="h-2.5 w-2.5 shrink-0 opacity-50" />
                      )}
                    </button>
                  )}
                  {row.isValid === true && (
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                  )}
                  {row.isValid === false && <XCircle className="h-3 w-3 shrink-0 text-red-400" />}
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-1.5">
                  <div className="relative min-w-0">
                    <Input
                      type={isShown ? 'text' : 'password'}
                      value={row.apiKey}
                      onChange={(e) => handleValueChange(row.id, e.target.value)}
                      placeholder={API_KEY_HINTS[provider.id] || 'Enter API key...'}
                      className="h-8 rounded-md border-border/60 bg-background pr-9 font-mono text-xs shadow-none"
                    />
                    <button
                      type="button"
                      aria-label={isShown ? 'Hide API key' : 'Show API key'}
                      onClick={() => setShowKeys((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                      className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {isShown ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestClick(row)}
                    disabled={!row.apiKey || row.apiKey.trim() === '' || tState === 'testing'}
                    className="h-8 min-w-16 rounded-md border-border/60 px-2 text-[10px] shadow-none"
                  >
                    {tState === 'testing' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Verify'}
                  </Button>
                  {!row.isDefault && row.apiKey && row.apiKey.trim() !== '' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Make default"
                      aria-label={`Make ${row.label} the default ${provider.label} key`}
                      onClick={() => onPromote(provider.id, row.id)}
                      className="h-8 w-8 rounded-md text-muted-foreground/70 hover:text-amber-500"
                    >
                      <Star className="h-3 w-3" />
                    </Button>
                  )}
                  {row.apiKey && row.apiKey.trim() !== '' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${row.label} ${provider.label} key`}
                      onClick={() => onDelete(provider.id, row.id)}
                      className="h-8 w-8 rounded-md text-muted-foreground/70 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {savedFlash === row.id && (
                  <p className="flex items-center gap-1 text-[9px] text-emerald-500">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Saved
                  </p>
                )}
                {tState === 'success' && (
                  <p className="flex items-center gap-1 text-[9px] text-emerald-500">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                  </p>
                )}
                {tState === 'error' && (
                  <p className="flex items-center gap-1 text-[9px] text-red-400">
                    <XCircle className="h-2.5 w-2.5" /> Verification failed
                  </p>
                )}
              </div>
            )
          })}

          {/* Add-key form */}
          {adding ? (
            <div className="space-y-2 rounded-md border border-primary/25 bg-primary/[0.035] p-2.5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)]">
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Label (e.g. Personal, Work)"
                  className="h-8 rounded-md border-border/60 bg-background text-xs shadow-none"
                />
                <Input
                  type="password"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={API_KEY_HINTS[provider.id] || 'Enter API key...'}
                  className="h-8 rounded-md border-border/60 bg-background font-mono text-xs shadow-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitNewKey()
                    if (e.key === 'Escape') closeAddForm()
                  }}
                />
              </div>
              <div className="flex justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeAddForm}
                  className="h-8 rounded-md px-2 text-[10px]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={submitNewKey}
                  disabled={!newValue.trim()}
                  className="h-8 rounded-md px-3 text-[10px]"
                >
                  Save key
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={openAddForm}
              className="h-8 w-full rounded-md text-[10px] text-muted-foreground hover:text-foreground"
            >
              <Plus className="mr-1 h-3 w-3" />
              Add another key
            </Button>
          )}
        </div>
      )}
    </div>
  )
})
