/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

type WorkspacesModule = typeof import('@/hooks/use-workspaces')

const loadModule = async (): Promise<WorkspacesModule> => {
  return await import('@/hooks/use-workspaces')
}

const sampleWorkspaces = [
  {
    id: 'ws_1',
    name: 'Workspace One',
    role: 'owner' as const,
    ownerId: 'user_1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  },
  {
    id: 'ws_2',
    name: 'Workspace Two',
    role: 'editor' as const,
    ownerId: 'user_2',
    createdAt: new Date('2026-01-03T00:00:00Z'),
    updatedAt: new Date('2026-01-04T00:00:00Z'),
  },
]

describe('useWorkspaces', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts in loading state and resolves with fetched workspaces', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      statusText: 'OK',
      json: async () => ({ workspaces: sampleWorkspaces }),
    })

    const { useWorkspaces } = await loadModule()
    const { result } = renderHook(() => useWorkspaces())

    expect(result.current.loading).toBe(true)
    expect(result.current.workspaces).toEqual([])

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/workspaces',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(result.current.workspaces).toEqual(sampleWorkspaces)
    expect(result.current.error).toBeNull()
  })

  it('exposes an error when the response is not ok', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    })

    const { useWorkspaces } = await loadModule()
    const { result } = renderHook(() => useWorkspaces())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toContain('Failed to fetch workspaces')
    expect(result.current.workspaces).toEqual([])
  })

  it('exposes an error when fetch rejects', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'))

    const { useWorkspaces } = await loadModule()
    const { result } = renderHook(() => useWorkspaces())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('offline')
  })

  it('returns cached workspaces across consecutive renders without refetch', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      statusText: 'OK',
      json: async () => ({ workspaces: sampleWorkspaces }),
    })

    const { useWorkspaces } = await loadModule()
    const first = renderHook(() => useWorkspaces())

    await waitFor(() => {
      expect(first.result.current.loading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)

    const second = renderHook(() => useWorkspaces())

    await waitFor(() => {
      expect(second.result.current.loading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(second.result.current.workspaces).toEqual(sampleWorkspaces)
  })

  it('refetch forces a new network request and updates the workspaces list', async () => {
    const updated = [
      {
        ...sampleWorkspaces[0],
        name: 'Workspace One Renamed',
      },
    ]
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        statusText: 'OK',
        json: async () => ({ workspaces: sampleWorkspaces }),
      })
      .mockResolvedValueOnce({
        ok: true,
        statusText: 'OK',
        json: async () => ({ workspaces: updated }),
      })

    const { useWorkspaces } = await loadModule()
    const { result } = renderHook(() => useWorkspaces())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.refetch()
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(result.current.workspaces).toEqual(updated)
    expect(result.current.error).toBeNull()
  })

  it('invalidateWorkspacesCache causes the next render to refetch', async () => {
    const replacement = [
      {
        ...sampleWorkspaces[0],
        id: 'ws_new',
        name: 'Fresh Workspace',
      },
    ]
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        statusText: 'OK',
        json: async () => ({ workspaces: sampleWorkspaces }),
      })
      .mockResolvedValueOnce({
        ok: true,
        statusText: 'OK',
        json: async () => ({ workspaces: replacement }),
      })

    const { useWorkspaces, invalidateWorkspacesCache } = await loadModule()
    const first = renderHook(() => useWorkspaces())

    await waitFor(() => {
      expect(first.result.current.loading).toBe(false)
    })

    act(() => {
      invalidateWorkspacesCache()
    })

    const second = renderHook(() => useWorkspaces())

    await waitFor(() => {
      expect(second.result.current.loading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(second.result.current.workspaces).toEqual(replacement)
  })
})
