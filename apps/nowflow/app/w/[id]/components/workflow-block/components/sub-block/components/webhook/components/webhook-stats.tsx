import { useEffect, useState } from 'react'
import { Activity, AlertCircle, CheckCircle2, Clock, TrendingUp, Zap } from 'lucide-react'
import {
  WebhookActivityIcon,
  WebhookSecurityIcon,
  WebhookStatusIcon,
} from '@/components/icons/webhook-icon'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface WebhookStatsProps {
  webhookId: string
  className?: string
}

interface WebhookStats {
  totalTriggers: number
  successfulTriggers: number
  failedTriggers: number
  successRate: number
  averageResponseTime: number
  lastTriggeredAt: Date | null
  healthStatus: 'healthy' | 'warning' | 'error' | 'inactive'
}

export function WebhookStats({ webhookId, className }: WebhookStatsProps) {
  const [stats, setStats] = useState<WebhookStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!webhookId) return

    const fetchStats = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/webhooks/${webhookId}/stats`)
        if (!response.ok) {
          throw new Error('Failed to fetch webhook stats')
        }
        const data = await response.json()
        setStats(data.stats)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [webhookId])

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error || !stats) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>{error || 'No stats available'}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500'
      case 'warning':
        return 'text-yellow-500'
      case 'error':
        return 'text-red-500'
      case 'inactive':
        return 'text-zinc-500 dark:text-white/40'
      default:
        return 'text-zinc-500 dark:text-white/40'
    }
  }

  const getHealthStatusLabel = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'Healthy'
      case 'warning':
        return 'Warning'
      case 'error':
        return 'Error'
      case 'inactive':
        return 'Inactive'
      default:
        return 'Unknown'
    }
  }

  const successRatePercentage = Math.round(stats.successRate * 100)

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Webhook Statistics</CardTitle>
            <CardDescription>Performance and health metrics</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <WebhookStatusIcon
              status={stats.healthStatus === 'healthy' ? 'active' : stats.healthStatus}
              className="h-8 w-8"
            />
            <span className={cn('text-sm font-medium', getHealthStatusColor(stats.healthStatus))}>
              {getHealthStatusLabel(stats.healthStatus)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Success Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="font-medium">Success Rate</span>
            </div>
            <span className="text-muted-foreground">{successRatePercentage}%</span>
          </div>
          <Progress value={successRatePercentage} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{stats.successfulTriggers} successful</span>
            <span>{stats.failedTriggers} failed</span>
          </div>
        </div>

        {/* Total Triggers */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Total Triggers</p>
              <p className="text-xs text-muted-foreground">All time</p>
            </div>
          </div>
          <span className="text-2xl font-bold">{stats.totalTriggers}</span>
        </div>

        {/* Average Response Time */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Avg Response Time</p>
              <p className="text-xs text-muted-foreground">Last 100 requests</p>
            </div>
          </div>
          <span className="text-2xl font-bold">{stats.averageResponseTime}ms</span>
        </div>

        {/* Last Triggered */}
        {stats.lastTriggeredAt && (
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Zap className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Last Triggered</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(stats.lastTriggeredAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Performance Indicator */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp
              className={cn(
                'h-4 w-4',
                successRatePercentage >= 95
                  ? 'text-green-500'
                  : successRatePercentage >= 80
                    ? 'text-yellow-500'
                    : 'text-red-500'
              )}
            />
            <span className="text-muted-foreground">
              {successRatePercentage >= 95
                ? 'Excellent performance'
                : successRatePercentage >= 80
                  ? 'Good performance, some issues detected'
                  : 'Poor performance, attention needed'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
