/**
 * Barrel export for the Human-In-The-Loop (HITL) namespace.
 *
 * Surfaces request CRUD, paused-execution state persistence, escalation
 * engine, and notifications through a single import site. Existing
 * nested-path imports keep working unchanged.
 */

// Type system (request/status/priority + payload shapes).
export type {
  CreateHITLRequestOptions,
  HITLPriority,
  HITLRequestData,
  HITLRequestStatus,
  HITLRequestType,
  PausedExecutionState,
  RespondToRequestOptions,
} from './hitl-types'

// Service (request CRUD + paused-execution coordination).
export {
  cancelRequest,
  createHITLRequest,
  getExecutionRequests,
  getHITLRequest,
  getPausedExecution,
  getPendingRequest,
  getPendingRequests,
  getRequestStats,
  markExecutionResumed,
  processTimeouts,
  respondToRequest,
  sendNotifications,
  storePausedExecution,
} from './hitl-service'

// Execution-state serialization (used to persist a paused workflow context).
export {
  deserializeExecutionContext,
  loadPausedExecutionState,
  savePausedExecutionState,
  serializeExecutionContext,
} from './execution-state'
export type { SerializedExecutionState } from './execution-state'

// Escalation engine (rules + evaluation + execution).
export {
  createDefaultRules,
  createEscalationRule,
  deleteEscalationRule,
  evaluateEscalation,
  executeEscalation,
  getEscalationRules,
  processEscalations,
  updateEscalationRule,
} from './escalation-engine'
export type { EscalationAction, EscalationCondition, EscalationRule } from './escalation-engine'
