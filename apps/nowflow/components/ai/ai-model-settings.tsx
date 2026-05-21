'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Eye, EyeOff, Loader2, RefreshCw, Save, XCircle } from 'lucide-react'
import { getProviderStatusBadgeClass } from '@/components/ai/ai-provider-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const OLLAMA_DEFAULT_HOST = 'http://localhost:11434'

interface AIModelSettings {
  selectedProvider: string
  selectedModel: string
  apiKeys: {
    openai: string
    anthropic: string
    groq: string
    together: string
  }
  ollamaHost: string
  preferences: {
    temperature: number
    maxTokens: number
    timeout: number
  }
}

interface AIModelStatus {
  status: string
  activeProvider: string
  activeModel: string | null
  providers: {
    ollama: {
      available: boolean
      models: string[]
      defaultModel: string | null
      host: string
      error: string | null
    }
    openai: {
      available: boolean
      models: string[]
      apiKey: boolean
      error: string | null
    }
    anthropic: {
      available: boolean
      models: string[]
      apiKey: boolean
      error: string | null
    }
  }
}

const getClientPersistableSettings = (settings: AIModelSettings) => ({
  selectedProvider: settings.selectedProvider,
  selectedModel: settings.selectedModel,
  ollamaHost: settings.ollamaHost,
  preferences: settings.preferences,
})

