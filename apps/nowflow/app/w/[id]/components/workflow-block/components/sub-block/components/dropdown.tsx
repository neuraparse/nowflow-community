import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  ChevronDown,
  Clock,
  CloudUpload,
  Database,
  FileText,
  Mail,
  MousePointer2,
  Play,
  RefreshCw,
  Webhook,
  Zap,
} from 'lucide-react'
import { PROVIDER_COLORS, ProviderIcon } from '@/components/icons/model-icons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useModelSettingsStore } from '@/stores/model-settings/store'
import { useOllamaStore } from '@/stores/ollama/store'
import { useSubscription } from '@/hooks/use-subscription'
import {
  getPreferredDefaultModel,
  resolveApiKeyForBlock,
} from '@/blocks/blocks/agent-model-helpers'
import { getProviderFromModel } from '@/providers/utils'
import { useSubBlockValue } from '../hooks/use-sub-block-value'
import { ModelSettingsModal } from './model-settings-modal'

// Icon mapping for trigger options
const iconMap: Record<string, React.ComponentType<any>> = {
  'mouse-pointer-2': MousePointer2,
  webhook: Webhook,
  mail: Mail,
  'file-text': FileText,
  database: Database,
  'cloud-upload': CloudUpload,
  calendar: Calendar,
  clock: Clock,
  'refresh-cw': RefreshCw,
  zap: Zap,
  play: Play,
}

interface DropdownProps {
  options:
    | Array<
        string | { label: string; id: string; group?: string; icon?: string; description?: string }
      >
    | (() => Array<
        string | { label: string; id: string; group?: string; icon?: string; description?: string }
      >)
  defaultValue?: string
  blockId: string
  subBlockId: string
  placeholder?: string
}

type OptionType =
  | string
  | { label: string; id: string; group?: string; icon?: string; description?: string }

