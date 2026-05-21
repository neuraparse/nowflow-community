'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FlaskConical,
  Info,
  Layers,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { PanelEmptyState, PanelHeader, PanelLoadingSkeleton } from '../panel/components/shared'

// ── Types ──────────────────────────────────────────────

interface BlockOverride {
  blockId: string
  blockName?: string
  params: Record<string, any>
  enabled?: boolean
}

interface Variant {
  id: string
  name: string
  description?: string
  weight: number
  config: Record<string, any>
  blockOverrides?: BlockOverride[]
}

interface Experiment {
  id: string
  name: string
  description: string | null
  status: 'draft' | 'running' | 'paused' | 'completed'
  variants: Variant[]
  trafficSplit: Record<string, number>
  metrics: string[]
  winnerVariantId: string | null
  startedAt: string | null
  endedAt: string | null
  targetSampleSize?: number
  currentSampleSize?: number
}

interface ExperimentResult {
  variantId: string
  count: number
  metrics: Record<string, { avg: number; min: number; max: number }>
}

interface StatisticalAnalysis {
  experiment: Experiment | null
  summary: Record<string, { count: number; metrics: Record<string, { avg: number }> }>
  significance: Record<
    string,
    { vsControl: { confidence: number; pValue: number; significant: boolean } }
  >
  recommendedWinner: string | null
}

interface ExperimentPanelProps {
  workflowId: string
  panelWidth?: number
}

// ── Helpers ────────────────────────────────────────────

