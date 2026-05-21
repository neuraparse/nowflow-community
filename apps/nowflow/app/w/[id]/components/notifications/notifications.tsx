// NOTE: API NOTIFICATIONS NO LONGER EXIST, BUT IF YOU DELETE THEM FROM THIS FILE THE APPLICATION WILL BREAK
import { useEffect, useMemo, useState } from 'react'
import { Info, Rocket, Store, Terminal, X } from 'lucide-react'
import { ErrorIcon } from '@/components/icons'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { createLogger } from '@/lib/logs/console-logger'
import { cn } from '@/lib/utils'
import { MAX_VISIBLE_NOTIFICATIONS, useNotificationStore } from '@/stores/notifications/store'
import { Notification, NotificationContext } from '@/stores/notifications/types'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'

const logger = createLogger('Notifications')

// Constants
const FADE_DURATION = 500 // Fade out over 500ms
const DEFAULT_NOTIFICATION_CONTEXTS: NotificationContext[] = ['workflow']

// Define keyframes for the animations in a style tag
const AnimationStyles = () => (
  <style jsx global>{`
    @keyframes notification-slide {
      0% {
        opacity: 0;
        transform: translateY(-100%);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes notification-fade-out {
      0% {
        opacity: 1;
        transform: translateY(0);
      }
      100% {
        opacity: 0;
        transform: translateY(-10%);
      }
    }

    @keyframes notification-slide-up {
      0% {
        transform: translateY(0);
      }
      100% {
        transform: translateY(-100%);
      }
    }

    .animate-notification-slide {
      animation: notification-slide 300ms ease forwards;
    }

    .animate-notification-fade-out {
      animation: notification-fade-out ${FADE_DURATION}ms ease forwards;
    }

    .animate-notification-slide-up {
      animation: notification-slide-up 300ms ease forwards;
    }

    .notification-container {
      transition:
        height 300ms ease,
        opacity 300ms ease,
        transform 300ms ease;
    }
  `}</style>
)

// Icon mapping for notification types
const NotificationIcon = {
  error: ErrorIcon,
  console: Terminal,
  api: Rocket,
  marketplace: Store,
  info: Info,
}

// Color schemes for different notification types
const NotificationColors = {
  error:
    'border-rose-500/18 text-rose-700 dark:border-rose-400/20 dark:text-rose-100 [&>svg]:text-rose-500 dark:[&>svg]:text-rose-300',
  console:
    'border-black/[0.08] text-zinc-800 dark:border-white/[0.08] dark:text-white/92 [&>svg]:text-black/55 dark:[&>svg]:text-white/55',
  api: 'border-violet-500/16 text-zinc-800 dark:border-violet-400/18 dark:text-white/92 [&>svg]:text-violet-500 dark:[&>svg]:text-violet-300',
  marketplace:
    'border-amber-500/16 text-zinc-800 dark:border-amber-400/18 dark:text-white/92 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-300',
  info: 'border-sky-500/16 text-zinc-800 dark:border-sky-400/18 dark:text-white/92 [&>svg]:text-sky-600 dark:[&>svg]:text-sky-300',
}

// API deployment status styling
const ApiStatusStyles = {
  active:
    'smoky-glass-chip inline-flex items-center rounded-full border border-emerald-500/16 px-2 py-0.5 text-emerald-700 dark:border-emerald-400/18 dark:text-emerald-200',
  inactive:
    'smoky-glass-chip inline-flex items-center rounded-full border border-rose-500/18 px-2 py-0.5 text-rose-700 dark:border-rose-400/20 dark:text-rose-200',
}

/**
 * AlertDialog component for API deletion confirmation
 */
