'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/stores/notifications/store'

export function AuthNotificationList() {
  const { notifications, hideNotification } = useNotificationStore()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const visibleNotifications = isMounted
    ? notifications.filter(
        (notification) =>
          notification.isVisible &&
          !notification.read &&
          (notification.options?.context ?? 'workflow') === 'auth'
      )
    : []

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-5 z-[70] w-full max-w-md -translate-x-1/2 px-4"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="space-y-2">
        {visibleNotifications.slice(0, 3).map((notification) => (
          <div
            key={notification.id}
            className={cn(
              'pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_16px_34px_rgba(24,24,27,0.08)]',
              'silver-glass-pane dark:shadow-[0_18px_40px_rgba(0,0,0,0.22)]',
              notification.type === 'error'
                ? 'border-red-200/70 bg-red-50/80 text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-200'
                : 'border-white/60 text-zinc-700 dark:border-white/[0.1] dark:text-white/80'
            )}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-body text-[13px] font-medium leading-relaxed">
                  {notification.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => hideNotification(notification.id)}
                className="rounded-md p-1 text-current/50 transition hover:text-current"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
