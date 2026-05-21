import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Module from 'node:module'
// Now import the module under test (after the loader patch is installed)
import { handleWorkflowActions } from '../copilot-workflow-actions'

// ─── Mock modules loaded via require() inside the module under test ─────────
type Block = {
  id: string
  type: string
  name?: string
  position?: { x: number; y: number }
}

type Edge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: string
}

type WorkflowState = {
  blocks: Record<string, Block>
  edges: Edge[]
  addBlock: (id: string, type: string, name: string, position: { x: number; y: number }) => void
  removeBlock: (id: string) => void
  addEdge: (edge: Edge) => void
  removeEdge: (id: string) => void
  updateBlockPosition: (id: string, position: { x: number; y: number }) => void
}

type SubBlockState = {
  values: Record<string, Record<string, any>>
  setValue: (blockId: string, subBlockId: string, value: any) => void
  getValue: (blockId: string, subBlockId: string) => any
}

const workflowState: WorkflowState = {
  blocks: {},
  edges: [],
  addBlock: vi.fn((id, type, name, position) => {
    workflowState.blocks[id] = { id, type, name, position }
  }),
  removeBlock: vi.fn((id) => {
    delete workflowState.blocks[id]
  }),
  addEdge: vi.fn((edge) => {
    workflowState.edges.push(edge)
  }),
  removeEdge: vi.fn((id) => {
    workflowState.edges = workflowState.edges.filter((e) => e.id !== id)
  }),
  updateBlockPosition: vi.fn((id, position) => {
    if (workflowState.blocks[id]) workflowState.blocks[id].position = position
  }),
}

const subBlockState: SubBlockState = {
  values: {},
  setValue: vi.fn((blockId, subBlockId, value) => {
    if (!subBlockState.values[blockId]) subBlockState.values[blockId] = {}
    subBlockState.values[blockId][subBlockId] = value
  }),
  getValue: vi.fn((blockId, subBlockId) => subBlockState.values[blockId]?.[subBlockId]),
}

const useWorkflowStore = {
  getState: () => workflowState,
}

const useSubBlockStore = {
  getState: () => subBlockState,
}

vi.mock('@/stores/workflows/workflow/store', () => ({ useWorkflowStore }))
vi.mock('@/stores/workflows/subblock/store', () => ({ useSubBlockStore }))
vi.mock('@/blocks', () => ({
  getBlock: () => ({
    subBlocks: [
      { id: 'systemPrompt', type: 'long-input' },
      { id: 'userPrompt', type: 'short-input' },
    ],
  }),
}))

// Intercept CommonJS require() calls made inside the module under test —
// vi.mock only covers ESM imports, and the source file uses `require()` to
// dynamically load these modules.
const moduleOverrides: Record<string, unknown> = {
  '@/stores/workflows/workflow/store': { useWorkflowStore },
  '@/stores/workflows/subblock/store': { useSubBlockStore },
  '@/blocks': {
    getBlock: () => ({
      subBlocks: [
        { id: 'systemPrompt', type: 'long-input' },
        { id: 'userPrompt', type: 'short-input' },
      ],
    }),
  },
}
const originalLoad = (Module as any)._load
;(Module as any)._load = function patchedLoad(request: string, ...rest: unknown[]) {
  if (Object.prototype.hasOwnProperty.call(moduleOverrides, request)) {
    return moduleOverrides[request]
  }
  return originalLoad.call(this, request, ...rest)
}

// ─── Test utilities ───────────────────────────────────────────────────────────
const resetWorkflow = () => {
  workflowState.blocks = {}
  workflowState.edges = []
  subBlockState.values = {}
  vi.mocked(workflowState.addBlock).mockClear()
  vi.mocked(workflowState.removeBlock).mockClear()
  vi.mocked(workflowState.addEdge).mockClear()
  vi.mocked(workflowState.removeEdge).mockClear()
  vi.mocked(workflowState.updateBlockPosition).mockClear()
  vi.mocked(subBlockState.setValue).mockClear()
  vi.mocked(subBlockState.getValue).mockClear()
}