function DeleteApiConfirmation({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="z-[100]">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete API Deployment</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this API deployment? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="smoky-glass-chip rounded-[10px] border border-rose-500/[0.18] bg-rose-500/[0.08] text-rose-700 transition-all duration-200 hover:bg-rose-500/[0.12] dark:border-rose-400/[0.16] dark:bg-rose-400/[0.1] dark:text-rose-100"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * NotificationList component displays all active notifications as alerts
 * with support for auto-dismissal, copying content, and different styling per type
 */
export function NotificationList({
  contexts = DEFAULT_NOTIFICATION_CONTEXTS,
}: {
  contexts?: NotificationContext[]
} = {}) {
  // Store access
  const { notifications, hideNotification, markAsRead, setNotificationFading } =
    useNotificationStore()
  const { activeWorkflowId } = useWorkflowRegistry()

  // Local state
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set())

  // Filter to only show:
  // 1. Visible notifications for the current workflow
  // 2. That are either unread OR marked as persistent
  const allowedContexts = useMemo(
    () => (contexts.length > 0 ? contexts : DEFAULT_NOTIFICATION_CONTEXTS),
    [contexts]
  )
  const visibleNotifications = useMemo(
    () =>
      notifications.filter((n) => {
        const notificationContext = n.options?.context ?? 'workflow'

        if (!allowedContexts.includes(notificationContext)) return false

        if (notificationContext === 'workflow') {
          if (!activeWorkflowId || n.workflowId !== activeWorkflowId) return false
        }

        return n.isVisible && (!n.read || n.options?.isPersistent)
      }),
    [activeWorkflowId, allowedContexts, notifications]
  )

  const stackedNotifications = useMemo(
    () => visibleNotifications.slice(0, MAX_VISIBLE_NOTIFICATIONS),
    [visibleNotifications]
  )

  // Handle fading notifications created by the store
  useEffect(() => {
    // This effect watches for notifications that are fading
    // and handles the DOM removal after animation completes

    const timers: Record<string, ReturnType<typeof setTimeout>> = {}

    stackedNotifications.forEach((notification) => {
      // For notifications that have started fading, set up cleanup timers
      if (notification.isFading && !animatingIds.has(notification.id)) {
        // Start slide up animation after fade animation
        const slideTimer = setTimeout(() => {
          setAnimatingIds((prev) => new Set([...prev, notification.id]))

          // After slide animation, remove from DOM
          setTimeout(() => {
            hideNotification(notification.id)
            markAsRead(notification.id)

            // Remove from animating set
            setAnimatingIds((prev) => {
              const next = new Set(prev)
              next.delete(notification.id)
              return next
            })
          }, 300)
        }, FADE_DURATION)

        timers[notification.id] = slideTimer
      }
    })

    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [stackedNotifications, animatingIds, hideNotification, markAsRead])

  // Early return if no notifications to show
  if (visibleNotifications.length === 0) return null

  return (
    <>
      <AnimationStyles />
      <div
        className="fixed left-3 right-3 z-[60] flex max-h-[calc(100dvh-6rem)] flex-col items-center gap-2 overflow-hidden pointer-events-none sm:left-1/2 sm:right-auto sm:w-[min(calc(100vw-2rem),36rem)] sm:-translate-x-1/2 sm:gap-2.5"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 76px)',
        }}
      >
        {stackedNotifications.map((notification) => (
          <div
            key={notification.id}
            className={cn(
              'notification-container',
              animatingIds.has(notification.id) && 'animate-notification-slide-up'
            )}
          >
            <NotificationAlert
              notification={notification}
              isFading={notification.isFading ?? false}
              onHide={(id) => {
                // For persistent notifications like API, just hide immediately without animations
                if (notification.options?.isPersistent) {
                  hideNotification(id)
                  markAsRead(id)
                  return
                }

                // For regular notifications, use the animation sequence
                // Start the fade out animation when manually closing
                setNotificationFading(id)

                // Start slide up animation after fade completes
                setTimeout(() => {
                  setAnimatingIds((prev) => new Set([...prev, id]))
                }, FADE_DURATION)

                // Remove from DOM after all animations complete
                setTimeout(() => {
                  hideNotification(id)
                  markAsRead(id)
                  setAnimatingIds((prev) => {
                    const next = new Set(prev)
                    next.delete(id)
                    return next
                  })
                }, FADE_DURATION + 300) // Fade + slide durations
              }}
            />
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * Individual notification alert component
 */
interface NotificationAlertProps {
  notification: Notification
  isFading: boolean
  onHide: (id: string) => void
}

export function NotificationAlert({ notification, isFading, onHide }: NotificationAlertProps) {
  const { id, type, message, options, workflowId } = notification
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const setDeploymentStatus = useWorkflowStore((s) => s.setDeploymentStatus)
  const isDeployed = useWorkflowStore((s) => s.isDeployed)

  // Create a function to clear the redeployment flag and update deployment status
  const updateDeploymentStatus = (isDeployed: boolean, deployedAt?: Date) => {
    // Update deployment status in workflow store
    setDeploymentStatus(isDeployed, deployedAt)

    // Manually update the needsRedeployment flag in workflow store
    useWorkflowStore.getState().setNeedsRedeploymentFlag(false)
  }

  const Icon = NotificationIcon[type] || Info // Fallback to Info icon if type is invalid

  const handleDeleteApi = async () => {
    if (!workflowId) return

    try {
      const response = await fetch(`/api/workflows/${workflowId}/deploy`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete API deployment')

      // Update deployment status in the store
      updateDeploymentStatus(false)

      // Close the notification
      onHide(id)

      // Close the dialog
      setIsDeleteDialogOpen(false)
    } catch (error) {
      logger.error('Error deleting API deployment:', { error })
    }
  }

  // Function to mask API key with asterisks but keep first and last 4 chars visible
  const maskApiKey = (key: string) => {
    if (!key || key.includes('No API key found')) return key
    if (key.length <= 8) return key
    return `${key.substring(0, 4)}${'*'.repeat(key.length - 8)}${key.substring(key.length - 4)}`
  }

  // Modify the curl command to use a placeholder for the API key
  const formatCurlCommand = (command: string, apiKey: string) => {
    if (!command.includes('curl')) return command

    // Replace the actual API key with a placeholder in the command
    const sanitizedCommand = command.replace(apiKey, 'SIM_API_KEY')

    // Format the command with line breaks for better readability
    return sanitizedCommand
      .replace(' -H ', '\n  -H ')
      .replace(' -d ', '\n  -d ')
      .replace(' http', '\n  http')
  }

  return (
    <>
      <Alert
        className={cn(
          'silver-glass-pane smoky-glass-pane pointer-events-auto w-full max-w-[36rem] select-none rounded-[14px] border border-black/[0.08] shadow-[0_24px_56px_rgba(24,24,27,0.12)] transition-all duration-300 ease-in-out dark:border-white/[0.08] dark:shadow-[0_28px_60px_rgba(0,0,0,0.28)]',
          isFading
            ? 'animate-notification-fade-out pointer-events-none'
            : 'animate-notification-slide',
          NotificationColors[type] || NotificationColors.info
        )}
      >
        {type === 'api' ? (
          // Special layout for API notifications with equal spacing
          <div className="relative flex min-w-0 items-start gap-3 py-1">
            {/* Left icon */}
            <div className="flex-shrink-0 mt-0.5">
              <Icon className="!h-4 !w-4 !text-violet-500 dark:!text-violet-300" />
            </div>

            {/* Content area with equal margins */}
            <div className="min-w-0 flex-1 space-y-2 pt-[3.5px] pr-7 sm:pr-8">
              <AlertTitle className="-mt-0.5">
                <span>API</span>
              </AlertTitle>

              <AlertDescription className="min-w-0 space-y-4">
                <p className="break-words [overflow-wrap:anywhere]">
                  {!isDeployed ? 'Workflow currently not deployed' : message}
                </p>

                {/* Optional sections with copyable content */}
                {options?.sections?.map((section, index) => {
                  // Get the API key from the sections to use in curl command formatting
                  const apiKey =
                    options.sections?.find((s) => s.label === 'x-api-key')?.content || ''

                  return (
                    <div key={index} className="space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground">
                        {section.label}
                      </div>

                      {/* Copyable code block */}
                      <div className="smoky-glass-pane group relative min-w-0 rounded-[10px] border border-black/[0.08] bg-transparent transition-colors hover:border-black/[0.12] dark:border-white/[0.08] dark:hover:border-white/[0.12]">
                        {section.label === 'x-api-key' ? (
                          <>
                            <pre
                              className="max-h-[300px] max-w-full cursor-pointer select-text overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words p-3 font-mono text-xs [overflow-wrap:anywhere]"
                              onClick={() => setShowApiKey(!showApiKey)}
                              title={
                                showApiKey ? 'Click to hide API Key' : 'Click to reveal API Key'
                              }
                            >
                              {showApiKey ? section.content : maskApiKey(section.content)}
                            </pre>
                            <div className="text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                              <CopyButton text={section.content} showLabel={false} />
                            </div>
                          </>
                        ) : section.label === 'Example curl command' ? (
                          <>
                            <pre className="max-h-[300px] max-w-full select-text overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words p-3 font-mono text-xs [overflow-wrap:anywhere]">
                              {formatCurlCommand(section.content, apiKey)}
                            </pre>
                            <CopyButton text={section.content} showLabel={false} />
                          </>
                        ) : (
                          <>
                            <pre className="max-h-[300px] max-w-full select-text overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words p-3 font-mono text-xs [overflow-wrap:anywhere]">
                              {section.content}
                            </pre>
                            <CopyButton text={section.content} showLabel={false} />
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Status and Delete button row - with pulsing green indicator */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Status:</span>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <div className="relative flex items-center justify-center">
                        {isDeployed ? (
                          options?.needsRedeployment ? (
                            <>
                              <div className="absolute h-3 w-3 rounded-full bg-amber-500/20 animate-ping"></div>
                              <div className="relative h-2 w-2 rounded-full bg-amber-500"></div>
                            </>
                          ) : (
                            <>
                              <div className="absolute h-3 w-3 rounded-full bg-green-500/20 animate-ping"></div>
                              <div className="relative h-2 w-2 rounded-full bg-green-500"></div>
                            </>
                          )
                        ) : (
                          <>
                            <div className="absolute h-3 w-3 rounded-full bg-red-500/20 animate-ping"></div>
                            <div className="relative h-2 w-2 rounded-full bg-red-500"></div>
                          </>
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          isDeployed
                            ? options?.needsRedeployment
                              ? 'smoky-glass-chip inline-flex items-center rounded-full border border-amber-500/16 px-2 py-0.5 text-amber-700 dark:border-amber-400/18 dark:text-amber-200'
                              : ApiStatusStyles.active
                            : ApiStatusStyles.inactive
                        )}
                      >
                        {isDeployed
                          ? options?.needsRedeployment
                            ? 'Changes Detected'
                            : 'Active'
                          : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {options?.needsRedeployment && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="smoky-glass-chip h-7 rounded-[9px] border border-black/[0.08] bg-transparent px-2.5 text-xs font-logo font-medium text-black/60 hover:bg-transparent hover:text-amber-700 dark:border-white/[0.08] dark:text-white/62 dark:hover:text-amber-200"
                        onClick={async () => {
                          if (!workflowId) return

                          try {
                            // Call the deploy endpoint to redeploy the workflow
                            const response = await fetch(`/api/workflows/${workflowId}/deploy`, {
                              method: 'POST',
                            })

                            if (!response.ok) throw new Error('Failed to redeploy workflow')

                            // Get the response data
                            const data = await response.json()

                            // Update deployment status in the store (resets needsRedeployment flag)
                            updateDeploymentStatus(
                              data.isDeployed,
                              data.deployedAt ? new Date(data.deployedAt) : undefined
                            )

                            // First close this notification
                            onHide(id)

                            // Show a temporary success notification without creating another API notification
                            useNotificationStore
                              .getState()
                              .addNotification(
                                'info',
                                'Workflow successfully redeployed',
                                workflowId,
                                { isPersistent: false }
                              )
                          } catch (error) {
                            logger.error('Error redeploying workflow:', { error })
                          }
                        }}
                      >
                        Redeploy
                      </Button>
                    )}
                    {isDeployed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="smoky-glass-chip h-7 rounded-[9px] border border-black/[0.08] bg-transparent px-2.5 text-xs font-logo font-medium text-black/60 hover:bg-transparent hover:text-rose-700 dark:border-white/[0.08] dark:text-white/62 dark:hover:text-rose-200"
                        onClick={() => setIsDeleteDialogOpen(true)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </div>

            {/* Absolute positioned close button in the top right */}
            {(options?.showCloseButton === true ||
              (options?.showCloseButton === undefined && options?.isPersistent)) && (
              <div className="absolute right-0 top-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="smoky-glass-chip h-6 w-6 rounded-[8px] border border-black/[0.08] bg-transparent opacity-80 transition-opacity hover:bg-transparent hover:opacity-100 dark:border-white/[0.08]"
                  onClick={() => onHide(id)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Original layout for error, console and marketplace notifications
          <div className="flex min-w-0 items-start gap-3 py-1 sm:gap-4">
            {/* Icon with proper vertical alignment */}
            <div className="flex-shrink-0 mt-0.5">
              <Icon
                className={cn('h-4 w-4', {
                  '!text-red-500 mt-[-3px]': type === 'error',
                  'text-black/60 dark:text-white/60 mt-[-4px]':
                    type === 'console' || type === 'info',
                  'text-black/60 dark:text-white/60': type === 'marketplace',
                })}
              />
            </div>

            {/* Content area with right margin for balance */}
            <div className="mr-1 min-w-0 flex-1 space-y-2 sm:mr-4">
              <AlertTitle className="-mt-0.5 flex min-w-0 items-center justify-between gap-3">
                <span>
                  {type === 'error'
                    ? 'Error'
                    : type === 'marketplace'
                      ? 'Marketplace'
                      : type === 'info'
                        ? 'Info'
                        : 'Console'}
                </span>

                {/* Close button - show if explicitly enabled or for persistent notifications */}
                {(options?.showCloseButton === true ||
                  (options?.showCloseButton === undefined && options?.isPersistent)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="smoky-glass-chip h-6 w-6 rounded-[8px] border border-black/[0.08] bg-transparent opacity-80 transition-opacity hover:bg-transparent hover:opacity-100 dark:border-white/[0.08]"
                    onClick={() => onHide(id)}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                )}
              </AlertTitle>

              <AlertDescription className="min-w-0 space-y-4">
                {/* Message with auto-expanding and max height */}
                <p className="max-h-[300px] overflow-y-auto whitespace-normal break-words [overflow-wrap:anywhere]">
                  {message}
                </p>

                {/* Optional sections with copyable content */}
                {options?.sections?.map((section, index) => (
                  <div key={index} className="space-y-1.5">
                    <div className="text-xs font-medium text-muted-foreground">{section.label}</div>

                    {/* Copyable code block with max height */}
                    <div className="smoky-glass-pane group relative min-w-0 rounded-[10px] border border-black/[0.08] bg-transparent transition-colors hover:border-black/[0.12] dark:border-white/[0.08] dark:hover:border-white/[0.12]">
                      <pre className="max-h-[300px] max-w-full select-text overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words p-3 font-mono text-xs [overflow-wrap:anywhere]">
                        {section.content}
                      </pre>
                      <CopyButton text={section.content} />
                    </div>
                  </div>
                ))}
              </AlertDescription>
            </div>
          </div>
        )}
      </Alert>

      {/* Delete API confirmation dialog */}
      <DeleteApiConfirmation
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteApi}
      />
    </>
  )
}
