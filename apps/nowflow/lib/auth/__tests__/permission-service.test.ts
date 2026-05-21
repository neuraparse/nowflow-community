import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const limitMock = vi.fn(async () => [] as any[])
  const whereMock = vi.fn(() => ({
    limit: limitMock,
    then: (resolve: (v: any) => any) => Promise.resolve([]).then(resolve),
  }))
  const innerJoinMock = vi.fn(() => ({ where: whereMock }))
  const fromMock = vi.fn(() => ({
    where: whereMock,
    innerJoin: innerJoinMock,
    // Support `await db.select().from(permission)`
    then: (resolve: (v: any) => any) => Promise.resolve([]).then(resolve),
  }))
  const selectMock = vi.fn(() => ({ from: fromMock }))

  const insertValuesMock = vi.fn(async () => undefined)
  const insertMock = vi.fn(() => ({ values: insertValuesMock }))

  const deleteWhereMock = vi.fn(async () => undefined)
  const deleteMock = vi.fn(() => ({ where: deleteWhereMock }))

  return {
    db: {
      select: selectMock,
      insert: insertMock,
      delete: deleteMock,
    },
    selectMock,
    fromMock,
    whereMock,
    innerJoinMock,
    limitMock,
    insertMock,
    insertValuesMock,
    deleteMock,
    deleteWhereMock,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }
})

vi.mock('@/db', () => ({ db: mocks.db }))
vi.mock('@/db/schema', () => ({
  permission: {
    id: 'p.id',
    name: 'p.name',
    resource: 'p.resource',
    action: 'p.action',
    description: 'p.description',
    createdAt: 'p.createdAt',
  },
  rolePermission: {
    id: 'rp.id',
    role: 'rp.role',
    permissionId: 'rp.permissionId',
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: any, b: any) => ({ __eq: [a, b] })),
  and: vi.fn((...args: any[]) => ({ __and: args })),
}))
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => mocks.logger,
}))
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'uuid-v4-mock'),
}))

