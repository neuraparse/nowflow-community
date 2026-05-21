'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCollaboration } from '@/hooks/use-collaboration'
import type { CollabUser } from '@/hooks/use-realtime-collaboration'

const MAX_VISIBLE = 4
const RING_COLORS = [
  'ring-blue-500',
  'ring-emerald-500',
  'ring-amber-500',
  'ring-purple-500',
  'ring-pink-500',
]
const tooltipClass = 'bg-[#1b1b1b] text-white border-none text-[11px] font-logo'

/** Map a CollabUser hex color to a Tailwind ring class. Falls back to the positional palette. */
function ringClassFromColor(hex: string, index: number): string {
  const map: Record<string, string> = {
    '#3b82f6': 'ring-blue-500',
    '#10b981': 'ring-emerald-500',
    '#f59e0b': 'ring-amber-500',
    '#8b5cf6': 'ring-purple-500',
    '#ec4899': 'ring-pink-500',
    '#ef4444': 'ring-red-500',
    '#06b6d4': 'ring-cyan-500',
    '#f97316': 'ring-orange-500',
  }
  return map[hex.toLowerCase()] ?? RING_COLORS[index % RING_COLORS.length]
}

interface CollaborationPresenceProps {
  workflowId: string
  collaborators?: CollabUser[]
  isConnected?: boolean
  /** Map of userId -> selected node labels, provided by the parent when using the realtime hook */
  selectedNodes?: Map<string, string[]>
}

export function CollaborationPresence({
  workflowId,
  collaborators: externalCollaborators,
  isConnected: externalIsConnected,
  selectedNodes: externalSelectedNodes,
}: CollaborationPresenceProps) {
  // Use the old hook as a fallback when no external collaborators are provided
  const legacy = useCollaboration(externalCollaborators ? null : workflowId || null)

  const useRealtime = !!externalCollaborators
  const connected = useRealtime ? (externalIsConnected ?? false) : legacy.isConnected

  // Normalise both sources into a common shape
  const collaboratorList = useMemo(() => {
    if (useRealtime && externalCollaborators) {
      return externalCollaborators.map((u) => ({
        userId: u.userId,
        name: u.name,
        avatar: undefined as string | undefined,
        color: u.color,
      }))
    }
    return Array.from(legacy.collaborators.values()).map((u) => ({
      userId: u.userId,
      name: u.name,
      avatar: u.avatar,
      color: undefined as string | undefined,
    }))
  }, [useRealtime, externalCollaborators, legacy.collaborators])

  const lockingUserIds = useMemo(() => {
    if (useRealtime) {
      // In realtime mode, a user is "editing" if they have selected nodes
      const ids = new Set<string>()
      if (externalSelectedNodes) {
        for (const [uid, nodes] of externalSelectedNodes) {
          if (nodes.length > 0) ids.add(uid)
        }
      }
      return ids
    }
    const ids = new Set<string>()
    for (const lock of legacy.lockedBlocks.values()) ids.add(lock.userId)
    return ids
  }, [useRealtime, externalSelectedNodes, legacy.lockedBlocks])

  if (collaboratorList.length === 0) return null

  const visible = collaboratorList.slice(0, MAX_VISIBLE)
  const overflow = collaboratorList.length - MAX_VISIBLE

  return (
    <div
      className="flex min-h-8 items-center gap-1"
      aria-label={`${collaboratorList.length} active collaborator${collaboratorList.length === 1 ? '' : 's'}`}
    >
      {/* Connection status indicator */}
      {useRealtime ? (
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
            connected
              ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/40'
              : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40'
          }`}
          aria-label={connected ? 'Collaboration live' : 'Collaboration offline'}
        >
          {connected ? 'Live' : 'Offline'}
        </span>
      ) : (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
          title={connected ? 'Connected' : 'Disconnected'}
          aria-label={connected ? 'Collaboration connected' : 'Collaboration disconnected'}
        />
      )}

      {/* Avatar stack */}
      <div className="flex -space-x-2">
        {visible.map((user, i) => {
          const hasLock = lockingUserIds.has(user.userId)
          const initials = user.name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
          const ringColor = hasLock
            ? 'ring-amber-400'
            : user.color
              ? ringClassFromColor(user.color, i)
              : RING_COLORS[i % RING_COLORS.length]

          // Build tooltip label
          const userSelectedNodes = externalSelectedNodes?.get(user.userId)
          let tooltipLabel = user.name
          if (hasLock && userSelectedNodes && userSelectedNodes.length > 0) {
            tooltipLabel += ` — editing ${userSelectedNodes.join(', ')}`
          } else if (hasLock) {
            tooltipLabel += ' (editing)'
          }

          return (
            <Tooltip key={user.userId}>
              <TooltipTrigger asChild>
                <div
                  className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2 ${ringColor} bg-muted text-[10px] font-medium text-muted-foreground cursor-default transition-transform hover:z-10 hover:scale-110 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-1`}
                  style={user.color ? { borderColor: user.color } : undefined}
                  role="img"
                  aria-label={tooltipLabel}
                >
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.name}
                      width={28}
                      height={28}
                      unoptimized
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className={tooltipClass}>
                {tooltipLabel}
              </TooltipContent>
            </Tooltip>
          )
        })}

        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-muted-foreground/30 cursor-default"
                role="img"
                aria-label={`${overflow} more collaborator${overflow > 1 ? 's' : ''}`}
              >
                +{overflow}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className={tooltipClass}>
              {overflow} more collaborator{overflow > 1 ? 's' : ''}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
