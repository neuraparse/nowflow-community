'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Loader2,
  Play,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface TestCase {
  input: string
  expectedOutput: string
  tags: string[]
}

interface EvalSuite {
  id: string
  name: string
  description: string | null
  testCaseCount: number
  testCases: TestCase[]
  latestRun: {
    id: string
    status: string
    summary: any
    completedAt: string | null
  } | null
}

interface EvalsPanelProps {
  workflowId: string
}

export function EvalsPanel({ workflowId }: EvalsPanelProps) {
  const [suites, setSuites] = useState<EvalSuite[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newSuiteName, setNewSuiteName] = useState('')
  const [newTestCases, setNewTestCases] = useState<TestCase[]>([
    { input: '', expectedOutput: '', tags: [] },
  ])
  const [runningId, setRunningId] = useState<string | null>(null)

  useEffect(() => {
    loadSuites()
  }, [workflowId])

  const loadSuites = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/evals?workflowId=${workflowId}`)
      if (response.ok) {
        const data = await response.json()
        setSuites(data.suites || [])
      }
    } catch (error) {
      // handle silently
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSuite = async () => {
    if (!newSuiteName.trim()) return
    try {
      const validTestCases = newTestCases.filter((tc) => tc.input.trim())
      const response = await fetch('/api/evals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          name: newSuiteName,
          testCases: validTestCases,
        }),
      })
      if (response.ok) {
        setShowCreateDialog(false)
        setNewSuiteName('')
        setNewTestCases([{ input: '', expectedOutput: '', tags: [] }])
        loadSuites()
      }
    } catch (error) {
      // handle silently
    }
  }

  const handleRunSuite = async (suiteId: string) => {
    setRunningId(suiteId)
    try {
      const response = await fetch('/api/evals/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiteId }),
      })
      if (response.ok) {
        loadSuites()
      }
    } catch (error) {
      // handle silently
    } finally {
      setRunningId(null)
    }
  }

  const handleDeleteSuite = async (suiteId: string) => {
    try {
      await fetch(`/api/evals?id=${suiteId}`, { method: 'DELETE' })
      setSuites((prev) => prev.filter((s) => s.id !== suiteId))
    } catch (error) {
      // handle silently
    }
  }

  const addTestCase = () => {
    setNewTestCases((prev) => [...prev, { input: '', expectedOutput: '', tags: [] }])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400 dark:text-white/40" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/[0.06] px-3 py-2 dark:border-white/[0.08]">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-orange-500" />
          <span className="text-xs font-medium font-logo text-zinc-800 dark:text-white/70">
            AI Evaluations
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          className="silver-glass-button h-8 rounded-xl text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          New Suite
        </Button>
      </div>

      {/* Suite List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {suites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <FlaskConical className="h-8 w-8 text-zinc-400 dark:text-white/40 mb-3" />
            <p className="text-sm text-zinc-500 dark:text-white/40">No eval suites yet</p>
            <p className="text-xs text-zinc-400 dark:text-white/40 mt-1">
              Create test suites to evaluate your AI workflow's quality
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateDialog(true)}
              className="mt-3"
            >
              Create Suite
            </Button>
          </div>
        ) : (
          suites.map((suite) => (
            <div
              key={suite.id}
              className="silver-glass-pane rounded-2xl border border-black/[0.06] p-3 transition-colors hover:bg-black/[0.04] dark:border-white/[0.08] dark:hover:bg-white/[0.06]"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-zinc-800 dark:text-white">{suite.name}</h4>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRunSuite(suite.id)}
                    disabled={runningId === suite.id}
                  >
                    {runningId === suite.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3 text-emerald-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleDeleteSuite(suite.id)}
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-white/40">
                <span>{suite.testCaseCount} tests</span>
                {suite.latestRun && (
                  <>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        suite.latestRun.status === 'completed'
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {suite.latestRun.status}
                    </Badge>
                    {suite.latestRun.summary?.avgAccuracy !== undefined && (
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {(suite.latestRun.summary.avgAccuracy * 100).toFixed(0)}%
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Suite Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Eval Suite</DialogTitle>
            <DialogDescription>
              Define test cases with expected inputs and outputs to evaluate your workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
            <div>
              <label className="text-sm font-medium">Suite Name</label>
              <Input
                value={newSuiteName}
                onChange={(e) => setNewSuiteName(e.target.value)}
                placeholder="e.g., Customer Support Quality"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Test Cases</label>
              {newTestCases.map((tc, index) => (
                <div
                  key={index}
                  className="mt-2 space-y-2 rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3"
                >
                  <Input
                    value={tc.input}
                    onChange={(e) => {
                      const updated = [...newTestCases]
                      updated[index] = { ...updated[index], input: e.target.value }
                      setNewTestCases(updated)
                    }}
                    placeholder="Input (what to send to workflow)"
                    className="text-sm"
                  />
                  <Input
                    value={tc.expectedOutput}
                    onChange={(e) => {
                      const updated = [...newTestCases]
                      updated[index] = { ...updated[index], expectedOutput: e.target.value }
                      setNewTestCases(updated)
                    }}
                    placeholder="Expected output (what the result should contain)"
                    className="text-sm"
                  />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addTestCase} className="mt-2 w-full">
                <Plus className="h-3 w-3 mr-1" />
                Add Test Case
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSuite} disabled={!newSuiteName.trim()}>
              Create Suite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
