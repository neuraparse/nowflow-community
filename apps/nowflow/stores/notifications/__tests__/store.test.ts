/**
 * @vitest-environment jsdom
 *
 * Tests for the notification Zustand store.
 * Covers initial state, adding, hiding, showing, marking read,
 * removing and clearing notifications, as well as localStorage
 * persistence and auto-fade timer behavior.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'workflow-notifications'

// Stable UUID counter so each notification id is unique and predictable.
let uuidCounter = 0
vi.stubGlobal('crypto', {
  randomUUID: () => `uuid-${++uuidCounter}`,
})

describe('useNotificationStore', () => {
  let useNotificationStore: typeof import('../store').useNotificationStore
  let NOTIFICATION_TIMEOUT: number
  let MAX_VISIBLE_NOTIFICATIONS: number

  beforeEach(async () => {
    vi.useFakeTimers()
    localStorage.clear()
    uuidCounter = 0
    vi.resetModules()

    const mod = await import('../store')
    useNotificationStore = mod.useNotificationStore
    NOTIFICATION_TIMEOUT = mod.NOTIFICATION_TIMEOUT
    MAX_VISIBLE_NOTIFICATIONS = mod.MAX_VISIBLE_NOTIFICATIONS

    // Reset store state between tests to avoid leakage.
    useNotificationStore.setState({ notifications: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('has an empty notifications array initially', () => {
    expect(useNotificationStore.getState().notifications).toEqual([])
  })

  it('adds a notification with sensible defaults', () => {
    const id = useNotificationStore.getState().addNotification('info', 'Hello', 'wf-1')

    expect(id).toBe('uuid-1')
    const { notifications } = useNotificationStore.getState()
    expect(notifications).toHaveLength(1)
    const n = notifications[0]
    expect(n).toMatchObject({
      id: 'uuid-1',
      type: 'info',
      message: 'Hello',
      workflowId: 'wf-1',
      isVisible: true,
      isFading: false,
      read: false,
    })
    expect(n.options?.context).toBe('workflow')
  })

  it('persists notifications to localStorage', () => {
    useNotificationStore.getState().addNotification('info', 'Hi', 'wf-1')
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].message).toBe('Hi')
  })

  it('clamps timeout option below the minimum (1000ms)', () => {
    useNotificationStore.getState().addNotification('info', 'fast', 'wf', { timeout: 10 })

    const n = useNotificationStore.getState().notifications[0]
    expect(n.options?.timeout).toBe(1000)
  })

  it('clamps timeout option above the maximum (300000ms)', () => {
    useNotificationStore.getState().addNotification('info', 'slow', 'wf', { timeout: 999999 })

    const n = useNotificationStore.getState().notifications[0]
    expect(n.options?.timeout).toBe(300000)
  })

  it('auto-fades a non-persistent notification after the default timeout', () => {
    const id = useNotificationStore.getState().addNotification('info', 'fade me', 'wf-1')

    expect(useNotificationStore.getState().notifications[0].isFading).toBe(false)

    vi.advanceTimersByTime(NOTIFICATION_TIMEOUT)

    const n = useNotificationStore.getState().notifications.find((x) => x.id === id)
    expect(n?.isFading).toBe(true)
  })

  it('does not auto-fade persistent notifications', () => {
    const id = useNotificationStore
      .getState()
      .addNotification('info', 'stay', 'wf-1', { isPersistent: true })

    vi.advanceTimersByTime(NOTIFICATION_TIMEOUT * 2)

    const n = useNotificationStore.getState().notifications.find((x) => x.id === id)
    expect(n?.isFading).toBe(false)
  })

  it('hideNotification marks as hidden and read', () => {
    const id = useNotificationStore.getState().addNotification('info', 'bye', 'wf-1')

    useNotificationStore.getState().hideNotification(id)

    const n = useNotificationStore.getState().notifications[0]
    expect(n.isVisible).toBe(false)
    expect(n.read).toBe(true)
    expect(n.isFading).toBe(false)
  })

  it('setNotificationFading sets isFading=true', () => {
    const id = useNotificationStore
      .getState()
      .addNotification('info', 'x', 'wf-1', { isPersistent: true })

    useNotificationStore.getState().setNotificationFading(id)
    const n = useNotificationStore.getState().notifications[0]
    expect(n.isFading).toBe(true)
  })

  it('showNotification re-shows a hidden notification', () => {
    const id = useNotificationStore
      .getState()
      .addNotification('info', 'x', 'wf-1', { isPersistent: true })

    useNotificationStore.getState().hideNotification(id)
    expect(useNotificationStore.getState().notifications[0].isVisible).toBe(false)

    useNotificationStore.getState().showNotification(id)
    const n = useNotificationStore.getState().notifications[0]
    expect(n.isVisible).toBe(true)
    expect(n.read).toBe(false)
    expect(n.isFading).toBe(false)
  })

  it('showNotification is a no-op for unknown ids', () => {
    useNotificationStore.getState().addNotification('info', 'x', 'wf-1')
    const before = useNotificationStore.getState().notifications
    useNotificationStore.getState().showNotification('does-not-exist')
    const after = useNotificationStore.getState().notifications
    expect(after).toEqual(before)
  })

  it('markAsRead sets a single notification as read', () => {
    const id = useNotificationStore
      .getState()
      .addNotification('info', 'x', 'wf-1', { isPersistent: true })
    useNotificationStore.getState().markAsRead(id)
    expect(useNotificationStore.getState().notifications[0].read).toBe(true)
  })

  it('markAllAsRead only affects notifications for the given workflow', () => {
    const store = useNotificationStore.getState()
    store.addNotification('info', 'a', 'wf-1', { isPersistent: true })
    store.addNotification('info', 'b', 'wf-1', { isPersistent: true })
    store.addNotification('info', 'c', 'wf-2', { isPersistent: true })

    useNotificationStore.getState().markAllAsRead('wf-1')

    const all = useNotificationStore.getState().notifications
    const wf1 = all.filter((n) => n.workflowId === 'wf-1')
    const wf2 = all.filter((n) => n.workflowId === 'wf-2')
    expect(wf1.every((n) => n.read)).toBe(true)
    expect(wf2.every((n) => n.read)).toBe(false)
  })

  it('removeNotification removes a single notification', () => {
    const id = useNotificationStore
      .getState()
      .addNotification('info', 'x', 'wf-1', { isPersistent: true })
    useNotificationStore.getState().removeNotification(id)
    expect(useNotificationStore.getState().notifications).toHaveLength(0)
  })

  it('clearNotifications empties the store and localStorage', () => {
    useNotificationStore.getState().addNotification('info', 'x', 'wf-1', { isPersistent: true })
    useNotificationStore.getState().clearNotifications()

    expect(useNotificationStore.getState().notifications).toEqual([])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string)).toEqual([])
  })

  it('getWorkflowNotifications filters by workflowId', () => {
    const store = useNotificationStore.getState()
    store.addNotification('info', 'a', 'wf-1', { isPersistent: true })
    store.addNotification('info', 'b', 'wf-2', { isPersistent: true })
    store.addNotification('info', 'c', 'wf-1', { isPersistent: true })

    const wf1 = useNotificationStore.getState().getWorkflowNotifications('wf-1')
    expect(wf1).toHaveLength(2)
    expect(wf1.every((n) => n.workflowId === 'wf-1')).toBe(true)
  })

  it('getVisibleNotificationCount counts visible, unread notifications per workflow', () => {
    const store = useNotificationStore.getState()
    const id1 = store.addNotification('info', 'a', 'wf-1', { isPersistent: true })
    store.addNotification('info', 'b', 'wf-1', { isPersistent: true })
    store.addNotification('info', 'c', 'wf-2', { isPersistent: true })

    expect(useNotificationStore.getState().getVisibleNotificationCount('wf-1')).toBe(2)
    expect(useNotificationStore.getState().getVisibleNotificationCount('wf-2')).toBe(1)

    useNotificationStore.getState().hideNotification(id1)
    expect(useNotificationStore.getState().getVisibleNotificationCount('wf-1')).toBe(1)
    expect(useNotificationStore.getState().getVisibleNotificationCount(null)).toBe(0)
  })

  it('fades older visible notifications when exceeding MAX_VISIBLE_NOTIFICATIONS', () => {
    const store = useNotificationStore.getState()
    // The fade logic fires when the OLD state already has more than MAX_VISIBLE
    // visible notifications for the workflow, so we need MAX + 2 additions
    // for the check to trigger on at least one subsequent addition.
    for (let i = 0; i < MAX_VISIBLE_NOTIFICATIONS + 2; i++) {
      store.addNotification('info', `msg-${i}`, 'wf-1')
    }

    const faded = useNotificationStore.getState().notifications.filter((n) => n.isFading)
    expect(faded.length).toBeGreaterThan(0)
  })
})
