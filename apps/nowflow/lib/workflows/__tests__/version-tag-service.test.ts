import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createWorkflowTag,
  DEFAULT_TAGS,
  deleteWorkflowTag,
  getAllAvailableTags,
  getDefaultTags,
  getWorkflowTags,
  updateWorkflowTag,
  validateTags,
} from '@/lib/workflows/version-tag-service'
import { db } from '@/db'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('uuid', () => ({ v4: () => 'uuid-fixed' }))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
}))

// DB chainable mock. Because vi.mock is hoisted above all `const` bindings, we
// declare the queue inside the factory and expose it via a setter.
vi.mock('@/db', () => {
  const queue: any[] = []
  const shift = () => queue.shift()
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(shift() ?? [])),
    orderBy: vi.fn().mockImplementation(() => Promise.resolve(shift() ?? [])),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockImplementation(() => Promise.resolve()),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => Promise.resolve()),
    })),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(() => Promise.resolve()),
    }),
    __queue: queue,
    __reset: () => {
      queue.length = 0
    },
  }
  return { db: chain }
})

vi.mock('@/db/schema', () => ({
  workflowVersionTag: {
    id: 'id',
    workflowId: 'workflowId',
    name: 'name',
    slug: 'slug',
  },
}))

const dbMock = db as unknown as { __queue: any[]; __reset: () => void }

const push = (v: any) => {
  dbMock.__queue.push(v)
}

beforeEach(() => {
  dbMock.__reset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('getDefaultTags', () => {
  it('returns the default tag list unchanged', () => {
    const tags = getDefaultTags()
    expect(tags).toBe(DEFAULT_TAGS)
    expect(tags.map((t) => t.slug).sort()).toEqual([
      'archived',
      'draft',
      'production',
      'reviewed',
      'stable',
    ])
  })

  it('each default tag has required fields', () => {
    for (const tag of DEFAULT_TAGS) {
      expect(typeof tag.name).toBe('string')
      expect(typeof tag.slug).toBe('string')
      expect(tag.color).toMatch(/^#[0-9A-F]{6}$/i)
      expect(typeof tag.description).toBe('string')
    }
  })
})

describe('getWorkflowTags', () => {
  it('returns tags ordered by name (via orderBy terminal)', async () => {
    push([{ id: 't1', workflowId: 'wf', name: 'A', slug: 'a', color: '#fff', description: null }])
    const tags = await getWorkflowTags('wf')
    expect(tags).toHaveLength(1)
    expect(tags[0].name).toBe('A')
  })
})

describe('getAllAvailableTags', () => {
  it('returns default + custom tags', async () => {
    push([
      {
        id: 'c1',
        workflowId: 'wf',
        name: 'Custom',
        slug: 'custom',
        color: '#000',
        description: null,
      },
    ])
    const res = await getAllAvailableTags('wf')
    expect(res.defaultTags).toBe(DEFAULT_TAGS)
    expect(res.customTags).toHaveLength(1)
    expect(res.customTags[0].name).toBe('Custom')
  })
})

describe('createWorkflowTag', () => {
  it('throws when a tag with the same slug exists', async () => {
    push([{ id: 'existing', slug: 'my-tag' }])
    await expect(createWorkflowTag('wf', { name: 'My Tag' }, 'user-1')).rejects.toThrow(
      /already exists/i
    )
  })

  it('creates a tag with default color when none provided', async () => {
    push([])
    const result = await createWorkflowTag('wf', { name: 'Beta Release!' })
    expect(result).toMatchObject({
      id: 'uuid-fixed',
      workflowId: 'wf',
      name: 'Beta Release!',
      slug: 'beta-release',
      color: '#3B82F6',
      description: null,
      createdBy: null,
    })
  })

  it('respects provided color and description', async () => {
    push([])
    const result = await createWorkflowTag(
      'wf',
      { name: 'HotFix', color: '#FF0000', description: 'urgent' },
      'user-1'
    )
    expect(result.color).toBe('#FF0000')
    expect(result.description).toBe('urgent')
    expect(result.createdBy).toBe('user-1')
    expect(result.slug).toBe('hotfix')
  })
})

describe('updateWorkflowTag', () => {
  it('throws when the tag id does not exist', async () => {
    push([])
    await expect(updateWorkflowTag('missing', { name: 'x' })).rejects.toThrow(/not found/i)
  })

  it('returns existing when no updates are provided', async () => {
    const existing = {
      id: 't1',
      workflowId: 'wf',
      name: 'Old',
      slug: 'old',
      color: '#000',
      description: null,
      createdBy: null,
      createdAt: new Date(),
    }
    push([existing])
    const result = await updateWorkflowTag('t1', {})
    expect(result).toMatchObject(existing)
  })

  it('rebuilds slug when name changes', async () => {
    const existing = {
      id: 't1',
      workflowId: 'wf',
      name: 'Old',
      slug: 'old',
      color: '#000',
      description: null,
      createdBy: null,
      createdAt: new Date(),
    }
    push([existing])
    const result = await updateWorkflowTag('t1', { name: 'Shiny New' })
    expect(result.name).toBe('Shiny New')
    expect(result.slug).toBe('shiny-new')
  })
})

describe('deleteWorkflowTag', () => {
  it('throws when tag not found', async () => {
    push([])
    await expect(deleteWorkflowTag('missing')).rejects.toThrow(/not found/i)
  })

  it('resolves successfully when tag exists', async () => {
    push([{ id: 't1' }])
    await expect(deleteWorkflowTag('t1')).resolves.toBeUndefined()
  })
})

describe('validateTags', () => {
  it('treats default tag names as valid (case-insensitive)', async () => {
    push([])
    const result = await validateTags('wf', ['Stable', 'production'])
    expect(result).toEqual({ valid: true, invalidTags: [] })
  })

  it('flags unknown tag names', async () => {
    push([])
    const result = await validateTags('wf', ['stable', 'nope', 'other'])
    expect(result.valid).toBe(false)
    expect(result.invalidTags).toEqual(['nope', 'other'])
  })

  it('accepts custom tag names', async () => {
    push([
      {
        id: 'c1',
        workflowId: 'wf',
        name: 'Custom Tag',
        slug: 'custom-tag',
        color: '#000',
        description: null,
        createdBy: null,
        createdAt: new Date(),
      },
    ])
    const result = await validateTags('wf', ['custom tag'])
    expect(result).toEqual({ valid: true, invalidTags: [] })
  })
})
