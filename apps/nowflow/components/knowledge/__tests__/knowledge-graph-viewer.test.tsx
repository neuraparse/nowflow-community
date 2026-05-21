/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeGraphViewer } from '@/components/knowledge/knowledge-graph-viewer'

// Mock @xyflow/react so the component can render in jsdom without ResizeObserver
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges, onNodeClick, children }: any) => (
    <div data-testid="react-flow">
      <div data-testid="rf-node-count">{nodes.length}</div>
      <div data-testid="rf-edge-count">{edges.length}</div>
      {nodes.map((n: any) => (
        <button
          key={n.id}
          data-testid={`rf-node-${n.id}`}
          onClick={(e) => onNodeClick?.(e, { id: n.id })}
        >
          {n.data.label}
        </button>
      ))}
      {children}
    </div>
  ),
  Background: () => <div data-testid="rf-bg" />,
  Controls: () => <div data-testid="rf-controls" />,
  MarkerType: { ArrowClosed: 'arrowclosed' },
}))

// @xyflow/react css import is a side-effect; stub it
vi.mock('@xyflow/react/dist/style.css', () => ({}))

const originalFetch = global.fetch

function jsonResponse(body: any, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) })
}

describe('KnowledgeGraphViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('shows the initial loading spinner', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as any
    const { container } = render(<KnowledgeGraphViewer sourceId="src-1" />)
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('renders empty state when graph has no nodes', async () => {
    global.fetch = vi.fn(() =>
      jsonResponse({
        stats: {
          nodeCount: 0,
          edgeCount: 0,
          nodeTypes: {},
          relationshipTypes: {},
          avgDegree: 0,
        },
      })
    ) as any

    render(<KnowledgeGraphViewer sourceId="src-1" />)

    await waitFor(() => {
      expect(screen.getByText('No graph data yet')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Build Graph/i })).toBeInTheDocument()
  })

  it('renders stats pills and search-prompt state when node count > 0', async () => {
    global.fetch = vi.fn(() =>
      jsonResponse({
        stats: {
          nodeCount: 12,
          edgeCount: 8,
          nodeTypes: { person: 7, organization: 5 },
          relationshipTypes: {},
          avgDegree: 1.3,
        },
      })
    ) as any

    render(<KnowledgeGraphViewer sourceId="src-1" />)

    await waitFor(() => {
      expect(screen.getByText('12 nodes / 8 edges')).toBeInTheDocument()
    })
    expect(screen.getByText(/person/)).toBeInTheDocument()
    expect(screen.getByText(/organization/)).toBeInTheDocument()
    expect(screen.getByText('Search for entities to visualize the graph')).toBeInTheDocument()
  })

  it('disables the Search button when input is empty and triggers search on click', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('action=stats')) {
        return jsonResponse({
          stats: {
            nodeCount: 3,
            edgeCount: 1,
            nodeTypes: { person: 3 },
            relationshipTypes: {},
            avgDegree: 1,
          },
        })
      }
      if (url.includes('action=query')) {
        return jsonResponse({
          nodes: [
            { id: 'n1', name: 'Alice', type: 'person', properties: {}, metadata: {} },
            { id: 'n2', name: 'Acme', type: 'organization', properties: {}, metadata: {} },
          ],
          edges: [
            {
              id: 'e1',
              sourceNodeId: 'n1',
              targetNodeId: 'n2',
              relationship: 'works_at',
              weight: 0.9,
              properties: {},
            },
          ],
        })
      }
      return jsonResponse({})
    })
    global.fetch = fetchMock as any

    const user = userEvent.setup()
    render(<KnowledgeGraphViewer sourceId="src-1" />)

    await waitFor(() => {
      expect(screen.getByText('3 nodes / 1 edges')).toBeInTheDocument()
    })

    const searchBtn = screen.getByRole('button', { name: 'Search' })
    expect(searchBtn).toBeDisabled()

    const input = screen.getByPlaceholderText('Search entities...')
    await user.type(input, 'alice')
    expect(searchBtn).not.toBeDisabled()

    await user.click(searchBtn)

    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument()
    })
    expect(screen.getByTestId('rf-node-count')).toHaveTextContent('2')
    expect(screen.getByTestId('rf-edge-count')).toHaveTextContent('1')
    // Verify the query URL was hit
    const queryCall = fetchMock.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('action=query')
    )
    expect(queryCall).toBeDefined()
    expect(queryCall![0]).toContain('q=alice')
  })

  it('opens and closes the selected-node detail panel on node click', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes('action=stats')) {
        return jsonResponse({
          stats: {
            nodeCount: 2,
            edgeCount: 0,
            nodeTypes: { person: 2 },
            relationshipTypes: {},
            avgDegree: 0,
          },
        })
      }
      return jsonResponse({
        nodes: [
          {
            id: 'n1',
            name: 'Alice',
            type: 'person',
            properties: { score: 0.42 },
            metadata: {},
          },
        ],
        edges: [],
      })
    }) as any

    const user = userEvent.setup()
    render(<KnowledgeGraphViewer sourceId="src-1" />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search entities...')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Search entities...')
    await user.type(input, 'alice{Enter}')

    await waitFor(() => {
      expect(screen.getByTestId('rf-node-n1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('rf-node-n1'))

    await waitFor(() => {
      // Detail panel shows the "person" type label and the property row
      expect(screen.getByText('person')).toBeInTheDocument()
    })
    // Both the node button (mocked) AND the detail panel <p> render "Alice"
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('score')).toBeInTheDocument()
    expect(screen.getByText('0.42')).toBeInTheDocument()

    // Close panel via the X button (last button without accessible name inside panel)
    const allButtons = screen.getAllByRole('button')
    // The X close button is the one whose parent is the detail panel (nearest to selected node name).
    // Find it by filter: button with empty accessible name that contains the X icon.
    const closeBtn = allButtons.find(
      (b) => b.textContent === '' && b.querySelector('svg') && !b.hasAttribute('disabled')
    )
    expect(closeBtn).toBeDefined()
    await user.click(closeBtn!)

    await waitFor(() => {
      // Node label from ReactFlow remains ("Alice" on the mocked node button), but
      // the detail-panel's standalone "Alice" paragraph is gone. Assert the properties row is gone.
      expect(screen.queryByText('score')).not.toBeInTheDocument()
    })
  })

  it('fires the Build Graph action and refetches stats', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ success: true })
      }
      return jsonResponse({
        stats: {
          nodeCount: 0,
          edgeCount: 0,
          nodeTypes: {},
          relationshipTypes: {},
          avgDegree: 0,
        },
      })
    })
    global.fetch = fetchMock as any

    const user = userEvent.setup()
    render(<KnowledgeGraphViewer sourceId="src-42" />)

    await waitFor(() => {
      expect(screen.getByText('No graph data yet')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Build Graph/i }))

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === 'POST'
      )
      expect(postCall).toBeDefined()
      expect(postCall![0]).toBe('/api/knowledge/src-42/graph')
    })
  })
})
