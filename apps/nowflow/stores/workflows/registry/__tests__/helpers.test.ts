/**
 * @vitest-environment jsdom
 *
 * Tests for the workflow registry helpers module.
 * Covers createEmptyInteraction, resetWorkflowStores, and
 * cleanupLocalStorageForWorkspace (which reads window/localStorage).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// The helpers module calls `require('./store')` at runtime to dodge a circular
// import. Under vitest's ESM loader the relative `./store` path cannot be
// resolved, so we pre-populate Node's require cache with a stub module so the
// helper's require call succeeds and returns our fake store.
import Module from 'node:module'
import path from 'node:path'
import {
  cleanupLocalStorageForWorkspace,
  createEmptyInteraction,
  resetWorkflowStores,
} from '@/stores/workflows/registry/helpers'

const clearWorkflowVariablesTracking = vi.fn()
const workflowSetState = vi.fn()
const subBlockSetState = vi.fn()
const saveWorkflowState = vi.fn()
const registryGetState = vi.fn()

vi.mock('@/stores/panel/variables/store', () => ({
  clearWorkflowVariablesTracking: (...args: unknown[]) => clearWorkflowVariablesTracking(...args),
}))

vi.mock('@/stores/workflows/subblock/store', () => ({
  useSubBlockStore: {
    setState: (...args: unknown[]) => subBlockSetState(...args),
  },
}))

vi.mock('@/stores/workflows/workflow/store', () => ({
  useWorkflowStore: {
    setState: (...args: unknown[]) => workflowSetState(...args),
  },
}))

vi.mock('@/stores/workflows/persistence', () => ({
  saveWorkflowState: (...args: unknown[]) => saveWorkflowState(...args),
}))

// Lazy require-style store used by cleanupLocalStorageForWorkspace
vi.mock('@/stores/workflows/registry/store', () => ({
  useWorkflowRegistry: {
    getState: () => registryGetState(),
  },
}))

const helpersDir = path.resolve(
  __dirname,
  '..' // up from __tests__ to registry/
)
const storeModulePath = path.join(helpersDir, 'store.js')

const moduleWithResolve = Module as typeof Module & {
  _resolveFilename: (request: string, parent: any, ...rest: any[]) => string
}
const originalResolve = moduleWithResolve._resolveFilename
moduleWithResolve._resolveFilename = function patched(
  request: string,
  parent: any,
  ...rest: any[]
) {
  if (request === './store' && parent?.filename?.includes('registry/helpers')) {
    return storeModulePath
  }
  return originalResolve.call(this, request, parent, ...rest)
}

// Inject a fake module into the require cache at the resolved path.
require.cache[storeModulePath] = {
  id: storeModulePath,
  filename: storeModulePath,
  loaded: true,
  exports: {
    useWorkflowRegistry: {
      getState: () => registryGetState(),
    },
  },
  children: [],
  parent: null,
  path: helpersDir,
  paths: [],
} as any

describe('createEmptyInteraction', () => {
  it('returns the default interaction shape with zeroed counters', () => {
    expect(createEmptyInteraction()).toEqual({
      isDragging: false,
      isEditing: false,
      lastInteractionTime: 0,
      lastDurableChangeTime: 0,
    })
  })

  it('returns a fresh object on each call', () => {
    const a = createEmptyInteraction()
    const b = createEmptyInteraction()
    expect(a).not.toBe(b)
  })
})

describe('resetWorkflowStores', () => {
  beforeEach(() => {
    clearWorkflowVariablesTracking.mockReset()
    workflowSetState.mockReset()
    subBlockSetState.mockReset()
  })

  it('clears variable tracking and resets workflow/subblock stores', () => {
    resetWorkflowStores()

    expect(clearWorkflowVariablesTracking).toHaveBeenCalledTimes(1)
    expect(workflowSetState).toHaveBeenCalledTimes(1)
    expect(subBlockSetState).toHaveBeenCalledTimes(1)

    const workflowArg = workflowSetState.mock.calls[0][0]
    expect(workflowArg.blocks).toEqual({})
    expect(workflowArg.edges).toEqual([])
    expect(workflowArg.loops).toEqual({})
    expect(workflowArg.isDeployed).toBe(false)
    expect(workflowArg.hasActiveSchedule).toBe(false)
    expect(workflowArg.interaction).toMatchObject({
      isDragging: false,
      isEditing: false,
      lastInteractionTime: 0,
      lastDurableChangeTime: 0,
    })
    expect(workflowArg.history.past).toEqual([])
    expect(workflowArg.history.future).toEqual([])
    expect(workflowArg.history.present.action).toBe('Initial state')

    expect(subBlockSetState.mock.calls[0][0]).toEqual({
      workflowValues: {},
      toolParams: {},
    })
  })
})

describe('cleanupLocalStorageForWorkspace', () => {
  beforeEach(() => {
    localStorage.clear()
    registryGetState.mockReset()
    saveWorkflowState.mockReset()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('is a no-op when window is undefined', () => {
    const originalWindow = globalThis.window
    delete (globalThis as any).window

    expect(() => cleanupLocalStorageForWorkspace('ws-1')).not.toThrow()
    expect(registryGetState).not.toHaveBeenCalled()
    ;(globalThis as any).window = originalWindow
  })

  it('removes orphan workflow- and subblock-values- entries when no stored state exists', () => {
    registryGetState.mockReturnValue({ workflows: {} })

    // Orphan subblock entry (no corresponding workflow- key)
    localStorage.setItem('subblock-values-orphan', JSON.stringify({}))

    cleanupLocalStorageForWorkspace('ws-1')

    expect(localStorage.getItem('subblock-values-orphan')).toBeNull()
  })

  it('removes stale workflow entries that belong to the current workspace', () => {
    registryGetState.mockReturnValue({ workflows: {} })

    localStorage.setItem('workflow-stale', JSON.stringify({ workspaceId: 'ws-1', blocks: {} }))

    cleanupLocalStorageForWorkspace('ws-1')

    expect(localStorage.getItem('workflow-stale')).toBeNull()
  })

  it('keeps a workflow entry whose workspaceId differs from the current one', () => {
    registryGetState.mockReturnValue({ workflows: {} })

    const payload = JSON.stringify({ workspaceId: 'ws-other', blocks: {} })
    localStorage.setItem('workflow-keep', payload)

    cleanupLocalStorageForWorkspace('ws-1')

    expect(localStorage.getItem('workflow-keep')).toBe(payload)
  })

  it('skips entries that are not valid JSON', () => {
    registryGetState.mockReturnValue({ workflows: {} })

    localStorage.setItem('workflow-bad', 'not-json')

    expect(() => cleanupLocalStorageForWorkspace('ws-1')).not.toThrow()
    // Bad JSON entries are preserved (the function continues past them).
    expect(localStorage.getItem('workflow-bad')).toBe('not-json')
  })

  it('migrates a workflow whose workspaceId is missing from the workspaces list', () => {
    registryGetState.mockReturnValue({
      workflows: { 'live-id': { id: 'live-id' } },
    })

    localStorage.setItem(
      'workflow-live-id',
      JSON.stringify({ workspaceId: 'deleted-ws', blocks: {} })
    )
    localStorage.setItem('workspaces', JSON.stringify([{ id: 'ws-1' }, { id: 'ws-2' }]))

    cleanupLocalStorageForWorkspace('ws-1')

    expect(saveWorkflowState).toHaveBeenCalledTimes(1)
    const [id, parsed] = saveWorkflowState.mock.calls[0]
    expect(id).toBe('live-id')
    expect(parsed.workspaceId).toBe('ws-1')
  })

  it('does not migrate if the stored workspace still exists', () => {
    registryGetState.mockReturnValue({
      workflows: { 'live-id': { id: 'live-id' } },
    })

    localStorage.setItem(
      'workflow-live-id',
      JSON.stringify({ workspaceId: 'ws-other', blocks: {} })
    )
    localStorage.setItem('workspaces', JSON.stringify([{ id: 'ws-1' }, { id: 'ws-other' }]))

    cleanupLocalStorageForWorkspace('ws-1')

    expect(saveWorkflowState).not.toHaveBeenCalled()
  })

  it('swallows errors from the registry access gracefully', () => {
    registryGetState.mockImplementation(() => {
      throw new Error('registry boom')
    })

    expect(() => cleanupLocalStorageForWorkspace('ws-1')).not.toThrow()
  })
})
