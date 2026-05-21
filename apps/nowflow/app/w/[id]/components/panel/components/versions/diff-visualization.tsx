import React from 'react'
import { Check, FileCode, Link2, Plus, RefreshCw, X } from 'lucide-react'
import type { DiffData } from './types'

export const DiffVisualization = React.memo(function DiffVisualization({
  diff,
  summary,
}: {
  diff: DiffData['diff']
  summary: string
}) {
  const hasBlockChanges =
    diff.blocks.added.length > 0 ||
    diff.blocks.removed.length > 0 ||
    diff.blocks.modified.length > 0
  const hasEdgeChanges = diff.edges.added.length > 0 || diff.edges.removed.length > 0
  const hasLoopChanges =
    diff.loops.added.length > 0 || diff.loops.removed.length > 0 || diff.loops.modified.length > 0
  const hasChanges = hasBlockChanges || hasEdgeChanges || hasLoopChanges

  if (!hasChanges) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Check className="h-12 w-12 text-green-500 mb-4" />
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-white">No Differences</h3>
        <p className="text-sm text-zinc-500 dark:text-white/50 mt-1">
          These two versions are identical.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-4">
      {/* Summary */}
      <div className="p-4 bg-black/[0.04] dark:bg-white/[0.06] rounded-lg">
        <p className="text-sm font-medium text-zinc-700 dark:text-white/70">{summary}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500 dark:text-white/50">
          <span>
            Blocks: {diff.metadata.fromBlockCount} &rarr; {diff.metadata.toBlockCount}
          </span>
          <span>
            Edges: {diff.metadata.fromEdgeCount} &rarr; {diff.metadata.toEdgeCount}
          </span>
        </div>
      </div>

      {/* Block Changes */}
      {hasBlockChanges && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-700 dark:text-white/70 mb-3 flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Block Changes
          </h4>
          <div className="space-y-2">
            {diff.blocks.added.map((block) => (
              <div
                key={block.id}
                className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800"
              >
                <Plus className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-400">
                  Added <strong>{block.type}</strong>
                  {block.name && (
                    <span className="text-green-600 dark:text-green-500">
                      {' '}
                      &ldquo;{block.name}&rdquo;
                    </span>
                  )}
                </span>
              </div>
            ))}
            {diff.blocks.removed.map((block) => (
              <div
                key={block.id}
                className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800"
              >
                <X className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700 dark:text-red-400">
                  Removed <strong>{block.type}</strong>
                  {block.name && (
                    <span className="text-red-600 dark:text-red-500">
                      {' '}
                      &ldquo;{block.name}&rdquo;
                    </span>
                  )}
                </span>
              </div>
            ))}
            {diff.blocks.modified.map((block) => (
              <div
                key={block.id}
                className="p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded border border-yellow-200 dark:border-yellow-800"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-400">
                    Modified <strong>{block.type}</strong>
                    {block.name && (
                      <span className="text-yellow-600 dark:text-yellow-500">
                        {' '}
                        &ldquo;{block.name}&rdquo;
                      </span>
                    )}
                  </span>
                </div>
                {block.changes.length > 0 && (
                  <div className="mt-2 pl-6 text-xs text-yellow-600 dark:text-yellow-500 space-y-1">
                    {block.changes.slice(0, 3).map((change, idx) => (
                      <div key={idx}>
                        <span className="font-mono">{change.path}</span> changed
                      </div>
                    ))}
                    {block.changes.length > 3 && (
                      <div className="text-yellow-500">
                        +{block.changes.length - 3} more changes
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edge Changes */}
      {hasEdgeChanges && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-700 dark:text-white/70 mb-3 flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Connection Changes
          </h4>
          <div className="space-y-2">
            {diff.edges.added.map((edge) => (
              <div
                key={edge.id}
                className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800"
              >
                <Plus className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-400">
                  Added connection:{' '}
                  <code className="text-xs bg-green-100 dark:bg-green-900 px-1 rounded">
                    {edge.source}
                  </code>
                  {' \u2192 '}
                  <code className="text-xs bg-green-100 dark:bg-green-900 px-1 rounded">
                    {edge.target}
                  </code>
                </span>
              </div>
            ))}
            {diff.edges.removed.map((edge) => (
              <div
                key={edge.id}
                className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800"
              >
                <X className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700 dark:text-red-400">
                  Removed connection:{' '}
                  <code className="text-xs bg-red-100 dark:bg-red-900 px-1 rounded">
                    {edge.source}
                  </code>
                  {' \u2192 '}
                  <code className="text-xs bg-red-100 dark:bg-red-900 px-1 rounded">
                    {edge.target}
                  </code>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loop Changes */}
      {hasLoopChanges && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-700 dark:text-white/70 mb-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Loop Changes
          </h4>
          <div className="space-y-2">
            {diff.loops.added.map((loopId) => (
              <div
                key={loopId}
                className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800"
              >
                <Plus className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-400">Added loop</span>
              </div>
            ))}
            {diff.loops.removed.map((loopId) => (
              <div
                key={loopId}
                className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800"
              >
                <X className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700 dark:text-red-400">Removed loop</span>
              </div>
            ))}
            {diff.loops.modified.map((loopId) => (
              <div
                key={loopId}
                className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded border border-yellow-200 dark:border-yellow-800"
              >
                <RefreshCw className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-700 dark:text-yellow-400">Modified loop</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
