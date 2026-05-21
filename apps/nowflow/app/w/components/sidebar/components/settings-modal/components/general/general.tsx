import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Cpu, RefreshCw, ShieldCheck } from 'lucide-react'
import { ModernAlertIcon, ModernInfoIcon } from '@/components/modern-settings-component-icons'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useOllamaStore } from '@/stores/ollama/store'
import { useGeneralStore } from '@/stores/settings/general/store'
import { resetAllStores } from '@/stores'

const TOOLTIPS = {
  debugMode: 'Enable visual debugging information during execution.',
  autoConnect: 'Automatically connect nodes.',
  autoFillEnvVars: 'Automatically fill API keys.',
  liveValidation: 'Validate blocks in real-time as you edit.',
  resetData: 'Permanently delete all workflows, settings, and stored data.',
}

const parsePositiveInteger = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

type SettingSectionProps = {
  title: string
  description?: string
  icon: ReactNode
  tone?: 'default' | 'accent' | 'danger'
  children: ReactNode
}

type SettingRowProps = {
  title: string
  description: string
  icon: ReactNode
  action: ReactNode
  controlId?: string
  tone?: 'default' | 'danger'
}

function SettingSection({
  title,
  description,
  icon,
  tone = 'default',
  children,
}: SettingSectionProps) {
  return (
    <section className="workflow-editor-settings-section-card" data-tone={tone}>
      <div className="workflow-editor-settings-section-heading">
        <span className="workflow-editor-settings-section-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      <div className="workflow-editor-settings-section-stack">{children}</div>
    </section>
  )
}

function SettingRow({
  title,
  description,
  icon,
  action,
  controlId,
  tone = 'default',
}: SettingRowProps) {
  return (
    <div className="workflow-editor-settings-row" data-tone={tone}>
      <div className="workflow-editor-settings-row-copy">
        <span className="workflow-editor-settings-row-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          {controlId ? (
            <Label htmlFor={controlId} className="workflow-editor-settings-row-title">
              {title}
            </Label>
          ) : (
            <span className="workflow-editor-settings-row-title">{title}</span>
          )}
          <p className="workflow-editor-settings-row-description">{description}</p>
        </div>
      </div>
      <div className="workflow-editor-settings-row-action">{action}</div>
    </div>
  )
}

