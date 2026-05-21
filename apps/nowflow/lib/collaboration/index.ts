/**
 * Barrel export for the realtime collaboration namespace.
 *
 * Surfaces the SSE-based collaboration service (cursor presence, block locks,
 * change broadcasts, conflict resolution) used by the workflow editor.
 * Existing nested-path imports keep working unchanged.
 */

export { CollaborationService, getCollaborationService } from './collaboration-service'
export type {
  BlockChange,
  BlockLock,
  Collaborator,
  CollaborationEvent,
  ConflictResolution,
} from './collaboration-service'
