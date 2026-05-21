'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WorkflowNotificationIcon } from '@/components/workflow-control-icons'
import type { Notification } from '@/stores/notifications/types'
import type { UserInboxNotification } from '@/hooks/use-user-notifications'
import { NotificationPanel } from './notification-panel'
import { UserNotificationInboxPanel } from './user-notification-inbox-panel'

interface NotificationsDropdownProps {
  notificationsOpen: boolean
  setNotificationsOpen: (open: boolean) => void
  currentWorkflowNotifications: Notification[]
  removeNotification: (id: string) => void
  inboxNotifications: UserInboxNotification[]
  inboxUnreadCount: number
  inboxRealtimeConnected: boolean
  inboxLoading: boolean
  inboxError: string | null
  markInboxRead: (recipientId: string) => Promise<void>
  markAllInboxRead: () => Promise<void>
  isLoggedIn: boolean
}

export function NotificationsDropdown({
  notificationsOpen,
  setNotificationsOpen,
  currentWorkflowNotifications,
  removeNotification,
  inboxNotifications,
  inboxUnreadCount,
  inboxRealtimeConnected,
  inboxLoading,
  inboxError,
  markInboxRead,
  markAllInboxRead,
  isLoggedIn,
}: NotificationsDropdownProps) {
  const hasAnyIndicator = currentWorkflowNotifications.length > 0 || inboxUnreadCount > 0
  const defaultTab =
    inboxUnreadCount > 0 ? 'inbox' : currentWorkflowNotifications.length > 0 ? 'workflow' : 'inbox'

  return (
    <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              data-control-action="notifications"
              data-control-state={
                inboxUnreadCount > 0 ? 'active' : hasAnyIndicator ? 'warning' : 'idle'
              }
              variant="ghost"
              size="icon"
              className="silver-glass-chip relative h-8 w-8 rounded-[10px] transition-all duration-200 hover:text-foreground"
            >
              <WorkflowNotificationIcon className="h-3.5 w-3.5" />
              {inboxUnreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-logo font-medium leading-none text-primary-foreground shadow-sm tabular-nums">
                  {inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}
                </span>
              ) : hasAnyIndicator ? (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative rounded-full h-2 w-2 bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]"></span>
                </span>
              ) : null}
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        {!notificationsOpen && (
          <TooltipContent
            side="bottom"
            className="bg-[#1b1b1b] text-white border-none text-[11px] font-logo"
          >
            Notifications
          </TooltipContent>
        )}
      </Tooltip>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="workflow-editor-notifications-menu smoky-glass-panel z-[80] w-[min(calc(100vw-1rem),24rem)] overflow-hidden rounded-[12px] border-black/[0.08] p-0 shadow-[0_16px_48px_rgba(0,0,0,0.14)] outline-none dark:border-white/[0.08] dark:shadow-[0_16px_48px_rgba(0,0,0,0.42)]"
      >
        <Tabs
          defaultValue={defaultTab}
          className="flex max-h-[min(560px,calc(100dvh-5rem))] w-full min-w-0 flex-col"
        >
          <div className="px-2.5 py-2.5">
            <TabsList className="smoky-glass-pane grid w-full grid-cols-2 gap-1 rounded-[10px] border border-black/[0.08] bg-transparent p-1 dark:border-white/[0.08]">
              <TabsTrigger
                value="workflow"
                className="h-8 min-w-0 gap-1.5 rounded-[8px] border border-transparent bg-transparent px-2 text-[11px] font-logo font-medium text-black/60 transition-all focus-visible:ring-2 focus-visible:ring-primary/35 data-[state=active]:border-black/[0.08] data-[state=active]:bg-black/[0.84] data-[state=active]:text-white dark:text-white/60 dark:data-[state=active]:border-white/[0.08] dark:data-[state=active]:bg-white/[0.92] dark:data-[state=active]:text-[#1b1b1b]"
              >
                <span className="truncate">Workflow</span>
                {currentWorkflowNotifications.length > 0 ? (
                  <span className="smoky-glass-chip inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-amber-500/16 bg-amber-500/10 px-1.5 text-amber-700 tabular-nums dark:border-amber-400/18 dark:text-amber-300">
                    {currentWorkflowNotifications.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger
                value="inbox"
                className="h-8 min-w-0 gap-1.5 rounded-[8px] border border-transparent bg-transparent px-2 text-[11px] font-logo font-medium text-black/60 transition-all focus-visible:ring-2 focus-visible:ring-primary/35 data-[state=active]:border-black/[0.08] data-[state=active]:bg-black/[0.84] data-[state=active]:text-white dark:text-white/60 dark:data-[state=active]:border-white/[0.08] dark:data-[state=active]:bg-white/[0.92] dark:data-[state=active]:text-[#1b1b1b]"
              >
                <span className="truncate">Inbox</span>
                {inboxRealtimeConnected ? (
                  <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500/80" />
                ) : null}
                {inboxUnreadCount > 0 ? (
                  <span className="smoky-glass-chip inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-primary/16 bg-primary/10 px-1.5 text-primary tabular-nums dark:text-[#d9ebe1]">
                    {inboxUnreadCount}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="workflow" className="m-0 min-h-0 flex-1">
            <NotificationPanel
              notifications={currentWorkflowNotifications.map((n) => ({
                id: n.id,
                title: n.type.charAt(0).toUpperCase() + n.type.slice(1),
                message: n.message,
                timestamp: new Date(n.timestamp),
                read: false,
                type:
                  n.type === 'error'
                    ? ('error' as const)
                    : n.type === 'api' || n.type === 'console' || n.type === 'marketplace'
                      ? ('info' as const)
                      : ('info' as const),
              }))}
              onMarkAsRead={(id) => removeNotification(id)}
              onMarkAllAsRead={() =>
                currentWorkflowNotifications.forEach((n) => removeNotification(n.id))
              }
              onClearAll={() =>
                currentWorkflowNotifications.forEach((n) => removeNotification(n.id))
              }
            />
          </TabsContent>

          <TabsContent value="inbox" className="m-0 min-h-0 flex-1">
            {Boolean(isLoggedIn) && inboxError ? (
              <div className="mx-2 mt-1 break-words rounded-[10px] border border-rose-500/18 px-3 py-2 text-xs font-logo leading-relaxed text-rose-700 smoky-glass-pane dark:border-rose-400/20 dark:text-rose-200">
                {inboxError}
              </div>
            ) : null}
            {Boolean(isLoggedIn) && inboxLoading ? (
              <div className="mx-2 mt-1 rounded-[10px] border border-black/[0.08] px-3 py-2 text-xs font-logo text-zinc-500 smoky-glass-pane dark:border-white/[0.08] dark:text-white/60">
                Loading...
              </div>
            ) : null}
            {Boolean(isLoggedIn) ? (
              <UserNotificationInboxPanel
                notifications={inboxNotifications}
                onMarkAsRead={markInboxRead}
                onMarkAllAsRead={markAllInboxRead}
              />
            ) : (
              <div className="m-2 flex min-h-[180px] items-center justify-center rounded-[10px] border border-black/[0.08] p-6 text-center text-sm font-logo leading-relaxed text-zinc-500 smoky-glass-pane dark:border-white/[0.08] dark:text-white/60">
                Sign in to view notifications.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
