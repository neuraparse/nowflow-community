import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, ExternalLink, RefreshCw, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface WebhookLogsProps {
  webhookId: string
  className?: string
}

interface WebhookLog {
  id: string
  method: string
  sourceIp: string
  statusCode: number | null
  responseTime: number | null
  success: boolean
  errorMessage: string | null
  executionId: string | null
  retryCount: number
  triggeredAt: string
  completedAt: string | null
}

export function WebhookLogs({ webhookId, className }: WebhookLogsProps) {
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all')

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filter === 'success') params.append('successOnly', 'true')
      if (filter === 'failed') params.append('failedOnly', 'true')

      const response = await fetch(`/api/webhooks/${webhookId}/logs?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch webhook logs')
      }
      const data = await response.json()
      setLogs(data.logs || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!webhookId) return
    fetchLogs()
  }, [webhookId, filter])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return `${seconds}s ago`
  }

  const getStatusBadge = (log: WebhookLog) => {
    if (log.success) {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Success
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      )
    }
  }

  if (loading && logs.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Webhook Logs</CardTitle>
            <CardDescription>Recent webhook trigger history</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="success">Success</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-4">
            {error ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mr-2" />
                <p>{error}</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No logs yet</p>
                <p className="text-sm">Webhook triggers will appear here</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(log)}
                          <Badge variant="secondary" className="font-mono text-xs">
                            {log.method}
                          </Badge>
                          {log.retryCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Retry {log.retryCount}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(log.triggeredAt)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Source IP:</span>
                          <span className="ml-2 font-mono">{log.sourceIp}</span>
                        </div>
                        {log.statusCode && (
                          <div>
                            <span className="text-muted-foreground">Status:</span>
                            <span
                              className={cn(
                                'ml-2 font-mono',
                                log.statusCode >= 200 && log.statusCode < 300
                                  ? 'text-green-500'
                                  : 'text-red-500'
                              )}
                            >
                              {log.statusCode}
                            </span>
                          </div>
                        )}
                        {log.responseTime && (
                          <div>
                            <span className="text-muted-foreground">Response Time:</span>
                            <span className="ml-2 font-mono">{log.responseTime}ms</span>
                          </div>
                        )}
                        {log.executionId && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Execution ID:</span>
                            <span className="ml-2 font-mono text-xs">{log.executionId}</span>
                          </div>
                        )}
                      </div>

                      {log.errorMessage && (
                        <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20">
                          <p className="text-xs text-red-500 font-medium mb-1">Error:</p>
                          <p className="text-xs text-red-500/80">{log.errorMessage}</p>
                        </div>
                      )}

                      {log.executionId && (
                        <div className="mt-3 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              // Navigate to execution details
                              window.open(`/executions/${log.executionId}`, '_blank')
                            }}
                          >
                            View Execution
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
