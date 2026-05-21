/**
 * Tests for the custom-tools Zustand store.
 * Covers: initial state, local CRUD (addTool/updateTool/removeTool),
 * selectors (getTool/getAllTools), and server sync (loadCustomTools/sync)
 * with mocked fetch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCustomToolsStore } from '@/stores/custom-tools/store'
import type { CustomToolDefinition } from '@/stores/custom-tools/types'

vi.mock('@/stores/safe-storage', () => ({
  safeStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

type FetchMock = ReturnType<typeof vi.fn>

function mockJsonResponse(body: unknown, init: Partial<Response> = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: async () => body,
  } as unknown as Response
}

function buildToolInput(overrides: Partial<CustomToolDefinition> = {}) {
  return {
    title: 'My Tool',
    schema: {
      type: 'function',
      function: {
        name: 'my_tool',
        description: 'desc',
        parameters: { type: 'object', properties: {} },
      },
    },
    code: 'return 1',
    ...overrides,
  } as Omit<CustomToolDefinition, 'id' | 'createdAt' | 'updatedAt'>
}

describe('useCustomToolsStore', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    useCustomToolsStore.setState(
      (prev) => ({
        ...prev,
        tools: {},
        isLoading: false,
        error: null,
      }),
      true
    )

    // Default: successful empty sync/load
    fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ data: [] }))
    vi.stubGlobal('fetch', fetchMock)

    // Ensure crypto.randomUUID is available and deterministic-ish
    let i = 0
    vi.stubGlobal('crypto', {
      ...(globalThis.crypto ?? {}),
      randomUUID: () => `uuid-${++i}`,
    })
  })

  describe('initial state', () => {
    it('has empty tools and no loading/error', () => {
      const state = useCustomToolsStore.getState()
      expect(state.tools).toEqual({})
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('addTool', () => {
    it('returns a generated id and inserts the tool', () => {
      const id = useCustomToolsStore.getState().addTool(buildToolInput())
      expect(id).toBe('uuid-1')
      const tool = useCustomToolsStore.getState().tools[id]
      expect(tool).toBeDefined()
      expect(tool.title).toBe('My Tool')
      expect(tool.id).toBe('uuid-1')
      expect(typeof tool.createdAt).toBe('string')
    })

    it('triggers a sync POST with the current tools', async () => {
      useCustomToolsStore.getState().addTool(buildToolInput({ title: 'A' }))
      // sync is fire-and-forget; flush microtasks
      await Promise.resolve()
      await Promise.resolve()
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/tools/custom',
        expect.objectContaining({ method: 'POST' })
      )
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
      expect(body.tools).toHaveLength(1)
      expect(body.tools[0].title).toBe('A')
    })

    it('adding multiple tools preserves all of them', () => {
      const id1 = useCustomToolsStore.getState().addTool(buildToolInput({ title: 'One' }))
      const id2 = useCustomToolsStore.getState().addTool(buildToolInput({ title: 'Two' }))
      const tools = useCustomToolsStore.getState().tools
      expect(Object.keys(tools)).toHaveLength(2)
      expect(tools[id1].title).toBe('One')
      expect(tools[id2].title).toBe('Two')
    })
  })

  describe('updateTool', () => {
    it('returns false if tool does not exist and leaves state untouched', () => {
      const result = useCustomToolsStore.getState().updateTool('missing', { title: 'X' })
      expect(result).toBe(false)
      expect(useCustomToolsStore.getState().tools).toEqual({})
    })

    it('merges updates, stamps updatedAt, preserves id/createdAt', () => {
      const id = useCustomToolsStore.getState().addTool(buildToolInput({ title: 'Old' }))
      const originalCreatedAt = useCustomToolsStore.getState().tools[id].createdAt

      const result = useCustomToolsStore.getState().updateTool(id, { title: 'New' })
      expect(result).toBe(true)

      const tool = useCustomToolsStore.getState().tools[id]
      expect(tool.title).toBe('New')
      expect(tool.id).toBe(id)
      expect(tool.createdAt).toBe(originalCreatedAt)
      expect(typeof tool.updatedAt).toBe('string')
    })
  })

  describe('removeTool', () => {
    it('deletes an existing tool', () => {
      const id = useCustomToolsStore.getState().addTool(buildToolInput())
      useCustomToolsStore.getState().removeTool(id)
      expect(useCustomToolsStore.getState().tools[id]).toBeUndefined()
    })

    it('is a no-op when the id does not exist', () => {
      useCustomToolsStore.getState().addTool(buildToolInput())
      const before = { ...useCustomToolsStore.getState().tools }
      useCustomToolsStore.getState().removeTool('does-not-exist')
      expect(useCustomToolsStore.getState().tools).toEqual(before)
    })
  })

  describe('selectors', () => {
    it('getTool returns the matching tool or undefined', () => {
      const id = useCustomToolsStore.getState().addTool(buildToolInput({ title: 'Hello' }))
      expect(useCustomToolsStore.getState().getTool(id)?.title).toBe('Hello')
      expect(useCustomToolsStore.getState().getTool('missing')).toBeUndefined()
    })

    it('getAllTools returns an array of all tools', () => {
      useCustomToolsStore.getState().addTool(buildToolInput({ title: 'A' }))
      useCustomToolsStore.getState().addTool(buildToolInput({ title: 'B' }))
      const all = useCustomToolsStore.getState().getAllTools()
      expect(all).toHaveLength(2)
      expect(all.map((t) => t.title).sort()).toEqual(['A', 'B'])
    })
  })

  describe('loadCustomTools', () => {
    it('fetches and stores tools keyed by id on success', async () => {
      const serverTools = [
        {
          id: 'abc',
          title: 'Server Tool',
          schema: {
            type: 'function',
            function: { name: 'st', parameters: { type: 'object', properties: {} } },
          },
          code: 'return 2',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ]
      fetchMock.mockResolvedValueOnce(mockJsonResponse({ data: serverTools }))

      await useCustomToolsStore.getState().loadCustomTools()

      const state = useCustomToolsStore.getState()
      expect(fetchMock).toHaveBeenCalledWith('/api/tools/custom')
      expect(state.tools.abc).toBeDefined()
      expect(state.tools.abc.title).toBe('Server Tool')
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('clears tools silently on 401 Unauthorized', async () => {
      useCustomToolsStore.setState({ tools: { existing: { id: 'existing' } as any } })
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse(null, { ok: false, status: 401, statusText: 'Unauthorized' })
      )

      await useCustomToolsStore.getState().loadCustomTools()

      const state = useCustomToolsStore.getState()
      expect(state.tools).toEqual({})
      expect(state.error).toBeNull()
      expect(state.isLoading).toBe(false)
    })

    it('clears tools silently on 5xx server errors', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse(null, { ok: false, status: 500, statusText: 'Server Error' })
      )

      await useCustomToolsStore.getState().loadCustomTools()

      const state = useCustomToolsStore.getState()
      expect(state.tools).toEqual({})
      expect(state.error).toBeNull()
      expect(state.isLoading).toBe(false)
    })

    it('sets error when response shape is invalid', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({ data: 'not-an-array' }))

      await useCustomToolsStore.getState().loadCustomTools()

      const state = useCustomToolsStore.getState()
      expect(state.error).toBe('Invalid response format')
      expect(state.isLoading).toBe(false)
    })

    it('sets error for non-ok non-auth, non-5xx responses', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse(null, { ok: false, status: 400, statusText: 'Bad Request' })
      )

      await useCustomToolsStore.getState().loadCustomTools()

      const state = useCustomToolsStore.getState()
      expect(state.error).toContain('Bad Request')
      expect(state.isLoading).toBe(false)
    })

    it('sets error when an individual tool has an invalid shape', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({ data: [{ id: 'a' /* missing title/schema/code */ }] })
      )

      await useCustomToolsStore.getState().loadCustomTools()

      const state = useCustomToolsStore.getState()
      expect(state.error).toMatch(/Invalid tool format/)
      expect(state.isLoading).toBe(false)
    })
  })

  describe('sync', () => {
    it('POSTs tools to the server and then reloads', async () => {
      useCustomToolsStore.setState({
        tools: {
          t1: {
            id: 't1',
            title: 'Tool 1',
            schema: {
              type: 'function',
              function: { name: 't1', parameters: { type: 'object', properties: {} } },
            },
            code: 'return 1',
            createdAt: '2024-01-01T00:00:00Z',
          },
        },
      })

      fetchMock
        // POST sync
        .mockResolvedValueOnce(mockJsonResponse({ ok: true }))
        // subsequent GET load
        .mockResolvedValueOnce(mockJsonResponse({ data: [] }))

      await useCustomToolsStore.getState().sync()
      // loadCustomTools is fire-and-forget from within sync; flush microtasks
      await Promise.resolve()
      await Promise.resolve()

      expect(fetchMock.mock.calls[0][0]).toBe('/api/tools/custom')
      expect(fetchMock.mock.calls[0][1]?.method).toBe('POST')
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
      expect(body.tools).toHaveLength(1)
      expect(body.tools[0].id).toBe('t1')

      expect(useCustomToolsStore.getState().isLoading).toBe(false)
      expect(useCustomToolsStore.getState().error).toBeNull()
    })

    it('sets error when the POST fails', async () => {
      fetchMock.mockReset()
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({ error: 'bad' }, { ok: false, status: 500, statusText: 'Server Error' })
      )
      vi.stubGlobal('fetch', fetchMock)

      await useCustomToolsStore.getState().sync()

      const state = useCustomToolsStore.getState()
      expect(state.error).toContain('Failed to sync custom tools')
      expect(state.isLoading).toBe(false)
    })

    it('sets error when fetch rejects', async () => {
      fetchMock.mockReset()
      fetchMock.mockRejectedValueOnce(new Error('network down'))
      vi.stubGlobal('fetch', fetchMock)

      await useCustomToolsStore.getState().sync()

      const state = useCustomToolsStore.getState()
      expect(state.error).toBe('network down')
      expect(state.isLoading).toBe(false)
    })
  })
})
