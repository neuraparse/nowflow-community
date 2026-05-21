'use client'

import { useState } from 'react'
import { Check, CheckCheck, Clock, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export type Notification = {
  id: string
  title: string
  message: string
  timestamp: Date
  read: boolean
  type: 'info' | 'success' | 'warning' | 'error'
}

interface NotificationPanelProps {
  notifications: Notification[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onClearAll: () => void
  showMarkAllAsRead?: boolean
  showClearAll?: boolean
}

export function NotificationPanel({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  showMarkAllAsRead = true,
  showClearAll = true,
}: NotificationPanelProps) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const filteredNotifications =
    filter === 'all' ? notifications : notifications.filter((n) => !n.read)

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="flex max-h-[min(500px,calc(100dvh-8rem))] min-h-0 w-full min-w-0 flex-col">
      <div className="mx-2 mt-2 flex items-center justify-between gap-2 rounded-[10px] border border-black/[0.08] bg-transparent px-3 py-2 smoky-glass-pane dark:border-white/[0.08]">
        <h3 className="min-w-0 truncate text-sm font-medium font-logo text-zinc-800 dark:text-white">
          Notifications
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'smoky-glass-chip h-7 rounded-[8px] border border-black/[0.08] bg-transparent px-2 text-[11px] font-logo text-black/60 hover:bg-transparent hover:text-black focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/[0.08] dark:text-white/60 dark:hover:text-white',
              filter === 'all' && 'border-primary/18 text-primary dark:text-[#b8d6c8]'
            )}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'smoky-glass-chip h-7 rounded-[8px] border border-black/[0.08] bg-transparent px-2 text-[11px] font-logo text-black/60 hover:bg-transparent hover:text-black focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/[0.08] dark:text-white/60 dark:hover:text-white',
              filter === 'unread' && 'border-primary/18 text-primary dark:text-[#b8d6c8]'
            )}
            onClick={() => setFilter('unread')}
          >
            Unread
            {unreadCount > 0 && (
              <span className="smoky-glass-chip flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full border border-primary/18 bg-primary/10 px-1 text-[10px] text-primary dark:text-[#d9ebe1]">
                {unreadCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      <Separator className="mx-3 my-2 bg-black/[0.06] dark:bg-white/[0.08]" />

      <ScrollArea className="min-h-0 flex-1">
        {filteredNotifications.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center px-4 py-8 text-center">
            <Info className="h-8 w-8 text-zinc-400 dark:text-white/40 mb-2 opacity-50" />
            <p className="text-sm font-logo leading-relaxed text-zinc-500 dark:text-white/50">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            {filter === 'unread' && notifications.length > 0 && (
              <Button
                variant="link"
                size="sm"
                className="mt-2 h-auto p-0 text-xs focus-visible:ring-2 focus-visible:ring-primary/35"
                onClick={() => setFilter('all')}
              >
                Show all notifications
              </Button>
            )}
          </div>
        ) : (
          <div className="flex min-w-0 flex-col pb-2">
            {filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={onMarkAsRead}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {notifications.length > 0 && (showMarkAllAsRead || showClearAll) && (
        <>
          <Separator className="mx-3 my-2 bg-black/[0.06] dark:bg-white/[0.08]" />
          <div className="mx-2 mb-2 flex items-center justify-between gap-2 rounded-[10px] border border-black/[0.08] bg-transparent p-2 smoky-glass-pane dark:border-white/[0.08]">
            {showMarkAllAsRead ? (
              <Button
                variant="ghost"
                size="sm"
                className="smoky-glass-chip h-7 min-w-0 rounded-[8px] border border-black/[0.08] bg-transparent px-2 text-[11px] font-logo text-black/60 hover:bg-transparent hover:text-black focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/[0.08] dark:text-white/60 dark:hover:text-white"
                onClick={onMarkAllAsRead}
                disabled={unreadCount === 0}
              >
                <CheckCheck className="h-3 w-3 shrink-0 mr-1" />
                <span className="truncate">Mark all read</span>
              </Button>
            ) : (
              <div />
            )}
            {showClearAll ? (
              <Button
                variant="ghost"
                size="sm"
                className="smoky-glass-chip h-7 min-w-0 rounded-[8px] border border-black/[0.08] bg-transparent px-2 text-[11px] font-logo text-rose-600 hover:bg-transparent hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-400/35 dark:border-white/[0.08] dark:text-rose-300 dark:hover:text-rose-200"
                onClick={onClearAll}
              >
                <X className="h-3 w-3 shrink-0 mr-1" />
                <span className="truncate">Clear all</span>
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: Notification
  onMarkAsRead: (id: string) => void
}) {
  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    // Less than a minute
    if (diff < 60 * 1000) {
      return 'Just now'
    }

    // Less than an hour
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000))
      return `${minutes}m ago`
    }

    // Less than a day
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000))
      return `${hours}h ago`
    }

    // Format as date
    return date.toLocaleDateString()
  }

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />
      case 'warning':
        return <Info className="h-4 w-4 text-amber-500" />
      case 'error':
        return <X className="h-4 w-4 text-red-500" />
    }
  }

  return (
    <div
      className={cn(
        'mx-2 my-1 flex min-w-0 items-start rounded-[10px] border border-transparent px-3 py-3 transition-all duration-200',
        notification.read
          ? 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
          : 'smoky-glass-pane border-primary/16 bg-primary/[0.04] dark:bg-primary/[0.06]'
      )}
    >
      <div className="mr-3 mt-0.5 flex-shrink-0">{getTypeIcon(notification.type)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-medium font-logo text-zinc-800 dark:text-white">
            {notification.title}
          </p>
          <div className="flex shrink-0 items-center">
            <span className="flex items-center whitespace-nowrap text-xs font-logo text-zinc-400 dark:text-white/40">
              <Clock className="h-3 w-3 shrink-0 mr-1" />
              {formatTime(notification.timestamp)}
            </span>
          </div>
        </div>
        <p className="mt-1 break-words text-xs leading-relaxed text-zinc-500 dark:text-white/50 [overflow-wrap:anywhere]">
          {notification.message}
        </p>
      </div>
      {!notification.read && (
        <Button
          variant="ghost"
          size="sm"
          className="smoky-glass-chip ml-2 h-6 w-6 shrink-0 rounded-full border border-black/[0.08] bg-transparent p-0 text-black/60 hover:bg-transparent hover:text-black focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/[0.08] dark:text-white/60 dark:hover:text-white"
          onClick={() => onMarkAsRead(notification.id)}
        >
          <Check className="h-3 w-3" />
          <span className="sr-only">Mark as read</span>
        </Button>
      )}
    </div>
  )
}
