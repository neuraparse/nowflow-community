/**
 * @vitest-environment jsdom
 *
 * Tests for the composed workflow registry Zustand store.
 * Focused on initial state, the lightweight `setLoading` / `setLoadingWorkflow`
 * primitives, and the activeWorkspaceId bootstrapping from localStorage.
 * Action-level behavior is covered in actions.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'

vi.mock('@/stores/safe-storage', () => {
  const mem = new Map<string, string>()
  const storage = {
    getItem: (name: string) => {
      const raw = mem.get(name)
      return raw ? JSON.parse(raw) : null
    },
    setItem: (name: string, value: unknown) => {
      mem.set(name, JSON.stringify(value))
    },
    removeItem: (name: string) => {
      mem.delete(name)
    },
  }
  return {
    safeStorage: storage,
    createSafeStorage: () => storage,
    debouncedSafeStorage: storage,
    createDebouncedStorage: () => storage,
  }
})

// Mock nested workflow / subblock stores so composed actions that touch them
// during construction don't drag the real graph into the tests.
vi.mock('@/stores/workflows/workflow/store', () => ({
  useWorkflowStore: {
    getState: vi.fn(() => ({
      blocks: {},
      edges: [],
      loops: {},
      groups: {},
      selectedNodeIds: [],
      history: { past: [], present: null, future: [] },
      isDeployed: false,
      deployedAt: undefined,
    })),
    setState: vi.fn(),
  },
}))

vi.mock('@/stores/workflows/subblock/store', () => ({
  useSubBlockStore: {
    getState: vi.fn(() => ({
      workflowValues: {},
      initializeFromWorkflow: vi.fn(),
    })),
    setState: vi.fn(),
  },
}))

vi.mock('@/stores/workflows/sync', () => ({
  fetchWorkflowsFromDB: vi.fn(() => Promise.resolve()),
  startWorkspaceSwitch: vi.fn(),
  endWorkspaceSwitch: vi.fn(),
  workflowSync: { sync: vi.fn() },
}))

vi.mock('@/stores/workflows/persistence', () => ({
  loadWorkflowState: vi.fn(() => null),
  saveWorkflowState: vi.fn(),
  saveSubblockValues: vi.fn(),
  saveRegistry: vi.fn(),
  removeFromStorage: vi.fn(),
}))

vi.mock('@/stores/panel/variables/store', () => ({
  clearWorkflowVariablesTracking: vi.fn(),
}))

const INITIAL_STATE = {
  workflows: {},
  activeWorkflowId: null,
  activeWorkspaceId: null,
  creatingWorkflowIds: {},
  pendingCreationIds: {},
  pendingDeletionIds: {},
  isLoading: false,
  isLoadingWorkflow: false,
  error: null,
}

describe('useWorkflowRegistry', () => {
  beforeEach(() => {
    useWorkflowRegistry.setState(INITIAL_STATE as any, false)
  })

  describe('initial state', () => {
    it('exposes the documented default fields', () => {
      const state = useWorkflowRegistry.getState()

      expect(state.workflows).toEqual({})
      expect(state.activeWorkflowId).toBeNull()
      expect(state.creatingWorkflowIds).toEqual({})
      expect(state.pendingCreationIds).toEqual({})
      expect(state.pendingDeletionIds).toEqual({})
      expect(state.isLoading).toBe(false)
      expect(state.isLoadingWorkflow).toBe(false)
      expect(state.error).toBeNull()
    })

    it('wires up the composed action methods', () => {
      const state = useWorkflowRegistry.getState()

      expect(typeof state.setLoading).toBe('function')
      expect(typeof state.setLoadingWorkflow).toBe('function')
      expect(typeof state.setActiveWorkflow).toBe('function')
      expect(typeof state.setActiveWorkspace).toBe('function')
      expect(typeof state.handleWorkspaceDeletion).toBe('function')
      expect(typeof state.createWorkflow).toBe('function')
      expect(typeof state.duplicateWorkflow).toBe('function')
      expect(typeof state.removeWorkflow).toBe('function')
      expect(typeof state.updateWorkflow).toBe('function')
    })
  })

  describe('setLoading', () => {
    it('turns loading on from a clean registry', () => {
      useWorkflowRegistry.getState().setLoading(true)
      expect(useWorkflowRegistry.getState().isLoading).toBe(true)
    })

    it('turns loading off regardless of workflow count', () => {
      useWorkflowRegistry.setState({
        isLoading: true,
        workflows: { a: { id: 'a', name: 'A', color: '#fff', lastModified: new Date() } as any },
      })
      useWorkflowRegistry.getState().setLoading(false)
      expect(useWorkflowRegistry.getState().isLoading).toBe(false)
    })

    it('does not flip loading ON when workflows already exist in the registry', () => {
      useWorkflowRegistry.setState({
        isLoading: false,
        workflows: { a: { id: 'a', name: 'A', color: '#fff', lastModified: new Date() } as any },
      })
      useWorkflowRegistry.getState().setLoading(true)
      expect(useWorkflowRegistry.getState().isLoading).toBe(false)
    })
  })

  describe('setLoadingWorkflow', () => {
    it('updates isLoadingWorkflow', () => {
      useWorkflowRegistry.getState().setLoadingWorkflow(true)
      expect(useWorkflowRegistry.getState().isLoadingWorkflow).toBe(true)

      useWorkflowRegistry.getState().setLoadingWorkflow(false)
      expect(useWorkflowRegistry.getState().isLoadingWorkflow).toBe(false)
    })
  })

  describe('activeWorkspaceId bootstrap', () => {
    it('reads active-workspace-id from localStorage when the module loads (jsdom)', async () => {
      // Pre-seed localStorage then re-import the module fresh to exercise the
      // initialization branch that reads from localStorage.
      localStorage.setItem('active-workspace-id', 'ws-from-storage')
      vi.resetModules()

      const mod = await import('@/stores/workflows/registry/store')
      expect(mod.useWorkflowRegistry.getState().activeWorkspaceId).toBe('ws-from-storage')

      // Cleanup so other suites see a clean slate.
      localStorage.removeItem('active-workspace-id')
    })
  })
})
