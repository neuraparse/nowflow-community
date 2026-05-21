/**
 * Tests for workflow common state-update action factory.
 * Covers: createStateUpdater behavior with default options and option flags.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStateUpdater } from '@/stores/workflows/common/actions'

const { syncUserAction, syncSpy } = vi.hoisted(() => ({
  syncUserAction: vi.fn(),
  syncSpy: vi.fn(),
}))

vi.mock('@/stores/workflows/sync', () => ({
  workflowSync: {
    syncUserAction,
    sync: syncSpy,
  },
}))

describe('createStateUpdater', () => {
  let safeSet: ReturnType<typeof vi.fn> & ((partial: any) => void)
  let updateLastSaved: ReturnType<typeof vi.fn>
  let pushHistory: ReturnType<typeof vi.fn>
  let get: ReturnType<typeof vi.fn>
  let updater: ReturnType<typeof createStateUpdater>

  beforeEach(() => {
    safeSet = vi.fn() as ReturnType<typeof vi.fn> & ((partial: any) => void)
    updateLastSaved = vi.fn()
    pushHistory = vi.fn()
    get = vi.fn(() => ({ updateLastSaved }) as any)
    syncUserAction.mockClear()
    updater = createStateUpdater(safeSet, get as any, pushHistory as any)
  })

  it('applies the state update via safeSet', () => {
    updater({ blocks: {} } as any)
    expect(safeSet).toHaveBeenCalledWith({ blocks: {} })
  })

  it('pushes history with default message when not skipped', () => {
    const state = { blocks: { a: 1 } } as any
    updater(state)
    expect(pushHistory).toHaveBeenCalledTimes(1)
    expect(pushHistory).toHaveBeenCalledWith(safeSet, get, state, 'Update state')
  })

  it('pushes history with a custom message', () => {
    updater({} as any, { historyMessage: 'Custom' })
    expect(pushHistory).toHaveBeenCalledWith(safeSet, get, {}, 'Custom')
  })

  it('skips history when skipHistory is true', () => {
    updater({} as any, { skipHistory: true })
    expect(pushHistory).not.toHaveBeenCalled()
  })

  it('calls updateLastSaved by default', () => {
    updater({} as any)
    expect(updateLastSaved).toHaveBeenCalledTimes(1)
  })

  it('skips updateLastSaved when skipSave is true', () => {
    updater({} as any, { skipSave: true })
    expect(updateLastSaved).not.toHaveBeenCalled()
  })

  it('syncs to DB via workflowSync.syncUserAction by default', () => {
    updater({} as any)
    expect(syncUserAction).toHaveBeenCalledTimes(1)
  })

  it('skips sync when skipSync is true', () => {
    updater({} as any, { skipSync: true })
    expect(syncUserAction).not.toHaveBeenCalled()
  })

  it('can skip everything except the state update', () => {
    updater({ edges: [] } as any, {
      skipHistory: true,
      skipSync: true,
      skipSave: true,
    })
    expect(safeSet).toHaveBeenCalledWith({ edges: [] })
    expect(pushHistory).not.toHaveBeenCalled()
    expect(updateLastSaved).not.toHaveBeenCalled()
    expect(syncUserAction).not.toHaveBeenCalled()
  })

  it('calls side-effects in the documented order: set → history → save → sync', () => {
    const order: string[] = []
    safeSet.mockImplementation(() => order.push('set'))
    pushHistory.mockImplementation(() => order.push('history'))
    updateLastSaved.mockImplementation(() => order.push('save'))
    syncUserAction.mockImplementation(() => order.push('sync'))

    updater({} as any)
    expect(order).toEqual(['set', 'history', 'save', 'sync'])
  })
})
