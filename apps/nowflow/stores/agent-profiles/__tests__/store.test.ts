import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAgentProfilesStore } from '@/stores/agent-profiles/store'
import type { AgentProfileDefinition } from '@/stores/agent-profiles/types'

// Mock logger
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock safe-storage to avoid touching localStorage in node env
vi.mock('@/stores/safe-storage', () => ({
  safeStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

const initialState = useAgentProfilesStore.getState()

const makeProfile = (overrides: Partial<AgentProfileDefinition> = {}): AgentProfileDefinition => ({
  id: 'p1',
  userId: 'u1',
  workspaceId: null,
  name: 'Profile 1',
  avatar: null,
  description: null,
  type: 'ai_agent',
  role: null,
  goal: null,
  personality: null,
  systemPrompt: null,
  communicationStyle: null,
  skills: ['skill-a'],
  constraints: [],
  tools: [],
  linkedUserId: null,
  notificationChannels: [],
  responseTimeoutMinutes: null,
  escalationRules: null,
  isPublic: false,
  tags: [],
  category: null,
  rating: '0',
  ratingCount: 0,
  usageCount: 0,
  version: 1,
  parentProfileId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

const jsonResponse = (body: any, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  }) as Response

beforeEach(() => {
  useAgentProfilesStore.setState(
    {
      ...initialState,
      profiles: {},
      isLoading: false,
      error: null,
      selectedProfileId: null,
    },
    true
  )
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAgentProfilesStore - initial state', () => {
  it('starts empty with no error or selection', () => {
    const state = useAgentProfilesStore.getState()
    expect(state.profiles).toEqual({})
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.selectedProfileId).toBeNull()
  })
})

describe('loadProfiles', () => {
  it('loads profiles and parses JSON fields from strings', async () => {
    const rawProfile = {
      ...makeProfile({ id: 'p-string' }),
      skills: JSON.stringify(['alpha', 'beta']),
      constraints: JSON.stringify(['c1']),
      tools: JSON.stringify([{ id: 't1' }]),
      notificationChannels: JSON.stringify(['email']),
      tags: JSON.stringify(['tag1']),
      escalationRules: JSON.stringify({ level: 1 }),
    }

    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({ profiles: [rawProfile] }))

    await useAgentProfilesStore.getState().loadProfiles()

    const state = useAgentProfilesStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
    const parsed = state.profiles['p-string']
    expect(parsed.skills).toEqual(['alpha', 'beta'])
    expect(parsed.constraints).toEqual(['c1'])
    expect(parsed.tools).toEqual([{ id: 't1' }])
    expect(parsed.notificationChannels).toEqual(['email'])
    expect(parsed.tags).toEqual(['tag1'])
    expect(parsed.escalationRules).toEqual({ level: 1 })
  })

  it('keeps already-parsed object fields as-is', async () => {
    const profile = makeProfile({
      id: 'p-obj',
      skills: ['already-array'],
      tools: [{ id: 'x' }],
    })
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({ profiles: [profile] }))

    await useAgentProfilesStore.getState().loadProfiles()

    const loaded = useAgentProfilesStore.getState().profiles['p-obj']
    expect(loaded.skills).toEqual(['already-array'])
    expect(loaded.tools).toEqual([{ id: 'x' }])
  })

  it('clears profiles silently on 401', async () => {
    useAgentProfilesStore.setState({ profiles: { old: makeProfile({ id: 'old' }) } })
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}, false, 401))

    await useAgentProfilesStore.getState().loadProfiles()

    const state = useAgentProfilesStore.getState()
    expect(state.profiles).toEqual({})
    expect(state.error).toBeNull()
    expect(state.isLoading).toBe(false)
  })

  it('clears profiles silently on 5xx server error', async () => {
    useAgentProfilesStore.setState({ profiles: { old: makeProfile({ id: 'old' }) } })
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}, false, 503))

    await useAgentProfilesStore.getState().loadProfiles()

    const state = useAgentProfilesStore.getState()
    expect(state.profiles).toEqual({})
    expect(state.error).toBeNull()
    expect(state.isLoading).toBe(false)
  })

  it('sets error for non-401/5xx failures', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}, false, 400))

    await useAgentProfilesStore.getState().loadProfiles()

    const state = useAgentProfilesStore.getState()
    expect(state.error).toMatch(/Failed to load agent profiles/)
    expect(state.isLoading).toBe(false)
  })

  it('sets error when response is malformed', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({ profiles: 'oops' }))

    await useAgentProfilesStore.getState().loadProfiles()

    const state = useAgentProfilesStore.getState()
    expect(state.error).toBe('Invalid response format')
    expect(state.isLoading).toBe(false)
  })

  it('captures unknown thrown values as Unknown error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue('kaboom')

    await useAgentProfilesStore.getState().loadProfiles()
    expect(useAgentProfilesStore.getState().error).toBe('Unknown error')
  })
})

