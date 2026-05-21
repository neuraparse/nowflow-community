import { describe, expect, it } from 'vitest'
import {
  canDeleteWorkflow,
  canDeployWorkflow,
  canEditWorkflow,
  canManageCollaborators,
  formatRole,
  getRoleColor,
  getRoleDescription,
  getUserWorkflowRole,
  getWorkflowPermissions,
  hasWorkflowAccess,
  type WorkflowRole,
} from '@/lib/workflows/permissions'

const makeCollaborator = (userId: string, role: WorkflowRole) => ({
  id: `col-${userId}`,
  userId,
  role,
  workflowId: 'wf-1',
  name: 'Name',
  email: 'a@b.co',
  addedAt: new Date().toISOString(),
})

describe('getUserWorkflowRole', () => {
  it('returns owner when userId matches ownerId', () => {
    expect(getUserWorkflowRole('user-1', 'user-1', [])).toBe('owner')
  })

  it('returns collaborator role when userId is in collaborators', () => {
    const collaborators = [
      makeCollaborator('user-2', 'editor'),
      makeCollaborator('user-3', 'viewer'),
    ]
    expect(getUserWorkflowRole('user-2', 'owner', collaborators as any)).toBe('editor')
    expect(getUserWorkflowRole('user-3', 'owner', collaborators as any)).toBe('viewer')
  })

  it('falls back to viewer for unknown users', () => {
    expect(getUserWorkflowRole('stranger', 'owner', [])).toBe('viewer')
  })
})

describe('getWorkflowPermissions', () => {
  it('grants full access to owner', () => {
    const p = getWorkflowPermissions('u', 'u', [])
    expect(p).toEqual({
      canView: true,
      canEdit: true,
      canDelete: true,
      canDeploy: true,
      canManageCollaborators: true,
      canExport: true,
      role: 'owner',
    })
  })

  it('grants edit + export to editor only', () => {
    const collaborators = [makeCollaborator('u', 'editor')]
    const p = getWorkflowPermissions('u', 'owner', collaborators as any)
    expect(p.role).toBe('editor')
    expect(p.canView).toBe(true)
    expect(p.canEdit).toBe(true)
    expect(p.canDelete).toBe(false)
    expect(p.canDeploy).toBe(false)
    expect(p.canManageCollaborators).toBe(false)
    expect(p.canExport).toBe(true)
  })

  it('grants view + export to viewer only', () => {
    const collaborators = [makeCollaborator('u', 'viewer')]
    const p = getWorkflowPermissions('u', 'owner', collaborators as any)
    expect(p.role).toBe('viewer')
    expect(p.canView).toBe(true)
    expect(p.canEdit).toBe(false)
    expect(p.canDelete).toBe(false)
    expect(p.canDeploy).toBe(false)
    expect(p.canManageCollaborators).toBe(false)
    expect(p.canExport).toBe(true)
  })

  it('non-collaborator falls through as viewer permission', () => {
    const p = getWorkflowPermissions('stranger', 'owner', [])
    expect(p.role).toBe('viewer')
    expect(p.canView).toBe(true)
    expect(p.canEdit).toBe(false)
  })
})

describe('permission boolean helpers', () => {
  const owner = 'owner-id'
  const editor = [makeCollaborator('u-edit', 'editor')] as any
  const viewer = [makeCollaborator('u-view', 'viewer')] as any

  it('hasWorkflowAccess allows all roles that can view', () => {
    expect(hasWorkflowAccess(owner, owner, [])).toBe(true)
    expect(hasWorkflowAccess('u-edit', owner, editor)).toBe(true)
    expect(hasWorkflowAccess('u-view', owner, viewer)).toBe(true)
    expect(hasWorkflowAccess('stranger', owner, [])).toBe(true)
  })

  it('canEditWorkflow is true only for owner and editor', () => {
    expect(canEditWorkflow(owner, owner, [])).toBe(true)
    expect(canEditWorkflow('u-edit', owner, editor)).toBe(true)
    expect(canEditWorkflow('u-view', owner, viewer)).toBe(false)
  })

  it('canDeleteWorkflow is owner-only', () => {
    expect(canDeleteWorkflow(owner, owner, [])).toBe(true)
    expect(canDeleteWorkflow('u-edit', owner, editor)).toBe(false)
    expect(canDeleteWorkflow('u-view', owner, viewer)).toBe(false)
  })

  it('canDeployWorkflow is owner-only', () => {
    expect(canDeployWorkflow(owner, owner, [])).toBe(true)
    expect(canDeployWorkflow('u-edit', owner, editor)).toBe(false)
  })

  it('canManageCollaborators is owner-only', () => {
    expect(canManageCollaborators(owner, owner, [])).toBe(true)
    expect(canManageCollaborators('u-edit', owner, editor)).toBe(false)
    expect(canManageCollaborators('u-view', owner, viewer)).toBe(false)
  })
})

describe('formatRole', () => {
  it('returns human readable role names', () => {
    expect(formatRole('owner')).toBe('Owner')
    expect(formatRole('editor')).toBe('Editor')
    expect(formatRole('viewer')).toBe('Viewer')
  })

  it('returns Unknown for invalid input', () => {
    expect(formatRole('bogus' as unknown as WorkflowRole)).toBe('Unknown')
  })
})

describe('getRoleDescription', () => {
  it('returns expected descriptions', () => {
    expect(getRoleDescription('owner')).toMatch(/Full access/i)
    expect(getRoleDescription('editor')).toMatch(/view and edit/i)
    expect(getRoleDescription('viewer')).toMatch(/only view/i)
    expect(getRoleDescription('other' as unknown as WorkflowRole)).toBe('No access')
  })
})

describe('getRoleColor', () => {
  it('maps roles to UI colors', () => {
    expect(getRoleColor('owner')).toBe('blue')
    expect(getRoleColor('editor')).toBe('green')
    expect(getRoleColor('viewer')).toBe('gray')
    expect(getRoleColor('other' as unknown as WorkflowRole)).toBe('gray')
  })
})
