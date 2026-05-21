'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createLogger } from '@/lib/logs/console-logger'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'

const logger = createLogger('useRealtimeCollaboration')

// Track sub-block keys currently being set by remote changes to prevent echo loops.
// When a remote change sets a sub-block value, the Zustand subscription in workflow.tsx
// would otherwise re-broadcast that same change back out.
const _remoteSubBlockKeys = new Set<string>()
export function markRemoteSubBlockChange(blockId: string, subBlockId: string): void {
  _remoteSubBlockKeys.add(`${blockId}:${subBlockId}`)
}
export function consumeRemoteSubBlockChange(blockId: string, subBlockId: string): boolean {
  const key = `${blockId}:${subBlockId}`
  return _remoteSubBlockKeys.delete(key)
}

// --- Types ---

export interface CollabUser {
  userId: string
  name: string
  color: string
  cursor?: { x: number; y: number }
  selectedNodes?: string[]
  lastActive: number
}

export interface UseRealtimeCollaborationReturn {
  collaborators: CollabUser[]
  isConnected: boolean
  syncNodePosition: (nodeId: string, position: { x: number; y: number }) => void
  syncNodeDrag: (nodeId: string, position: { x: number; y: number }) => void
  syncNodeAdd: (node: any) => void
  syncNodeRemove: (nodeId: string) => void
  syncEdgeAdd: (edge: any) => void
  syncEdgeRemove: (edgeId: string) => void
  syncNodeDataChange: (nodeId: string, key: string, value: any) => void
  syncBlockConfig: (nodeId: string, key: string, value: any) => void
  syncCursor: (position: { x: number; y: number }) => void
  syncSelection: (nodeIds: string[]) => void
}

