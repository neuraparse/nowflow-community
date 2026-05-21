'use client'

import { useEffect, useState } from 'react'
import { Edit2, GitCompare, Minus, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface DiffChange {
  type: 'added' | 'removed' | 'modified'
  path: string
  oldValue?: any
  newValue?: any
}

interface VersionDiff {
  fromVersion: number
  toVersion: number
  summary: {
    blocksAdded: number
    blocksRemoved: number
    blocksModified: number
    connectionsAdded: number
    connectionsRemoved: number
  }
  changes: DiffChange[]
}

interface VersionDiffViewerProps {
  workflowId: string
  fromVersionId: string
  toVersionId: string
}

export function VersionDiffViewer({
  workflowId,
  fromVersionId,
  toVersionId,
}: VersionDiffViewerProps) {
  const [diff, setDiff] = useState<VersionDiff | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDiff()
  }, [workflowId, fromVersionId, toVersionId])

  const fetchDiff = async () => {
    try {
      const response = await fetch(
        `/api/workflows/${workflowId}/versions/compare?from=${fromVersionId}&to=${toVersionId}`
      )
      const data = await response.json()
      if (data.success) {
        setDiff(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch diff:', error)
    } finally {
      setLoading(false)
    }
  }

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <Plus className="h-4 w-4 text-green-600" />
      case 'removed':
        return <Minus className="h-4 w-4 text-red-600" />
      case 'modified':
        return <Edit2 className="h-4 w-4 text-blue-600" />
      default:
        return null
    }
  }

  const getChangeBadge = (type: string) => {
    const styles: Record<string, string> = {
      added: 'bg-green-500/10 text-green-600',
      removed: 'bg-red-500/10 text-red-600',
      modified: 'bg-blue-500/10 text-blue-600',
    }
    return styles[type] || 'bg-zinc-500/10 text-zinc-600 dark:text-white/60'
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

  if (!diff) {
    return (
      <Card className="border-black/[0.06] dark:border-white/[0.06]">
        <CardContent className="p-6">
          <p className="text-sm text-zinc-500 dark:text-white/40 text-center">
            Failed to load diff
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-black/[0.06] dark:border-white/[0.06]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <GitCompare className="h-4 w-4" />
          Version Comparison
          <span className="text-zinc-500 dark:text-white/40 font-normal">
            v{diff.fromVersion} → v{diff.toVersion}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/20 text-center">
            <p className="text-lg font-bold text-green-600">{diff.summary.blocksAdded}</p>
            <p className="text-xs text-zinc-500 dark:text-white/40">Blocks Added</p>
          </div>
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-center">
            <p className="text-lg font-bold text-red-600">{diff.summary.blocksRemoved}</p>
            <p className="text-xs text-zinc-500 dark:text-white/40">Blocks Removed</p>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-center">
            <p className="text-lg font-bold text-blue-600">{diff.summary.blocksModified}</p>
            <p className="text-xs text-zinc-500 dark:text-white/40">Blocks Modified</p>
          </div>
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/20 text-center">
            <p className="text-lg font-bold text-green-600">{diff.summary.connectionsAdded}</p>
            <p className="text-xs text-zinc-500 dark:text-white/40">Connections +</p>
          </div>
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-center">
            <p className="text-lg font-bold text-red-600">{diff.summary.connectionsRemoved}</p>
            <p className="text-xs text-zinc-500 dark:text-white/40">Connections -</p>
          </div>
        </div>

        {/* Changes */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {diff.changes.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-white/40 text-center py-4">
                No changes detected
              </p>
            ) : (
              diff.changes.map((change, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    change.type === 'added'
                      ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20'
                      : change.type === 'removed'
                        ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'
                        : 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getChangeIcon(change.type)}
                    <span className="font-medium text-sm">{change.path}</span>
                    <Badge className={getChangeBadge(change.type)}>{change.type}</Badge>
                  </div>

                  {change.type === 'modified' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="p-2 rounded bg-red-100/50 dark:bg-red-900/20">
                        <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">Old Value</p>
                        <pre className="text-xs overflow-auto max-h-20">
                          {JSON.stringify(change.oldValue, null, 2)}
                        </pre>
                      </div>
                      <div className="p-2 rounded bg-green-100/50 dark:bg-green-900/20">
                        <p className="text-xs text-zinc-500 dark:text-white/40 mb-1">New Value</p>
                        <pre className="text-xs overflow-auto max-h-20">
                          {JSON.stringify(change.newValue, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {change.type === 'added' && change.newValue && (
                    <div className="mt-2 p-2 rounded bg-green-100/50 dark:bg-green-900/20">
                      <pre className="text-xs overflow-auto max-h-20">
                        {JSON.stringify(change.newValue, null, 2)}
                      </pre>
                    </div>
                  )}

                  {change.type === 'removed' && change.oldValue && (
                    <div className="mt-2 p-2 rounded bg-red-100/50 dark:bg-red-900/20">
                      <pre className="text-xs overflow-auto max-h-20">
                        {JSON.stringify(change.oldValue, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
