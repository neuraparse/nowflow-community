/**
 * Barrel export for the workflow domain.
 *
 * `lib/workflows/` contains the canonical surface for workflow lifecycle,
 * permissions, versioning, diffing, and restore helpers. This barrel collects
 * the public API into a single import site so callers can `from '@/lib/workflows'`
 * without reaching into nested service files. Existing nested-path imports keep
 * working.
 */

// Permissions (workflow-level role helpers — distinct from workspace-member auth).
export {
  canDeleteWorkflow,
  canEditWorkflow,
  canManageCollaborators,
  formatRole,
  getRoleColor,
  getRoleDescription,
  getUserWorkflowRole,
  getWorkflowPermissions,
  hasWorkflowAccess,
} from './permissions'
export type { WorkflowPermissions, WorkflowRole } from './permissions'

// Common utility helpers.
export {
  getWorkflowById,
  hasWorkflowChanged,
  stripCustomToolPrefix,
  updateWorkflowRunCounts,
} from './utils'

// Creation (with subscription-tier limit enforcement).
export { WorkflowCreationLimitError, createWorkflowWithLimits } from './create-workflow'

// Versioning + tags + diff.
export {
  compareVersions,
  createVersion,
  formatSemanticVersion,
  getLatestVersionNumber,
  getNextSemanticVersion,
  getVersion,
  getVersions,
  getVersionsFiltered,
  parseSemanticVersion,
  pruneVersions,
  restoreVersion,
  toggleVersionPin,
  updateVersion,
} from './version-service'
export type {
  ChangeType,
  CreateVersionOptions,
  SemanticBumpType,
  SemanticVersion,
  VersionExportData,
  VersionFilter,
  VersionTimelineEntry,
  WorkflowVersionData,
} from './version-service'
export {
  DEFAULT_TAGS,
  createWorkflowTag,
  getAllAvailableTags,
  getDefaultTags,
  getWorkflowTags,
} from './version-tag-service'
export type { CreateTagInput, UpdateTagInput, VersionTag } from './version-tag-service'
export { computeWorkflowDiff, generateDetailedChanges, generateDiffSummary } from './diff-engine'
export type {
  BlockChange,
  BlockModification,
  EdgeChange,
  PropertyChange,
  WorkflowDiff,
} from './diff-engine'