export function Dropdown({
  options,
  defaultValue,
  blockId,
  subBlockId,
  placeholder,
}: DropdownProps) {
  const [value, setValue] = useSubBlockValue<string>(blockId, subBlockId, true)
  const [storeInitialized, setStoreInitialized] = useState(false)

  // Detect if this is a model selector dropdown
  const isModelDropdown = subBlockId === 'model'

  // Handle model selection from the settings modal.
  // The modal already wrote the chosen key into the sub-block store before
  // invoking this callback (so the user's `activeKeyId` choice is honored).
  // We still resolve here as a safety net for the case where the modal didn't
  // (Ollama, or a provider with no requiresApiKey).
  const handleModelSelectFromModal = useCallback(
    (model: string) => {
      setValue(model)
      if (!isModelDropdown) return

      const provider = getProviderFromModel(model)
      const { useSubBlockStore } = require('@/stores/workflows/subblock/store')
      const subBlockStore = useSubBlockStore.getState()

      const currentApiKey = subBlockStore.getValue(blockId, 'apiKey')
      if (!currentApiKey || currentApiKey === '') {
        const resolved = resolveApiKeyForBlock(provider)
        if (resolved && resolved !== 'ollama') {
          subBlockStore.setValue(blockId, 'apiKey', resolved)
          subBlockStore.setToolParam(provider, 'apiKey', resolved)
        }
      }

      const store = useModelSettingsStore.getState()
      const savedTemp = store.getProviderTemperature(provider)
      if (savedTemp !== undefined) {
        const currentTemp = subBlockStore.getValue(blockId, 'temperature')
        if (currentTemp === null || currentTemp === undefined) {
          subBlockStore.setValue(blockId, 'temperature', savedTemp)
        }
      }

      // Track as recent model + remember as the user's preferred default so the
      // next freshly-added block opens with this model selected.
      store.addRecentModel(provider, model)
      store.setDefaultPreference({ provider, model, temperature: savedTemp })
    },
    [isModelDropdown, blockId, setValue]
  )

  // Subscribe to Ollama models so dropdown re-evaluates when models change
  const ollamaModels = useOllamaStore((s) => s.models)

  // Subscription check for gating local models
  const { isPro, loading: subLoading } = useSubscription()

  // Evaluate options if it's a function — re-evaluate when Ollama models change
  const evaluatedOptions = useMemo(() => {
    return typeof options === 'function' ? options() : options
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, ollamaModels])

  // Filter out Ollama models for non-Pro users
  const filteredOptions = useMemo(() => {
    if (isModelDropdown && !isPro && !subLoading) {
      return evaluatedOptions.filter((opt) => {
        const group = typeof opt === 'string' ? undefined : opt.group
        return group !== 'Local (Ollama)'
      })
    }
    return evaluatedOptions
  }, [evaluatedOptions, isModelDropdown, isPro, subLoading])

  const getOptionValue = (option: OptionType) => {
    return typeof option === 'string' ? option : option.id
  }

  const getOptionLabel = (option: OptionType) => {
    return typeof option === 'string' ? option : option.label
  }

  const getOptionGroup = (option: OptionType) => {
    return typeof option === 'string' ? undefined : option.group
  }

  const getOptionIcon = (option: OptionType) => {
    return typeof option === 'string' ? undefined : option.icon
  }

  const getOptionDescription = (option: OptionType) => {
    return typeof option === 'string' ? undefined : option.description
  }

  // Render lucide icon from icon name
  const renderIcon = (iconName?: string) => {
    if (!iconName || !iconMap[iconName]) return null
    const IconComponent = iconMap[iconName]
    return <IconComponent className="w-4 h-4" />
  }

  // Get the default option value.
  // For model dropdowns, prefer the user's saved default model so a freshly-added
  // block opens with their preferred provider/model rather than whatever happens
  // to sort first in the option list. Falls back to the first option if the saved
  // model isn't actually available (e.g. removed from a provider).
  const defaultOptionValue = useMemo(() => {
    if (defaultValue !== undefined) {
      return defaultValue
    }

    if (isModelDropdown) {
      const preferred = getPreferredDefaultModel()
      const isAvailable = filteredOptions.some((opt) => getOptionValue(opt) === preferred)
      if (isAvailable) return preferred
    }

    if (filteredOptions.length > 0) {
      return getOptionValue(filteredOptions[0])
    }

    return undefined
  }, [defaultValue, filteredOptions, isModelDropdown])

  // Mark store as initialized on first render
  useEffect(() => {
    setStoreInitialized(true)
  }, [])

  // Only set default value once the store is confirmed to be initialized
  // and we know the actual value is null/undefined (not just loading)
  useEffect(() => {
    if (
      storeInitialized &&
      (value === null || value === undefined) &&
      defaultOptionValue !== undefined
    ) {
      setValue(defaultOptionValue)
    }
  }, [storeInitialized, value, defaultOptionValue, setValue])

  // Calculate the effective value to use in the dropdown
  const effectiveValue = useMemo(() => {
    if (value !== null && value !== undefined) {
      return value
    }
    if (storeInitialized) {
      return defaultOptionValue
    }
    return undefined
  }, [value, defaultOptionValue, storeInitialized])

  // Handle the case where filteredOptions changes and the current selection is no longer valid
  const isValueInOptions = useMemo(() => {
    if (!effectiveValue || filteredOptions.length === 0) return false
    return filteredOptions.some((opt) => getOptionValue(opt) === effectiveValue)
  }, [effectiveValue, filteredOptions])

  // Group options by their group property
  const groupedOptions = useMemo(() => {
    const groups: Record<string, typeof filteredOptions> = {}
    const ungrouped: typeof filteredOptions = []

    filteredOptions.forEach((option) => {
      const group = getOptionGroup(option)
      if (group) {
        if (!groups[group]) groups[group] = []
        groups[group].push(option)
      } else {
        ungrouped.push(option)
      }
    })

    return { groups, ungrouped }
  }, [filteredOptions])

  // Provider name -> ProviderId mapping for dropdown groups
  const groupToProviderId: Record<string, string> = {
    OpenAI: 'openai',
    Anthropic: 'anthropic',
    Google: 'google',
    DeepSeek: 'deepseek',
    'xAI (Grok)': 'xai',
    Cerebras: 'cerebras',
    Groq: 'groq',
    'Local (Ollama)': 'ollama',
  }

  // Get group label with icon
  const getGroupLabel = (groupName: string) => {
    const providerId = groupToProviderId[groupName]
    switch (groupName) {
      case 'cloud':
        return { iconName: null, label: 'Cloud Models', emoji: null, providerId: null }
      case 'ollama':
        return { iconName: null, label: 'Local Models (Ollama)', emoji: null, providerId: 'ollama' }
      case 'manual':
        return { iconName: 'play', label: 'Manual Trigger', emoji: null, providerId: null }
      case 'real-time':
        return { iconName: 'zap', label: 'Real-time Triggers', emoji: null, providerId: null }
      case 'scheduled':
        return { iconName: 'clock', label: 'Scheduled Triggers', emoji: null, providerId: null }
      default:
        return { iconName: null, label: groupName, emoji: null, providerId: providerId || null }
    }
  }

  // Get selected option for display
  const selectedOption = useMemo(() => {
    return filteredOptions.find((opt) => getOptionValue(opt) === effectiveValue)
  }, [filteredOptions, effectiveValue])

  const selectedIcon = selectedOption ? getOptionIcon(selectedOption) : undefined
  const selectedLabel = selectedOption ? getOptionLabel(selectedOption) : undefined

  // When model dropdown opens, auto-refresh Ollama models if needed (Pro only)
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open && isModelDropdown && isPro) {
        useOllamaStore.getState().refreshIfNeeded()
      }
    },
    [isModelDropdown, isPro]
  )

  // When model changes, auto-fill API key and temperature from settings store.
  // Uses `resolveApiKeyForBlock` so a freshly-selected model picks up:
  //   1. an explicit per-block override already in the subblock store
  //   2. the provider's default key from useModelSettingsStore
  //   3. (left to the executor) env-var fallback
  useEffect(() => {
    if (!isModelDropdown || !value) return
    const provider = getProviderFromModel(value)

    const { useSubBlockStore } = require('@/stores/workflows/subblock/store')
    const subBlockStore = useSubBlockStore.getState()
    const currentApiKey = subBlockStore.getValue(blockId, 'apiKey')

    // Only auto-fill if the block has no explicit key yet — never overwrite a
    // user's per-block override.
    if (!currentApiKey || currentApiKey === '') {
      const resolved = resolveApiKeyForBlock(provider, {
        explicitValue: typeof currentApiKey === 'string' ? currentApiKey : undefined,
      })
      if (resolved && resolved !== 'ollama') {
        subBlockStore.setValue(blockId, 'apiKey', resolved)
        subBlockStore.setToolParam(provider, 'apiKey', resolved)
      }
    }

    // Auto-fill temperature if not already set
    const currentTemp = subBlockStore.getValue(blockId, 'temperature')
    if (currentTemp === null || currentTemp === undefined) {
      const savedTemp = useModelSettingsStore.getState().getProviderTemperature(provider)
      if (savedTemp !== undefined) {
        subBlockStore.setValue(blockId, 'temperature', savedTemp)
      }
    }
  }, [value, isModelDropdown, blockId])

  // ─── MODEL SELECTOR: Clickable trigger that opens modal directly ───
  if (isModelDropdown) {
    const providerId = effectiveValue ? getProviderFromModel(effectiveValue) : null
    const colors = providerId ? PROVIDER_COLORS[providerId] : null

    return (
      <div className="w-full">
        <ModelSettingsModal
          blockId={blockId}
          onModelSelect={handleModelSelectFromModal}
          trigger={
            <button
              type="button"
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left',
                'bg-background/50 hover:bg-background/80',
                'border border-border/60 hover:border-border',
                'transition-all duration-200',
                'shadow-sm hover:shadow',
                'group cursor-pointer'
              )}
            >
              {effectiveValue && providerId ? (
                <>
                  <div
                    className={cn(
                      'flex items-center justify-center w-6 h-6 rounded-md shrink-0',
                      colors?.bg
                    )}
                  >
                    <ProviderIcon providerId={providerId} className="w-3 h-3" colored />
                  </div>
                  <span className="flex-1 truncate font-medium text-[13px]">{effectiveValue}</span>
                </>
              ) : (
                <span className="flex-1 text-muted-foreground text-[13px]">Select a model...</span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
            </button>
          }
        />
      </div>
    )
  }

  // ─── STANDARD DROPDOWN: For non-model dropdowns ───
  return (
    <div className="flex items-center gap-1.5 w-full">
      <Select
        value={isValueInOptions ? effectiveValue : ''}
        onOpenChange={handleOpenChange}
        onValueChange={(newValue) => {
          setValue(newValue)
        }}
      >
        <SelectTrigger
          className={cn(
            'text-left w-full',
            'bg-background/50 hover:bg-background/80',
            'border-border/60 hover:border-border',
            'transition-all duration-200',
            'shadow-sm hover:shadow',
            'focus:ring-2 focus:ring-primary/20 focus:border-primary/40',
            'group'
          )}
        >
          {selectedOption ? (
            <div className="flex items-center gap-2">
              {selectedIcon && renderIcon(selectedIcon)}
              <span>{selectedLabel}</span>
            </div>
          ) : (
            <SelectValue placeholder={placeholder || 'Select an option'} />
          )}
        </SelectTrigger>
        <SelectContent
          className={cn(
            'max-h-64 overflow-auto',
            'border-border/60 shadow-lg',
            'bg-popover/95 backdrop-blur-sm',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
        >
          {/* Render ungrouped options first */}
          {groupedOptions.ungrouped.map((option) => {
            const icon = getOptionIcon(option)
            const description = getOptionDescription(option)
            return (
              <SelectItem
                key={getOptionValue(option)}
                value={getOptionValue(option)}
                className={cn(
                  'text-sm cursor-pointer',
                  'transition-colors duration-150',
                  'focus:bg-primary/10 focus:text-foreground',
                  'data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary',
                  'rounded-md mx-1 my-0.5',
                  description && 'py-2'
                )}
              >
                <div className="flex items-start gap-2.5 w-full">
                  {icon && <span className="mt-0.5 flex-shrink-0">{renderIcon(icon)}</span>}
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="font-medium">{getOptionLabel(option)}</span>
                    {description && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {description}
                      </span>
                    )}
                  </div>
                </div>
              </SelectItem>
            )
          })}

          {/* Render grouped options */}
          {Object.entries(groupedOptions.groups).map(([groupName, groupOptions], groupIndex) => {
            const { iconName, label, providerId } = getGroupLabel(groupName)
            return (
              <div key={groupName}>
                {(groupedOptions.ungrouped.length > 0 || groupIndex > 0) && (
                  <div className="my-1 border-t border-border/40" />
                )}
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
                  {providerId ? (
                    <ProviderIcon providerId={providerId} className="w-3 h-3" colored />
                  ) : (
                    iconName && <span className="flex items-center">{renderIcon(iconName)}</span>
                  )}
                  <span>{label}</span>
                  <span className="ml-auto text-muted-foreground/50 font-normal normal-case">
                    {groupOptions.length}
                  </span>
                </div>
                {groupOptions.map((option) => {
                  const icon = getOptionIcon(option)
                  const description = getOptionDescription(option)
                  return (
                    <SelectItem
                      key={getOptionValue(option)}
                      value={getOptionValue(option)}
                      className={cn(
                        'text-sm cursor-pointer',
                        'transition-colors duration-150',
                        'focus:bg-primary/10 focus:text-foreground',
                        'data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary',
                        'rounded-md mx-1 my-0.5',
                        description && 'py-2'
                      )}
                    >
                      <div className="flex items-start gap-2.5 w-full">
                        {icon && <span className="mt-0.5 flex-shrink-0">{renderIcon(icon)}</span>}
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <span className="font-medium">{getOptionLabel(option)}</span>
                          {description && (
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {description}
                            </span>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  )
                })}
              </div>
            )
          })}

          {/* Empty state */}
          {filteredOptions.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No options available
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
