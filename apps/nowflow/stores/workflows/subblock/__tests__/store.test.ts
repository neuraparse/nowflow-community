/**
 * @vitest-environment jsdom
 *
 * Tests for subblock store + its local-change tracking helpers.
 * Covers: setValue/getValue/clear, initializeFromWorkflow, syncWithDB,
 *         tool-params actions, env-var resolution,
 *         markLocalChange / hasRecentLocalChange / clearLocalChange /
 *         clearAllLocalChanges / getPendingLocalChanges.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllLocalChanges,
  clearLocalChange,
  getPendingLocalChanges,
  hasRecentLocalChange,
  markLocalChange,
  useSubBlockStore,
} from '@/stores/workflows/subblock/store'

// ---- hoisted shared mocks ---------------------------------------------------
const {
  registry,
  envStore,
  generalStore,
  workflowStore,
  saveSubblockValues,
  loadSubblockValues,
  workflowSync,
  findMatchingEnvVar,
} = vi.hoisted(() => {
  const registry = { activeWorkflowId: 'wf-1' as string | null }
  const envStore = { getVariable: vi.fn() }
  const generalStore = { isAutoFillEnvVarsEnabled: true }
  const workflowStore = {
    blocks: {} as Record<string, any>,
    updateBlock: vi.fn(),
  }
  return {
    registry,
    envStore,
    generalStore,
    workflowStore,
    saveSubblockValues: vi.fn(),
    loadSubblockValues: vi.fn(),
    workflowSync: {
      sync: vi.fn(),
      syncUserAction: vi.fn(),
    },
    findMatchingEnvVar: vi.fn(),
  }
})

vi.mock('@/stores/workflows/registry/store', () => ({
  useWorkflowRegistry: {
    getState: () => registry,
  },
}))

vi.mock('@/stores/settings/environment/store', () => ({
  useEnvironmentStore: {
    getState: () => envStore,
  },
}))

vi.mock('@/stores/settings/general/store', () => ({
  useGeneralStore: {
    getState: () => generalStore,
  },
}))

vi.mock('@/stores/workflows/persistence', () => ({
  saveSubblockValues,
  loadSubblockValues,
}))

vi.mock('@/stores/workflows/sync', () => ({
  workflowSync,
}))

// the subblock store calls `require('../workflow/store')` inside a debounced
// timer — we replace it with a direct path mock so the require finds our mock.
vi.mock('@/stores/workflows/workflow/store', () => ({
  useWorkflowStore: {
    getState: () => workflowStore,
  },
}))

// Mocks the `../workflow/store` specifier used via runtime require
vi.mock('../../workflow/store', () => ({
  useWorkflowStore: {
    getState: () => workflowStore,
  },
}))

// The source file does a runtime `require('../workflow/store')` inside a
// debounced setTimeout. Node's CJS loader can't resolve the TS file, so we
// inject a stub into `require.cache` under the resolved path.
{
  const Module = require('node:module')
  const path = require('node:path')
  const storeDir = path.resolve(__dirname, '..', '..', 'workflow')
  const tsPath = path.join(storeDir, 'store.ts')
  const jsPath = path.join(storeDir, 'store.js')
  const stub = {
    exports: {
      useWorkflowStore: {
        getState: () => workflowStore,
      },
    },
    loaded: true,
    id: jsPath,
    filename: jsPath,
    paths: Module._nodeModulePaths(storeDir),
    children: [],
  }
  require.cache[jsPath] = stub as any
  require.cache[tsPath] = { ...stub, id: tsPath, filename: tsPath } as any

  // Patch resolution so require('../workflow/store') returns jsPath even
  // though the actual file is .ts
  const originalResolve = Module._resolveFilename
  Module._resolveFilename = function (request: string, parent: any, ...rest: any[]) {
    if (request === '../workflow/store' || request.endsWith('/workflow/store')) {
      return jsPath
    }
    return originalResolve.call(this, request, parent, ...rest)
  }
}

// The store's subblock/utils re-imports env-store helpers; keep them real by
// passing through the real module but override findMatchingEnvVar.
vi.mock('@/stores/workflows/subblock/utils', async () => {
  const actual = await vi.importActual<any>('@/stores/workflows/subblock/utils')
  return {
    ...actual,
    findMatchingEnvVar,
  }
})

// Avoid zustand `persist` actually serializing to localStorage during tests.
vi.mock('@/stores/safe-storage', () => ({
  debouncedSafeStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  safeStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  createSafeStorage: () => ({
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }),
  createDebouncedStorage: () => ({
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }),
}))

const INITIAL_STATE = useSubBlockStore.getState()

const resetStore = () => {
  useSubBlockStore.setState(
    {
      ...INITIAL_STATE,
      workflowValues: {},
      toolParams: {},
      clearedParams: {},
    },
    true
  )
  registry.activeWorkflowId = 'wf-1'
  generalStore.isAutoFillEnvVarsEnabled = true
  envStore.getVariable.mockReset()
  workflowStore.blocks = {}
  workflowStore.updateBlock.mockClear()
  saveSubblockValues.mockClear()
  loadSubblockValues.mockReset()
  workflowSync.sync.mockClear()
  workflowSync.syncUserAction.mockClear()
  findMatchingEnvVar.mockReset()
  // Clear local-change tracking between tests
  clearAllLocalChanges('wf-1')
  clearAllLocalChanges('wf-2')
}

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('initial state', () => {
  it('exposes empty maps and expected actions', () => {
    const state = useSubBlockStore.getState()
    expect(state.workflowValues).toEqual({})
    expect(state.toolParams).toEqual({})
    expect(state.clearedParams).toEqual({})
    expect(typeof state.setValue).toBe('function')
    expect(typeof state.getValue).toBe('function')
    expect(typeof state.clear).toBe('function')
    expect(typeof state.initializeFromWorkflow).toBe('function')
    expect(typeof state.syncWithDB).toBe('function')
    expect(typeof state.setToolParam).toBe('function')
    expect(typeof state.resolveToolParamValue).toBe('function')
  })
})

describe('setValue / getValue', () => {
  it('throws when no active workflow', () => {
    registry.activeWorkflowId = null
    expect(() => useSubBlockStore.getState().setValue('b', 's', 'v')).toThrow(/No active workflow/)
  })

  it('stores a value under the active workflow', () => {
    useSubBlockStore.getState().setValue('b1', 's1', 'hello')
    expect(useSubBlockStore.getState().workflowValues['wf-1']['b1']['s1']).toBe('hello')
  })

  it('coerces null to empty string for persistence', () => {
    useSubBlockStore.getState().setValue('b1', 's1', null)
    expect(useSubBlockStore.getState().workflowValues['wf-1']['b1']['s1']).toBe('')
  })

  it('skips work when the value has not changed (reference equality)', () => {
    useSubBlockStore.getState().setValue('b1', 's1', 'same')
    const before = useSubBlockStore.getState().workflowValues
    useSubBlockStore.getState().setValue('b1', 's1', 'same')
    // same reference → short-circuit, workflowValues untouched
    expect(useSubBlockStore.getState().workflowValues).toBe(before)
  })

  it('skips work when the object value is structurally equal', () => {
    useSubBlockStore.getState().setValue('b1', 's1', { a: 1 })
    const snapshot = useSubBlockStore.getState().workflowValues
    useSubBlockStore.getState().setValue('b1', 's1', { a: 1 })
    expect(useSubBlockStore.getState().workflowValues).toBe(snapshot)
  })

  it('getValue returns stored value for the active workflow', () => {
    useSubBlockStore.getState().setValue('b1', 's1', 'hello')
    expect(useSubBlockStore.getState().getValue('b1', 's1')).toBe('hello')
  })

  it('getValue returns null when no active workflow or value is missing', () => {
    expect(useSubBlockStore.getState().getValue('missing', 'sub')).toBeNull()
    registry.activeWorkflowId = null
    expect(useSubBlockStore.getState().getValue('b', 's')).toBeNull()
  })

  it('marks local change and schedules debounced persistence + DB sync for user edits', () => {
    useSubBlockStore.getState().setValue('b1', 's1', 'user typed')

    // Immediately: local change is tracked, but timers not fired yet
    expect(hasRecentLocalChange('wf-1', 'b1', 's1')).toBe(true)
    expect(saveSubblockValues).not.toHaveBeenCalled()
    expect(workflowSync.syncUserAction).not.toHaveBeenCalled()

    // After 500ms persist timer fires
    vi.advanceTimersByTime(500)
    expect(saveSubblockValues).toHaveBeenCalledWith('wf-1', expect.any(Object))

    // After 800ms total (300ms more), DB sync fires
    vi.advanceTimersByTime(300)
    expect(workflowSync.syncUserAction).toHaveBeenCalled()
  })

  it('skips local tracking, persistence, and sync for remote updates', () => {
    useSubBlockStore.getState().setValue('b1', 's1', 'remote', { remote: true })
    vi.advanceTimersByTime(2000)
    expect(hasRecentLocalChange('wf-1', 'b1', 's1')).toBe(false)
    expect(saveSubblockValues).not.toHaveBeenCalled()
    expect(workflowSync.syncUserAction).not.toHaveBeenCalled()
  })

  it('calls workflowStore.updateBlock with merged subBlock value after debounce', () => {
    workflowStore.blocks = {
      b1: {
        id: 'b1',
        subBlocks: { s1: { id: 's1', type: 'short-input', value: '' } },
      },
    }
    useSubBlockStore.getState().setValue('b1', 's1', 'final')
    vi.advanceTimersByTime(500)
    expect(workflowStore.updateBlock).toHaveBeenCalledTimes(1)
    const [blockId, updated] = workflowStore.updateBlock.mock.calls[0]
    expect(blockId).toBe('b1')
    expect(updated.subBlocks.s1.value).toBe('final')
  })

  it('creates a minimal workflow subblock when persisting a newly introduced value', () => {
    workflowStore.blocks = {
      b1: {
        id: 'b1',
        subBlocks: {},
      },
    }

    useSubBlockStore.getState().setValue('b1', 'dynamicField', 'final')
    vi.advanceTimersByTime(500)

    expect(workflowStore.updateBlock).toHaveBeenCalledTimes(1)
    const [blockId, updated] = workflowStore.updateBlock.mock.calls[0]
    expect(blockId).toBe('b1')
    expect(updated.subBlocks.dynamicField).toEqual({
      id: 'dynamicField',
      type: 'short-input',
      value: 'final',
    })
  })
})

describe('clear', () => {
  it('empties the active workflow values and triggers immediate sync', () => {
    useSubBlockStore.getState().setValue('b1', 's1', 'v')
    // flush timers so setValue's work is done
    vi.advanceTimersByTime(1000)
    saveSubblockValues.mockClear()
    workflowSync.sync.mockClear()

    useSubBlockStore.getState().clear()
    expect(useSubBlockStore.getState().workflowValues['wf-1']).toEqual({})
    expect(saveSubblockValues).toHaveBeenCalledWith('wf-1', {})
    expect(workflowSync.sync).toHaveBeenCalled()
  })

  it('is a no-op when there is no active workflow', () => {
    registry.activeWorkflowId = null
    useSubBlockStore.getState().clear()
    expect(saveSubblockValues).not.toHaveBeenCalled()
    expect(workflowSync.sync).not.toHaveBeenCalled()
  })
})

describe('initializeFromWorkflow', () => {
  it('loads saved values from localStorage when present', () => {
    loadSubblockValues.mockReturnValue({ b1: { s1: 'saved' } })
    useSubBlockStore.getState().initializeFromWorkflow('wf-2', {})
    expect(useSubBlockStore.getState().workflowValues['wf-2']).toEqual({ b1: { s1: 'saved' } })
    expect(saveSubblockValues).not.toHaveBeenCalled()
  })

  it('initializes from block defaults and persists when nothing saved', () => {
    loadSubblockValues.mockReturnValue(null)
    const blocks = {
      b1: { subBlocks: { s1: { value: 'default' }, s2: { value: null } } },
    }
    useSubBlockStore.getState().initializeFromWorkflow('wf-2', blocks)
    const stored = useSubBlockStore.getState().workflowValues['wf-2']
    expect(stored.b1.s1).toBe('default')
    // null is coerced to empty string
    expect(stored.b1.s2).toBe('')
    expect(saveSubblockValues).toHaveBeenCalledWith('wf-2', stored)
  })

  it('handles legacy blocks without subBlocks', () => {
    loadSubblockValues.mockReturnValue(null)
    const blocks = {
      b1: { id: 'b1', type: 'agent' },
    }

    useSubBlockStore.getState().initializeFromWorkflow('wf-2', blocks)

    expect(useSubBlockStore.getState().workflowValues['wf-2']).toEqual({ b1: {} })
  })
})

describe('syncWithDB debouncing', () => {
  it('calls syncUserAction after the 800ms debounce window', () => {
    useSubBlockStore.getState().syncWithDB()
    expect(workflowSync.syncUserAction).not.toHaveBeenCalled()
    vi.advanceTimersByTime(800)
    expect(workflowSync.syncUserAction).toHaveBeenCalledTimes(1)
  })

  it('resets the timer on subsequent calls', () => {
    useSubBlockStore.getState().syncWithDB()
    vi.advanceTimersByTime(400)
    useSubBlockStore.getState().syncWithDB()
    vi.advanceTimersByTime(400)
    // only 400ms since second call → still pending
    expect(workflowSync.syncUserAction).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(workflowSync.syncUserAction).toHaveBeenCalledTimes(1)
  })
})

describe('tool params', () => {
  it('setToolParam stores the value and triggers DB sync debounce', () => {
    useSubBlockStore.getState().setToolParam('crm', 'apikey', 'secret')
    expect(useSubBlockStore.getState().toolParams.crm.apikey).toBe('secret')
    vi.advanceTimersByTime(800)
    expect(workflowSync.syncUserAction).toHaveBeenCalled()
  })

  it('setToolParam mirrors api key to the base tool', () => {
    useSubBlockStore.getState().setToolParam('crm-create', 'apikey', 'secret')
    expect(useSubBlockStore.getState().toolParams['crm-create'].apikey).toBe('secret')
    expect(useSubBlockStore.getState().toolParams.crm.apikey).toBe('secret')
  })

  it('setToolParam removes param from clearedParams when re-setting', () => {
    useSubBlockStore.getState().markParamAsCleared('crm', 'apikey')
    expect(useSubBlockStore.getState().isParamCleared('crm', 'apikey')).toBe(true)
    useSubBlockStore.getState().setToolParam('crm', 'apikey', 'new')
    expect(useSubBlockStore.getState().isParamCleared('crm', 'apikey')).toBe(false)
  })

  it('markParamAsCleared / unmarkParamAsCleared toggle cleared flag', () => {
    const { markParamAsCleared, unmarkParamAsCleared, isParamCleared } = useSubBlockStore.getState()
    markParamAsCleared('x', 'p')
    expect(isParamCleared('x', 'p')).toBe(true)
    unmarkParamAsCleared('x', 'p')
    expect(isParamCleared('x', 'p')).toBe(false)
  })

  it('getToolParam returns direct match or base-tool match', () => {
    useSubBlockStore.getState().setToolParam('crm', 'apikey', 'k1')
    expect(useSubBlockStore.getState().getToolParam('crm', 'apikey')).toBe('k1')
    // same value propagates to base tool since compound starts with crm
    expect(useSubBlockStore.getState().getToolParam('crm-create', 'apikey')).toBe('k1')
  })

  it('getToolParams returns the tool map or empty object', () => {
    useSubBlockStore.getState().setToolParam('crm', 'apikey', 'k1')
    expect(useSubBlockStore.getState().getToolParams('crm')).toEqual({ apikey: 'k1' })
    expect(useSubBlockStore.getState().getToolParams('missing')).toEqual({})
  })

  it('clearToolParams wipes all tool-related state', () => {
    useSubBlockStore.getState().setToolParam('crm', 'apikey', 'k1')
    useSubBlockStore.getState().markParamAsCleared('crm', 'apikey')
    useSubBlockStore.getState().clearToolParams()
    expect(useSubBlockStore.getState().toolParams).toEqual({})
    expect(useSubBlockStore.getState().clearedParams).toEqual({})
  })

  it('isEnvVarReference delegates to utils', () => {
    expect(useSubBlockStore.getState().isEnvVarReference('{{FOO}}')).toBe(true)
    expect(useSubBlockStore.getState().isEnvVarReference('plain')).toBe(false)
  })
})

describe('resolveToolParamValue', () => {
  it('returns undefined when the specific instance is cleared', () => {
    useSubBlockStore.getState().markParamAsCleared('inst-1', 'apikey')
    const result = useSubBlockStore.getState().resolveToolParamValue('crm', 'apikey', 'inst-1')
    expect(result).toBeUndefined()
  })

  it('returns the stored value directly when it is not an env var reference', () => {
    useSubBlockStore.getState().setToolParam('crm', 'apikey', 'plain-secret')
    const result = useSubBlockStore.getState().resolveToolParamValue('crm', 'apikey')
    expect(result).toBe('plain-secret')
  })

  it('returns env var reference if the variable still exists', () => {
    useSubBlockStore.getState().setToolParam('crm', 'apikey', '{{CRM_KEY}}')
    envStore.getVariable.mockReturnValue('real-val')
    const result = useSubBlockStore.getState().resolveToolParamValue('crm', 'apikey')
    expect(result).toBe('{{CRM_KEY}}')
  })

  it('returns undefined when env var reference points to missing variable', () => {
    useSubBlockStore.getState().setToolParam('crm', 'apikey', '{{CRM_KEY}}')
    envStore.getVariable.mockReturnValue(undefined)
    const result = useSubBlockStore.getState().resolveToolParamValue('crm', 'apikey')
    expect(result).toBeUndefined()
  })

  it('auto-fills an env var reference when none is stored yet', () => {
    findMatchingEnvVar.mockReturnValue('CRM_API_KEY')
    const result = useSubBlockStore.getState().resolveToolParamValue('crm', 'apikey')
    expect(result).toBe('{{CRM_API_KEY}}')
    expect(useSubBlockStore.getState().toolParams.crm.apikey).toBe('{{CRM_API_KEY}}')
  })

  it('returns raw stored value (without env resolution) when auto-fill is disabled', () => {
    generalStore.isAutoFillEnvVarsEnabled = false
    useSubBlockStore.getState().setToolParam('crm', 'apikey', 'plain')
    const result = useSubBlockStore.getState().resolveToolParamValue('crm', 'apikey')
    expect(result).toBe('plain')
  })
})

describe('local-change tracking helpers', () => {
  it('markLocalChange records the change and hasRecentLocalChange returns true', () => {
    markLocalChange('wf-1', 'b', 's')
    expect(hasRecentLocalChange('wf-1', 'b', 's')).toBe(true)
  })

  it('hasRecentLocalChange returns false after the protection window', () => {
    const originalNow = Date.now
    let current = 1_000_000
    Date.now = () => current
    try {
      markLocalChange('wf-1', 'b', 's')
      current += 4000 // > 3000ms
      expect(hasRecentLocalChange('wf-1', 'b', 's')).toBe(false)
    } finally {
      Date.now = originalNow
    }
  })

  it('clearLocalChange removes just that field and cleans empty maps', () => {
    markLocalChange('wf-1', 'b', 's')
    clearLocalChange('wf-1', 'b', 's')
    expect(getPendingLocalChanges('wf-1')).toBeUndefined()
  })

  it('clearAllLocalChanges drops all entries for a workflow', () => {
    markLocalChange('wf-1', 'b1', 's1')
    markLocalChange('wf-1', 'b2', 's2')
    clearAllLocalChanges('wf-1')
    expect(getPendingLocalChanges('wf-1')).toBeUndefined()
  })

  it('getPendingLocalChanges returns the per-block map', () => {
    markLocalChange('wf-1', 'b', 's')
    const changes = getPendingLocalChanges('wf-1')
    expect(changes).toBeDefined()
    expect(changes!['b']['s']).toBeTypeOf('number')
  })
})