describe('lib/auth/permission-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.limitMock.mockResolvedValue([])
    mocks.insertValuesMock.mockResolvedValue(undefined)
    mocks.deleteWhereMock.mockResolvedValue(undefined)
  })

  describe('constants', () => {
    it('DEFAULT_PERMISSIONS contains all core permissions', async () => {
      const mod = await import('@/lib/auth/permission-service')
      expect(mod.DEFAULT_PERMISSIONS.length).toBeGreaterThan(10)
      expect(mod.DEFAULT_PERMISSIONS.every((p) => p.name.includes(':'))).toBe(true)
    })

    it('DEFAULT_ROLE_PERMISSIONS: owner has all perms, viewer is smallest', async () => {
      const mod = await import('@/lib/auth/permission-service')
      const { owner, admin, member, viewer } = mod.DEFAULT_ROLE_PERMISSIONS
      expect(owner.length).toBe(mod.DEFAULT_PERMISSIONS.length)
      expect(admin.length).toBeLessThanOrEqual(owner.length)
      expect(member.length).toBeLessThan(admin.length)
      expect(viewer.length).toBeLessThan(member.length)
      expect(viewer).toContain('workflow:read')
    })
  })

  describe('seedPermissions', () => {
    it('inserts permissions that do not already exist', async () => {
      mocks.limitMock.mockResolvedValue([])

      const mod = await import('@/lib/auth/permission-service')
      await mod.seedPermissions()

      expect(mocks.insertMock).toHaveBeenCalledTimes(mod.DEFAULT_PERMISSIONS.length)
      expect(mocks.insertValuesMock).toHaveBeenCalledTimes(mod.DEFAULT_PERMISSIONS.length)
    })

    it('skips existing permissions', async () => {
      mocks.limitMock.mockResolvedValue([{ id: 'existing', name: 'x' }])

      const mod = await import('@/lib/auth/permission-service')
      await mod.seedPermissions()

      expect(mocks.insertMock).not.toHaveBeenCalled()
    })

    it('throws when DB fails', async () => {
      mocks.limitMock.mockRejectedValueOnce(new Error('db-fail'))

      const mod = await import('@/lib/auth/permission-service')
      await expect(mod.seedPermissions()).rejects.toThrow(/db-fail/)
    })
  })

  describe('getAllPermissions', () => {
    it('maps rows to Permission shape', async () => {
      const rows = [
        {
          id: 'id-1',
          name: 'workflow:read',
          resource: 'workflow',
          action: 'read',
          description: 'd',
        },
      ]
      mocks.fromMock.mockReturnValueOnce({
        then: (resolve: any) => Promise.resolve(rows).then(resolve),
      } as any)

      const mod = await import('@/lib/auth/permission-service')
      const result = await mod.getAllPermissions()
      expect(result).toEqual([
        {
          id: 'id-1',
          name: 'workflow:read',
          resource: 'workflow',
          action: 'read',
          description: 'd',
        },
      ])
    })

    it('throws when DB select fails', async () => {
      mocks.fromMock.mockReturnValueOnce({
        then: (resolve: any, reject: any) =>
          Promise.reject(new Error('fail')).then(resolve, reject),
      } as any)

      const mod = await import('@/lib/auth/permission-service')
      await expect(mod.getAllPermissions()).rejects.toThrow(/fail/)
    })
  })

  describe('getRolePermissions', () => {
    it('returns mapped permissions for a role', async () => {
      const rows = [
        {
          permission: {
            id: 'p1',
            name: 'workflow:read',
            resource: 'workflow',
            action: 'read',
            description: null,
          },
        },
      ]
      mocks.whereMock.mockReturnValueOnce({
        then: (resolve: any) => Promise.resolve(rows).then(resolve),
      } as any)

      const mod = await import('@/lib/auth/permission-service')
      const result = await mod.getRolePermissions('admin')
      expect(result).toEqual([
        {
          id: 'p1',
          name: 'workflow:read',
          resource: 'workflow',
          action: 'read',
          description: null,
        },
      ])
    })

    it('throws on DB error', async () => {
      mocks.whereMock.mockReturnValueOnce({
        then: (resolve: any, reject: any) => Promise.reject(new Error('x')).then(resolve, reject),
      } as any)

      const mod = await import('@/lib/auth/permission-service')
      await expect(mod.getRolePermissions('admin')).rejects.toThrow(/x/)
    })
  })

  describe('setRolePermissions', () => {
    it('deletes old role permissions then inserts new ones for known names', async () => {
      mocks.deleteWhereMock.mockResolvedValueOnce(undefined)
      mocks.fromMock.mockReturnValueOnce({
        then: (resolve: any) =>
          Promise.resolve([
            { id: 'pid-read', name: 'workflow:read' },
            { id: 'pid-write', name: 'workflow:write' },
          ]).then(resolve),
      } as any)

      const mod = await import('@/lib/auth/permission-service')
      await mod.setRolePermissions('member', ['workflow:read', 'unknown:perm'])

      expect(mocks.deleteMock).toHaveBeenCalled()
      // Only the matched permission gets inserted
      expect(mocks.insertValuesMock).toHaveBeenCalledTimes(1)
      expect(mocks.insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'member', permissionId: 'pid-read' })
      )
    })

    it('throws on DB error', async () => {
      mocks.deleteWhereMock.mockRejectedValueOnce(new Error('del-fail'))

      const mod = await import('@/lib/auth/permission-service')
      await expect(mod.setRolePermissions('member', [])).rejects.toThrow(/del-fail/)
    })
  })

  describe('hasPermission', () => {
    it('returns true when role has the permission', async () => {
      mocks.whereMock.mockReturnValueOnce({
        then: (resolve: any) =>
          Promise.resolve([
            {
              permission: {
                id: 'p',
                name: 'workflow:read',
                resource: 'workflow',
                action: 'read',
                description: null,
              },
            },
          ]).then(resolve),
      } as any)

      const mod = await import('@/lib/auth/permission-service')
      await expect(mod.hasPermission('admin', 'workflow:read')).resolves.toBe(true)
    })

    it('returns false when role lacks the permission', async () => {
      mocks.whereMock.mockReturnValueOnce({
        then: (resolve: any) => Promise.resolve([]).then(resolve),
      } as any)

      const mod = await import('@/lib/auth/permission-service')
      await expect(mod.hasPermission('viewer', 'admin:billing')).resolves.toBe(false)
    })

    it('returns false on DB error', async () => {
      mocks.whereMock.mockReturnValueOnce({
        then: (resolve: any, reject: any) =>
          Promise.reject(new Error('boom')).then(resolve, reject),
      } as any)

      const mod = await import('@/lib/auth/permission-service')
      await expect(mod.hasPermission('admin', 'x:y')).resolves.toBe(false)
    })
  })

  describe('canPerform', () => {
    it('composes resource:action and delegates to hasPermission', async () => {
      mocks.whereMock.mockReturnValueOnce({
        then: (resolve: any) =>
          Promise.resolve([
            {
              permission: {
                id: 'p',
                name: 'credentials:delete',
                resource: 'credentials',
                action: 'delete',
                description: null,
              },
            },
          ]).then(resolve),
      } as any)

      const mod = await import('@/lib/auth/permission-service')
      await expect(mod.canPerform('admin', 'credentials', 'delete')).resolves.toBe(true)
    })

    it('returns false when the permission is missing', async () => {
      mocks.whereMock.mockReturnValueOnce({
        then: (resolve: any) => Promise.resolve([]).then(resolve),
      } as any)

      const mod = await import('@/lib/auth/permission-service')
      await expect(mod.canPerform('viewer', 'admin', 'billing')).resolves.toBe(false)
    })
  })
})
