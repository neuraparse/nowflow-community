import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { AlertCircle, Rocket, Store, Terminal } from 'lucide-react'
import { ErrorIcon } from '@/components/icons'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/stores/notifications/store'
import { Notification, NotificationOptions, NotificationType } from '@/stores/notifications/types'

interface NotificationDropdownItemProps {
  id: string
  type: NotificationType
  message: string
  timestamp: number
  options?: NotificationOptions
  setDropdownOpen?: (open: boolean) => void
}

const NotificationIcon = {
  error: ErrorIcon,
  console: Terminal,
  marketplace: Store,
  info: AlertCircle,
  api: Rocket,
}

const NotificationColors = {
  error: 'text-destructive',
  console: 'text-foreground',
  marketplace: 'text-foreground',
  info: 'text-foreground',
  api: 'text-foreground',
}

export function NotificationDropdownItem({
  id,
  type,
  message,
  timestamp,
  options,
  setDropdownOpen,
}: NotificationDropdownItemProps) {
  const { notifications, showNotification, addNotification } = useNotificationStore()
  const Icon = NotificationIcon[type]
  const [, forceUpdate] = useState({})

  // Update the time display every minute
  useEffect(() => {
    const interval = setInterval(() => forceUpdate({}), 60000)
    return () => clearInterval(interval)
  }, [])

  // Find the full notification object from the store
  const getFullNotification = (): Notification | undefined => {
    return notifications.find((n) => n.id === id)
  }

  // Handle click to show the notification
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const notification = getFullNotification()

    if (notification) {
      // Simply show the notification regardless of its current state
      showNotification(id)
    } else {
      // Fallback for any case where the notification doesn't exist anymore
      addNotification(type, message, null, options)
    }

    // Close the dropdown after clicking
    if (setDropdownOpen) {
      setDropdownOpen(false)
    }
  }

  // Format time and replace "less than a minute ago" with "<1 minute ago"
  const rawTimeAgo = formatDistanceToNow(timestamp, { addSuffix: true })
  const timeAgo = rawTimeAgo.replace('less than a minute ago', '<1 minute ago')

  return (
    <DropdownMenuItem
      className="smoky-glass-pane flex min-w-0 cursor-pointer items-start gap-2 rounded-[10px] border border-black/[0.08] bg-transparent p-3 outline-none focus:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/[0.08] dark:focus:bg-white/[0.05]"
      onClick={handleClick}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', NotificationColors[type])} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-logo font-medium text-zinc-800 dark:text-white/90">
            {type === 'error'
              ? 'Error'
              : type === 'marketplace'
                ? 'Marketplace'
                : type === 'info'
                  ? 'Info'
                  : 'Console'}
          </span>
          <span className="shrink-0 whitespace-nowrap text-xs text-zinc-400 dark:text-white/40 font-logo">
            {timeAgo}
          </span>
        </div>
        <p className="whitespace-normal break-words text-sm leading-relaxed text-zinc-800 dark:text-white [overflow-wrap:anywhere]">
          {message.length > 100 ? `${message.slice(0, 60)}...` : message}
        </p>
      </div>
    </DropdownMenuItem>
  )
}
