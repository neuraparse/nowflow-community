'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Layers,
  Map as MapIcon,
  Maximize2,
  RefreshCw,
  Search,
  Server,
  Workflow,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSession } from '@/lib/auth-client'
import { isAbortLikeError } from '@/lib/errors/network'
import { createLogger } from '@/lib/logs/console-logger'
import { useSidebarStore } from '@/stores/sidebar/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { WorkspacePageHeader } from '@/app/w/components/workspace-shell'

const logger = createLogger('SystemMapPage')

interface WorkflowNode {
  id: string
  name: string
  status: 'healthy' | 'warning' | 'error' | 'inactive'
  lastRun: string | null
  runCount: number
  errorCount: number
  services: string[]
  isDeployed: boolean
  triggers: string[]
  dependencies: string[]
}

interface ServiceGroup {
  name: string
  icon: string
  color: string
  workflowIds: string[]
}

interface SystemMapData {
  workflows: WorkflowNode[]
  services: ServiceGroup[]
  connections: { from: string; to: string; type: string }[]
  stats: {
    totalWorkflows: number
    activeWorkflows: number
    totalExecutions: number
    avgSuccessRate: number
    estimatedTimeSaved: number
  }
}

const STATUS_CONFIG = {
  healthy: { color: '#4A7A68', dot: 'bg-[#4A7A68]', text: 'text-[#4A7A68]', icon: CheckCircle2 },
  warning: { color: '#F59E0B', dot: 'bg-[#F59E0B]', text: 'text-[#F59E0B]', icon: AlertCircle },
  error: { color: '#EF4444', dot: 'bg-[#EF4444]', text: 'text-[#EF4444]', icon: AlertCircle },
  inactive: {
    color: '#a1a1aa',
    dot: 'bg-zinc-400',
    text: 'text-zinc-400 dark:text-white/50',
    icon: Clock,
  },
}

