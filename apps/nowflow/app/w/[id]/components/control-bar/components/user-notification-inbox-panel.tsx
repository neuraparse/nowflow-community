'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, CheckCheck, Clock, ExternalLink, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { UserInboxNotification } from '@/hooks/use-user-notifications'

function formatRelativeTime(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60 * 1000) return 'Just now'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`

  return date.toLocaleDateString()
}

function typeIcon(type: UserInboxNotification['type']) {
  switch (type) {
    case 'success':
      return <Check className="h-4 w-4 text-emerald-500" />
    case 'warning':
      return <Info className="h-4 w-4 text-amber-500" />
    case 'error':
      return <X className="h-4 w-4 text-rose-500" />
    default:
      return <Info className="h-4 w-4 text-blue-500" />
  }
}

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url)
}

export function UserNotificationInboxPanel({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}: {
  notifications: UserInboxNotification[]
  onMarkAsRead: (recipientId: string) => Promise<void>
  onMarkAllAsRead: () => Promise<void>
}) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sorted = useMemo(() => {
    return [...notifications].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [notifications])

  const filtered = useMemo(() => {
    return filter === 'all' ? sorted : sorted.filter((n) => !n.isRead)
  }, [filter, sorted])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications])

  const selected = useMemo(() => {
    if (!selectedId) return null
    return notifications.find((n) => n.recipientId === selectedId) || null
  }, [notifications, selectedId])

  const openDetails = async (id: string) => {
    setSelectedId(id)
    const notification = notifications.find((n) => n.recipientId === id)
    if (notification && !notification.isRead) {
      await onMarkAsRead(id).catch(() => {})
    }
  }

  return (
    <div className="flex max-h-[min(500px,calc(100dvh-8rem))] min-h-0 w-full min-w-0 flex-col">
      <div className="mx-2 mt-2 flex items-center justify-between gap-2 rounded-[10px] border border-black/[0.08] bg-transparent px-3 py-2 smoky-glass-pane dark:border-white/[0.08]">
        <h3 className="min-w-0 truncate text-sm font-medium font-logo text-zinc-800 dark:text-white">
          Inbox
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
        {filtered.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center px-4 py-8 text-center">
            <Info className="h-8 w-8 text-zinc-400 dark:text-white/40 mb-2 opacity-50" />
            <p className="text-sm font-logo leading-relaxed text-zinc-500 dark:text-white/50">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col pb-2">
            {filtered.map((notification) => (
              <button
                key={notification.recipientId}
                type="button"
                className={cn(
                  'mx-2 my-1 flex w-[calc(100%-1rem)] min-w-0 items-start rounded-[10px] border border-transparent px-3 py-3 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35',
                  notification.isRead
                    ? 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                    : 'smoky-glass-pane border-primary/16 bg-primary/[0.04] dark:bg-primary/[0.06]'
                )}
                onClick={() => void openDetails(notification.recipientId)}
              >
                <div className="mr-3 mt-0.5 flex-shrink-0">{typeIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium font-logo text-zinc-800 dark:text-white">
                      {notification.title}
                    </p>
                    <span className="flex shrink-0 items-center whitespace-nowrap text-xs text-zinc-400 dark:text-white/40 font-logo">
                      <Clock className="h-3 w-3 shrink-0 mr-1" />
                      {formatRelativeTime(new Date(notification.createdAt))}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-zinc-500 dark:text-white/50 [overflow-wrap:anywhere]">
                    {notification.message}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {notifications.length > 0 && (
        <>
          <Separator className="mx-3 my-2 bg-black/[0.06] dark:bg-white/[0.08]" />
          <div className="mx-2 mb-2 flex items-center justify-between gap-2 rounded-[10px] border border-black/[0.08] bg-transparent p-2 smoky-glass-pane dark:border-white/[0.08]">
            <Button
              variant="ghost"
              size="sm"
              className="smoky-glass-chip h-7 min-w-0 rounded-[8px] border border-black/[0.08] bg-transparent px-2 text-[11px] font-logo text-black/60 hover:bg-transparent hover:text-black focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/[0.08] dark:text-white/60 dark:hover:text-white"
              onClick={() => void onMarkAllAsRead().catch(() => {})}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="h-3 w-3 shrink-0 mr-1" />
              <span className="truncate">Mark all read</span>
            </Button>
            <div className="shrink-0 pr-1 text-[11px] text-zinc-400 dark:text-white/40 font-logo tabular-nums">
              {unreadCount} unread
            </div>
          </div>
        </>
      )}

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => setSelectedId(open ? selectedId : null)}
      >
        {selected ? (
          <DialogContent className="max-h-[min(640px,calc(100dvh-2rem))] overflow-hidden sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="flex min-w-0 items-center gap-2">
                {typeIcon(selected.type)}
                <span className="min-w-0 truncate">{selected.title}</span>
              </DialogTitle>
              <DialogDescription className="flex flex-col gap-1">
                <span className="text-xs text-zinc-400 dark:text-white/40">
                  Sent: {new Date(selected.createdAt).toLocaleString()}
                </span>
                {selected.readAt ? (
                  <span className="text-xs text-zinc-400 dark:text-white/40">
                    Read: {new Date(selected.readAt).toLocaleString()}
                  </span>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[min(360px,45dvh)] pr-3">
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
                {selected.message}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2 sm:gap-2">
              {!selected.isRead ? (
                <Button
                  variant="ghost"
                  className="smoky-glass-chip h-10 rounded-[10px] border border-black/[0.08] bg-transparent px-4 text-[13px] font-logo font-medium text-black/70 hover:bg-transparent hover:text-black focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/[0.08] dark:text-white/70 dark:hover:text-white"
                  onClick={() => void onMarkAsRead(selected.recipientId).catch(() => {})}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Mark as read
                </Button>
              ) : null}

              {selected.actionUrl ? (
                isExternalUrl(selected.actionUrl) ? (
                  <Button
                    asChild
                    className="silver-glass-button-strong h-10 rounded-[10px] border-0 bg-transparent px-4 text-[13px] font-logo font-medium text-black hover:bg-transparent focus-visible:ring-2 focus-visible:ring-primary/35 dark:text-white"
                  >
                    <a href={selected.actionUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open
                    </a>
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="silver-glass-button-strong h-10 rounded-[10px] border-0 bg-transparent px-4 text-[13px] font-logo font-medium text-black hover:bg-transparent focus-visible:ring-2 focus-visible:ring-primary/35 dark:text-white"
                  >
                    <Link href={selected.actionUrl}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open
                    </Link>
                  </Button>
                )
              ) : (
                <Button
                  variant="ghost"
                  className="smoky-glass-chip h-10 rounded-[10px] border border-black/[0.08] bg-transparent px-4 text-[13px] font-logo font-medium text-black/70 hover:bg-transparent hover:text-black focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/[0.08] dark:text-white/70 dark:hover:text-white"
                  onClick={() => setSelectedId(null)}
                >
                  Close
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  )
}
