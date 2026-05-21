'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Cpu, Loader2, RefreshCw, XCircle, Zap } from 'lucide-react'
import { getProviderIcon, getProviderStatusBadgeClass } from '@/components/ai/ai-provider-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AIModelStatus {
  status: string
  timestamp: string
  responseTime: number
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
  summary: {
    totalModels: number
    availableProviders: string[]
    hasActiveModel: boolean
  }
}

export function AIModelStatus() {
  const [status, setStatus] = useState<AIModelStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/ai/status')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch AI status')
    } finally {
      setLoading(false)
    }
  }

  const testModel = async () => {
    if (!status?.activeProvider || !status?.activeModel) return

    try {
      setTesting(true)
      setTestResult(null)

      const response = await fetch('/api/ai/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: status.activeProvider,
          model: status.activeModel,
          message: 'Hello! This is a test message. Please respond briefly.',
        }),
      })

      const data = await response.json()
      setTestResult(data)
    } catch (err) {
      setTestResult({
        status: 'error',
        error: err instanceof Error ? err.message : 'Test failed',
      })
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            AI Model Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Checking AI models...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            AI Model Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle className="h-5 w-5" />
            <span>Error: {error}</span>
          </div>
          <Button onClick={fetchStatus} className="mt-4" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!status) return null

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            AI Model Status
          </div>
          <Button onClick={fetchStatus} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Model */}
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium">Active Model:</span>
          </div>
          <div className="flex items-center gap-2">
            {status.activeModel ? (
              <>
                <span className="text-sm">{getProviderIcon(status.activeProvider)}</span>
                <Badge variant="default">{status.activeModel}</Badge>
                <Badge variant="outline">{status.activeProvider}</Badge>
              </>
            ) : (
              <Badge variant="destructive">No active model</Badge>
            )}
          </div>
        </div>

        {/* Providers */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-zinc-800 dark:text-white">
            Available Providers:
          </h4>

          {/* Ollama */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-lg">🦙</span>
              <div>
                <div className="font-medium">Ollama</div>
                <div className="text-sm text-muted-foreground">{status.providers.ollama.host}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getProviderStatusBadgeClass(status.providers.ollama.available)}>
                {status.providers.ollama.available ? 'Online' : 'Offline'}
              </Badge>
              {status.providers.ollama.models.length > 0 && (
                <Badge variant="outline">{status.providers.ollama.models.length} models</Badge>
              )}
            </div>
          </div>

          {/* OpenAI */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-lg">🤖</span>
              <div>
                <div className="font-medium">OpenAI</div>
                <div className="text-sm text-muted-foreground">
                  {status.providers.openai.apiKey ? 'API Key configured' : 'No API key'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getProviderStatusBadgeClass(status.providers.openai.available)}>
                {status.providers.openai.available ? 'Available' : 'Not implemented'}
              </Badge>
            </div>
          </div>

          {/* Anthropic */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-lg">🧠</span>
              <div>
                <div className="font-medium">Anthropic</div>
                <div className="text-sm text-muted-foreground">
                  {status.providers.anthropic.apiKey ? 'API Key configured' : 'No API key'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getProviderStatusBadgeClass(status.providers.anthropic.available)}>
                {status.providers.anthropic.available ? 'Available' : 'Not implemented'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Models List */}
        {status.providers.ollama.models.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-zinc-800 dark:text-white">Ollama Models:</h4>
            <div className="flex flex-wrap gap-2">
              {status.providers.ollama.models.map((model) => (
                <Badge
                  key={model}
                  variant={model === status.activeModel ? 'default' : 'outline'}
                  className="text-xs"
                >
                  {model}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Test Model */}
        {status.activeModel && (
          <div className="space-y-2">
            <Button
              onClick={testModel}
              disabled={testing}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing model...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Test Active Model
                </>
              )}
            </Button>

            {testResult && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  testResult.status === 'success'
                    ? 'bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-300'
                    : 'bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-300'
                }`}
              >
                {testResult.status === 'success' ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">Test successful!</span>
                    </div>
                    <div className="text-xs opacity-75">
                      Response time: {testResult.responseTime}ms
                    </div>
                    {testResult.response?.content && (
                      <div className="mt-2 p-2 bg-white dark:bg-black/30 rounded border border-black/[0.06] dark:border-white/[0.06]">
                        {testResult.response.content.substring(0, 100)}...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    <span>Test failed: {testResult.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Last updated: {new Date(status.timestamp).toLocaleTimeString()}({status.responseTime}ms)
        </div>
      </CardContent>
    </Card>
  )
}