export function AIModelSettings() {
  const [status, setStatus] = useState<AIModelStatus | null>(null)
  const [settings, setSettings] = useState<AIModelSettings>({
    selectedProvider: 'ollama',
    selectedModel: '',
    apiKeys: {
      openai: '',
      anthropic: '',
      groq: '',
      together: '',
    },
    ollamaHost: OLLAMA_DEFAULT_HOST,
    preferences: {
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30,
    },
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showApiKeys, setShowApiKeys] = useState({
    openai: false,
    anthropic: false,
    groq: false,
    together: false,
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/ai/status')
      if (response.ok) {
        const data = await response.json()
        setStatus(data)

        // Update settings with current active model
        setSettings((prev) => ({
          ...prev,
          selectedProvider: data.activeProvider || 'ollama',
          selectedModel: data.activeModel || '',
        }))
      }
    } catch (error) {
      console.error('Failed to fetch AI status:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)

      // Save to backend API
      const response = await fetch('/api/ai/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'AI model settings have been saved successfully.' })

        // Keep provider/model preferences client-side, but never persist API keys.
        localStorage.setItem(
          'ai-model-settings',
          JSON.stringify(getClientPersistableSettings(settings))
        )
      } else {
        const errorData = await response.json()
        setMessage({ type: 'error', text: errorData.error || 'Failed to save settings.' })
      }

      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async (provider: string, model?: string) => {
    try {
      const response = await fetch('/api/ai/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: model || settings.selectedModel,
          message: 'Test connection',
        }),
      })

      const data = await response.json()

      if (data.status === 'success') {
        setMessage({ type: 'success', text: `Successfully connected to ${provider} model.` })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to connect to model.' })
      }
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({ type: 'error', text: 'Failed to test connection.' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const loadSettings = async () => {
    try {
      // Try to load from backend first
      const response = await fetch('/api/ai/settings')
      if (response.ok) {
        const data = await response.json()
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }))
          return
        }
      }
    } catch (error) {
      console.error('Failed to load settings from backend:', error)
    }

    // Fallback to localStorage
    const savedSettings = localStorage.getItem('ai-model-settings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings((prev) => ({
          ...prev,
          ...getClientPersistableSettings({ ...prev, ...parsed }),
        }))
      } catch (error) {
        console.error('Failed to parse saved settings:', error)
      }
    }
  }

  useEffect(() => {
    fetchStatus()
    loadSettings()
  }, [])

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading AI settings...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>AI Model Settings</span>
          <div className="flex gap-2">
            <Button onClick={fetchStatus} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={saveSettings} disabled={saving} size="sm">
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Message Display */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/20 dark:text-green-300 dark:border-green-800/50'
                : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          </div>
        )}
        <Tabs defaultValue="models" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="apikeys">API Keys</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="models" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="provider">AI Provider</Label>
                <Select
                  value={settings.selectedProvider}
                  onValueChange={(value) =>
                    setSettings((prev) => ({
                      ...prev,
                      selectedProvider: value,
                      selectedModel: '', // Reset model when provider changes
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select AI provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ollama">
                      <div className="flex items-center gap-2">
                        <span>🦙</span>
                        <span>Ollama (Local)</span>
                        <Badge
                          className={getProviderStatusBadgeClass(
                            status?.providers.ollama.available || false
                          )}
                        >
                          {status?.providers.ollama.available ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="openai">
                      <div className="flex items-center gap-2">
                        <span>🤖</span>
                        <span>OpenAI</span>
                        <Badge
                          className={getProviderStatusBadgeClass(
                            status?.providers.openai.available || false
                          )}
                        >
                          {status?.providers.openai.available ? 'Available' : 'Not configured'}
                        </Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="anthropic">
                      <div className="flex items-center gap-2">
                        <span>🧠</span>
                        <span>Anthropic</span>
                        <Badge
                          className={getProviderStatusBadgeClass(
                            status?.providers.anthropic.available || false
                          )}
                        >
                          {status?.providers.anthropic.available ? 'Available' : 'Not configured'}
                        </Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.selectedProvider === 'ollama' && status?.providers.ollama.models && (
                <div>
                  <Label htmlFor="ollama-model">Ollama Model</Label>
                  <Select
                    value={settings.selectedModel}
                    onValueChange={(value) =>
                      setSettings((prev) => ({ ...prev, selectedModel: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Ollama model" />
                    </SelectTrigger>
                    <SelectContent>
                      {status.providers.ollama.models.map((model) => (
                        <SelectItem key={model} value={model}>
                          <div className="flex items-center gap-2">
                            <span>{model}</span>
                            {model === status.activeModel && (
                              <Badge variant="default">Active</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {settings.selectedProvider === 'openai' && (
                <div>
                  <Label htmlFor="openai-model">OpenAI Model</Label>
                  <Select
                    value={settings.selectedModel}
                    onValueChange={(value) =>
                      setSettings((prev) => ({ ...prev, selectedModel: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select OpenAI model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {settings.selectedProvider === 'anthropic' && (
                <div>
                  <Label htmlFor="anthropic-model">Anthropic Model</Label>
                  <Select
                    value={settings.selectedModel}
                    onValueChange={(value) =>
                      setSettings((prev) => ({ ...prev, selectedModel: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Anthropic model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                      <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                      <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {settings.selectedModel && (
                <Button
                  onClick={() => testConnection(settings.selectedProvider, settings.selectedModel)}
                  variant="outline"
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="apikeys" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="openai-key"
                    type={showApiKeys.openai ? 'text' : 'password'}
                    value={settings.apiKeys.openai}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        apiKeys: { ...prev.apiKeys, openai: e.target.value },
                      }))
                    }
                    placeholder="API key"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowApiKeys((prev) => ({ ...prev, openai: !prev.openai }))}
                  >
                    {showApiKeys.openai ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="anthropic-key"
                    type={showApiKeys.anthropic ? 'text' : 'password'}
                    value={settings.apiKeys.anthropic}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        apiKeys: { ...prev.apiKeys, anthropic: e.target.value },
                      }))
                    }
                    placeholder="API key"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setShowApiKeys((prev) => ({ ...prev, anthropic: !prev.anthropic }))
                    }
                  >
                    {showApiKeys.anthropic ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="ollama-host">Ollama Host</Label>
                <Input
                  id="ollama-host"
                  value={settings.ollamaHost}
                  onChange={(e) => setSettings((prev) => ({ ...prev, ollamaHost: e.target.value }))}
                  placeholder={OLLAMA_DEFAULT_HOST}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="temperature">Temperature: {settings.preferences.temperature}</Label>
                <input
                  id="temperature"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.preferences.temperature}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      preferences: { ...prev.preferences, temperature: parseFloat(e.target.value) },
                    }))
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Conservative</span>
                  <span>Creative</span>
                </div>
              </div>

              <div>
                <Label htmlFor="max-tokens">Max Tokens</Label>
                <Input
                  id="max-tokens"
                  type="number"
                  value={settings.preferences.maxTokens}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      preferences: { ...prev.preferences, maxTokens: parseInt(e.target.value) },
                    }))
                  }
                  min="100"
                  max="4000"
                />
              </div>

              <div>
                <Label htmlFor="timeout">Timeout (seconds)</Label>
                <Input
                  id="timeout"
                  type="number"
                  value={settings.preferences.timeout}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      preferences: { ...prev.preferences, timeout: parseInt(e.target.value) },
                    }))
                  }
                  min="5"
                  max="120"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
