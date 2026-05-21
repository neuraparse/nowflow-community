'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, Bell, CheckCircle, Clock, Edit, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface Alert {
  id: string
  name: string
  description: string | null
  isEnabled: boolean
  metric: string
  operator: string
  threshold: number
  windowMinutes: number
  notificationChannels: string[]
  lastTriggeredAt: string | null
  triggerCount: number
}

interface AlertEvent {
  id: string
  alertId: string
  metricValue: number
  thresholdValue: number
  status: 'triggered' | 'acknowledged' | 'resolved'
  createdAt: string
}

export function AlertManager() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newAlert, setNewAlert] = useState({
    name: '',
    description: '',
    metric: 'error_rate',
    operator: 'gt',
    threshold: 10,
    windowMinutes: 60,
    notificationChannels: ['email'],
  })

  useEffect(() => {
    fetchAlerts()
  }, [])

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/analytics/alerts?includeEvents=true')
      const data = await response.json()
      if (data.success) {
        setAlerts(data.data.alerts || [])
        setEvents(data.data.events || [])
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const createAlert = async () => {
    try {
      const response = await fetch('/api/analytics/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAlert),
      })
      const data = await response.json()
      if (data.success) {
        setCreateDialogOpen(false)
        fetchAlerts()
        setNewAlert({
          name: '',
          description: '',
          metric: 'error_rate',
          operator: 'gt',
          threshold: 10,
          windowMinutes: 60,
          notificationChannels: ['email'],
        })
      }
    } catch (error) {
      console.error('Failed to create alert:', error)
    }
  }

  const toggleAlert = async (alertId: string, isEnabled: boolean) => {
    try {
      await fetch('/api/analytics/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alertId, isEnabled }),
      })
      fetchAlerts()
    } catch (error) {
      console.error('Failed to toggle alert:', error)
    }
  }

  const deleteAlert = async (alertId: string) => {
    try {
      await fetch(`/api/analytics/alerts?id=${alertId}`, { method: 'DELETE' })
      fetchAlerts()
    } catch (error) {
      console.error('Failed to delete alert:', error)
    }
  }

  const getMetricLabel = (metric: string) => {
    const labels: Record<string, string> = {
      error_rate: 'Error Rate',
      latency_avg: 'Average Latency',
      latency_p95: 'P95 Latency',
      cost_total: 'Total Cost',
      execution_count: 'Execution Count',
      token_usage: 'Token Usage',
    }
    return labels[metric] || metric
  }

  const getOperatorLabel = (operator: string) => {
    const labels: Record<string, string> = {
      gt: '>',
      lt: '<',
      gte: '≥',
      lte: '≤',
      eq: '=',
    }
    return labels[operator] || operator
  }

  if (loading) {
    return (
      <Card className="border-black/[0.06] dark:border-white/[0.06]">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Alerts */}
      <Card className="border-black/[0.06] dark:border-white/[0.06]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alerts
          </CardTitle>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Create Alert
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Alert</DialogTitle>
                <DialogDescription>
                  Set up a new alert to monitor your workflow metrics
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={newAlert.name}
                    onChange={(e) => setNewAlert((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Alert name"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Metric</Label>
                    <Select
                      value={newAlert.metric}
                      onValueChange={(v) => setNewAlert((prev) => ({ ...prev, metric: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="error_rate">Error Rate</SelectItem>
                        <SelectItem value="latency_avg">Avg Latency</SelectItem>
                        <SelectItem value="latency_p95">P95 Latency</SelectItem>
                        <SelectItem value="cost_total">Total Cost</SelectItem>
                        <SelectItem value="execution_count">Executions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Condition</Label>
                    <Select
                      value={newAlert.operator}
                      onValueChange={(v) => setNewAlert((prev) => ({ ...prev, operator: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gt">&gt;</SelectItem>
                        <SelectItem value="gte">≥</SelectItem>
                        <SelectItem value="lt">&lt;</SelectItem>
                        <SelectItem value="lte">≤</SelectItem>
                        <SelectItem value="eq">=</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Threshold</Label>
                    <Input
                      type="number"
                      value={newAlert.threshold}
                      onChange={(e) =>
                        setNewAlert((prev) => ({ ...prev, threshold: parseFloat(e.target.value) }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Time Window (minutes)</Label>
                  <Input
                    type="number"
                    value={newAlert.windowMinutes}
                    onChange={(e) =>
                      setNewAlert((prev) => ({ ...prev, windowMinutes: parseInt(e.target.value) }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createAlert}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-white/40 text-center py-4">
              No alerts configured
            </p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-lg border border-black/[0.06] dark:border-white/[0.06]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium font-logo text-sm">{alert.name}</span>
                          <Badge
                            className={
                              alert.isEnabled
                                ? 'bg-green-500/10 text-green-600'
                                : 'bg-zinc-500/10 text-zinc-500 dark:text-white/40'
                            }
                          >
                            {alert.isEnabled ? 'Active' : 'Disabled'}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-400 dark:text-white/40 mt-1">
                          {getMetricLabel(alert.metric)} {getOperatorLabel(alert.operator)}{' '}
                          {alert.threshold}
                        </p>
                        {alert.lastTriggeredAt && (
                          <p className="text-xs text-orange-600 mt-1">
                            Last triggered{' '}
                            {formatDistanceToNow(new Date(alert.lastTriggeredAt), {
                              addSuffix: true,
                            })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={alert.isEnabled}
                          onCheckedChange={(checked) => toggleAlert(alert.id, checked)}
                        />
                        <Button variant="ghost" size="sm" onClick={() => deleteAlert(alert.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card className="border-black/[0.06] dark:border-white/[0.06]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Recent Alert Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-white/40 text-center py-4">
              No recent events
            </p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {events.map((event) => {
                  const alert = alerts.find((a) => a.id === event.alertId)
                  return (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg border ${
                        event.status === 'triggered'
                          ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'
                          : event.status === 'acknowledged'
                            ? 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20'
                            : 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            {event.status === 'triggered' ? (
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            ) : event.status === 'acknowledged' ? (
                              <Clock className="h-4 w-4 text-yellow-600" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                            <span className="font-medium font-logo text-sm">
                              {alert?.name || 'Unknown'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 dark:text-white/40 mt-1">
                            Value: {event.metricValue.toFixed(2)} (threshold: {event.thresholdValue}
                            )
                          </p>
                        </div>
                        <span className="text-xs text-zinc-400 dark:text-white/40">
                          {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
