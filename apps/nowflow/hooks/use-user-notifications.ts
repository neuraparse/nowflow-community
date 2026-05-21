'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type UserInboxNotification = {
  recipientId: string
  notificationId: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  actionUrl: string | null
  createdAt: string
  isRead: boolean
  readAt: string | null
}

type ApiResponse = {
  notifications: UserInboxNotification[]
  unreadCount: number
}

export function useUserNotifications(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options
  const [notifications, setNotifications] = useState<UserInboxNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)

  const inFlight = useRef<Promise<void> | null>(null)
  const sseRef = useRef<EventSource | null>(null)

  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current

    const run = (async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/notifications', { method: 'GET' })
        if (!response.ok) {
          throw new Error(`Failed to load notifications (${response.status})`)
        }
        const data = (await response.json()) as ApiResponse
        setNotifications(data.notifications || [])
        setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0)
      } catch (e: any) {
        setError(e?.message || 'Failed to load notifications')
      } finally {
        setIsLoading(false)
        inFlight.current = null
      }
    })()

    inFlight.current = run
    return run
  }, [])

  const markRead = useCallback(
    async (recipientId: string) => {
      const nowIso = new Date().toISOString()
      setNotifications((current) => {
        const next = current.map((n) =>
          n.recipientId === recipientId ? { ...n, isRead: true, readAt: n.readAt || nowIso } : n
        )
        setUnreadCount(next.reduce((acc, n) => (n.isRead ? acc : acc + 1), 0))
        return next
      })

      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId }),
      })

      if (!response.ok) {
        await refresh()
        throw new Error(`Failed to mark notification as read (${response.status})`)
      }
    },
    [refresh]
  )

  const markAllRead = useCallback(async () => {
    const nowIso = new Date().toISOString()
    setNotifications((current) => {
      const next = current.map((n) => ({ ...n, isRead: true, readAt: n.readAt || nowIso }))
      setUnreadCount(0)
      return next
    })

    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })

    if (!response.ok) {
      await refresh()
      throw new Error(`Failed to mark all notifications as read (${response.status})`)
    }
  }, [refresh])

  const hasNotifications = notifications.length > 0

  const unreadNotifications = useMemo(() => notifications.filter((n) => !n.isRead), [notifications])

  useEffect(() => {
    if (!enabled) return
    refresh()

    const interval = setInterval(() => {
      refresh()
    }, 60_000)

    return () => clearInterval(interval)
  }, [enabled, refresh])

  useEffect(() => {
    if (!enabled) {
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      setIsRealtimeConnected(false)
      return
    }

    // Avoid duplicate connections
    if (sseRef.current) return

    try {
      const es = new EventSource('/api/notifications/stream')
      sseRef.current = es

      const handleUpdate = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as ApiResponse
          setUnreadCount(typeof payload.unreadCount === 'number' ? payload.unreadCount : 0)

          const incoming = payload.notifications || []
          if (incoming.length === 0) return

          setNotifications((current) => {
            const byId = new Map(current.map((n) => [n.recipientId, n]))
            const merged: UserInboxNotification[] = []

            for (const n of incoming) {
              const existing = byId.get(n.recipientId)
              merged.push(existing ? { ...existing, ...n } : n)
              byId.delete(n.recipientId)
            }

            for (const leftover of byId.values()) merged.push(leftover)

            return merged
          })
        } catch {
          // ignore
        }
      }

      es.addEventListener('open', () => setIsRealtimeConnected(true))
      es.addEventListener('error', () => setIsRealtimeConnected(false))
      es.addEventListener('update', handleUpdate as any)

      return () => {
        es.close()
        sseRef.current = null
        setIsRealtimeConnected(false)
      }
    } catch {
      setIsRealtimeConnected(false)
      return
    }
  }, [enabled])

  return {
    notifications,
    unreadCount,
    unreadNotifications,
    hasNotifications,
    isLoading,
    error,
    isRealtimeConnected,
    refresh,
    markRead,
    markAllRead,
  }
}