describe('addProfile', () => {
  it('posts, parses response, stores profile, and returns new id', async () => {
    const returned = {
      ...makeProfile({ id: 'new-1', name: 'Added' }),
      skills: JSON.stringify(['s']),
      tools: JSON.stringify([]),
      constraints: JSON.stringify([]),
      notificationChannels: JSON.stringify([]),
      tags: JSON.stringify([]),
    }
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(jsonResponse({ profile: returned }))

    const input = {
      workspaceId: null,
      name: 'Added',
      type: 'ai_agent' as const,
      skills: ['s'],
      constraints: [],
      tools: [],
      notificationChannels: [],
      isPublic: false,
      tags: [],
    } as any

    const id = await useAgentProfilesStore.getState().addProfile(input)

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/agent-profiles',
      expect.objectContaining({ method: 'POST' })
    )
    expect(id).toBe('new-1')
    const stored = useAgentProfilesStore.getState().profiles['new-1']
    expect(stored.name).toBe('Added')
    expect(stored.skills).toEqual(['s'])
    expect(useAgentProfilesStore.getState().isLoading).toBe(false)
  })

  it('uses errorData.error for failed creates', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'nope' }),
    } as unknown as Response)

    const id = await useAgentProfilesStore.getState().addProfile({} as any)
    expect(id).toBeNull()
    expect(useAgentProfilesStore.getState().error).toBe('nope')
    expect(useAgentProfilesStore.getState().isLoading).toBe(false)
  })

  it('falls back to statusText when error body cannot be parsed', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => {
        throw new Error('not json')
      },
    } as unknown as Response)

    const id = await useAgentProfilesStore.getState().addProfile({} as any)
    expect(id).toBeNull()
    expect(useAgentProfilesStore.getState().error).toMatch(/Failed to create profile: Bad Request/)
  })
})

describe('updateProfile', () => {
  it('PATCHes and merges the updated profile', async () => {
    useAgentProfilesStore.setState({
      profiles: { p1: makeProfile({ id: 'p1', name: 'Old' }) },
    })
    const updated = { ...makeProfile({ id: 'p1', name: 'New' }), skills: JSON.stringify(['x']) }
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({ profile: updated }))

    const ok = await useAgentProfilesStore.getState().updateProfile('p1', { name: 'New' })

    expect(ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/agent-profiles/p1',
      expect.objectContaining({ method: 'PATCH' })
    )
    const stored = useAgentProfilesStore.getState().profiles['p1']
    expect(stored.name).toBe('New')
    expect(stored.skills).toEqual(['x'])
  })

  it('returns false and sets error on failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}, false, 500))

    const ok = await useAgentProfilesStore.getState().updateProfile('p1', { name: 'X' })
    expect(ok).toBe(false)
    expect(useAgentProfilesStore.getState().error).toMatch(/Failed to update profile/)
    expect(useAgentProfilesStore.getState().isLoading).toBe(false)
  })
})

describe('deleteProfile', () => {
  it('DELETEs and removes the profile from state', async () => {
    useAgentProfilesStore.setState({
      profiles: {
        a: makeProfile({ id: 'a' }),
        b: makeProfile({ id: 'b' }),
      },
    })
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({ success: true }))

    const ok = await useAgentProfilesStore.getState().deleteProfile('a')

    expect(ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/agent-profiles/a',
      expect.objectContaining({ method: 'DELETE' })
    )
    const profiles = useAgentProfilesStore.getState().profiles
    expect(profiles.a).toBeUndefined()
    expect(profiles.b).toBeDefined()
  })

  it('returns false and sets error on failure', async () => {
    useAgentProfilesStore.setState({ profiles: { a: makeProfile({ id: 'a' }) } })
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}, false, 500))

    const ok = await useAgentProfilesStore.getState().deleteProfile('a')
    expect(ok).toBe(false)
    expect(useAgentProfilesStore.getState().error).toMatch(/Failed to delete profile/)
    // Profile remains untouched
    expect(useAgentProfilesStore.getState().profiles.a).toBeDefined()
  })
})

describe('selectors', () => {
  beforeEach(() => {
    useAgentProfilesStore.setState({
      profiles: {
        a: makeProfile({ id: 'a', type: 'ai_agent' }),
        b: makeProfile({ id: 'b', type: 'human_agent' }),
        c: makeProfile({ id: 'c', type: 'ai_agent' }),
      },
    })
  })

  it('getProfile returns the matching profile', () => {
    expect(useAgentProfilesStore.getState().getProfile('b')?.id).toBe('b')
  })

  it('getProfile returns undefined for unknown id', () => {
    expect(useAgentProfilesStore.getState().getProfile('missing')).toBeUndefined()
  })

  it('getAllProfiles returns every profile', () => {
    const all = useAgentProfilesStore.getState().getAllProfiles()
    expect(all.map((p) => p.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('getProfilesByType filters by type', () => {
    expect(
      useAgentProfilesStore
        .getState()
        .getProfilesByType('ai_agent')
        .map((p) => p.id)
        .sort()
    ).toEqual(['a', 'c'])
    expect(
      useAgentProfilesStore
        .getState()
        .getProfilesByType('human_agent')
        .map((p) => p.id)
    ).toEqual(['b'])
    expect(useAgentProfilesStore.getState().getProfilesByType('hybrid')).toEqual([])
  })
})

describe('setSelectedProfile', () => {
  it('updates selectedProfileId', () => {
    useAgentProfilesStore.getState().setSelectedProfile('x')
    expect(useAgentProfilesStore.getState().selectedProfileId).toBe('x')
    useAgentProfilesStore.getState().setSelectedProfile(null)
    expect(useAgentProfilesStore.getState().selectedProfileId).toBeNull()
  })
})
