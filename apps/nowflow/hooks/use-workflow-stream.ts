import { useEffect, useRef, useState } from 'react'
import { createLogger } from '@/lib/logs/console-logger'
import { workflowSync } from '@/stores/workflows/sync'

const logger = createLogger('WorkflowStream')

type WorkflowUpdate = {
  workflowId: string
  lastUpdate: number
  workspaceId: string
}

type WorkflowStreamData = {
  updates: WorkflowUpdate[]
  timestamp: number
}

type UseWorkflowStreamOptions = {
  enabled?: boolean
  onUpdate?: (data: WorkflowStreamData) => void
}

export function useWorkflowStream(options: UseWorkflowStreamOptions = {}) {
  const { enabled = true, onUpdate } = options
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<number>(0)
  const sseRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const onUpdateRef = useRef(onUpdate)

  const MAX_RECONNECT_ATTEMPTS = 5
  const RECONNECT_DELAY = 3000

  // Keep onUpdate ref up to date without triggering reconnection
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    if (!enabled) {
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      const resetTimer = setTimeout(() => setIsConnected(false), 0)
      return () => clearTimeout(resetTimer)
    }

    // Avoid duplicate connections
    if (sseRef.current) return

    const connect = () => {
      try {
        logger.info('🔌 Connecting to workflow stream...')
        const es = new EventSource('/api/workflows/stream')
        sseRef.current = es

        const handleOpen = () => {
          logger.info('✅ Workflow stream connected')
          setIsConnected(true)
          reconnectAttempts.current = 0
          // Notify sync system that SSE is connected (enables backup polling mode)
          workflowSync.setSSEConnected(true)
        }

        const handleError = () => {
          logger.warn('❌ Workflow stream error')
          setIsConnected(false)
          // Notify sync system that SSE is disconnected (enables primary polling mode)
          workflowSync.setSSEConnected(false)

          // Attempt reconnection with exponential backoff
          if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts.current++
            const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current - 1)
            logger.info(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`)

            reconnectTimeoutRef.current = setTimeout(() => {
              if (sseRef.current) {
                sseRef.current.close()
                sseRef.current = null
              }
              connect()
            }, delay)
          } else {
            logger.error('❌ Max reconnection attempts reached')
          }
        }

        const handleWorkflowUpdate = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data) as WorkflowStreamData
            logger.info('📥 SSE HOOK: Workflow update received', {
              count: data.updates.length,
              timestamp: data.timestamp,
              hasCallback: !!onUpdateRef.current,
            })
            setLastUpdate(data.timestamp)
            onUpdateRef.current?.(data)
          } catch (error) {
            logger.error('Failed to parse workflow update', error)
          }
        }

        const handlePing = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data)
            logger.debug('🏓 Ping received', data.t)
          } catch {
            // ignore
          }
        }

        es.addEventListener('open', handleOpen)
        es.addEventListener('error', handleError)
        es.addEventListener('workflow-update', handleWorkflowUpdate as any)
        es.addEventListener('ping', handlePing as any)
      } catch (error) {
        logger.error('Failed to create EventSource', error)
        setIsConnected(false)
      }
    }

    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (sseRef.current) {
        logger.info('🔌 Closing workflow stream')
        sseRef.current.close()
        sseRef.current = null
      }
      setIsConnected(false)
      // Notify sync system that SSE is disconnected
      workflowSync.setSSEConnected(false)
    }
  }, [enabled])

  return {
    isConnected,
    lastUpdate,
  }
}
