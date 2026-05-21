/**
 * Tests for workflow selectors
 */
import { describe, expect, it, vi } from 'vitest'
import {
  selectBlockById,
  selectBlocks,
  selectConnectedBlocks,
  selectDeploymentState,
  selectEdgeById,
  selectEdges,
  selectGroups,
  selectHighlightedConnections,
  selectLoops,
  selectReactFlowEdges,
  selectReactFlowNodes,
  selectSelectedNodeIds,
  selectSidebarState,
  selectWorkflowActions,
  useShallowSelector,
} from '../selectors'

vi.mock('@/blocks', () => ({
  getBlock: (type: string) => ({
    type,
    name: type,
    category: 'tools',
  }),
}))

const makeState = (overrides: Record<string, any> = {}): any => ({
  blocks: {},
  edges: [],
  loops: {},
  groups: {},
  selectedNodeIds: [],
  highlightedNodeId: null,
  highlightedEdgeIds: [],
  selectedBlockForSidebar: null,
  isRightSidebarOpen: false,
  isDeployed: false,
  deployedAt: undefined,
  needsRedeployment: false,
  hasActiveSchedule: false,
  hasActiveWebhook: false,
  addBlock: vi.fn(),
  removeBlock: vi.fn(),
  updateBlockPosition: vi.fn(),
  updateBlockName: vi.fn(),
  addEdge: vi.fn(),
  removeEdge: vi.fn(),
  setSelectedNodes: vi.fn(),
  toggleNodeSelection: vi.fn(),
  addToSelection: vi.fn(),
  clearSelection: vi.fn(),
  highlightConnections: vi.fn(),
  resetHighlightedConnections: vi.fn(),
  toggleRightSidebar: vi.fn(),
  ...overrides,
})

describe('primitive selectors', () => {
  it('selectBlocks returns the blocks map', () => {
    const blocks = { a: { id: 'a' } }
    expect(selectBlocks(makeState({ blocks }))).toBe(blocks)
  })

  it('selectEdges returns the edges array', () => {
    const edges = [{ id: 'e1', source: 'a', target: 'b' }] as any
    expect(selectEdges(makeState({ edges }))).toBe(edges)
  })

  it('selectSelectedNodeIds returns the selected ids', () => {
    const selectedNodeIds = ['a', 'b']
    expect(selectSelectedNodeIds(makeState({ selectedNodeIds }))).toBe(selectedNodeIds)
  })

  it('selectGroups returns groups', () => {
    const groups = { g1: { id: 'g1', nodeIds: ['a', 'b'] } } as any
    expect(selectGroups(makeState({ groups }))).toBe(groups)
  })

  it('selectLoops returns loops', () => {
    const loops = { l1: { id: 'l1', nodes: ['a'], iterations: 3, loopType: 'for' } } as any
    expect(selectLoops(makeState({ loops }))).toBe(loops)
  })
})

describe('composite selectors', () => {
  it('selectHighlightedConnections combines node + edge ids', () => {
    const state = makeState({
      highlightedNodeId: 'a',
      highlightedEdgeIds: ['e1', 'e2'],
    })
    expect(selectHighlightedConnections(state)).toEqual({
      highlightedNodeId: 'a',
      highlightedEdgeIds: ['e1', 'e2'],
    })
  })

  it('selectSidebarState combines sidebar block + open flag', () => {
    const state = makeState({
      selectedBlockForSidebar: 'block-1',
      isRightSidebarOpen: true,
    })
    expect(selectSidebarState(state)).toEqual({
      selectedBlockForSidebar: 'block-1',
      isRightSidebarOpen: true,
    })
  })

  it('selectDeploymentState captures all deployment flags', () => {
    const deployedAt = new Date()
    const state = makeState({
      isDeployed: true,
      deployedAt,
      needsRedeployment: true,
      hasActiveSchedule: true,
      hasActiveWebhook: false,
    })
    expect(selectDeploymentState(state)).toEqual({
      isDeployed: true,
      deployedAt,
      needsRedeployment: true,
      hasActiveSchedule: true,
      hasActiveWebhook: false,
    })
  })
})

