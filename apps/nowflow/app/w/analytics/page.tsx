'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Cpu,
  DollarSign,
  Gauge,
  Loader2,
  RefreshCw,
  Rocket,
  Workflow,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react'
import { QuotaDisplay } from '@/components/billing/quota-display'
import { SpendControlsPanel } from '@/components/billing/spend-controls-panel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSidebarStore } from '@/stores/sidebar/store'
import { WorkspacePageHeader } from '@/app/w/components/workspace-shell'
import { OverviewCards } from './components/overview-cards'

const CostChart = dynamic(
  () => import('./components/cost-chart').then((mod) => ({ default: mod.CostChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/[0.04]" />
    ),
  }
)
const ErrorRateChart = dynamic(
  () => import('./components/error-rate-chart').then((mod) => ({ default: mod.ErrorRateChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/[0.04]" />
    ),
  }
)
const AlertManager = dynamic(
  () => import('./components/alert-manager').then((mod) => ({ default: mod.AlertManager })),
  { ssr: false }
)
const PerformanceTab = dynamic(
  () => import('./components/performance-tab').then((mod) => ({ default: mod.PerformanceTab })),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/[0.04]" />
    ),
  }
)
const ToolsTab = dynamic(
  () => import('./components/tools-tab').then((mod) => ({ default: mod.ToolsTab })),
  { ssr: false }
)
const TriggersTab = dynamic(
  () => import('./components/triggers-tab').then((mod) => ({ default: mod.TriggersTab })),
  { ssr: false }
)
const ExecutionTimeline = dynamic(
  () =>
    import('./components/execution-timeline').then((mod) => ({ default: mod.ExecutionTimeline })),
  { ssr: false }
)

interface AnalyticsSummary {
  totalExecutions: number
  successRate: number
  avgLatency: number
  p50Latency?: number | null
  p95Latency?: number | null
  p99Latency?: number | null
  totalCost: number
  totalInputCost?: number
  totalOutputCost?: number
  totalTokens: number
  totalPromptTokens?: number
  totalCompletionTokens?: number
  errorCount: number
}

interface WorkflowWithStats {
  id: string
  name: string
  isDeployed: boolean
  runCount: number
  lastRunAt: string | null
  stats: {
    executions: number
    cost: number
    tokens: number
    errors: number
  }
}

interface Deployment {
  id: string
  workflowId: string
  type: string
  status: string
  deployedAt: string
  subdomain?: string | null
}

interface ModelUsage {
  [model: string]: {
    tokens: number
    cost: number
    count: number
  }
}

interface RecentRun {
  id: string
  workflowId: string
  status: string
  executionTime: number | null
  tokensUsed: number | null
  cost: number
  model: string | null
  createdAt: string
}