const VARIANT_COLORS = [
  {
    bg: 'bg-zinc-500',
    light: 'bg-zinc-100 dark:bg-white/[0.06]',
    text: 'text-zinc-700 dark:text-white/70',
    dot: 'bg-zinc-400',
  },
  {
    bg: 'bg-pink-500',
    light: 'bg-pink-50 dark:bg-pink-950/30',
    text: 'text-pink-700 dark:text-pink-300',
    dot: 'bg-pink-500',
  },
  {
    bg: 'bg-blue-500',
    light: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  {
    bg: 'bg-emerald-500',
    light: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
]

const STATUS_CONFIG: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
  draft: {
    bg: 'bg-zinc-500/10 text-zinc-600 dark:text-white/60',
    icon: <Settings className="h-3 w-3" />,
    label: 'Draft',
  },
  running: {
    bg: 'bg-green-500/10 text-green-600 dark:text-green-400',
    icon: <Activity className="h-3 w-3 animate-pulse" />,
    label: 'Running',
  },
  paused: {
    bg: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    icon: <Pause className="h-3 w-3" />,
    label: 'Paused',
  },
  completed: {
    bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    icon: <CheckCircle className="h-3 w-3" />,
    label: 'Done',
  },
}

function formatMetric(metric: string, value: number) {
  if (metric === 'success') return `${(value * 100).toFixed(1)}%`
  if (metric === 'latency') return `${value.toFixed(0)}ms`
  if (metric === 'cost') return `$${value.toFixed(4)}`
  if (metric === 'tokens') return value.toFixed(0)
  return value.toFixed(2)
}

function getVariantColor(index: number) {
  return VARIANT_COLORS[index] || VARIANT_COLORS[0]
}

// ── Component ──────────────────────────────────────────

export function ExperimentPanel({ workflowId, panelWidth = 400 }: ExperimentPanelProps) {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null)
  const [results, setResults] = useState<Record<string, ExperimentResult>>({})
  const [analysis, setAnalysis] = useState<StatisticalAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const isCompact = panelWidth < 400
  const workflowBlocks = useWorkflowStore((state) => state.blocks)

  const [newExperiment, setNewExperiment] = useState({
    name: '',
    description: '',
    targetSampleSize: 100,
    variants: [
      {
        id: 'control',
        name: 'Control',
        weight: 50,
        config: {},
        blockOverrides: [] as BlockOverride[],
      },
      {
        id: 'variant-a',
        name: 'Variant A',
        weight: 50,
        config: {},
        blockOverrides: [] as BlockOverride[],
      },
    ],
    metrics: ['success', 'latency', 'cost', 'tokens'],
  })

  // ── Data fetching ──

  useEffect(() => {
    fetchExperiments()
  }, [workflowId])

  useEffect(() => {
    if (selectedExperiment) {
      fetchResults(selectedExperiment.id)
      fetchAnalysis(selectedExperiment.id)
    }
  }, [selectedExperiment])

  useEffect(() => {
    if (selectedExperiment?.status === 'running') {
      const interval = setInterval(() => {
        fetchResults(selectedExperiment.id)
        fetchAnalysis(selectedExperiment.id)
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [selectedExperiment])

  const fetchExperiments = async () => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/experiments`)
      const data = await response.json()
      if (data.success) {
        setExperiments(data.data)
        setError(null)
        if (data.data.length > 0 && !selectedExperiment) {
          setSelectedExperiment(data.data[0])
        }
      } else {
        setError(data.error || 'Failed to fetch experiments')
      }
    } catch (err) {
      console.error('Failed to fetch experiments:', err)
      setError('Failed to load experiments')
    } finally {
      setLoading(false)
    }
  }

  const fetchResults = async (experimentId: string) => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/experiments/${experimentId}`)
      const data = await response.json()
      if (data.success) {
        setResults(data.data.summary || {})
        if (data.data.experiment) setSelectedExperiment(data.data.experiment)
      }
    } catch (err) {
      console.error('Failed to fetch results:', err)
    }
  }

  const fetchAnalysis = async (experimentId: string) => {
    try {
      const response = await fetch(
        `/api/workflows/${workflowId}/experiments/${experimentId}?analysis=true`
      )
      const data = await response.json()
      if (data.success) setAnalysis(data.data)
    } catch (err) {
      console.error('Failed to fetch analysis:', err)
    }
  }

  const handleRefresh = async () => {
    if (!selectedExperiment) return
    setRefreshing(true)
    await Promise.all([fetchResults(selectedExperiment.id), fetchAnalysis(selectedExperiment.id)])
    setRefreshing(false)
  }

  // ── Experiment CRUD ──

  const createExperiment = async () => {
    try {
      const trafficSplit: Record<string, number> = {}
      newExperiment.variants.forEach((v) => {
        trafficSplit[v.id] = v.weight
      })

      const response = await fetch(`/api/workflows/${workflowId}/experiments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newExperiment.name,
          description: newExperiment.description,
          variants: newExperiment.variants,
          trafficSplit,
          metrics: newExperiment.metrics,
          targetSampleSize: newExperiment.targetSampleSize,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setCreateDialogOpen(false)
        fetchExperiments()
        setNewExperiment({
          name: '',
          description: '',
          targetSampleSize: 100,
          variants: [
            { id: 'control', name: 'Control', weight: 50, config: {}, blockOverrides: [] },
            { id: 'variant-a', name: 'Variant A', weight: 50, config: {}, blockOverrides: [] },
          ],
          metrics: ['success', 'latency', 'cost', 'tokens'],
        })
      }
    } catch (err) {
      console.error('Failed to create experiment:', err)
    }
  }

  const controlExperiment = async (
    action: 'start' | 'pause' | 'complete',
    winnerVariantId?: string
  ) => {
    if (!selectedExperiment) return
    try {
      const response = await fetch(
        `/api/workflows/${workflowId}/experiments/${selectedExperiment.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, winnerVariantId }),
        }
      )
      const data = await response.json()
      if (data.success) fetchExperiments()
    } catch (err) {
      console.error('Failed to control experiment:', err)
    }
  }

  // ── Variant management (create dialog) ──

  const addVariant = () => {
    const newWeight = Math.floor(100 / (newExperiment.variants.length + 1))
    const updatedVariants = newExperiment.variants.map((v) => ({ ...v, weight: newWeight }))
    updatedVariants.push({
      id: `variant-${String.fromCharCode(97 + newExperiment.variants.length - 1)}`,
      name: `Variant ${String.fromCharCode(65 + newExperiment.variants.length - 1)}`,
      weight: newWeight,
      config: {},
      blockOverrides: [],
    })
    setNewExperiment((prev) => ({ ...prev, variants: updatedVariants }))
  }

  const removeVariant = (index: number) => {
    if (newExperiment.variants.length <= 2) return
    const updatedVariants = newExperiment.variants.filter((_, i) => i !== index)
    const newWeight = Math.floor(100 / updatedVariants.length)
    setNewExperiment((prev) => ({
      ...prev,
      variants: updatedVariants.map((v) => ({ ...v, weight: newWeight })),
    }))
  }

  const addBlockOverride = (variantIndex: number) => {
    const updatedVariants = [...newExperiment.variants]
    if (!updatedVariants[variantIndex].blockOverrides)
      updatedVariants[variantIndex].blockOverrides = []
    updatedVariants[variantIndex].blockOverrides!.push({ blockId: '', params: {}, enabled: true })
    setNewExperiment((prev) => ({ ...prev, variants: updatedVariants }))
  }

  const updateBlockOverride = (
    variantIndex: number,
    overrideIndex: number,
    field: string,
    value: any
  ) => {
    const updatedVariants = [...newExperiment.variants]
    const override = updatedVariants[variantIndex].blockOverrides![overrideIndex]
    if (field === 'blockId') {
      override.blockId = value
      const block = workflowBlocks[value]
      if (block) override.blockName = block.name
    } else if (field === 'params') {
      override.params = value
    } else if (field === 'enabled') {
      override.enabled = value
    }
    setNewExperiment((prev) => ({ ...prev, variants: updatedVariants }))
  }

  const removeBlockOverride = (variantIndex: number, overrideIndex: number) => {
    const updatedVariants = [...newExperiment.variants]
    updatedVariants[variantIndex].blockOverrides!.splice(overrideIndex, 1)
    setNewExperiment((prev) => ({ ...prev, variants: updatedVariants }))
  }

  // ── Computed values ──

  const totalSamples = Object.values(results).reduce((sum, r) => sum + (r.count || 0), 0)
  const progressPct = selectedExperiment?.targetSampleSize
    ? Math.min(100, (totalSamples / selectedExperiment.targetSampleSize) * 100)
    : 0

  const exportResults = () => {
    if (!selectedExperiment || !analysis) return
    const exportData = {
      experiment: {
        id: selectedExperiment.id,
        name: selectedExperiment.name,
        status: selectedExperiment.status,
        startedAt: selectedExperiment.startedAt,
        endedAt: selectedExperiment.endedAt,
      },
      variants: selectedExperiment.variants.map((v) => ({
        ...v,
        results: results[v.id],
        significance: analysis.significance[v.id],
      })),
      recommendedWinner: analysis.recommendedWinner,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `experiment-${selectedExperiment.name.replace(/\s+/g, '-')}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Loading ──

  if (loading) return <PanelLoadingSkeleton showHeader variant="card" itemCount={3} />

  // ── Render ──

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title="Experiments"
        icon={FlaskConical}
        count={experiments.length}
        accentColor="pink"
        pulseDot={experiments.some((e) => e.status === 'running')}
        actions={
          <Button
            size="sm"
            className="h-6 text-[10px] bg-pink-600 hover:bg-pink-700"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-3 w-3" />
            {!isCompact && <span className="ml-1">New</span>}
          </Button>
        }
      />

      {/* ── Create Dialog ── */}
      <CreateExperimentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        newExperiment={newExperiment}
        setNewExperiment={setNewExperiment}
        onCreateExperiment={createExperiment}
        addVariant={addVariant}
        removeVariant={removeVariant}
        addBlockOverride={addBlockOverride}
        updateBlockOverride={updateBlockOverride}
        removeBlockOverride={removeBlockOverride}
        workflowBlocks={workflowBlocks}
      />

      {/* ── Error ── */}
      {error && (
        <div className="silver-glass-pane smoky-glass-pane mx-3 mt-2 flex-none rounded-lg border border-rose-500/[0.16] bg-rose-500/[0.05] p-2 dark:border-rose-400/[0.14] dark:bg-rose-400/[0.06]">
          <div className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-100/82">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span className="flex-1 truncate">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              className="smoky-glass-chip h-5 px-2 text-[10px]"
              onClick={() => fetchExperiments()}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* ── Empty ── */}
      {experiments.length === 0 ? (
        <PanelEmptyState
          icon={FlaskConical}
          title="No experiments yet"
          description="Create an experiment to start A/B testing"
          accentColor="pink"
          ctaLabel="New Experiment"
          ctaOnClick={() => setCreateDialogOpen(true)}
          ctaIcon={Plus}
          className="py-6"
        />
      ) : (
        <>
          {/* ── Experiment Selector ── */}
          <div className="flex-none px-3 py-2 border-b border-black/[0.06] dark:border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <Select
                value={selectedExperiment?.id || ''}
                onValueChange={(id) => {
                  const exp = experiments.find((e) => e.id === id)
                  if (exp) setSelectedExperiment(exp)
                }}
              >
                <SelectTrigger className="flex-1 h-7 text-xs">
                  <SelectValue placeholder="Select experiment" />
                </SelectTrigger>
                <SelectContent>
                  {experiments.map((exp) => (
                    <SelectItem key={exp.id} value={exp.id}>
                      <div className="flex items-center gap-2">
                        <span>{exp.name}</span>
                        <Badge className={`${STATUS_CONFIG[exp.status]?.bg} text-[9px] h-3.5 px-1`}>
                          {STATUS_CONFIG[exp.status]?.label}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="h-7 w-7 p-0"
                  >
                    <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={exportResults} className="h-7 w-7 p-0">
                    <Download className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* ── Experiment Content (single scroll, no tabs) ── */}
          {selectedExperiment && (
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-3">
                  {/* Status + Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge className={STATUS_CONFIG[selectedExperiment.status]?.bg}>
                        {STATUS_CONFIG[selectedExperiment.status]?.icon}
                        <span className="ml-1">
                          {STATUS_CONFIG[selectedExperiment.status]?.label}
                        </span>
                      </Badge>
                      <span className="text-xs text-zinc-400 dark:text-white/40 truncate">
                        {selectedExperiment.variants.length} variants
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {selectedExperiment.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => controlExperiment('start')}
                          className="h-6 px-2 text-[10px] bg-green-600 hover:bg-green-700"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Start
                        </Button>
                      )}
                      {selectedExperiment.status === 'running' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => controlExperiment('pause')}
                            className="h-6 px-2 text-[10px]"
                          >
                            <Pause className="h-3 w-3 mr-1" />
                            Pause
                          </Button>
                          <Button
                            size="sm"
                            onClick={() =>
                              controlExperiment(
                                'complete',
                                analysis?.recommendedWinner || undefined
                              )
                            }
                            className="h-6 px-2 text-[10px]"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            End
                          </Button>
                        </>
                      )}
                      {selectedExperiment.status === 'paused' && (
                        <Button
                          size="sm"
                          onClick={() => controlExperiment('start')}
                          className="h-6 px-2 text-[10px] bg-green-600 hover:bg-green-700"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Resume
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {selectedExperiment.description && (
                    <p className="text-[11px] text-zinc-400 dark:text-white/40 leading-relaxed">
                      {selectedExperiment.description}
                    </p>
                  )}

                  {/* Progress */}
                  {selectedExperiment.targetSampleSize && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-white/40">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {totalSamples} / {selectedExperiment.targetSampleSize} samples
                        </span>
                        <span>{progressPct.toFixed(0)}%</span>
                      </div>
                      <Progress value={progressPct} className="h-1.5" />
                    </div>
                  )}

                  {/* Winner / Leader Alert */}
                  {analysis?.recommendedWinner && (
                    <div
                      className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                        selectedExperiment.status === 'completed'
                          ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
                          : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      <Star className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        <strong>
                          {
                            selectedExperiment.variants.find(
                              (v) => v.id === analysis.recommendedWinner
                            )?.name
                          }
                        </strong>
                        {selectedExperiment.status === 'completed'
                          ? ' won the experiment'
                          : ' is currently leading'}
                      </span>
                    </div>
                  )}

                  {/* ── Variant Cards ── */}
                  <div className="space-y-2">
                    {selectedExperiment.variants.map((variant, idx) => {
                      const vResult = results[variant.id]
                      const color = getVariantColor(idx)
                      const isWinner = selectedExperiment.winnerVariantId === variant.id
                      const isLeading = analysis?.recommendedWinner === variant.id && !isWinner
                      const sig = analysis?.significance[variant.id]?.vsControl
                      const successRate = vResult?.metrics?.success?.avg

                      return (
                        <div
                          key={variant.id}
                          className={`rounded-lg border p-2.5 ${
                            isWinner
                              ? 'border-green-400 bg-green-50/50 dark:bg-green-950/10'
                              : isLeading
                                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/10'
                                : 'border-black/[0.06] dark:border-white/[0.06]'
                          }`}
                        >
                          {/* Variant header row */}
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
                            <span className="font-medium text-xs flex-1 truncate">
                              {variant.name}
                            </span>
                            {isWinner && (
                              <Badge className="bg-green-500/10 text-green-600 text-[9px] h-4 px-1">
                                <Star className="h-2.5 w-2.5 mr-0.5" />
                                Winner
                              </Badge>
                            )}
                            {isLeading && selectedExperiment.status !== 'draft' && (
                              <Badge className="bg-amber-500/10 text-amber-600 text-[9px] h-4 px-1">
                                <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                                Leading
                              </Badge>
                            )}
                            <span className="text-[10px] text-zinc-400 dark:text-white/40">
                              {selectedExperiment.trafficSplit[variant.id]}%
                            </span>
                          </div>

                          {/* Metrics row */}
                          {vResult ? (
                            <div className="flex items-center gap-3 mt-2 pl-4">
                              <div className="text-[10px] text-zinc-400 dark:text-white/40">
                                <span className="font-medium text-zinc-800 dark:text-white">
                                  {vResult.count}
                                </span>{' '}
                                samples
                              </div>
                              {Object.entries(vResult.metrics).map(([metric, stats]) => (
                                <div
                                  key={metric}
                                  className="text-[10px] text-zinc-400 dark:text-white/40"
                                >
                                  <span className="capitalize">{metric}: </span>
                                  <span className="font-medium text-zinc-800 dark:text-white">
                                    {formatMetric(metric, stats.avg)}
                                  </span>
                                </div>
                              ))}
                              {/* Significance badge (non-control only) */}
                              {idx > 0 && sig && (
                                <Badge
                                  className={`text-[9px] h-3.5 px-1 ${sig.significant ? 'bg-green-500/10 text-green-600' : 'bg-zinc-500/10 text-zinc-500 dark:text-white/40'}`}
                                >
                                  {sig.significant
                                    ? 'Significant'
                                    : `${(sig.confidence * 100).toFixed(0)}%`}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <p className="text-[10px] text-zinc-400 dark:text-white/40 mt-1.5 pl-4">
                              No data yet
                            </p>
                          )}

                          {/* Success rate comparison bar */}
                          {successRate !== undefined && (
                            <div className="mt-2 pl-4">
                              <div className="h-1.5 bg-zinc-100 dark:bg-white/[0.05] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${color.bg}`}
                                  style={{ width: `${Math.min(100, successRate * 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* ── Detailed Metrics Comparison (collapsible) ── */}
                  {Object.keys(results).length > 0 && (
                    <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-white/40 hover:text-zinc-800 dark:text-white transition-colors w-full py-1">
                        {showDetails ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <BarChart3 className="h-3 w-3" />
                        Detailed comparison
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-3">
                        {/* Comparison table */}
                        <div className="overflow-x-auto rounded-lg border border-black/[0.06] dark:border-white/[0.06]">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b bg-zinc-50 dark:bg-white/[0.04]">
                                <th className="text-left p-1.5 text-[10px] font-medium text-zinc-400 dark:text-white/40">
                                  Variant
                                </th>
                                <th className="text-right p-1.5 text-[10px] font-medium text-zinc-400 dark:text-white/40">
                                  N
                                </th>
                                {selectedExperiment.metrics.map((m) => (
                                  <th
                                    key={m}
                                    className="text-right p-1.5 text-[10px] font-medium text-zinc-400 dark:text-white/40 capitalize"
                                  >
                                    {m}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {selectedExperiment.variants.map((variant, idx) => {
                                const vr = results[variant.id]
                                const isW = selectedExperiment.winnerVariantId === variant.id
                                return (
                                  <tr
                                    key={variant.id}
                                    className={`border-b last:border-0 ${isW ? 'bg-green-50/50 dark:bg-green-950/10' : ''}`}
                                  >
                                    <td className="p-1.5 text-[10px] font-medium">
                                      <div className="flex items-center gap-1.5">
                                        <div
                                          className={`w-1.5 h-1.5 rounded-full ${getVariantColor(idx).dot}`}
                                        />
                                        {variant.name}
                                        {isW && <Star className="h-2.5 w-2.5 text-green-600" />}
                                      </div>
                                    </td>
                                    <td className="text-right p-1.5 text-[10px] tabular-nums">
                                      {vr?.count || 0}
                                    </td>
                                    {selectedExperiment.metrics.map((m) => (
                                      <td
                                        key={m}
                                        className="text-right p-1.5 text-[10px] tabular-nums"
                                      >
                                        {vr?.metrics[m] ? formatMetric(m, vr.metrics[m].avg) : '-'}
                                      </td>
                                    ))}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Visual metric bars */}
                        {selectedExperiment.metrics.map((metric) => {
                          const maxVal = Math.max(
                            ...selectedExperiment.variants.map(
                              (v) => results[v.id]?.metrics[metric]?.avg || 0
                            )
                          )
                          if (maxVal === 0) return null
                          return (
                            <div key={metric} className="space-y-1">
                              <span className="text-[10px] font-medium text-zinc-400 dark:text-white/40 capitalize">
                                {metric}
                              </span>
                              {selectedExperiment.variants.map((variant, i) => {
                                const val = results[variant.id]?.metrics[metric]?.avg || 0
                                const pct = maxVal > 0 ? (val / maxVal) * 100 : 0
                                return (
                                  <div key={variant.id} className="flex items-center gap-1.5">
                                    <div
                                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getVariantColor(i).dot}`}
                                    />
                                    <div className="flex-1 h-2 bg-zinc-50 dark:bg-white/[0.04] rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${getVariantColor(i).bg}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="text-[9px] w-12 text-right tabular-nums text-zinc-400 dark:text-white/40">
                                      {formatMetric(metric, val)}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}

                        {/* Significance summary */}
                        {selectedExperiment.variants.length > 1 && analysis && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-medium text-zinc-400 dark:text-white/40">
                              Significance vs Control
                            </span>
                            {selectedExperiment.variants.slice(1).map((variant) => {
                              const sig = analysis.significance[variant.id]?.vsControl
                              return (
                                <div
                                  key={variant.id}
                                  className="flex items-center justify-between text-[10px] py-1 px-2 rounded bg-zinc-50/50 dark:bg-white/[0.03]"
                                >
                                  <span>{variant.name}</span>
                                  {sig ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-zinc-400 dark:text-white/40 tabular-nums">
                                        {(sig.confidence * 100).toFixed(1)}% conf.
                                      </span>
                                      <Badge
                                        className={`text-[9px] h-3.5 px-1 ${sig.significant ? 'bg-green-500/10 text-green-600' : 'bg-zinc-500/10 text-zinc-500 dark:text-white/40'}`}
                                      >
                                        {sig.significant ? (
                                          <>
                                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                            Sig.
                                          </>
                                        ) : (
                                          'Not sig.'
                                        )}
                                      </Badge>
                                    </div>
                                  ) : (
                                    <span className="text-zinc-400 dark:text-white/40">
                                      Needs more data
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Low sample warning */}
                        {selectedExperiment.status === 'running' && totalSamples < 30 && (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-[10px]">
                            <AlertCircle className="h-3 w-3 flex-shrink-0" />
                            Need at least {selectedExperiment.variants.length * 30} samples for
                            reliable analysis ({totalSamples} collected)
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Create Dialog (extracted for clarity) ──────────────

function CreateExperimentDialog({
  open,
  onOpenChange,
  newExperiment,
  setNewExperiment,
  onCreateExperiment,
  addVariant,
  removeVariant,
  addBlockOverride,
  updateBlockOverride,
  removeBlockOverride,
  workflowBlocks,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  newExperiment: any
  setNewExperiment: React.Dispatch<React.SetStateAction<any>>
  onCreateExperiment: () => void
  addVariant: () => void
  removeVariant: (index: number) => void
  addBlockOverride: (variantIndex: number) => void
  updateBlockOverride: (
    variantIndex: number,
    overrideIndex: number,
    field: string,
    value: any
  ) => void
  removeBlockOverride: (variantIndex: number, overrideIndex: number) => void
  workflowBlocks: Record<string, any>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[85vh]">
        <DialogHeader className="flex-none">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-pink-500" />
            New Experiment
          </DialogTitle>
          <DialogDescription className="text-xs">
            Set up an A/B test for your workflow
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
          {/* Name + Description */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={newExperiment.name}
                onChange={(e) =>
                  setNewExperiment((prev: any) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., GPT-4 vs Claude"
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={newExperiment.description}
                onChange={(e) =>
                  setNewExperiment((prev: any) => ({ ...prev, description: e.target.value }))
                }
                placeholder="What hypothesis are you testing?"
                className="mt-1 text-sm"
                rows={2}
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Target className="h-3 w-3" />
                Target Sample Size
              </Label>
              <Input
                type="number"
                value={newExperiment.targetSampleSize}
                onChange={(e) =>
                  setNewExperiment((prev: any) => ({
                    ...prev,
                    targetSampleSize: parseInt(e.target.value) || 100,
                  }))
                }
                className="mt-1 h-8 w-28 text-sm"
                min={10}
              />
            </div>
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Variants</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVariant}
                className="h-6 text-[10px]"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {newExperiment.variants.map((variant: any, index: number) => (
                <div
                  key={variant.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-zinc-50/30 dark:bg-white/[0.02]"
                >
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${getVariantColor(index).dot}`}
                  />
                  <Input
                    value={variant.name}
                    onChange={(e) => {
                      const variants = [...newExperiment.variants]
                      variants[index].name = e.target.value
                      setNewExperiment((prev: any) => ({ ...prev, variants }))
                    }}
                    className="flex-1 h-7 text-xs"
                    placeholder="Name"
                  />
                  <div className="flex items-center gap-0.5">
                    <Input
                      type="number"
                      value={variant.weight}
                      onChange={(e) => {
                        const variants = [...newExperiment.variants]
                        variants[index].weight = parseInt(e.target.value) || 0
                        setNewExperiment((prev: any) => ({ ...prev, variants }))
                      }}
                      className="w-12 h-7 text-xs text-center"
                      min={0}
                      max={100}
                    />
                    <span className="text-[10px] text-zinc-400 dark:text-white/40">%</span>
                  </div>
                  {newExperiment.variants.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariant(index)}
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Traffic split bar */}
            <div className="flex h-4 rounded-md overflow-hidden mt-2">
              {newExperiment.variants.map((variant: any, index: number) => (
                <div
                  key={variant.id}
                  className={`transition-all flex items-center justify-center ${getVariantColor(index).bg}`}
                  style={{ width: `${variant.weight}%` }}
                  title={`${variant.name}: ${variant.weight}%`}
                >
                  {variant.weight >= 20 && (
                    <span className="text-[9px] font-semibold text-white">{variant.weight}%</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Block Overrides */}
          <Collapsible className="border rounded-lg">
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2.5 hover:bg-zinc-50 dark:bg-white/[0.04] text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Layers className="h-3 w-3" />
                Block Overrides
              </span>
              <ChevronDown className="h-3 w-3 text-zinc-400 dark:text-white/40" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2.5 pb-2.5 space-y-3">
              <p className="text-[10px] text-zinc-400 dark:text-white/40">
                Configure different block parameters per variant (e.g., different AI models).
              </p>
              {newExperiment.variants.map((variant: any, variantIndex: number) => (
                <div key={variant.id} className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${getVariantColor(variantIndex).dot}`}
                    />
                    <span className="text-[10px] font-medium">{variant.name}</span>
                    <Badge variant="outline" className="text-[9px] h-3.5 ml-auto">
                      {variant.blockOverrides?.length || 0}
                    </Badge>
                  </div>
                  {variant.blockOverrides?.map((override: BlockOverride, overrideIndex: number) => (
                    <div
                      key={overrideIndex}
                      className="p-2 bg-zinc-50/50 dark:bg-white/[0.03] rounded border border-black/[0.04] dark:border-white/[0.04] space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={override.blockId}
                          onValueChange={(value) =>
                            updateBlockOverride(variantIndex, overrideIndex, 'blockId', value)
                          }
                        >
                          <SelectTrigger className="flex-1 h-7 text-xs">
                            <SelectValue placeholder="Select block" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(workflowBlocks).map(([id, block]: [string, any]) => (
                              <SelectItem key={id} value={id}>
                                {block.name || id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBlockOverride(variantIndex, overrideIndex)}
                          className="h-7 w-7 p-0 text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {override.blockId && (
                        <Textarea
                          value={JSON.stringify(override.params, null, 2)}
                          onChange={(e) => {
                            try {
                              updateBlockOverride(
                                variantIndex,
                                overrideIndex,
                                'params',
                                JSON.parse(e.target.value)
                              )
                            } catch {}
                          }}
                          className="font-mono text-[10px] h-14"
                          placeholder='{"model": "gpt-4"}'
                        />
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addBlockOverride(variantIndex)}
                    className="w-full h-6 text-[10px]"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Override
                  </Button>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="flex-none pt-3 border-t gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onCreateExperiment}
            disabled={!newExperiment.name.trim()}
            className="bg-pink-600 hover:bg-pink-700"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
