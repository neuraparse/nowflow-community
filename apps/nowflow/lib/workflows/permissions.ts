import { WorkflowCollaborator } from '@/app/api/workflows/[id]/collaborators/route'

/**
 * Workflow permission utilities
 */

export type WorkflowRole = 'owner' | 'editor' | 'viewer'

export interface WorkflowPermissions {
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canDeploy: boolean
  canManageCollaborators: boolean
  canExport: boolean
  role: WorkflowRole
}

/**
 * Get user's role in a workflow
 */
export function getUserWorkflowRole(
  userId: string,
  ownerId: string,
  collaborators: WorkflowCollaborator[]
): WorkflowRole {
  // Check if user is owner
  if (userId === ownerId) {
    return 'owner'
  }

  // Check if user is collaborator
  const collaborator = collaborators.find((c) => c.userId === userId)
  if (collaborator) {
    return collaborator.role
  }

  // No access
  return 'viewer' // Will be denied by permissions
}

/**
 * Get user's permissions for a workflow
 */
export function getWorkflowPermissions(
  userId: string,
  ownerId: string,
  collaborators: WorkflowCollaborator[]
): WorkflowPermissions {
  const role = getUserWorkflowRole(userId, ownerId, collaborators)

  switch (role) {
    case 'owner':
      return {
        canView: true,
        canEdit: true,
        canDelete: true,
        canDeploy: true,
        canManageCollaborators: true,
        canExport: true,
        role: 'owner',
      }

    case 'editor':
      return {
        canView: true,
        canEdit: true,
        canDelete: false,
        canDeploy: false,
        canManageCollaborators: false,
        canExport: true,
        role: 'editor',
      }

    case 'viewer':
      return {
        canView: true,
        canEdit: false,
        canDelete: false,
        canDeploy: false,
        canManageCollaborators: false,
        canExport: true,
        role: 'viewer',
      }

    default:
      return {
        canView: false,
        canEdit: false,
        canDelete: false,
        canDeploy: false,
        canManageCollaborators: false,
        canExport: false,
        role: 'viewer',
      }
  }
}

/**
 * Check if user has access to workflow
 */
export function hasWorkflowAccess(
  userId: string,
  ownerId: string,
  collaborators: WorkflowCollaborator[]
): boolean {
  const permissions = getWorkflowPermissions(userId, ownerId, collaborators)
  return permissions.canView
}

/**
 * Check if user can edit workflow
 */
export function canEditWorkflow(
  userId: string,
  ownerId: string,
  collaborators: WorkflowCollaborator[]
): boolean {
  const permissions = getWorkflowPermissions(userId, ownerId, collaborators)
  return permissions.canEdit
}

/**
 * Check if user can delete workflow
 */
export function canDeleteWorkflow(
  userId: string,
  ownerId: string,
  collaborators: WorkflowCollaborator[]
): boolean {
  const permissions = getWorkflowPermissions(userId, ownerId, collaborators)
  return permissions.canDelete
}

/**
 * Check if user can deploy workflow
 */
export function canDeployWorkflow(
  userId: string,
  ownerId: string,
  collaborators: WorkflowCollaborator[]
): boolean {
  const permissions = getWorkflowPermissions(userId, ownerId, collaborators)
  return permissions.canDeploy
}

/**
 * Check if user can manage collaborators
 */
export function canManageCollaborators(
  userId: string,
  ownerId: string,
  collaborators: WorkflowCollaborator[]
): boolean {
  const permissions = getWorkflowPermissions(userId, ownerId, collaborators)
  return permissions.canManageCollaborators
}

/**
 * Format role for display
 */
export function formatRole(role: WorkflowRole): string {
  switch (role) {
    case 'owner':
      return 'Owner'
    case 'editor':
      return 'Editor'
    case 'viewer':
      return 'Viewer'
    default:
      return 'Unknown'
  }
}

/**
 * Get role description
 */
export function getRoleDescription(role: WorkflowRole): string {
  switch (role) {
    case 'owner':
      return 'Full access - can edit, delete, deploy, and manage collaborators'
    case 'editor':
      return 'Can view and edit workflow, but cannot delete or deploy'
    case 'viewer':
      return 'Can only view workflow, cannot make changes'
    default:
      return 'No access'
  }
}

/**
 * Get role color for UI
 */
export function getRoleColor(role: WorkflowRole): string {
  switch (role) {
    case 'owner':
      return 'blue'
    case 'editor':
      return 'green'
    case 'viewer':
      return 'gray'
    default:
      return 'gray'
  }
}