// Deterministic color from userId
function userColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`
}

/**
 * Real-time collaboration hook using SSE + POST (no extra server needed).
 * Works in both development and production.
 */
export function useRealtimeCollaboration(
  workflowId: string | null,
  userId: string,
  userName: string
): UseRealtimeCollaborationReturn {
  void userName
  const [collaborators, setCollaborators] = useState<CollabUser[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingPositionRef = useRef<{ nodeId: string; position: { x: number; y: number } } | null>(
    null
  )
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Store methods for applying remote changes
  const updateBlockPosition = useWorkflowStore((s) => s.updateBlockPosition)
  const removeBlock = useWorkflowStore((s) => s.removeBlock)
  const addBlock = useWorkflowStore((s) => s.addBlock)
  const addEdge = useWorkflowStore((s) => s.addEdge)
  const removeEdge = useWorkflowStore((s) => s.removeEdge)
  const updateBlock = useWorkflowStore((s) => s.updateBlock)

  // POST helper - fire and forget, no await blocking
  const postCollab = useCallback(
    (action: string, payload: Record<string, any>) => {
      if (!workflowId) return
      fetch(`/api/collaboration/${workflowId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      }).catch(() => {}) // Silent fail for real-time events
    },
    [workflowId]
  )

  // --- Outgoing sync methods ---

  const syncNodePosition = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      postCollab('node_move', { nodeId, payload: { position } })
    },
    [postCollab]
  )

  // Throttled at 1 frame (16ms) using RAF
  const syncNodeDrag = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      pendingPositionRef.current = { nodeId, position }
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        const pending = pendingPositionRef.current
        if (pending) {
          postCollab('node_move', {
            nodeId: pending.nodeId,
            payload: { position: pending.position },
          })
          pendingPositionRef.current = null
        }
        rafRef.current = null
      })
    },
    [postCollab]
  )

  const syncNodeAdd = useCallback(
    (node: any) => {
      postCollab('node_add', { nodeId: node.id, payload: { node } })
    },
    [postCollab]
  )

  const syncNodeRemove = useCallback(
    (nodeId: string) => {
      postCollab('node_remove', { nodeId, payload: {} })
    },
    [postCollab]
  )

  const syncEdgeAdd = useCallback(
    (edge: any) => {
      postCollab('edge_add', { edgeId: edge.id, payload: { edge } })
    },
    [postCollab]
  )

  const syncEdgeRemove = useCallback(
    (edgeId: string) => {
      postCollab('edge_remove', { edgeId, payload: {} })
    },
    [postCollab]
  )

  // Debounced at 100ms per node+key combo
  const syncNodeDataChange = useCallback(
    (nodeId: string, key: string, value: any) => {
      const timerKey = `${nodeId}:${key}`
      const existing = debounceTimersRef.current.get(timerKey)
      if (existing) clearTimeout(existing)
      debounceTimersRef.current.set(
        timerKey,
        setTimeout(() => {
          postCollab('node_data', { nodeId, payload: { key, value } })
          debounceTimersRef.current.delete(timerKey)
        }, 100)
      )
    },
    [postCollab]
  )

  // Sync block-level config changes (name, enabled, isMinimized, isWide, etc.)
  const syncBlockConfig = useCallback(
    (nodeId: string, key: string, value: any) => {
      postCollab('block_config', { nodeId, payload: { key, value } })
    },
    [postCollab]
  )

  // Throttled at 50ms
  const lastCursorRef = useRef(0)
  const syncCursor = useCallback(
    (position: { x: number; y: number }) => {
      const now = Date.now()
      if (now - lastCursorRef.current < 50) return
      lastCursorRef.current = now
      postCollab('cursor', { blockId: '', field: '', position })
    },
    [postCollab]
  )

  const syncSelection = useCallback(
    (nodeIds: string[]) => {
      postCollab('cursor', { blockId: nodeIds[0] || '', selectedNodes: nodeIds })
    },
    [postCollab]
  )

  // --- SSE connection for incoming changes ---

  useEffect(() => {
    if (!workflowId || !userId) return

    let reconnectAttempts = 0
    let reconnectTimer: NodeJS.Timeout | null = null

    const connect = () => {
      const es = new EventSource(`/api/collaboration/${workflowId}`)
      eventSourceRef.current = es

      es.onopen = () => {
        setIsConnected(true)
        reconnectAttempts = 0
      }

      es.addEventListener('init', (e) => {
        try {
          const data = JSON.parse(e.data)
          const raw = data.collaborators || {}
          const entries = Array.isArray(raw)
            ? raw.map((u: any) => ({
                userId: u.id || u.userId,
                name: u.name || u.userName || 'User',
              }))
            : Object.entries(raw).map(([id, info]: [string, any]) => ({
                userId: id,
                name: info?.name || 'User',
              }))
          const users = entries
            .map((u) => ({
              ...u,
              color: userColor(u.userId),
              lastActive: Date.now(),
            }))
            .filter((u) => u.userId !== userId)
          setCollaborators(users)
        } catch {}
      })

      es.addEventListener('presence', (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.userId === userId) return
          setCollaborators((prev) => {
            const exists = prev.find((c) => c.userId === data.userId)
            if (exists) return prev
            return [
              ...prev,
              {
                userId: data.userId,
                name: data.userName || 'User',
                color: userColor(data.userId),
                lastActive: Date.now(),
              },
            ]
          })
        } catch {}
      })

      es.addEventListener('leave', (e) => {
        try {
          const data = JSON.parse(e.data)
          setCollaborators((prev) => prev.filter((c) => c.userId !== data.userId))
        } catch {}
      })

      es.addEventListener('cursor', (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.userId === userId) return
          setCollaborators((prev) =>
            prev.map((c) =>
              c.userId === data.userId
                ? {
                    ...c,
                    cursor: data.position,
                    selectedNodes: data.selectedNodes,
                    lastActive: Date.now(),
                  }
                : c
            )
          )
        } catch {}
      })

      // Handle block/edge changes from other users - apply IMMEDIATELY to store
      es.addEventListener('change', (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.userId === userId) return
          const action = data.changes?.action
          const payload = data.changes || {}

          switch (action) {
            case 'node_move':
              if (payload.position && data.blockId) {
                updateBlockPosition(data.blockId, payload.position)
              }
              break
            case 'node_remove':
              if (data.blockId) {
                removeBlock(data.blockId)
              }
              break
            case 'edge_add':
              if (payload.edge) {
                addEdge(payload.edge)
              }
              break
            case 'edge_remove':
              if (data.blockId) {
                removeEdge(data.blockId)
              }
              break
            case 'node_data':
              if (data.blockId && payload.key !== undefined) {
                logger.debug('Applying remote node_data', {
                  blockId: data.blockId,
                  key: payload.key,
                  value:
                    typeof payload.value === 'string' && payload.value.length > 30
                      ? payload.value.substring(0, 30) + '...'
                      : payload.value,
                })
                // Mark BEFORE setValue so the synchronous Zustand subscriber
                // in workflow.tsx can consume the flag and skip re-broadcasting.
                markRemoteSubBlockChange(data.blockId, payload.key)
                try {
                  const storeBefore = useSubBlockStore.getState()
                  useSubBlockStore
                    .getState()
                    .setValue(data.blockId, payload.key, payload.value, { remote: true })
                  // If setValue was a no-op (value unchanged, equality check),
                  // the Zustand subscriber never fires and the remote marker
                  // leaks in _remoteSubBlockKeys.  The NEXT local edit on
                  // this field would be silently swallowed.  Clean it up.
                  if (useSubBlockStore.getState() === storeBefore) {
                    consumeRemoteSubBlockChange(data.blockId, payload.key)
                  }
                } catch (err) {
                  // If setValue fails (e.g. no activeWorkflowId), clean up the
                  // remote-change marker so it doesn't leak and suppress the
                  // user's next local edit on this field.
                  consumeRemoteSubBlockChange(data.blockId, payload.key)
                  logger.error('Failed to apply remote node_data', {
                    err,
                    blockId: data.blockId,
                    key: payload.key,
                  })
                }
              }
              break
            case 'block_config':
              if (data.blockId && payload.key !== undefined) {
                updateBlock(data.blockId, { [payload.key]: payload.value })
              }
              break
            case 'node_add':
              if (payload.node) {
                const n = payload.node
                addBlock(n.id, n.type, n.data?.name || n.name || n.type, n.position)
              }
              break
            default:
              break
          }
          logger.debug('Remote change applied', { action, from: data.userName })
        } catch (err) {
          logger.error('Failed to process remote change event', { err })
        }
      })

      es.onerror = () => {
        setIsConnected(false)
        es.close()
        if (reconnectAttempts < 10) {
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000)
          reconnectAttempts++
          reconnectTimer = setTimeout(connect, delay)
        } else {
          reconnectTimer = setTimeout(() => {
            reconnectAttempts = 0
            connect()
          }, 30000)
        }
      }
    }

    connect()

    const debounceTimers = debounceTimersRef.current

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      eventSourceRef.current?.close()
      setIsConnected(false)
      setCollaborators([])
      // Cleanup RAF and debounce timers
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      debounceTimers.forEach((t) => clearTimeout(t))
      debounceTimers.clear()
    }
  }, [
    workflowId,
    userId,
    updateBlockPosition,
    removeBlock,
    addBlock,
    addEdge,
    removeEdge,
    updateBlock,
  ])

  return {
    collaborators,
    isConnected,
    syncNodePosition,
    syncNodeDrag,
    syncNodeAdd,
    syncNodeRemove,
    syncEdgeAdd,
    syncEdgeRemove,
    syncNodeDataChange,
    syncBlockConfig,
    syncCursor,
    syncSelection,
  }
}