describe('factory selectors', () => {
  it('selectBlockById returns the block by id', () => {
    const block = { id: 'a', type: 'agent', name: 'A' }
    const state = makeState({ blocks: { a: block } })
    expect(selectBlockById('a')(state)).toBe(block)
  })

  it('selectBlockById returns undefined for a missing block', () => {
    const state = makeState()
    expect(selectBlockById('nope')(state)).toBeUndefined()
  })

  it('selectEdgeById returns the edge by id', () => {
    const edge = { id: 'e1', source: 'a', target: 'b' } as any
    const state = makeState({ edges: [edge] })
    expect(selectEdgeById('e1')(state)).toBe(edge)
  })

  it('selectEdgeById returns undefined for a missing edge', () => {
    const state = makeState({ edges: [] })
    expect(selectEdgeById('missing')(state)).toBeUndefined()
  })

  it('selectConnectedBlocks returns all blocks connected to target', () => {
    const blocks = {
      a: { id: 'a', type: 'agent', name: 'A' },
      b: { id: 'b', type: 'agent', name: 'B' },
      c: { id: 'c', type: 'agent', name: 'C' },
      d: { id: 'd', type: 'agent', name: 'D' },
    } as any
    const edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
      { id: 'e3', source: 'd', target: 'b' },
    ] as any
    const state = makeState({ blocks, edges })
    const connected = selectConnectedBlocks('b')(state)
    const ids = connected.map((block: any) => block.id).sort()
    expect(ids).toEqual(['a', 'c', 'd'])
  })

  it('selectConnectedBlocks returns empty array when no connections', () => {
    const blocks = { a: { id: 'a' } } as any
    const state = makeState({ blocks, edges: [] })
    expect(selectConnectedBlocks('a')(state)).toEqual([])
  })

  it('selectConnectedBlocks filters out missing block refs', () => {
    const blocks = { a: { id: 'a' } } as any
    const edges = [{ id: 'e1', source: 'a', target: 'ghost' }] as any
    const state = makeState({ blocks, edges })
    expect(selectConnectedBlocks('a')(state)).toEqual([])
  })
})

describe('selectWorkflowActions', () => {
  it('returns the expected bundle of action references', () => {
    const state = makeState()
    const actions = selectWorkflowActions(state)
    expect(actions.addBlock).toBe(state.addBlock)
    expect(actions.removeBlock).toBe(state.removeBlock)
    expect(actions.updateBlockPosition).toBe(state.updateBlockPosition)
    expect(actions.addEdge).toBe(state.addEdge)
    expect(actions.removeEdge).toBe(state.removeEdge)
    expect(actions.setSelectedNodes).toBe(state.setSelectedNodes)
    expect(actions.toggleNodeSelection).toBe(state.toggleNodeSelection)
    expect(actions.clearSelection).toBe(state.clearSelection)
    expect(actions.highlightConnections).toBe(state.highlightConnections)
    expect(actions.resetHighlightedConnections).toBe(state.resetHighlightedConnections)
    expect(actions.toggleRightSidebar).toBe(state.toggleRightSidebar)
  })
})

describe('useShallowSelector', () => {
  it('returns the selector function as-is', () => {
    const selector = (s: any) => s.blocks
    expect(useShallowSelector(selector)).toBe(selector)
  })
})

describe('reactflow selectors', () => {
  it('selectReactFlowNodes maps blocks to rf-node shape', () => {
    const blocks = {
      a: {
        id: 'a',
        type: 'agent',
        name: 'Agent A',
        position: { x: 10, y: 20 },
      },
      b: {
        id: 'b',
        type: 'function',
        name: 'Fn B',
        position: { x: 30, y: 40 },
      },
    } as any
    const nodes = selectReactFlowNodes(makeState({ blocks }))
    expect(nodes).toHaveLength(2)
    const nodeA = nodes.find((n) => n.id === 'a')!
    expect(nodeA.type).toBe('heroStyleBlock')
    expect(nodeA.position).toEqual({ x: 10, y: 20 })
    expect(nodeA.data.type).toBe('agent')
    expect(nodeA.data.name).toBe('Agent A')
    expect(nodeA.data.isActive).toBe(false)
    expect(nodeA.data.isPending).toBe(false)
    expect(nodeA.draggable).toBe(true)
    expect(nodeA.selectable).toBe(true)
  })

  it('selectReactFlowNodes returns [] for empty blocks', () => {
    expect(selectReactFlowNodes(makeState())).toEqual([])
  })

  it('selectReactFlowEdges defaults type to "custom" when unset', () => {
    const edges = [{ id: 'e1', source: 'a', target: 'b' }] as any
    const mapped = selectReactFlowEdges(makeState({ edges }))
    expect(mapped[0].type).toBe('custom')
    expect(mapped[0].animated).toBe(false)
  })

  it('selectReactFlowEdges preserves existing type and animated', () => {
    const edges = [{ id: 'e1', source: 'a', target: 'b', type: 'heroEdge', animated: true }] as any
    const mapped = selectReactFlowEdges(makeState({ edges }))
    expect(mapped[0].type).toBe('heroEdge')
    expect(mapped[0].animated).toBe(true)
  })
})
