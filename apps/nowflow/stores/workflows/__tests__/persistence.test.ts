/**
 * @vitest-environment jsdom
 *
 * Tests for workflow persistence helpers.
 * Covers: saveToStorage / loadFromStorage / removeFromStorage,
 *         saveWorkflowState / loadWorkflowState (strips transient fields),
 *         saveSubblockValues / loadSubblockValues,
 *         saveRegistry / loadRegistry,
 *         cleanupStaleWorkflowData,
 *         initializeStores, setupUnloadPersistence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanupStaleWorkflowData,
  initializeStores,
  loadFromStorage,
  loadRegistry,
  loadSubblockValues,
  loadWorkflowState,
  removeFromStorage,
  saveRegistry,
  saveSubblockValues,
  saveToStorage,
  saveWorkflowState,
  setupUnloadPersistence,
} from '@/stores/workflows/persistence'

// ---- hoisted shared state so vi.mock factories can access them safely -------
const {
  registryState,
  workflowState,
  subblockState,
  registrySetState,
  workflowSetState,
  subblockSetState,
  initializeFromWorkflow,
} = vi.hoisted(() => {
  const registryState = {
    workflows: {} as Record<string, any>,
    activeWorkflowId: null as string | null,
  }
  const workflowState: Record<string, any> = {
    blocks: {},
    edges: [],
    loops: {},
    groups: {},
    selectedNodeIds: [],
    isDeployed: false,
    deployedAt: null,
    history: {},
  }
  const subblockState = {
    workflowValues: {} as Record<string, any>,
  }
  return {
    registryState,
    workflowState,
    subblockState,
    registrySetState: vi.fn((next: any) => {
      Object.assign(registryState, typeof next === 'function' ? next(registryState) : next)
    }),
    workflowSetState: vi.fn((next: any) => {
      Object.assign(workflowState, typeof next === 'function' ? next(workflowState) : next)
    }),
    subblockSetState: vi.fn((next: any) => {
      const resolved = typeof next === 'function' ? next(subblockState) : next
      Object.assign(subblockState, resolved)
    }),
    initializeFromWorkflow: vi.fn(),
  }
})

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  }),
}))

vi.mock('@/stores/workflows/registry/store', () => ({
  useWorkflowRegistry: {
    getState: () => registryState,
    setState: registrySetState,
  },
}))

vi.mock('@/stores/workflows/workflow/store', () => ({
  useWorkflowStore: {
    getState: () => workflowState,
    setState: workflowSetState,
  },
}))

vi.mock('@/stores/workflows/subblock/store', () => ({
  useSubBlockStore: {
    getState: () => ({ ...subblockState, initializeFromWorkflow }),
    setState: subblockSetState,
  },
}))

const resetState = () => {
  localStorage.clear()
  Object.assign(registryState, { workflows: {}, activeWorkflowId: null })
  Object.keys(workflowState).forEach((key) => {
    delete (workflowState as any)[key]
  })
  Object.assign(workflowState, {
    blocks: {},
    edges: [],
    loops: {},
    groups: {},
    selectedNodeIds: [],
    isDeployed: false,
    deployedAt: null,
    history: {},
  })
  Object.keys(subblockState).forEach((key) => {
    delete (subblockState as any)[key]
  })
  subblockState.workflowValues = {}
  registrySetState.mockClear()
  workflowSetState.mockClear()
  subblockSetState.mockClear()
  initializeFromWorkflow.mockClear()
}

beforeEach(resetState)
afterEach(resetState)

describe('saveToStorage / loadFromStorage / removeFromStorage', () => {
  it('round-trips values through localStorage', () => {
    expect(saveToStorage('k', { a: 1 })).toBe(true)
    expect(loadFromStorage<{ a: number }>('k')).toEqual({ a: 1 })
    expect(removeFromStorage('k')).toBe(true)
    expect(loadFromStorage('k')).toBeNull()
  })

  it('returns null when key is missing', () => {
    expect(loadFromStorage('missing')).toBeNull()
  })

  it('returns null when JSON is malformed', () => {
    localStorage.setItem('bad', '{not-json')
    expect(loadFromStorage('bad')).toBeNull()
  })

  it('captures setItem failures and returns false', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(saveToStorage('k', {})).toBe(false)
    spy.mockRestore()
  })
})

describe('saveWorkflowState / loadWorkflowState', () => {
  it('strips transient isNew fields on save and load', () => {
    const state = {
      blocks: {
        a: { id: 'a', type: 't', name: 'A', isNew: true },
      },
      edges: [],
      loops: {},
    }
    saveWorkflowState('w1', state)
    const raw = JSON.parse(localStorage.getItem('workflow-w1')!)
    expect(raw.blocks.a.isNew).toBeUndefined()
    const loaded = loadWorkflowState('w1')
    expect(loaded.blocks.a.isNew).toBeUndefined()
    expect(loaded.blocks.a.name).toBe('A')
  })

  it('returns the raw state when there are no blocks to strip', () => {
    saveWorkflowState('w2', { foo: 1 })
    expect(loadWorkflowState('w2')).toEqual({ foo: 1 })
  })
})

describe('saveSubblockValues / loadSubblockValues', () => {
  it('round-trips values through the subblock key', () => {
    saveSubblockValues('w1', { block: { sub: 'val' } })
    expect(localStorage.getItem('subblock-values-w1')).not.toBeNull()
    expect(loadSubblockValues('w1')).toEqual({ block: { sub: 'val' } })
  })
})

describe('saveRegistry / loadRegistry', () => {
  it('round-trips the registry payload', () => {
    saveRegistry({ w1: { id: 'w1' } })
    expect(loadRegistry()).toEqual({ w1: { id: 'w1' } })
  })
})

describe('cleanupStaleWorkflowData', () => {
  it('removes entries not in valid list', () => {
    const longId = 'longworkflowid123456'
    const otherId = 'anotherworkflow12345'
    localStorage.setItem(`workflow-${longId}`, '{}')
    localStorage.setItem(`subblock-values-${longId}`, '{}')
    localStorage.setItem(`workflow-${otherId}`, '{}')
    cleanupStaleWorkflowData([otherId])
    expect(localStorage.getItem(`workflow-${longId}`)).toBeNull()
    expect(localStorage.getItem(`subblock-values-${longId}`)).toBeNull()
    expect(localStorage.getItem(`workflow-${otherId}`)).not.toBeNull()
  })

  it('skips when valid list is empty and forceCleanup is false', () => {
    const longId = 'longworkflowid123456'
    localStorage.setItem(`workflow-${longId}`, '{}')
    cleanupStaleWorkflowData([])
    expect(localStorage.getItem(`workflow-${longId}`)).not.toBeNull()
  })

  it('cleans even with empty valid list when forceCleanup is true', () => {
    const longId = 'longworkflowid123456'
    localStorage.setItem(`workflow-${longId}`, '{}')
    cleanupStaleWorkflowData([], true)
    expect(localStorage.getItem(`workflow-${longId}`)).toBeNull()
  })

  it('ignores the registry key and similar non-id keys', () => {
    localStorage.setItem('workflow-registry', '{}')
    cleanupStaleWorkflowData([], true)
    expect(localStorage.getItem('workflow-registry')).not.toBeNull()
  })
})

describe('initializeStores', () => {
  it('is a no-op when no registry is stored', () => {
    initializeStores()
    expect(registrySetState).not.toHaveBeenCalled()
    expect(workflowSetState).not.toHaveBeenCalled()
  })

  it('loads registry and hydrates active workflow + subblock values', () => {
    saveRegistry({ w1: { id: 'w1' } })
    saveWorkflowState('w1', {
      blocks: { a: { id: 'a', type: 't', name: 'A' } },
      edges: [],
      loops: {},
    })
    saveSubblockValues('w1', { a: { k: 'v' } })
    registryState.activeWorkflowId = 'w1'

    initializeStores()

    expect(registrySetState).toHaveBeenCalled()
    expect(workflowSetState).toHaveBeenCalled()
    expect(subblockSetState).toHaveBeenCalled()
  })

  it('filters out invalid blocks when hydrating', () => {
    saveRegistry({ w1: { id: 'w1' } })
    saveWorkflowState('w1', {
      blocks: {
        good: { id: 'good', type: 't', name: 'A' },
        bad: { foo: 'only' },
      },
      edges: [],
      loops: {},
    })
    registryState.activeWorkflowId = 'w1'

    initializeStores()

    const call = workflowSetState.mock.calls.at(-1)
    expect(call).toBeDefined()
    const payload = call![0] as any
    expect(payload.blocks.good).toBeDefined()
    expect(payload.blocks.bad).toBeUndefined()
  })

  it('falls back to initializeFromWorkflow when no saved subblock values exist', () => {
    saveRegistry({ w1: { id: 'w1' } })
    saveWorkflowState('w1', {
      blocks: { a: { id: 'a', type: 't', name: 'A' } },
      edges: [],
      loops: {},
    })
    registryState.activeWorkflowId = 'w1'

    initializeStores()

    expect(initializeFromWorkflow).toHaveBeenCalledWith('w1', expect.any(Object))
  })
})

describe('setupUnloadPersistence', () => {
  it('registers a beforeunload listener that saves state', () => {
    registryState.activeWorkflowId = 'w1'
    registryState.workflows = { w1: { id: 'w1' } }
    workflowState.blocks = { a: { id: 'a', type: 't', name: 'A' } }
    subblockState.workflowValues = { w1: { a: { k: 'v' } } }

    const addSpy = vi.spyOn(window, 'addEventListener')
    setupUnloadPersistence()
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))

    const handler = addSpy.mock.calls.find((c) => c[0] === 'beforeunload')![1] as any
    const event: any = { preventDefault: vi.fn(), returnValue: '' }
    handler(event)

    expect(localStorage.getItem('workflow-w1')).not.toBeNull()
    expect(localStorage.getItem('subblock-values-w1')).not.toBeNull()
    expect(localStorage.getItem('workflow-registry')).not.toBeNull()
    expect(event.preventDefault).toHaveBeenCalled()
    addSpy.mockRestore()
  })

  it('does not save workflow state on auth pages', () => {
    registryState.activeWorkflowId = 'w1'
    registryState.workflows = { w1: { id: 'w1' } }

    const original = window.location
    delete window.location
    ;(window as any).location = { pathname: '/login' }

    const addSpy = vi.spyOn(window, 'addEventListener')
    setupUnloadPersistence()
    const handler = addSpy.mock.calls.find((c) => c[0] === 'beforeunload')![1] as any
    const event: any = { preventDefault: vi.fn(), returnValue: '' }
    handler(event)

    expect(localStorage.getItem('workflow-w1')).toBeNull()
    expect(event.preventDefault).not.toHaveBeenCalled()
    ;(window as any).location = original
    addSpy.mockRestore()
  })
})