export function General() {
  const router = useRouter()
  const [retryCount, setRetryCount] = useState(0)
  const [isRefreshingOllama, setIsRefreshingOllama] = useState(false)

  const isLoading = useGeneralStore((state) => state.isLoading)
  const error = useGeneralStore((state) => state.error)

  const isAutoConnectEnabled = useGeneralStore((state) => state.isAutoConnectEnabled)
  const isDebugModeEnabled = useGeneralStore((state) => state.isDebugModeEnabled)
  const isAutoFillEnvVarsEnabled = useGeneralStore((state) => state.isAutoFillEnvVarsEnabled)
  const isLiveValidationEnabled = useGeneralStore((state) => state.isLiveValidationEnabled)

  const toggleAutoConnect = useGeneralStore((state) => state.toggleAutoConnect)
  const toggleDebugMode = useGeneralStore((state) => state.toggleDebugMode)
  const toggleAutoFillEnvVars = useGeneralStore((state) => state.toggleAutoFillEnvVars)
  const toggleLiveValidation = useGeneralStore((state) => state.toggleLiveValidation)
  const loadSettings = useGeneralStore((state) => state.loadSettings)

  const ollamaModels = useOllamaStore((state) => state.models)
  const refreshOllamaModels = useOllamaStore((state) => state.refreshModels)

  // AI Defaults state
  const [aiProvider, setAiProvider] = useState('openai')
  const [aiModel, setAiModel] = useState('')
  const [aiTemperature, setAiTemperature] = useState(0.7)
  const [aiMaxTokens, setAiMaxTokens] = useState('1000')
  const [aiTimeout, setAiTimeout] = useState('30')
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const aiSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load AI settings
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadAISettings = async () => {
      try {
        setIsLoadingAI(true)
        const res = await fetch('/api/ai/settings', { signal: controller.signal })
        if (res.ok) {
          const data = await res.json()
          if (!cancelled && data.settings) {
            setAiProvider(data.settings.selectedProvider || 'openai')
            setAiModel(data.settings.selectedModel || '')
            setAiTemperature(data.settings.preferences?.temperature ?? 0.7)
            setAiMaxTokens(String(data.settings.preferences?.maxTokens ?? 1000))
            setAiTimeout(String(data.settings.preferences?.timeout ?? 30))
          }
        }
      } catch {
        if (controller.signal.aborted) return
        // Silent - AI settings are optional
      } finally {
        if (!cancelled) {
          setIsLoadingAI(false)
        }
      }
    }

    const timer = setTimeout(() => {
      void loadAISettings()
    }, 120)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [])

  const saveAISettings = useCallback((updates: Record<string, unknown>) => {
    if (aiSaveTimer.current) clearTimeout(aiSaveTimer.current)
    aiSaveTimer.current = setTimeout(async () => {
      try {
        await fetch('/api/ai/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
      } catch {
        // Silent failure
      }
    }, 500)
  }, [])

  useEffect(() => {
    return () => {
      if (aiSaveTimer.current) {
        clearTimeout(aiSaveTimer.current)
      }
    }
  }, [])

  // Auto-refresh Ollama models on component mount (silent)
  useEffect(() => {
    if (ollamaModels.length > 0) {
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      if (cancelled) return

      refreshOllamaModels().catch(() => {
        // Silent failure - Ollama might not be available
      })
    }, 600)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [ollamaModels.length, refreshOllamaModels])

  useEffect(() => {
    const timer = setTimeout(
      () => {
        void loadSettings(retryCount > 0)
      },
      retryCount > 0 ? 0 : 80
    )

    return () => {
      clearTimeout(timer)
    }
  }, [loadSettings, retryCount])

  const handleDebugModeChange = (checked: boolean) => {
    if (checked !== isDebugModeEnabled) {
      toggleDebugMode()
    }
  }

  const handleAutoConnectChange = (checked: boolean) => {
    if (checked !== isAutoConnectEnabled) {
      toggleAutoConnect()
    }
  }

  const handleAutoFillEnvVarsChange = (checked: boolean) => {
    if (checked !== isAutoFillEnvVarsEnabled) {
      toggleAutoFillEnvVars()
    }
  }

  const handleLiveValidationChange = (checked: boolean) => {
    if (checked !== isLiveValidationEnabled) {
      toggleLiveValidation()
    }
  }

  const handleResetData = () => {
    resetAllStores()
    router.push('/w') // Redirect to home page after reset
  }

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1)
  }

  const handleRefreshOllama = async () => {
    setIsRefreshingOllama(true)
    try {
      await refreshOllamaModels()
    } catch (error) {
      // Silent failure - just log to debug
      console.debug('Ollama refresh failed (this is normal if Ollama is not installed):', error)
    } finally {
      setIsRefreshingOllama(false)
    }
  }

  const workflowRows = [
    {
      id: 'debug-mode',
      title: 'Debug mode',
      description: TOOLTIPS.debugMode,
      checked: isDebugModeEnabled,
      onCheckedChange: handleDebugModeChange,
    },
    {
      id: 'auto-connect',
      title: 'Auto-connect on drop',
      description: TOOLTIPS.autoConnect,
      checked: isAutoConnectEnabled,
      onCheckedChange: handleAutoConnectChange,
    },
    {
      id: 'auto-fill-env-vars',
      title: 'Auto-fill environment variables',
      description: TOOLTIPS.autoFillEnvVars,
      checked: isAutoFillEnvVarsEnabled,
      onCheckedChange: handleAutoFillEnvVarsChange,
    },
    {
      id: 'live-validation',
      title: 'Live validation',
      description: TOOLTIPS.liveValidation,
      checked: isLiveValidationEnabled,
      onCheckedChange: handleLiveValidationChange,
    },
  ]

  const modelPlaceholder =
    aiProvider === 'openai'
      ? 'gpt-4o'
      : aiProvider === 'anthropic'
        ? 'claude-sonnet-4-5-20250929'
        : 'model-id'

  return (
    <div className="workflow-editor-settings-general flex flex-col gap-5 p-6">
      {error && (
        <Alert variant="destructive" className="workflow-editor-settings-inline-alert">
          <ModernAlertIcon className="h-4 w-4" />
          <AlertDescription className="flex w-full items-center justify-between gap-3">
            <span>Failed to load settings: {error}</span>
            <Button variant="ghost" size="sm" onClick={handleRetry} disabled={isLoading}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <SettingSection
        title="Workflow behavior"
        description="Tune editor feedback, block linking, environment hints, and validation while you build."
        icon={<ModernInfoIcon className="h-4 w-4" />}
        tone="accent"
      >
        {isLoading ? (
          <>
            <SettingRowSkeleton />
            <SettingRowSkeleton />
            <SettingRowSkeleton />
            <SettingRowSkeleton />
            <SettingRowSkeleton />
          </>
        ) : (
          <>
            {workflowRows.map((row) => (
              <SettingRow
                key={row.id}
                controlId={row.id}
                title={row.title}
                description={row.description}
                icon={<ModernInfoIcon className="h-4 w-4" />}
                action={
                  <Switch
                    id={row.id}
                    checked={row.checked}
                    onCheckedChange={row.onCheckedChange}
                    disabled={isLoading}
                  />
                }
              />
            ))}

            <SettingRow
              title={`Ollama models (${ollamaModels.length})`}
              description={
                ollamaModels.length > 0
                  ? `Available locally: ${ollamaModels.join(', ')}`
                  : 'No local Ollama models detected. Cloud models continue to work normally.'
              }
              icon={<ModernInfoIcon className="h-4 w-4" />}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshOllama}
                  disabled={isLoading || isRefreshingOllama}
                >
                  <RefreshCw className={isRefreshingOllama ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                  {isRefreshingOllama ? 'Refreshing' : 'Refresh'}
                </Button>
              }
            />
          </>
        )}
      </SettingSection>

      <SettingSection
        title="AI model defaults"
        description="Set the provider, model, randomness, token limit, and timeout used when a block has no override."
        icon={<Cpu className="h-4 w-4" strokeWidth={1.5} />}
      >
        {isLoadingAI ? (
          <>
            <SettingRowSkeleton />
            <SettingRowSkeleton />
            <SettingRowSkeleton />
          </>
        ) : (
          <>
            <SettingRow
              controlId="settings-ai-provider"
              title="Default provider"
              description="AI provider used when a block does not specify one."
              icon={<Cpu className="h-4 w-4" />}
              action={
                <Select
                  value={aiProvider}
                  onValueChange={(v) => {
                    setAiProvider(v)
                    saveAISettings({ selectedProvider: v })
                  }}
                >
                  <SelectTrigger
                    id="settings-ai-provider"
                    className="workflow-editor-settings-control-md"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                    <SelectItem value="together">Together</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                    <SelectItem value="mistral">Mistral</SelectItem>
                    <SelectItem value="cerebras">Cerebras</SelectItem>
                    <SelectItem value="ollama">Ollama</SelectItem>
                  </SelectContent>
                </Select>
              }
            />

            <SettingRow
              controlId="settings-ai-model"
              title="Default model"
              description="Model identifier saved as the workspace-level fallback."
              icon={<Cpu className="h-4 w-4" />}
              action={
                <Input
                  id="settings-ai-model"
                  value={aiModel}
                  onChange={(e) => {
                    setAiModel(e.target.value)
                    saveAISettings({ selectedModel: e.target.value })
                  }}
                  className="workflow-editor-settings-control-lg"
                  placeholder={modelPlaceholder}
                />
              }
            />

            <SettingRow
              controlId="settings-ai-temperature"
              title="Temperature"
              description="Controls randomness. Lower values are more focused."
              icon={<Cpu className="h-4 w-4" />}
              action={
                <div className="workflow-editor-settings-range-control">
                  <input
                    id="settings-ai-temperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={aiTemperature}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      setAiTemperature(val)
                      saveAISettings({
                        preferences: {
                          temperature: val,
                          maxTokens: parsePositiveInteger(aiMaxTokens, 1000),
                          timeout: parsePositiveInteger(aiTimeout, 30),
                        },
                      })
                    }}
                  />
                  <span>{aiTemperature.toFixed(1)}</span>
                </div>
              }
            />

            <SettingRow
              controlId="settings-ai-max-tokens"
              title="Max tokens"
              description="Maximum response length in tokens."
              icon={<Cpu className="h-4 w-4" />}
              action={
                <Input
                  id="settings-ai-max-tokens"
                  type="number"
                  value={aiMaxTokens}
                  onChange={(e) => {
                    setAiMaxTokens(e.target.value)
                    saveAISettings({
                      preferences: {
                        temperature: aiTemperature,
                        maxTokens: parsePositiveInteger(e.target.value, 1000),
                        timeout: parsePositiveInteger(aiTimeout, 30),
                      },
                    })
                  }}
                  className="workflow-editor-settings-control-sm"
                />
              }
            />

            <SettingRow
              controlId="settings-ai-timeout"
              title="Timeout"
              description="Maximum wait time for AI responses, in seconds."
              icon={<Cpu className="h-4 w-4" />}
              action={
                <Input
                  id="settings-ai-timeout"
                  type="number"
                  value={aiTimeout}
                  onChange={(e) => {
                    setAiTimeout(e.target.value)
                    saveAISettings({
                      preferences: {
                        temperature: aiTemperature,
                        maxTokens: parsePositiveInteger(aiMaxTokens, 1000),
                        timeout: parsePositiveInteger(e.target.value, 30),
                      },
                    })
                  }}
                  className="workflow-editor-settings-control-sm"
                />
              }
            />
          </>
        )}
      </SettingSection>

      <div className="workflow-editor-settings-callout" data-tone="success">
        <span className="workflow-editor-settings-row-icon" aria-hidden="true">
          <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
        </span>
        <div>
          <p>Privacy protected</p>
          <span>
            Telemetry and data collection are disabled. Your workflows and data stay private.
          </span>
        </div>
      </div>

      <SettingSection
        title="Danger zone"
        description="Destructive workspace actions live here."
        icon={<ModernAlertIcon className="h-4 w-4" />}
        tone="danger"
      >
        <SettingRow
          title="Reset all data"
          description={TOOLTIPS.resetData}
          icon={<ModernAlertIcon className="h-4 w-4" />}
          tone="danger"
          action={
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isLoading}>
                  Reset Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="workflow-editor-settings-confirm-dialog">
                <AlertDialogHeader>
                  <div className="mb-2 flex items-center gap-2">
                    <ModernAlertIcon className="h-5 w-5 text-red-500" />
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  </div>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all your workflows,
                    settings, and stored data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetData}
                    className="workflow-editor-settings-danger-action"
                  >
                    Reset Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          }
        />
      </SettingSection>
    </div>
  )
}

const SettingRowSkeleton = () => (
  <div className="workflow-editor-settings-row" aria-hidden="true">
    <div className="workflow-editor-settings-row-copy">
      <Skeleton className="workflow-editor-settings-row-icon h-8 w-8" />
      <div className="min-w-0 flex-1">
        <Skeleton className="mb-2 h-3.5 w-32" />
        <Skeleton className="h-3 w-52" />
      </div>
    </div>
    <Skeleton className="h-7 w-16 rounded-sm" />
  </div>
)
