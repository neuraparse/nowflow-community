import { and, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { permission, rolePermission } from '@/db/schema'

const logger = createLogger('PermissionService')

export interface Permission {
  id: string
  name: string
  resource: string
  action: string
  description: string | null
}

export interface RolePermissionMapping {
  role: string
  permissions: Permission[]
}

// Default permissions
export const DEFAULT_PERMISSIONS: Omit<Permission, 'id'>[] = [
  // Workflow permissions
  { name: 'workflow:read', resource: 'workflow', action: 'read', description: 'View workflows' },
  {
    name: 'workflow:write',
    resource: 'workflow',
    action: 'write',
    description: 'Create and edit workflows',
  },
  {
    name: 'workflow:delete',
    resource: 'workflow',
    action: 'delete',
    description: 'Delete workflows',
  },
  {
    name: 'workflow:execute',
    resource: 'workflow',
    action: 'execute',
    description: 'Run workflows',
  },
  {
    name: 'workflow:deploy',
    resource: 'workflow',
    action: 'deploy',
    description: 'Deploy workflows',
  },

  // Credentials permissions
  {
    name: 'credentials:read',
    resource: 'credentials',
    action: 'read',
    description: 'View credentials',
  },
  {
    name: 'credentials:write',
    resource: 'credentials',
    action: 'write',
    description: 'Create and edit credentials',
  },
  {
    name: 'credentials:delete',
    resource: 'credentials',
    action: 'delete',
    description: 'Delete credentials',
  },

  // Team permissions
  { name: 'team:read', resource: 'team', action: 'read', description: 'View team members' },
  { name: 'team:manage', resource: 'team', action: 'manage', description: 'Manage team members' },

  // Admin permissions
  {
    name: 'admin:settings',
    resource: 'admin',
    action: 'settings',
    description: 'Manage organization settings',
  },
  { name: 'admin:billing', resource: 'admin', action: 'billing', description: 'Manage billing' },
  { name: 'admin:audit', resource: 'admin', action: 'audit', description: 'View audit logs' },

  // Analytics permissions
  { name: 'analytics:read', resource: 'analytics', action: 'read', description: 'View analytics' },
  {
    name: 'analytics:export',
    resource: 'analytics',
    action: 'export',
    description: 'Export analytics data',
  },
]

// Default role permissions
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: DEFAULT_PERMISSIONS.map((p) => p.name),
  admin: [
    'workflow:read',
    'workflow:write',
    'workflow:delete',
    'workflow:execute',
    'workflow:deploy',
    'credentials:read',
    'credentials:write',
    'credentials:delete',
    'team:read',
    'team:manage',
    'admin:settings',
    'analytics:read',
    'analytics:export',
  ],
  member: [
    'workflow:read',
    'workflow:write',
    'workflow:execute',
    'credentials:read',
    'team:read',
    'analytics:read',
  ],
  viewer: ['workflow:read', 'team:read', 'analytics:read'],
}

/**
 * Seeds default permissions
 */
export async function seedPermissions(): Promise<void> {
  try {
    for (const perm of DEFAULT_PERMISSIONS) {
      const [existing] = await db
        .select()
        .from(permission)
        .where(eq(permission.name, perm.name))
        .limit(1)

      if (!existing) {
        await db.insert(permission).values({
          id: uuidv4(),
          name: perm.name,
          resource: perm.resource,
          action: perm.action,
          description: perm.description,
          createdAt: new Date(),
        })
      }
    }

    logger.info('Seeded default permissions')
  } catch (error) {
    logger.error('Failed to seed permissions', { error })
    throw error
  }
}

/**
 * Gets all permissions
 */
export async function getAllPermissions(): Promise<Permission[]> {
  try {
    const permissions = await db.select().from(permission)

    return permissions.map(
      (p: Permission): Permission => ({
        id: p.id,
        name: p.name,
        resource: p.resource,
        action: p.action,
        description: p.description,
      })
    )
  } catch (error) {
    logger.error('Failed to get permissions', { error })
    throw error
  }
}

/**
 * Gets permissions for a role
 */
export async function getRolePermissions(role: string): Promise<Permission[]> {
  try {
    const mappings = await db
      .select({
        permission: permission,
      })
      .from(rolePermission)
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
      .where(eq(rolePermission.role, role))

    return mappings.map(
      (m: { permission: Permission }): Permission => ({
        id: m.permission.id,
        name: m.permission.name,
        resource: m.permission.resource,
        action: m.permission.action,
        description: m.permission.description,
      })
    )
  } catch (error) {
    logger.error('Failed to get role permissions', { role, error })
    throw error
  }
}

/**
 * Sets permissions for a role
 */
export async function setRolePermissions(role: string, permissionNames: string[]): Promise<void> {
  try {
    // Delete existing role permissions
    await db.delete(rolePermission).where(eq(rolePermission.role, role))

    // Get permission IDs
    const permissions = await db.select().from(permission)

    const permissionMap = new Map(
      permissions.map((p: Permission): [string, string] => [p.name, p.id])
    )

    // Insert new role permissions
    for (const permName of permissionNames) {
      const permId = permissionMap.get(permName)
      if (permId) {
        await db.insert(rolePermission).values({
          id: uuidv4(),
          role,
          permissionId: permId,
        })
      }
    }

    logger.info('Set role permissions', { role, count: permissionNames.length })
  } catch (error) {
    logger.error('Failed to set role permissions', { role, error })
    throw error
  }
}

/**
 * Checks if a user has a specific permission
 */
export async function hasPermission(userRole: string, permissionName: string): Promise<boolean> {
  try {
    const permissions = await getRolePermissions(userRole)
    return permissions.some((p) => p.name === permissionName)
  } catch (error) {
    logger.error('Failed to check permission', { userRole, permissionName, error })
    return false
  }
}

/**
 * Checks if a user can perform an action on a resource
 */
export async function canPerform(
  userRole: string,
  resource: string,
  action: string
): Promise<boolean> {
  const permissionName = `${resource}:${action}`
  return hasPermission(userRole, permissionName)
}