let uuidCounter = 0
beforeEach(() => {
  resetWorkflow()
  uuidCounter = 0
  const cryptoMock = {
    randomUUID: () => `uuid-${++uuidCounter}`,
  }
  // crypto.randomUUID is read lazily at call time
  vi.stubGlobal('crypto', cryptoMock as unknown as Crypto)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('handleWorkflowActions', () => {
  describe('starter block guards', () => {
    it('blocks adding a starter block', () => {
      handleWorkflowActions([{ name: 'addBlock', parameters: { type: 'starter', id: 'ref1' } }])
      expect(workflowState.addBlock).not.toHaveBeenCalled()
    })

    it('blocks removing a starter block by id match in store', () => {
      workflowState.blocks['s1'] = {
        id: 's1',
        type: 'starter',
        name: 'Starter',
        position: { x: 0, y: 0 },
      }
      handleWorkflowActions([{ name: 'removeBlock', parameters: { id: 's1' } }])
      expect(workflowState.removeBlock).not.toHaveBeenCalled()
      expect(workflowState.blocks['s1']).toBeDefined()
    })

    it('blocks removing a block with id equal to "starter"', () => {
      handleWorkflowActions([{ name: 'removeBlock', parameters: { id: 'starter' } }])
      expect(workflowState.removeBlock).not.toHaveBeenCalled()
    })

    it('blocks removing a block with id starting with "starter_"', () => {
      handleWorkflowActions([{ name: 'removeBlock', parameters: { id: 'starter_xyz' } }])
      expect(workflowState.removeBlock).not.toHaveBeenCalled()
    })
  })

  describe('addBlock', () => {
    it('adds a block with a generated UUID and capitalized default name', () => {
      handleWorkflowActions([{ name: 'addBlock', parameters: { id: 'ref1', type: 'agent' } }])
      expect(workflowState.addBlock).toHaveBeenCalledTimes(1)
      const [id, type, name] = vi.mocked(workflowState.addBlock).mock.calls[0]
      expect(id).toBe('uuid-1')
      expect(type).toBe('agent')
      expect(name).toBe('Agent')
    })

    it('respects the provided name when present', () => {
      handleWorkflowActions([
        {
          name: 'addBlock',
          parameters: { id: 'ref1', type: 'agent', name: 'My Agent' },
        },
      ])
      expect(vi.mocked(workflowState.addBlock).mock.calls[0][2]).toBe('My Agent')
    })

    it('positions new blocks to the right of existing ones', () => {
      workflowState.blocks['existing'] = {
        id: 'existing',
        type: 'api',
        position: { x: 100, y: 50 },
      }
      handleWorkflowActions([{ name: 'addBlock', parameters: { type: 'agent' } }])
      const [, , , pos] = vi.mocked(workflowState.addBlock).mock.calls[0]
      expect(pos.x).toBe(450)
      expect(pos.y).toBe(50)
    })

    it('uses a default position when the canvas is empty', () => {
      handleWorkflowActions([{ name: 'addBlock', parameters: { type: 'agent' } }])
      const [, , , pos] = vi.mocked(workflowState.addBlock).mock.calls[0]
      expect(pos.x).toBe(150)
      expect(pos.y).toBe(100)
    })

    it('converts underscores to spaces when deriving the default name', () => {
      handleWorkflowActions([{ name: 'addBlock', parameters: { type: 'slack_notification' } }])
      expect(vi.mocked(workflowState.addBlock).mock.calls[0][2]).toBe('Slack notification')
    })
  })

  describe('addEdge with reference ID resolution', () => {
    it('resolves AI ref IDs from a prior addBlock in the same batch', () => {
      handleWorkflowActions([
        { name: 'addBlock', parameters: { id: 'ref_a', type: 'agent' } },
        { name: 'addBlock', parameters: { id: 'ref_b', type: 'slack' } },
        {
          name: 'addEdge',
          parameters: { sourceId: 'ref_a', targetId: 'ref_b' },
        },
      ])
      // Expect a new edge with resolved source/target pointing to the UUIDs created.
      const addedEdges = vi.mocked(workflowState.addEdge).mock.calls.map((c) => c[0])
      const userEdge = addedEdges.find((e) => e.source === 'uuid-1' && e.target === 'uuid-2')
      expect(userEdge).toBeDefined()
      expect(userEdge?.sourceHandle).toBe('source')
      expect(userEdge?.targetHandle).toBe('target')
    })

    it('skips edges that already exist between resolved source and target', () => {
      workflowState.blocks['a'] = { id: 'a', type: 'agent', position: { x: 0, y: 0 } }
      workflowState.blocks['b'] = { id: 'b', type: 'slack', position: { x: 300, y: 0 } }
      workflowState.edges.push({
        id: 'existing',
        source: 'a',
        target: 'b',
        sourceHandle: 'source',
        targetHandle: 'target',
      })
      handleWorkflowActions([{ name: 'addEdge', parameters: { sourceId: 'a', targetId: 'b' } }])
      // addEdge should not be called for the duplicate (edgesCreated still increments
      // but store.addEdge is not triggered).
      const addEdgeCalls = vi.mocked(workflowState.addEdge).mock.calls
      const duplicate = addEdgeCalls.find((c) => c[0].source === 'a' && c[0].target === 'b')
      expect(duplicate).toBeUndefined()
    })
  })

  describe('removeEdge', () => {
    it('removes an edge by id', () => {
      workflowState.edges.push({ id: 'e1', source: 'a', target: 'b' })
      workflowState.blocks['a'] = { id: 'a', type: 'agent', position: { x: 0, y: 0 } }
      workflowState.blocks['b'] = { id: 'b', type: 'slack', position: { x: 300, y: 0 } }
      handleWorkflowActions([{ name: 'removeEdge', parameters: { id: 'e1' } }])
      expect(workflowState.removeEdge).toHaveBeenCalledWith('e1')
    })
  })

  describe('removeBlock with chain healing', () => {
    it('removes the block and auto-heals predecessor → successor', () => {
      workflowState.blocks['a'] = { id: 'a', type: 'agent', position: { x: 0, y: 0 } }
      workflowState.blocks['b'] = { id: 'b', type: 'router', position: { x: 300, y: 0 } }
      workflowState.blocks['c'] = { id: 'c', type: 'slack', position: { x: 600, y: 0 } }
      workflowState.edges.push(
        { id: 'e1', source: 'a', target: 'b', sourceHandle: 'source', targetHandle: 'target' },
        { id: 'e2', source: 'b', target: 'c', sourceHandle: 'source', targetHandle: 'target' }
      )

      handleWorkflowActions([{ name: 'removeBlock', parameters: { id: 'b' } }])

      expect(workflowState.removeBlock).toHaveBeenCalledWith('b')
      // Auto-heal edge a → c
      const healed = vi
        .mocked(workflowState.addEdge)
        .mock.calls.find((c) => c[0].source === 'a' && c[0].target === 'c')
      expect(healed).toBeDefined()
    })

    it('does not auto-heal when the AI explicitly added the replacement edge', () => {
      workflowState.blocks['a'] = { id: 'a', type: 'agent', position: { x: 0, y: 0 } }
      workflowState.blocks['b'] = { id: 'b', type: 'router', position: { x: 300, y: 0 } }
      workflowState.blocks['c'] = { id: 'c', type: 'slack', position: { x: 600, y: 0 } }
      workflowState.edges.push(
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' }
      )

      handleWorkflowActions([
        { name: 'removeBlock', parameters: { id: 'b' } },
        { name: 'addEdge', parameters: { sourceId: 'a', targetId: 'c' } },
      ])

      // Only the explicit edge addition (not a duplicate auto-heal).
      const addedAtoC = vi
        .mocked(workflowState.addEdge)
        .mock.calls.filter((c) => c[0].source === 'a' && c[0].target === 'c')
      expect(addedAtoC).toHaveLength(1)
    })
  })

  describe('updateSubBlock', () => {
    it('updates the value when the block exists', () => {
      workflowState.blocks['b1'] = { id: 'b1', type: 'agent', position: { x: 0, y: 0 } }
      handleWorkflowActions([
        {
          name: 'updateSubBlock',
          parameters: { blockId: 'b1', subBlockId: 'systemPrompt', value: 'hello' },
        },
      ])
      expect(subBlockState.setValue).toHaveBeenCalledWith('b1', 'systemPrompt', 'hello')
    })

    it('does nothing when required params are missing', () => {
      handleWorkflowActions([{ name: 'updateSubBlock', parameters: { blockId: 'b1' } }])
      expect(subBlockState.setValue).not.toHaveBeenCalled()
    })

    it('does nothing when the target block does not exist', () => {
      handleWorkflowActions([
        {
          name: 'updateSubBlock',
          parameters: { blockId: 'ghost', subBlockId: 'x', value: 'y' },
        },
      ])
      expect(subBlockState.setValue).not.toHaveBeenCalled()
    })
  })

  describe('repositionBlock', () => {
    it('updates block position using resolved id', () => {
      workflowState.blocks['b1'] = { id: 'b1', type: 'agent', position: { x: 0, y: 0 } }
      handleWorkflowActions([{ name: 'repositionBlock', parameters: { id: 'b1', x: 500, y: 200 } }])
      expect(workflowState.updateBlockPosition).toHaveBeenCalledWith('b1', { x: 500, y: 200 })
    })
  })

  describe('insertBlock', () => {
    it('warns and skips when required params are missing', () => {
      handleWorkflowActions([{ name: 'insertBlock', parameters: { type: 'router' } }])
      expect(workflowState.addBlock).not.toHaveBeenCalled()
    })

    it('inserts a block between after and before, wiring edges and removing the old edge', () => {
      workflowState.blocks['a'] = { id: 'a', type: 'agent', position: { x: 0, y: 0 } }
      workflowState.blocks['b'] = { id: 'b', type: 'slack', position: { x: 600, y: 0 } }
      workflowState.edges.push({
        id: 'e1',
        source: 'a',
        target: 'b',
        sourceHandle: 'source',
        targetHandle: 'target',
      })

      handleWorkflowActions([
        {
          name: 'insertBlock',
          parameters: {
            type: 'router',
            afterBlockId: 'a',
            beforeBlockId: 'b',
          },
        },
      ])

      // Old edge removed
      expect(workflowState.removeEdge).toHaveBeenCalledWith('e1')
      // New block added with midpoint position
      const addBlockCall = vi.mocked(workflowState.addBlock).mock.calls[0]
      expect(addBlockCall[1]).toBe('router')
      expect(addBlockCall[3]).toEqual({ x: 300, y: 0 })
      // Two new edges: a → new, new → b
      const newEdges = vi.mocked(workflowState.addEdge).mock.calls.map((c) => c[0])
      expect(newEdges.some((e) => e.source === 'a' && e.target === addBlockCall[0])).toBe(true)
      expect(newEdges.some((e) => e.source === addBlockCall[0] && e.target === 'b')).toBe(true)
    })

    it('offsets the inserted block by 300 when no beforeBlockId is provided', () => {
      workflowState.blocks['a'] = { id: 'a', type: 'agent', position: { x: 100, y: 50 } }

      handleWorkflowActions([
        {
          name: 'insertBlock',
          parameters: { type: 'router', afterBlockId: 'a' },
        },
      ])

      const addCall = vi.mocked(workflowState.addBlock).mock.calls[0]
      expect(addCall[3]).toEqual({ x: 400, y: 50 })
    })
  })

  describe('addUtilityBlock', () => {
    it('warns and skips when required params are missing', () => {
      handleWorkflowActions([{ name: 'addUtilityBlock', parameters: { type: 'data_table' } }])
      expect(workflowState.addBlock).not.toHaveBeenCalled()
    })

    it('warns when the host block is not found', () => {
      handleWorkflowActions([
        {
          name: 'addUtilityBlock',
          parameters: { type: 'data_table', hostBlockId: 'missing' },
        },
      ])
      expect(workflowState.addBlock).not.toHaveBeenCalled()
    })

    it('attaches a utility block with a utility-edge to its host', () => {
      workflowState.blocks['host'] = {
        id: 'host',
        type: 'agent',
        name: 'Agent',
        position: { x: 200, y: 100 },
      }

      handleWorkflowActions([
        {
          name: 'addUtilityBlock',
          parameters: { type: 'data_table', hostBlockId: 'host', mode: 'read' },
        },
      ])

      expect(workflowState.addBlock).toHaveBeenCalled()
      // Check that edge uses utility-source → utility-target
      const utilityEdge = vi
        .mocked(workflowState.addEdge)
        .mock.calls.find(
          (c) => c[0].sourceHandle === 'utility-source' && c[0].targetHandle === 'utility-target'
        )
      expect(utilityEdge).toBeDefined()
      expect(utilityEdge?.[0].target).toBe('host')
      // Read mode preconfigures operation = query_rows
      expect(subBlockState.setValue).toHaveBeenCalledWith(
        expect.any(String),
        'operation',
        'query_rows'
      )
    })

    it('write-mode data_table sets auto_save and rawData reference', () => {
      workflowState.blocks['host'] = {
        id: 'host',
        type: 'agent',
        name: 'My Agent',
        position: { x: 0, y: 0 },
      }

      handleWorkflowActions([
        {
          name: 'addUtilityBlock',
          parameters: {
            type: 'data_table',
            hostBlockId: 'host',
            mode: 'write',
            injectIntoHost: false,
          },
        },
      ])

      const calls = vi.mocked(subBlockState.setValue).mock.calls
      const operationCall = calls.find((c) => c[1] === 'operation')
      const tableNameCall = calls.find((c) => c[1] === 'tableName')
      const rawDataCall = calls.find((c) => c[1] === 'rawData')
      expect(operationCall?.[2]).toBe('auto_save')
      expect(tableNameCall?.[2]).toBe('myagent')
      expect(rawDataCall?.[2]).toBe('<myagent.response.content>')
    })
  })

  describe('auto-connect fallback', () => {
    it('chains new blocks together when the AI adds blocks but no edges', () => {
      handleWorkflowActions([
        { name: 'addBlock', parameters: { id: 'a', type: 'agent' } },
        { name: 'addBlock', parameters: { id: 'b', type: 'slack' } },
      ])

      // 2 blocks added → expect at least one auto-connect edge between them
      const autoEdge = vi
        .mocked(workflowState.addEdge)
        .mock.calls.find((c) => c[0].source === 'uuid-1' && c[0].target === 'uuid-2')
      expect(autoEdge).toBeDefined()
    })

    it('connects from starter block when present and without outgoing edges', () => {
      workflowState.blocks['s'] = {
        id: 's',
        type: 'starter',
        position: { x: 0, y: 0 },
      }
      handleWorkflowActions([{ name: 'addBlock', parameters: { type: 'agent' } }])

      const newUuid = vi.mocked(workflowState.addBlock).mock.calls[0][0]
      const autoEdge = vi
        .mocked(workflowState.addEdge)
        .mock.calls.find((c) => c[0].source === 's' && c[0].target === newUuid)
      expect(autoEdge).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('swallows errors thrown from downstream store calls', () => {
      vi.mocked(workflowState.addBlock).mockImplementationOnce(() => {
        throw new Error('boom')
      })
      expect(() =>
        handleWorkflowActions([{ name: 'addBlock', parameters: { type: 'agent' } }])
      ).not.toThrow()
    })
  })

  describe('auto-repair', () => {
    it('removes dangling edges pointing to non-existent blocks', () => {
      workflowState.blocks['a'] = { id: 'a', type: 'agent', position: { x: 0, y: 0 } }
      workflowState.edges.push({ id: 'dangling', source: 'a', target: 'ghost' })

      handleWorkflowActions([])

      expect(workflowState.removeEdge).toHaveBeenCalledWith('dangling')
    })

    it('removes self-referencing edges', () => {
      workflowState.blocks['a'] = { id: 'a', type: 'agent', position: { x: 0, y: 0 } }
      workflowState.edges.push({ id: 'self', source: 'a', target: 'a' })

      handleWorkflowActions([])

      expect(workflowState.removeEdge).toHaveBeenCalledWith('self')
    })

    it('removes duplicate edges with identical source/target', () => {
      workflowState.blocks['a'] = { id: 'a', type: 'agent', position: { x: 0, y: 0 } }
      workflowState.blocks['b'] = { id: 'b', type: 'slack', position: { x: 300, y: 0 } }
      workflowState.edges.push(
        { id: 'd1', source: 'a', target: 'b' },
        { id: 'd2', source: 'a', target: 'b' }
      )

      handleWorkflowActions([])

      expect(workflowState.removeEdge).toHaveBeenCalledWith('d2')
    })

    it('spreads overlapping blocks', () => {
      workflowState.blocks['a'] = {
        id: 'a',
        type: 'agent',
        position: { x: 100, y: 100 },
      }
      workflowState.blocks['b'] = {
        id: 'b',
        type: 'slack',
        position: { x: 110, y: 110 },
      }

      handleWorkflowActions([])

      expect(workflowState.updateBlockPosition).toHaveBeenCalledWith(
        'b',
        expect.objectContaining({ x: 400 })
      )
    })
  })
})