interface AnalyticsData {
  analytics: any[]
  summary: AnalyticsSummary
  workflows: WorkflowWithStats[]
  deployments: Deployment[]
  modelUsage: ModelUsage
  dailyTrend: Array<{
    date: string
    executions: number
    cost: number
    tokens: number
    errors: number
    inputCost?: number
    outputCost?: number
    promptTokens?: number
    completionTokens?: number
  }>
  recentRuns: RecentRun[]
  blockMetrics?: Record<string, any>
  triggerBreakdown?: Record<string, number>
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('30d')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null)
  const refreshInterval = useRef<NodeJS.Timeout | null>(null)
  const { isExpanded, mode } = useSidebarStore()

  const isSidebarCollapsed =
    mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'

  const getStartDate = useCallback(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    return startDate.toISOString()
  }, [dateRange])

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = getStartDate()
      const url =
        selectedWorkflow === 'all'
          ? `/api/analytics/workflows/all?startDate=${startDate}`
          : `/api/analytics/workflows/${selectedWorkflow}?startDate=${startDate}`

      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedWorkflow, getStartDate])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      refreshInterval.current = setInterval(fetchAnalytics, 30000)
    } else if (refreshInterval.current) {
      clearInterval(refreshInterval.current)
      refreshInterval.current = null
    }
    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current)
    }
  }, [autoRefresh, fetchAnalytics])

  const getWorkflowName = (workflowId: string) => {
    const workflow = data?.workflows.find((w) => w.id === workflowId)
    return workflow?.name || workflowId.slice(0, 8)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading && !data) {
    return (
      <div
        className={`workspace-stage flex items-center justify-center h-dvh transition-all duration-300 ${
          isSidebarCollapsed ? 'pl-20' : 'pl-72'
        }`}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#4A7A68] dark:text-[#94B8A6]" />
      </div>
    )
  }

  return (
    <div
      className={`workspace-stage p-6 space-y-6 min-h-screen transition-all duration-300 ${
        isSidebarCollapsed ? 'pl-20' : 'pl-72'
      }`}
    >
      <WorkspacePageHeader
        eyebrow="Tools"
        title="Analytics"
        accent="Dashboard"
        description="Monitor your workflow performance, costs, and AI usage"
        actions={
          <>
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh((prev) => !prev)}
              aria-label={autoRefresh ? 'Disable auto refresh' : 'Enable auto refresh'}
              aria-pressed={autoRefresh}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-logo font-medium transition-colors ${
                autoRefresh
                  ? 'bg-[#4A7A68]/[0.08] text-[#4A7A68] dark:bg-[#94B8A6]/[0.08] dark:text-[#94B8A6]'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-white/[0.06] dark:text-white/40'
              }`}
            >
              <RefreshCw className={`h-3 w-3 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </button>

            {data?.workflows && data.workflows.length > 0 && (
              <Select value={selectedWorkflow} onValueChange={setSelectedWorkflow}>
                <SelectTrigger className="w-48 font-logo text-[12px]">
                  <SelectValue placeholder="Select workflow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workflows</SelectItem>
                  {data.workflows.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32 font-logo text-[12px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* Overview Cards */}
      {data?.summary && <OverviewCards summary={data.summary} dailyTrend={data.dailyTrend} />}

      {/* Quota Display */}
      <QuotaDisplay />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Tabbed Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="flex-wrap">
              <TabsTrigger value="overview" className="font-logo text-[12px]">
                Overview
              </TabsTrigger>
              <TabsTrigger value="performance" className="font-logo text-[12px]">
                <Gauge className="h-3.5 w-3.5 mr-1" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="cost" className="font-logo text-[12px]">
                <DollarSign className="h-3.5 w-3.5 mr-1" />
                Cost
              </TabsTrigger>
              <TabsTrigger value="errors" className="font-logo text-[12px]">
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                Errors
              </TabsTrigger>
              <TabsTrigger value="tools" className="font-logo text-[12px]">
                <Wrench className="h-3.5 w-3.5 mr-1" />
                Tools
              </TabsTrigger>
              <TabsTrigger value="triggers" className="font-logo text-[12px]">
                <Zap className="h-3.5 w-3.5 mr-1" />
                Triggers
              </TabsTrigger>
              <TabsTrigger value="alerts" className="font-logo text-[12px]">
                Alerts
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab - Recent Executions + Timeline */}
            <TabsContent value="overview" className="space-y-4">
              {/* Execution Timeline (shown when an execution is selected) */}
              {selectedExecutionId && (
                <ExecutionTimeline
                  executionId={selectedExecutionId}
                  onClose={() => setSelectedExecutionId(null)}
                />
              )}

              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900">
                <div className="p-4 pb-2">
                  <h3 className="text-[13px] font-logo font-medium text-zinc-700 dark:text-white/85 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Recent Executions
                    <span className="text-[11px] font-logo text-zinc-400 dark:text-white/40 font-normal">
                      Click to view timeline
                    </span>
                  </h3>
                </div>
                <div className="p-4 pt-2">
                  {data?.recentRuns && data.recentRuns.length > 0 ? (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {data.recentRuns.slice(0, 30).map((run) => (
                        <div
                          key={run.id}
                          onClick={() =>
                            setSelectedExecutionId(selectedExecutionId === run.id ? null : run.id)
                          }
                          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedExecutionId === run.id
                              ? 'border border-[#4A7A68]/20 bg-[#4A7A68]/[0.03]'
                              : 'border border-black/[0.04] dark:border-white/[0.04] hover:bg-[#fafafa]/50 dark:hover:bg-white/[0.01]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {run.status === 'completed' || run.status === 'success' ? (
                              <CheckCircle className="h-4 w-4 text-[#4A7A68]" />
                            ) : run.status === 'failed' || run.status === 'error' ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-[#F59E0B]" />
                            )}
                            <div>
                              <p className="text-[13px] font-logo font-medium text-zinc-800 dark:text-white/85">
                                {getWorkflowName(run.workflowId)}
                              </p>
                              <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
                                {formatDate(run.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-[11px] font-logo">
                            {run.model && (
                              <span className="text-zinc-400 dark:text-white/40">{run.model}</span>
                            )}
                            {run.executionTime && (
                              <span className="text-zinc-400 dark:text-white/40">
                                {run.executionTime}ms
                              </span>
                            )}
                            {run.tokensUsed && (
                              <span className="text-zinc-400 dark:text-white/40">
                                {run.tokensUsed.toLocaleString()} tokens
                              </span>
                            )}
                            {run.cost > 0 && (
                              <span className="text-zinc-600 dark:text-white/70 font-medium">
                                ${run.cost.toFixed(4)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] font-logo text-zinc-500 dark:text-white/60 text-center py-8">
                      No recent executions
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance">
              <PerformanceTab
                analytics={data?.analytics || []}
                selectedWorkflow={selectedWorkflow}
                startDate={getStartDate()}
              />
            </TabsContent>

            {/* Cost Tab */}
            <TabsContent value="cost" className="space-y-6">
              <CostChart analytics={data?.analytics || []} />
              <SpendControlsPanel />
            </TabsContent>

            {/* Errors Tab */}
            <TabsContent value="errors">
              <ErrorRateChart
                analytics={data?.analytics || []}
                selectedWorkflow={selectedWorkflow}
                startDate={getStartDate()}
              />
            </TabsContent>

            {/* Tools Tab */}
            <TabsContent value="tools">
              <ToolsTab selectedWorkflow={selectedWorkflow} startDate={getStartDate()} />
            </TabsContent>

            {/* Triggers Tab */}
            <TabsContent value="triggers">
              <TriggersTab
                triggerBreakdown={data?.triggerBreakdown || {}}
                dailyTrend={data?.dailyTrend || []}
                analytics={data?.analytics || []}
              />
            </TabsContent>

            {/* Alerts Tab */}
            <TabsContent value="alerts">
              <AlertManager />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Workflows & Models */}
        <div className="space-y-6">
          {/* Model Usage */}
          <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900">
            <div className="p-4 pb-2">
              <h3 className="text-[13px] font-logo font-medium text-zinc-700 dark:text-white/85 flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                AI Model Usage
              </h3>
            </div>
            <div className="p-4 pt-2">
              {data?.modelUsage && Object.keys(data.modelUsage).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(data.modelUsage)
                    .sort(([, a], [, b]) => b.cost - a.cost)
                    .slice(0, 8)
                    .map(([model, usage]) => (
                      <div key={model} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-logo font-medium text-zinc-700 dark:text-white/85 truncate max-w-[180px]">
                            {model}
                          </span>
                          <span className="text-[13px] font-logo text-zinc-800 dark:text-white/85 font-medium">
                            ${usage.cost.toFixed(4)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-logo text-zinc-400 dark:text-white/40">
                          <span>{usage.tokens.toLocaleString()} tokens</span>
                          <span>{usage.count} requests</span>
                        </div>
                        <div className="h-1.5 bg-zinc-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#3B82F6] rounded-full"
                            style={{
                              width: `${Math.min(
                                (usage.cost /
                                  Math.max(...Object.values(data.modelUsage).map((m) => m.cost))) *
                                  100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-[13px] font-logo text-zinc-500 dark:text-white/60 text-center py-4">
                  No model usage data
                </p>
              )}
            </div>
          </div>

          {/* Workflow Stats */}
          <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900">
            <div className="p-4 pb-2">
              <h3 className="text-[13px] font-logo font-medium text-zinc-700 dark:text-white/85 flex items-center gap-2">
                <Workflow className="h-4 w-4" />
                Workflow Breakdown
              </h3>
            </div>
            <div className="p-4 pt-2">
              {data?.workflows && data.workflows.length > 0 ? (
                <div className="space-y-3 max-h-[350px] overflow-y-auto">
                  {data.workflows
                    .sort((a, b) => b.stats.cost - a.stats.cost)
                    .map((workflow) => (
                      <div
                        key={workflow.id}
                        className="p-3 rounded-lg border border-black/[0.04] dark:border-white/[0.04] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-logo font-medium text-zinc-800 dark:text-white/85 truncate max-w-[150px]">
                            {workflow.name}
                          </span>
                          <div className="flex items-center gap-1">
                            {workflow.isDeployed && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-logo font-medium bg-[#4A7A68]/[0.08] text-[#4A7A68] dark:bg-[#94B8A6]/[0.08] dark:text-[#94B8A6]">
                                <Rocket className="h-3 w-3" />
                                Live
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-logo">
                          <div className="flex items-center gap-1 text-zinc-400 dark:text-white/40">
                            <Activity className="h-3 w-3" />
                            {workflow.stats.executions} runs
                          </div>
                          <div className="flex items-center gap-1 text-zinc-600 dark:text-white/70">
                            <DollarSign className="h-3 w-3" />${workflow.stats.cost.toFixed(4)}
                          </div>
                          <div className="flex items-center gap-1 text-zinc-400 dark:text-white/40">
                            <Zap className="h-3 w-3" />
                            {workflow.stats.tokens.toLocaleString()} tokens
                          </div>
                          <div className="flex items-center gap-1 text-red-500">
                            <AlertTriangle className="h-3 w-3" />
                            {workflow.stats.errors} errors
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-[13px] font-logo text-zinc-500 dark:text-white/60 text-center py-4">
                  No workflows found
                </p>
              )}
            </div>
          </div>

          {/* Deployments */}
          <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900">
            <div className="p-4 pb-2">
              <h3 className="text-[13px] font-logo font-medium text-zinc-700 dark:text-white/85 flex items-center gap-2">
                <Rocket className="h-4 w-4" />
                Active Deployments
              </h3>
            </div>
            <div className="p-4 pt-2">
              {data?.deployments && data.deployments.length > 0 ? (
                <div className="space-y-2">
                  {data.deployments.slice(0, 10).map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-black/[0.04] dark:border-white/[0.04]"
                    >
                      <div>
                        <p className="text-[13px] font-logo font-medium text-zinc-800 dark:text-white/85">
                          {getWorkflowName(dep.workflowId)}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] font-logo text-zinc-400 dark:text-white/40">
                          <span>{formatDate(dep.deployedAt)}</span>
                          {dep.type === 'chat' && dep.subdomain && (
                            <span className="text-[#3B82F6]">/{dep.subdomain}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-logo font-medium ${
                            dep.status === 'active'
                              ? 'bg-[#4A7A68]/[0.08] text-[#4A7A68] dark:bg-[#94B8A6]/[0.08] dark:text-[#94B8A6]'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-white/[0.06] dark:text-white/40'
                          }`}
                        >
                          {dep.status}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-logo font-medium ${
                            dep.type === 'chat'
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                          }`}
                        >
                          {dep.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] font-logo text-zinc-500 dark:text-white/60 text-center py-4">
                  No active deployments
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
