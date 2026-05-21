import { and, desc, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { hitlEscalationRule, hitlRequest } from '@/db/schema'
import { getHITLRequest, HITLRequestData, sendNotifications } from './hitl-service'

const logger = createLogger('EscalationEngine')

export interface EscalationCondition {
  type: 'timeout' | 'priority' | 'custom'
  // For timeout
  minutes?: number
  // For priority
  value?: string
  // For custom
  expression?: string
}

export interface EscalationAction {
  type: 'reassign' | 'notify' | 'escalate_priority' | 'auto_approve' | 'auto_reject'
  // For reassign
  to?: string
  toEmail?: string
  // For notify
  channels?: string[]
  message?: string
  // For escalate_priority
  newPriority?: 'low' | 'normal' | 'high' | 'urgent'
}

export interface EscalationRule {
  id: string
  workflowId: string
  name: string
  description: string | null
  condition: EscalationCondition
  action: EscalationAction
  priority: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Creates a new escalation rule
 */
export async function createEscalationRule(
  workflowId: string,
  rule: {
    name: string
    description?: string
    condition: EscalationCondition
    action: EscalationAction
    priority?: number
  }
): Promise<EscalationRule> {
  try {
    const ruleId = uuidv4()
    const now = new Date()

    await db.insert(hitlEscalationRule).values({
      id: ruleId,
      workflowId,
      name: rule.name,
      description: rule.description,
      condition: rule.condition,
      action: rule.action,
      priority: rule.priority ?? 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })

    logger.info('Created escalation rule', { ruleId, workflowId, name: rule.name })

    return {
      id: ruleId,
      workflowId,
      name: rule.name,
      description: rule.description || null,
      condition: rule.condition,
      action: rule.action,
      priority: rule.priority ?? 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }
  } catch (error) {
    logger.error('Failed to create escalation rule', { workflowId, error })
    throw error
  }
}

/**
 * Gets escalation rules for a workflow
 */
export async function getEscalationRules(workflowId: string): Promise<EscalationRule[]> {
  try {
    const rules = await db
      .select()
      .from(hitlEscalationRule)
      .where(
        and(eq(hitlEscalationRule.workflowId, workflowId), eq(hitlEscalationRule.isActive, true))
      )
      .orderBy(desc(hitlEscalationRule.priority))

    return rules as EscalationRule[]
  } catch (error) {
    logger.error('Failed to get escalation rules', { workflowId, error })
    throw error
  }
}

/**
 * Updates an escalation rule
 */
export async function updateEscalationRule(
  ruleId: string,
  updates: Partial<{
    name: string
    description: string
    condition: EscalationCondition
    action: EscalationAction
    priority: number
    isActive: boolean
  }>
): Promise<void> {
  try {
    await db
      .update(hitlEscalationRule)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(hitlEscalationRule.id, ruleId))

    logger.info('Updated escalation rule', { ruleId })
  } catch (error) {
    logger.error('Failed to update escalation rule', { ruleId, error })
    throw error
  }
}

/**
 * Deletes an escalation rule
 */
export async function deleteEscalationRule(ruleId: string): Promise<void> {
  try {
    await db.delete(hitlEscalationRule).where(eq(hitlEscalationRule.id, ruleId))
    logger.info('Deleted escalation rule', { ruleId })
  } catch (error) {
    logger.error('Failed to delete escalation rule', { ruleId, error })
    throw error
  }
}

/**
 * Evaluates escalation rules for a request
 */
export async function evaluateEscalation(request: HITLRequestData): Promise<EscalationRule | null> {
  try {
    const rules = await getEscalationRules(request.workflowId)

    for (const rule of rules) {
      if (evaluateCondition(rule.condition, request)) {
        return rule
      }
    }

    return null
  } catch (error) {
    logger.error('Failed to evaluate escalation', { requestId: request.id, error })
    throw error
  }
}

/**
 * Evaluates a single condition against a request
 */
function evaluateCondition(condition: EscalationCondition, request: HITLRequestData): boolean {
  switch (condition.type) {
    case 'timeout':
      if (!condition.minutes) return false
      const ageMs = Date.now() - request.createdAt.getTime()
      const ageMinutes = ageMs / (1000 * 60)
      return ageMinutes >= condition.minutes

    case 'priority':
      return request.priority === condition.value

    case 'custom':
      // Safe expression evaluation — only supports simple comparisons
      // without eval() to prevent arbitrary code execution
      if (!condition.expression) return false
      try {
        const expr = condition.expression.trim()
        // Build a safe context of allowed variables
        const context: Record<string, string | undefined> = {
          'request.priority': request.priority,
          'request.status': request.status,
        }
        // Only support simple equality/inequality patterns:
        // "request.priority == 'critical'" or "request.status != 'resolved'"
        const match = expr.match(/^([\w.]+)\s*(===?|!==?)\s*['"]([^'"]*)['"]\s*$/)
        if (!match) return false
        const [, variable, operator, value] = match
        const actualValue = context[variable]
        if (actualValue === undefined) return false
        if (operator === '==' || operator === '===') return actualValue === value
        if (operator === '!=' || operator === '!==') return actualValue !== value
        return false
      } catch {
        return false
      }

    default:
      return false
  }
}

/**
 * Executes an escalation action
 */
export async function executeEscalation(
  request: HITLRequestData,
  rule: EscalationRule
): Promise<void> {
  try {
    logger.info('Executing escalation', {
      requestId: request.id,
      ruleId: rule.id,
      actionType: rule.action.type,
    })

    switch (rule.action.type) {
      case 'reassign':
        await executeReassign(request, rule.action)
        break

      case 'notify':
        await executeNotify(request, rule.action)
        break

      case 'escalate_priority':
        await executeEscalatePriority(request, rule.action)
        break

      case 'auto_approve':
        await executeAutoApprove(request)
        break

      case 'auto_reject':
        await executeAutoReject(request)
        break

      default:
        logger.warn('Unknown escalation action type', { actionType: rule.action.type })
    }
  } catch (error) {
    logger.error('Failed to execute escalation', {
      requestId: request.id,
      ruleId: rule.id,
      error,
    })
    throw error
  }
}

/**
 * Reassigns a request to a different user
 */
async function executeReassign(request: HITLRequestData, action: EscalationAction): Promise<void> {
  if (!action.to && !action.toEmail) {
    logger.warn('Reassign action missing target', { requestId: request.id })
    return
  }

  await db
    .update(hitlRequest)
    .set({
      assignedTo: action.to || null,
      assignedToEmail: action.toEmail || null,
      notificationSent: false, // Reset to send new notification
    })
    .where(eq(hitlRequest.id, request.id))

  // Send notification to new assignee
  await sendNotifications(request.id)

  logger.info('Reassigned HITL request', {
    requestId: request.id,
    newAssignee: action.to || action.toEmail,
  })
}

/**
 * Sends additional notifications
 */
async function executeNotify(request: HITLRequestData, action: EscalationAction): Promise<void> {
  const channels = action.channels || ['email']

  // Update notification channels and reset sent flag
  await db
    .update(hitlRequest)
    .set({
      notificationChannels: channels,
      notificationSent: false,
    })
    .where(eq(hitlRequest.id, request.id))

  await sendNotifications(request.id)

  logger.info('Sent escalation notifications', {
    requestId: request.id,
    channels,
  })
}

/**
 * Escalates the priority of a request
 */
async function executeEscalatePriority(
  request: HITLRequestData,
  action: EscalationAction
): Promise<void> {
  const newPriority = action.newPriority || 'high'

  await db.update(hitlRequest).set({ priority: newPriority }).where(eq(hitlRequest.id, request.id))

  logger.info('Escalated request priority', {
    requestId: request.id,
    oldPriority: request.priority,
    newPriority,
  })
}

/**
 * Auto-approves a request
 */
async function executeAutoApprove(request: HITLRequestData): Promise<void> {
  await db
    .update(hitlRequest)
    .set({
      status: 'approved',
      responseNote: 'Auto-approved by escalation rule',
      respondedAt: new Date(),
    })
    .where(eq(hitlRequest.id, request.id))

  logger.info('Auto-approved HITL request', { requestId: request.id })
}

/**
 * Auto-rejects a request
 */
async function executeAutoReject(request: HITLRequestData): Promise<void> {
  await db
    .update(hitlRequest)
    .set({
      status: 'rejected',
      responseNote: 'Auto-rejected by escalation rule',
      respondedAt: new Date(),
    })
    .where(eq(hitlRequest.id, request.id))

  logger.info('Auto-rejected HITL request', { requestId: request.id })
}

/**
 * Processes all pending requests for escalation
 */
export async function processEscalations(): Promise<number> {
  try {
    // Get all pending requests
    const pendingRequests = await db
      .select()
      .from(hitlRequest)
      .where(eq(hitlRequest.status, 'pending'))

    let escalatedCount = 0

    for (const request of pendingRequests) {
      const rule = await evaluateEscalation(request as HITLRequestData)
      if (rule) {
        await executeEscalation(request as HITLRequestData, rule)
        escalatedCount++
      }
    }

    if (escalatedCount > 0) {
      logger.info(`Processed ${escalatedCount} escalations`)
    }

    return escalatedCount
  } catch (error) {
    logger.error('Failed to process escalations', { error })
    throw error
  }
}

/**
 * Creates default escalation rules for a workflow
 */
export async function createDefaultRules(workflowId: string): Promise<void> {
  try {
    // Rule 1: Escalate priority after 30 minutes
    await createEscalationRule(workflowId, {
      name: 'Escalate after 30 minutes',
      description: 'Automatically escalate priority to high after 30 minutes',
      condition: { type: 'timeout', minutes: 30 },
      action: { type: 'escalate_priority', newPriority: 'high' },
      priority: 10,
    })

    // Rule 2: Auto-reject after 24 hours
    await createEscalationRule(workflowId, {
      name: 'Auto-reject after 24 hours',
      description: 'Automatically reject requests that are pending for 24 hours',
      condition: { type: 'timeout', minutes: 1440 },
      action: { type: 'auto_reject' },
      priority: 5,
    })

    logger.info('Created default escalation rules', { workflowId })
  } catch (error) {
    logger.error('Failed to create default rules', { workflowId, error })
    throw error
  }
}
