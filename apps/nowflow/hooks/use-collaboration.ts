'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('useCollaboration')

export interface CollaboratorInfo {
  userId: string
  name: string
  avatar?: string
  cursor?: { blockId: string; field?: string }
  joinedAt: number
}

export interface BlockLockInfo {
  blockId: string
  userId: string
  userName: string
  lockedAt: number
}

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 3000

export function useCollaboration(workflowId: string | null) {
  const [collaborators, setCollaborators] = useState<Map<string, CollaboratorInfo>>(new Map())
  const [lockedBlocks, setLockedBlocks] = useState<Map<string, BlockLockInfo>>(new Map())
  const [isConnected, setIsConnected] = useState(false)

  const sseRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)

  const postAction = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      if (!workflowId) return
      try {
        await fetch(`/api/collaboration/${workflowId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...payload }),
        })
      } catch (err) {
        logger.error('Failed to post collaboration action', { action, err })
      }
    },
    [workflowId]
  )

  const sendCursorPosition = useCallback(
    (blockId: string, field?: string) => {
      void postAction('cursor', { blockId, field })
    },
    [postAction]
  )

  const lockBlock = useCallback(
    async (blockId: string): Promise<boolean> => {
      if (!workflowId) return false
      try {
        const res = await fetch(`/api/collaboration/${workflowId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'lock', blockId }),
        })
        const data = await res.json()
        return data.locked === true
      } catch {
        return false
      }
    },
    [workflowId]
  )

  const unlockBlock = useCallback(
    (blockId: string) => {
      void postAction('unlock', { blockId })
    },
    [postAction]
  )

  useEffect(() => {
    if (!workflowId) {
      const resetTimer = setTimeout(() => {
        setIsConnected(false)
        setCollaborators(new Map())
        setLockedBlocks(new Map())
      }, 0)
      return () => clearTimeout(resetTimer)
    }

    if (sseRef.current) return

    const connect = () => {
      try {
        const es = new EventSource(`/api/collaboration/${workflowId}`)
        sseRef.current = es

        es.addEventListener('open', () => {
          setIsConnected(true)
          reconnectAttempts.current = 0
          logger.info('Collaboration stream connected', { workflowId })
        })

        es.addEventListener('error', () => {
          setIsConnected(false)

          if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts.current++
            const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current - 1)
            logger.info(`Reconnecting collaboration in ${delay}ms`, {
              attempt: reconnectAttempts.current,
            })
            reconnectTimeoutRef.current = setTimeout(() => {
              if (sseRef.current) {
                sseRef.current.close()
                sseRef.current = null
              }
              connect()
            }, delay)
          } else {
            logger.error('Max reconnection attempts reached for collaboration')
          }
        })

        // Initial state with full collaborator list
        es.addEventListener('init', (e: MessageEvent) => {
          try {
            const { collaborators: collabs } = JSON.parse(e.data) as {
              collaborators: CollaboratorInfo[]
            }
            const map = new Map<string, CollaboratorInfo>()
            for (const c of collabs) map.set(c.userId, c)
            setCollaborators(map)
          } catch (err) {
            logger.error('Failed to parse init event', { err })
          }
        })

        es.addEventListener('presence', (e: MessageEvent) => {
          try {
            const user = JSON.parse(e.data) as CollaboratorInfo
            setCollaborators((prev) => new Map(prev).set(user.userId, user))
          } catch {
            /* ignore */
          }
        })

        es.addEventListener('leave', (e: MessageEvent) => {
          try {
            const { userId } = JSON.parse(e.data) as { userId: string }
            setCollaborators((prev) => {
              const next = new Map(prev)
              next.delete(userId)
              return next
            })
          } catch {
            /* ignore */
          }
        })

        es.addEventListener('cursor', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as {
              userId: string
              name: string
              blockId: string
              field?: string
            }
            setCollaborators((prev) => {
              const existing = prev.get(data.userId)
              if (!existing) return prev
              const next = new Map(prev)
              next.set(data.userId, {
                ...existing,
                cursor: { blockId: data.blockId, field: data.field },
              })
              return next
            })
          } catch {
            /* ignore */
          }
        })

        es.addEventListener('lock', (e: MessageEvent) => {
          try {
            const lock = JSON.parse(e.data) as BlockLockInfo
            setLockedBlocks((prev) => new Map(prev).set(lock.blockId, lock))
          } catch {
            /* ignore */
          }
        })

        es.addEventListener('unlock', (e: MessageEvent) => {
          try {
            const { blockId } = JSON.parse(e.data) as { blockId: string }
            setLockedBlocks((prev) => {
              const next = new Map(prev)
              next.delete(blockId)
              return next
            })
          } catch {
            /* ignore */
          }
        })

        es.addEventListener('conflict', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as { blockId: string; userId: string }
            // Release the lock on conflict resolution
            setLockedBlocks((prev) => {
              const next = new Map(prev)
              next.delete(data.blockId)
              return next
            })
          } catch {
            /* ignore */
          }
        })
      } catch (err) {
        logger.error('Failed to create collaboration EventSource', { err })
        setIsConnected(false)
      }
    }

    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      setIsConnected(false)
    }
  }, [workflowId])

  return {
    collaborators,
    lockedBlocks,
    sendCursorPosition,
    lockBlock,
    unlockBlock,
    isConnected,
  }
}
