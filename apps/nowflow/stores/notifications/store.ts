import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Notification, NotificationOptions, NotificationStore } from './types'

const STORAGE_KEY = 'workflow-notifications'
// Maximum number of notifications to keep across all workflows
const MAX_NOTIFICATIONS = 50
// Default notification display time before fading (45 seconds)
export const NOTIFICATION_TIMEOUT = 45000
// Maximum number of visible notifications at once
export const MAX_VISIBLE_NOTIFICATIONS = 5

// Track active timers to prevent race conditions
const notificationTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Helper to load persisted notifications
const loadPersistedNotifications = (): Notification[] => {
  if (typeof window === 'undefined') return []
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved ? JSON.parse(saved).slice(0, MAX_NOTIFICATIONS) : []
}

// Helper to save notifications to localStorage
const persistNotifications = (notifications: Notification[]) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)))
}

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    (set, get) => ({
      notifications: loadPersistedNotifications(),

      addNotification: (type, message, workflowId, options: NotificationOptions = {}) => {
        // Only create notifications on the client side
        if (typeof window === 'undefined') return ''

        // Validate and normalize timeout (min: 1000ms, max: 300000ms = 5 minutes)
        let validatedTimeout = options.timeout
        if (validatedTimeout !== undefined) {
          if (validatedTimeout < 1000) {
            validatedTimeout = 1000 // Minimum 1 second
          } else if (validatedTimeout > 300000) {
            validatedTimeout = 300000 // Maximum 5 minutes
          }
        }

        const normalizedOptions: NotificationOptions = {
          ...options,
          timeout: validatedTimeout,
          context: options.context ?? 'workflow',
        }

        const notification: Notification = {
          id: crypto.randomUUID(),
          type,
          message,
          timestamp: Date.now(),
          isVisible: true,
          read: false,
          isFading: false,
          workflowId,
          options: normalizedOptions,
        }

        set((state) => {
          // Add new notification at the start and limit total count
          let newNotifications = [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS)

          // Check if we need to auto-fade older notifications if we exceed the limit
          const workflowVisibleCount = get().getVisibleNotificationCount(workflowId)

          if (workflowVisibleCount > MAX_VISIBLE_NOTIFICATIONS) {
            // Find the oldest non-persistent visible notification from this workflow to fade out
            newNotifications = newNotifications.map((n, index) => {
              // Don't touch the newly added notification
              if (index === 0) return n

              // Only target notifications from the same workflow that are visible, not persistent, and not already fading
              if (
                n.workflowId === workflowId &&
                n.isVisible &&
                !n.options?.isPersistent &&
                !n.isFading
              ) {
                // Mark it as fading - the oldest one will be the first we encounter
                return { ...n, isFading: true }
              }

              return n
            })
          }

          persistNotifications(newNotifications)
          return { notifications: newNotifications }
        })

        // If not persistent, start the fade timer immediately
        if (!normalizedOptions.isPersistent) {
          // Use custom timeout if provided, otherwise use default
          const timeoutDuration = normalizedOptions.timeout ?? NOTIFICATION_TIMEOUT

          const timerId = setTimeout(() => {
            // Start fade out animation
            set((state) => {
              const newNotifications = state.notifications.map((n) =>
                n.id === notification.id ? { ...n, isFading: true } : n
              )
              persistNotifications(newNotifications)
              return { notifications: newNotifications }
            })
            // Clean up timer tracking
            notificationTimers.delete(notification.id)
          }, timeoutDuration)

          // Track timer to prevent race conditions
          notificationTimers.set(notification.id, timerId)
        }

        return notification.id
      },

      hideNotification: (id) =>
        set((state) => {
          // Clear timer when hiding notification
          const existingTimer = notificationTimers.get(id)
          if (existingTimer) {
            clearTimeout(existingTimer)
            notificationTimers.delete(id)
          }

          const newNotifications = state.notifications.map((n) =>
            n.id === id ? { ...n, isVisible: false, read: true, isFading: false } : n
          )
          persistNotifications(newNotifications)
          return { notifications: newNotifications }
        }),

      setNotificationFading: (id) =>
        set((state) => {
          const newNotifications = state.notifications.map((n) =>
            n.id === id ? { ...n, isFading: true } : n
          )
          persistNotifications(newNotifications)
          return { notifications: newNotifications }
        }),

      showNotification: (id) =>
        set((state) => {
          // Find the notification first to ensure it exists
          const notification = state.notifications.find((n) => n.id === id)
          if (!notification) return { notifications: state.notifications }

          // Update the notification in place without changing its position
          const newNotifications = state.notifications.map((n) => {
            if (n.id === id) {
              // Only update visibility state, preserve timestamp and position
              return {
                ...n,
                isVisible: true,
                read: false,
                isFading: false,
              }
            }
            return n
          })

          // Check if we need to auto-fade older notifications due to the limit
          const workflowId = notification.workflowId
          const workflowVisibleCount = get().getVisibleNotificationCount(workflowId)

          let updatedNotifications = [...newNotifications]

          if (workflowVisibleCount > MAX_VISIBLE_NOTIFICATIONS) {
            // Find the oldest non-persistent visible notification to fade out
            updatedNotifications = updatedNotifications.map((n) => {
              // Don't touch the newly shown notification
              if (n.id === id) return n

              // Only target notifications from the same workflow that are visible, not persistent, and not already fading
              if (
                n.workflowId === workflowId &&
                n.isVisible &&
                !n.options?.isPersistent &&
                !n.isFading
              ) {
                // Mark it as fading - the oldest one will be the first we encounter
                return { ...n, isFading: true }
              }

              return n
            })
          }

          // If notification is not persistent, restart the fade timer
          if (!notification.options?.isPersistent) {
            // Clear any existing timer for this notification to prevent race conditions
            const existingTimer = notificationTimers.get(id)
            if (existingTimer) {
              clearTimeout(existingTimer)
              notificationTimers.delete(id)
            }

            // Use custom timeout if provided, otherwise use default
            const timeoutDuration = notification.options?.timeout ?? NOTIFICATION_TIMEOUT

            const timerId = setTimeout(() => {
              // Start fade out animation
              set((state) => {
                const newNotifications = state.notifications.map((n) =>
                  n.id === id ? { ...n, isFading: true } : n
                )
                persistNotifications(newNotifications)
                return { notifications: newNotifications }
              })
              // Clean up timer tracking
              notificationTimers.delete(id)
            }, timeoutDuration)

            // Track the new timer
            notificationTimers.set(id, timerId)
          }

          persistNotifications(updatedNotifications)
          return { notifications: updatedNotifications }
        }),

      markAsRead: (id) =>
        set((state) => {
          const newNotifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          )
          persistNotifications(newNotifications)
          return { notifications: newNotifications }
        }),

      markAllAsRead: (workflowId) =>
        set((state) => {
          const newNotifications = state.notifications.map((n) =>
            n.workflowId === workflowId ? { ...n, read: true } : n
          )
          persistNotifications(newNotifications)
          return { notifications: newNotifications }
        }),

      removeNotification: (id) =>
        set((state) => {
          const newNotifications = state.notifications.filter((n) => n.id !== id)
          persistNotifications(newNotifications)
          return { notifications: newNotifications }
        }),

      clearNotifications: () => {
        persistNotifications([])
        set({ notifications: [] })
      },

      getWorkflowNotifications: (workflowId) => {
        return get().notifications.filter((n) => n.workflowId === workflowId)
      },

      getVisibleNotificationCount: (workflowId) => {
        if (!workflowId) return 0

        return get().notifications.filter(
          (n) => n.workflowId === workflowId && n.isVisible && !n.read
        ).length
      },
    }),
    { name: 'notification-store' }
  )
)
