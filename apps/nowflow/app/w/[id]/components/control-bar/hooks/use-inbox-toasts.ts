'use client'

import { useEffect, useRef } from 'react'
import { useNotificationStore } from '@/stores/notifications/store'
import type { UserInboxNotification } from '@/hooks/use-user-notifications'

/**
 * Surfaces new inbox notifications as toast notifications.
 */
export function useInboxToasts(
  userId: string | undefined,
  inboxLoading: boolean,
  inboxNotifications: UserInboxNotification[],
  setNotificationsOpen: (open: boolean) => void
) {
  const { addNotification } = useNotificationStore()
  const inboxInitializedRef = useRef(false)
  const inboxSeenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) return
    if (inboxLoading) return

    if (!inboxInitializedRef.current) {
      inboxInitializedRef.current = true
      inboxSeenRef.current = new Set(inboxNotifications.map((n) => n.recipientId))
      return
    }

    const nextSeen = inboxSeenRef.current
    const newOnes = inboxNotifications.filter((n) => !nextSeen.has(n.recipientId))
    if (newOnes.length === 0) return

    for (const n of newOnes) {
      nextSeen.add(n.recipientId)
      const trimmedMessage =
        n.message.length > 180 ? `${n.message.slice(0, 180).trimEnd()}…` : n.message
      addNotification(
        n.type === 'error' ? 'error' : 'info',
        `${n.title}: ${trimmedMessage}`,
        null,
        {
          actions: [
            {
              label: 'Open Inbox',
              onClick: () => {
                setNotificationsOpen(true)
              },
            },
          ],
        }
      )
    }
  }, [addNotification, inboxLoading, inboxNotifications, userId])
}
