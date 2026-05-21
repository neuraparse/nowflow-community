'use client'

import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath } from '@xyflow/react'
import { ArrowRightIcon, CheckIcon, XIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDuration } from '@/lib/utils'
import { useExecutionStore } from '@/stores/execution/store'

export const ExecutionEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) => {
  const isHorizontal = sourcePosition === 'right' || sourcePosition === 'left'

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
    offset: isHorizontal ? 30 : 20,
  })

  const { activeConnections } = useExecutionStore()

  // Find connection state for this edge
  const connection = activeConnections.find(
    (conn) => conn.source === data?.source && conn.target === data?.target
  )

  // Default edge style - always visible
  let strokeColor = '#94a3b8' // Medium gray - always visible
  let strokeWidth = 1.5 // Thinner default
  let strokeOpacity = 1 // Always fully visible
  let strokeDasharray = 'none'
  let animate = false

  // Apply styles based on connection state with enhanced visibility
  if (connection) {
    if (connection.active) {
      strokeColor = '#3b82f6' // Blue for active
      strokeWidth = 3
      strokeOpacity = 1 // Full opacity for active
      animate = true
    } else if (connection.completed) {
      strokeColor = '#22c55e' // Green for completed
      strokeWidth = 2.5
      strokeOpacity = 1 // Full opacity for completed
    } else if (connection.error) {
      strokeColor = '#ef4444' // Red for error
      strokeWidth = 2.5
      strokeOpacity = 1 // Full opacity for error
      strokeDasharray = '5,3'
    }
  }

  return (
    <>
      <BaseEdge
        path={edgePath}
        data-testid="workflow-edge"
        style={{
          strokeWidth,
          stroke: strokeColor,
          strokeOpacity,
          strokeDasharray,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // Smooth easing
        }}
        interactionWidth={20}
      />

      {/* Status indicators */}
      {connection && (connection.completed || connection.error) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 1000,
            }}
          >
            {connection.completed && !connection.error && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white animate-completed-block">
                    <CheckIcon className="h-3 w-3" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="text-xs">
                    <p className="font-semibold">Data transferred successfully</p>
                    {connection.data?.transferTime && (
                      <p className="text-zinc-400 dark:text-white/40">
                        Duration: {formatDuration(connection.data.transferTime)}
                      </p>
                    )}
                    {connection.data?.type && (
                      <p className="text-zinc-400 dark:text-white/40">
                        Type: {connection.data.type}
                      </p>
                    )}
                    {connection.data?.size && (
                      <p className="text-zinc-400 dark:text-white/40">
                        Size: {formatBytes(connection.data.size)}
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}

            {connection.error && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white animate-error-block">
                    <XIcon className="h-3 w-3" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="text-xs">
                    <p className="font-semibold">Data transfer failed</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Active flow indicator */}
      {connection && connection.active && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 1000,
            }}
          >
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white animate-pulse">
              <ArrowRightIcon className="h-3 w-3" />
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

// Helper function to format bytes to human-readable format
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