export default function SystemMapPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const { mode, isExpanded } = useSidebarStore()
  const { workflows: registryWorkflows } = useWorkflowRegistry()
  const activeWorkspaceId = useWorkflowRegistry((state) => state.activeWorkspaceId)
  const isSidebarCollapsed =
    mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'

  const [data, setData] = useState<SystemMapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [zoom, setZoom] = useState(100)

  const loadSystemMap = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (activeWorkspaceId) params.set('workspaceId', activeWorkspaceId)
        const response = await fetch(`/api/system-map?${params}`, { signal })
        if (response.ok) {
          const result = await response.json()
          if (signal?.aborted) return
          setData(result)
        }
      } catch (error) {
        if (isAbortLikeError(error, signal)) return
        logger.error('Failed to load system map', error)
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [activeWorkspaceId]
  )

  useEffect(() => {
    const abortController = new AbortController()

    if (!isPending && session?.user) {
      loadSystemMap(abortController.signal)
    }

    return () => {
      abortController.abort()
    }
  }, [session, isPending, loadSystemMap])

  // Generate system map data from registry workflows if API isn't available
  const generatedData = useMemo<SystemMapData>(() => {
    if (data) return data

    const workflowEntries = Object.values(registryWorkflows)
    const serviceMap = new Map<string, string[]>()
    const workflowNodes: WorkflowNode[] = workflowEntries.map((wf) => {
      const services: string[] = []
      // Extract services from workflow state
      if (wf.state) {
        const blocks = Object.values(wf.state.blocks || {})
        blocks.forEach((block: any) => {
          const blockType = block?.type || ''
          if (
            blockType &&
            blockType !== 'starter' &&
            blockType !== 'condition' &&
            blockType !== 'function'
          ) {
            const serviceName = blockType
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (c: string) => c.toUpperCase())
            if (!services.includes(serviceName)) {
              services.push(serviceName)
            }
            if (!serviceMap.has(serviceName)) {
              serviceMap.set(serviceName, [])
            }
            serviceMap.get(serviceName)!.push(wf.id)
          }
        })
      }

      return {
        id: wf.id,
        name: wf.name || 'Untitled Workflow',
        status: wf.isDeployed ? 'healthy' : 'inactive',
        lastRun: null,
        runCount: 0,
        errorCount: 0,
        services,
        isDeployed: !!wf.isDeployed,
        triggers: [],
        dependencies: [],
      }
    })

    const serviceGroups: ServiceGroup[] = Array.from(serviceMap.entries()).map(([name, ids]) => ({
      name,
      icon: '🔌',
      color: getServiceColor(name),
      workflowIds: [...new Set(ids)],
    }))

    return {
      workflows: workflowNodes,
      services: serviceGroups,
      connections: [],
      stats: {
        totalWorkflows: workflowNodes.length,
        activeWorkflows: workflowNodes.filter((w) => w.isDeployed).length,
        totalExecutions: 0,
        avgSuccessRate: 0,
        estimatedTimeSaved: 0,
      },
    }
  }, [data, registryWorkflows])

  const filteredWorkflows = useMemo(() => {
    return generatedData.workflows.filter((wf) => {
      const matchesSearch =
        !searchQuery ||
        wf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wf.services.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesStatus = statusFilter === 'all' || wf.status === statusFilter
      const matchesService = serviceFilter === 'all' || wf.services.includes(serviceFilter)
      return matchesSearch && matchesStatus && matchesService
    })
  }, [generatedData.workflows, searchQuery, statusFilter, serviceFilter])

  const allServices = useMemo(() => {
    const services = new Set<string>()
    generatedData.workflows.forEach((wf) => wf.services.forEach((s) => services.add(s)))
    return Array.from(services).sort()
  }, [generatedData.workflows])

  const statCards = [
    {
      label: 'Total Workflows',
      value: generatedData.stats.totalWorkflows,
      icon: Workflow,
      color: '#4A7A68',
    },
    {
      label: 'Active',
      value: generatedData.stats.activeWorkflows,
      icon: Activity,
      color: '#4A7A68',
    },
    { label: 'Services', value: allServices.length, icon: Server, color: '#3B82F6' },
    {
      label: 'Success Rate',
      value:
        generatedData.stats.avgSuccessRate > 0
          ? `${generatedData.stats.avgSuccessRate.toFixed(1)}%`
          : '--',
      icon: CheckCircle2,
      color: '#4A7A68',
    },
    {
      label: 'Time Saved',
      value:
        generatedData.stats.estimatedTimeSaved > 0
          ? `${generatedData.stats.estimatedTimeSaved}h`
          : '--',
      icon: Clock,
      color: '#8B5CF6',
    },
  ]

  if (isPending || loading) {
    return (
      <div
        className={`workspace-stage min-h-screen py-6 px-6 transition-all duration-200 ${
          isSidebarCollapsed ? 'pl-20' : 'pl-72'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          {/* Header skeleton */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-zinc-200 dark:bg-white/[0.04] animate-pulse" />
            <div>
              <div className="h-5 w-40 rounded-md bg-zinc-200 dark:bg-white/[0.04] animate-pulse mb-1.5" />
              <div className="h-3 w-64 rounded-md bg-zinc-200 dark:bg-white/[0.04] animate-pulse" />
            </div>
          </div>
          {/* Stat cards skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="silver-glass-panel rounded-xl bg-transparent p-4">
                <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-white/[0.04] animate-pulse mb-3" />
                <div className="h-6 w-16 rounded-md bg-zinc-200 dark:bg-white/[0.04] animate-pulse mb-1.5" />
                <div className="h-3 w-24 rounded-md bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
              </div>
            ))}
          </div>
          {/* Content skeleton */}
          <div className="silver-glass-panel rounded-xl bg-transparent p-6">
            <div className="h-9 w-full max-w-md rounded-lg bg-zinc-100 dark:bg-white/[0.04] animate-pulse mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-32 rounded-xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`workspace-stage min-h-screen py-6 px-6 transition-all duration-200 ${
        isSidebarCollapsed ? 'pl-20' : 'pl-72'
      }`}
    >
      <div className="max-w-7xl mx-auto">
        <WorkspacePageHeader
          eyebrow="Tools"
          title="System"
          accent="Map"
          description="Visualize workflow dependencies and system health"
          className="mb-8"
          actions={
            <button
              onClick={() => loadSystemMap()}
              aria-label="Refresh system map"
              className="silver-glass-chip h-9 px-3.5 rounded-lg bg-transparent text-[13px] font-logo text-zinc-700 dark:text-white/80 flex items-center gap-2 transition-colors duration-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {statCards.map((stat) => {
            const StatIcon = stat.icon
            return (
              <div key={stat.label} className="silver-glass-panel rounded-xl bg-transparent p-4">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center mb-3"
                  style={{
                    backgroundColor: `${stat.color}08`,
                    border: `1px solid ${stat.color}15`,
                  }}
                >
                  <StatIcon className="h-4 w-4" style={{ color: stat.color }} />
                </div>
                <div className="text-[22px] font-logo font-bold text-zinc-800 dark:text-white">
                  {stat.value}
                </div>
                <div className="text-[10px] font-logo uppercase tracking-wider text-zinc-400 dark:text-white/50">
                  {stat.label}
                </div>
              </div>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search workflows or services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="silver-glass-pane smoky-glass-pane glass-field w-full h-9 rounded-lg border-0 bg-transparent pl-9 pr-3 text-[13px] font-logo text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/40 outline-none focus:ring-0"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9 rounded-lg text-[13px] font-logo focus:ring-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-48 h-9 rounded-lg text-[13px] font-logo focus:ring-0">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {allServices.map((service) => (
                <SelectItem key={service} value={service}>
                  {service}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Service Groups */}
        {generatedData.services.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[11px] font-logo font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/60 mb-3">
              Services ({generatedData.services.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {generatedData.services.slice(0, 20).map((service) => (
                <span
                  key={service.name}
                  className={`text-[11px] font-logo font-medium px-2 py-1 rounded-md border cursor-pointer transition-colors ${
                    serviceFilter === service.name
                      ? 'border-[#4A7A68]/20 bg-[#4A7A68]/[0.04] text-[#4A7A68]'
                      : 'border-black/[0.04] dark:border-white/[0.06] text-zinc-600 dark:text-white/60 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                  }`}
                  onClick={() =>
                    setServiceFilter(serviceFilter === service.name ? 'all' : service.name)
                  }
                >
                  <span className="mr-1">{service.icon}</span>
                  {service.name}
                  <span className="ml-1 opacity-60">({service.workflowIds.length})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Workflow Map Grid */}
        {filteredWorkflows.length === 0 ? (
          <div className="silver-glass-panel rounded-xl border-dashed bg-transparent flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 rounded-xl bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.08] flex items-center justify-center mb-4">
              <MapIcon className="h-6 w-6 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
            </div>
            <h3 className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white mb-1.5">
              {searchQuery || statusFilter !== 'all' || serviceFilter !== 'all'
                ? 'No workflows match filters'
                : 'No workflows yet'}
            </h3>
            <p className="text-[13px] font-logo text-zinc-500 dark:text-white/60 text-center max-w-md">
              Create workflows to see them appear on the system map with their connections and
              health status.
            </p>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(250, (300 * zoom) / 100)}px, 1fr))`,
            }}
          >
            {filteredWorkflows.map((wf) => {
              const statusConfig = STATUS_CONFIG[wf.status]
              const StatusIcon = statusConfig.icon
              return (
                <div
                  key={wf.id}
                  className="silver-glass-panel group cursor-pointer rounded-xl bg-transparent p-4 transition-all duration-200"
                  onClick={() => router.push(`/w/${wf.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${statusConfig.dot} flex-shrink-0`}
                      />
                      <h3 className="text-[13px] font-logo font-medium text-zinc-800 dark:text-white truncate">
                        {wf.name}
                      </h3>
                    </div>
                    <StatusIcon className={`h-4 w-4 ${statusConfig.text} flex-shrink-0`} />
                  </div>

                  {/* Services */}
                  {wf.services.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {wf.services.slice(0, 4).map((service) => (
                        <span
                          key={service}
                          className="silver-glass-chip text-[10px] font-logo px-1.5 py-0.5 rounded-md text-zinc-500 dark:text-white/60"
                        >
                          {service}
                        </span>
                      ))}
                      {wf.services.length > 4 && (
                        <span className="silver-glass-chip text-[10px] font-logo px-1.5 py-0.5 rounded-md text-zinc-500 dark:text-white/60">
                          +{wf.services.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-[12px] font-logo text-zinc-500 dark:text-white/60">
                    {wf.isDeployed && (
                      <span className="text-[10px] font-logo font-semibold uppercase px-1.5 py-0.5 rounded-md border border-[#4A7A68]/10 bg-[#4A7A68]/[0.04] text-[#4A7A68]">
                        Deployed
                      </span>
                    )}
                    {wf.runCount > 0 && <span className="font-logo">{wf.runCount} runs</span>}
                    {wf.errorCount > 0 && (
                      <span className="font-logo text-[#EF4444]">{wf.errorCount} errors</span>
                    )}
                  </div>

                  {/* Navigate link */}
                  <div className="mt-3 pt-3 border-t border-black/[0.04] dark:border-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1 text-[11px] font-logo text-[#4A7A68] dark:text-[#94B8A6]">
                      <span>Open workflow</span>
                      <ExternalLink className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function getServiceColor(serviceName: string): string {
  const colors = [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#F97316',
    '#14B8A6',
    '#6366F1',
  ]
  let hash = 0
  for (let i = 0; i < serviceName.length; i++) {
    hash = ((hash << 5) - hash + serviceName.charCodeAt(i)) | 0
  }
  return colors[Math.abs(hash) % colors.length]
}
