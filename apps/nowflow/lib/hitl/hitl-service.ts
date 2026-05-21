import { and, desc, eq, lt, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { hitlPausedExecution, hitlRequest } from '@/db/schema'
import type {
  CreateHITLRequestOptions,
  HITLPriority,
  HITLRequestData,
  HITLRequestStatus,
  HITLRequestType,
  PausedExecutionState,
  RespondToRequestOptions,
} from './hitl-types'

// Re-export types so existing consumers don't break
export type {
  HITLRequestType,
  HITLRequestStatus,
  HITLPriority,
  CreateHITLRequestOptions,
  HITLRequestData,
  RespondToRequestOptions,
  PausedExecutionState,
} from './hitl-types'

// Re-export sendNotifications from the notifications module
export { sendNotifications } from './hitl-notifications'

const logger = createLogger('HITLService')

/**
 * Creates a new HITL request
 */
export async function createHITLRequest(
  options: CreateHITLRequestOptions
): Promise<HITLRequestData> {
  const {
    workflowId,
    executionId,
    blockId,
    requestType,
    title,
    description,
    data,
    options: requestOptions,
    assignedTo,
    assignedToEmail,
    timeoutMinutes,
    priority = 'normal',
    notificationChannels = ['email'],
    metadata,
  } = options

  try {
    const requestId = uuidv4()
    const now = new Date()
    const timeoutAt = timeoutMinutes ? new Date(now.getTime() + timeoutMinutes * 60 * 1000) : null

    await db.insert(hitlRequest).values({
      id: requestId,
      workflowId,
      executionId,
      blockId,
      requestType,
      status: 'pending',
      title,
      description,
      data,
      options: requestOptions,
      assignedTo,
      assignedToEmail,
      timeoutAt,
      priority,
      notificationChannels,
      metadata,
      createdAt: now,
    })

    logger.info('Created HITL request', {
      requestId,
      workflowId,
      executionId,
      requestType,
      priority,
    })

    const request: HITLRequestData = {
      id: requestId,
      workflowId,
      executionId,
      blockId,
      requestType,
      status: 'pending',
      title,
      description: description || null,
      data,
      options: requestOptions,
      assignedTo: assignedTo || null,
      assignedToEmail: assignedToEmail || null,
      respondedBy: null,
      response: null,
      responseNote: null,
      timeoutAt,
      priority,
      notificationSent: false,
      notificationChannels,
      createdAt: now,
      respondedAt: null,
      metadata,
    }

    return request
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Unknown error',
      code: error?.code,
      constraint: error?.constraint,
      detail: error?.detail,
      table: error?.table,
      stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
    }
    logger.error('Failed to create HITL request', { options, error: errorDetails })
    throw new Error(`Failed to create HITL request: ${errorDetails.message}`)
  }
}

/**
 * Gets a HITL request by ID
 */
export async function getHITLRequest(requestId: string): Promise<HITLRequestData | null> {
  try {
    const [request] = await db
      .select()
      .from(hitlRequest)
      .where(eq(hitlRequest.id, requestId))
      .limit(1)

    return (request as HITLRequestData) || null
  } catch (error) {
    logger.error('Failed to get HITL request', { requestId, error })
    throw error
  }
}

/**
 * Gets pending HITL requests for a user
 */
export async function getPendingRequests(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ requests: HITLRequestData[]; total: number }> {
  const { limit = 50, offset = 0 } = options

  try {
    const requests = await db
      .select()
      .from(hitlRequest)
      .where(and(eq(hitlRequest.status, 'pending'), eq(hitlRequest.assignedTo, userId)))
      .orderBy(
        sql`CASE ${hitlRequest.priority}
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END`,
        desc(hitlRequest.createdAt)
      )
      .limit(limit)
      .offset(offset)

    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(hitlRequest)
      .where(and(eq(hitlRequest.status, 'pending'), eq(hitlRequest.assignedTo, userId)))

    return {
      requests: requests as HITLRequestData[],
      total: Number(count),
    }
  } catch (error) {
    logger.error('Failed to get pending requests', { userId, error })
    throw error
  }
}

/**
 * Gets HITL requests for a workflow execution
 */
export async function getExecutionRequests(executionId: string): Promise<HITLRequestData[]> {
  try {
    const requests = await db
      .select()
      .from(hitlRequest)
      .where(eq(hitlRequest.executionId, executionId))
      .orderBy(desc(hitlRequest.createdAt))

    return requests as HITLRequestData[]
  } catch (error) {
    logger.error('Failed to get execution requests', { executionId, error })
    throw error
  }
}

/**
 * Gets a pending HITL request for a specific block in a workflow execution
 */
export async function getPendingRequest(
  workflowId: string,
  executionId: string,
  blockId: string
): Promise<HITLRequestData | null> {
  try {
    const [request] = await db
      .select()
      .from(hitlRequest)
      .where(
        and(
          eq(hitlRequest.workflowId, workflowId),
          eq(hitlRequest.executionId, executionId),
          eq(hitlRequest.blockId, blockId)
        )
      )
      .orderBy(desc(hitlRequest.createdAt))
      .limit(1)

    return (request as HITLRequestData) || null
  } catch (error) {
    logger.error('Failed to get pending request', { workflowId, executionId, blockId, error })
    throw error
  }
}

/**
 * Responds to a HITL request
 */
export async function respondToRequest(options: RespondToRequestOptions): Promise<HITLRequestData> {
  const { requestId, userId, response, status, responseNote } = options

  try {
    const request = await getHITLRequest(requestId)
    if (!request) {
      throw new Error(`HITL request ${requestId} not found`)
    }

    if (request.status !== 'pending') {
      throw new Error(`HITL request ${requestId} is not pending (status: ${request.status})`)
    }

    const now = new Date()

    await db
      .update(hitlRequest)
      .set({
        status,
        respondedBy: userId,
        response,
        responseNote,
        respondedAt: now,
      })
      .where(eq(hitlRequest.id, requestId))

    logger.info('Responded to HITL request', {
      requestId,
      userId,
      status,
    })

    return {
      ...request,
      status,
      respondedBy: userId,
      response,
      responseNote: responseNote || null,
      respondedAt: now,
    }
  } catch (error) {
    logger.error('Failed to respond to HITL request', { options, error })
    throw error
  }
}

/**
 * Cancels a HITL request
 */
export async function cancelRequest(requestId: string, reason?: string): Promise<void> {
  try {
    await db
      .update(hitlRequest)
      .set({
        status: 'cancelled',
        responseNote: reason || 'Request cancelled',
        respondedAt: new Date(),
      })
      .where(eq(hitlRequest.id, requestId))

    logger.info('Cancelled HITL request', { requestId, reason })
  } catch (error) {
    logger.error('Failed to cancel HITL request', { requestId, error })
    throw error
  }
}

/**
 * Stores the execution state when paused for HITL
 */
export async function storePausedExecution(
  hitlRequestId: string,
  workflowId: string,
  executionId: string,
  state: PausedExecutionState
): Promise<void> {
  try {
    await db.insert(hitlPausedExecution).values({
      id: uuidv4(),
      hitlRequestId,
      workflowId,
      executionId,
      executionState: state,
      pausedAt: new Date(),
    })

    logger.info('Stored paused execution state', {
      hitlRequestId,
      workflowId,
      executionId,
    })
  } catch (error) {
    logger.error('Failed to store paused execution', { hitlRequestId, error })
    throw error
  }
}

/**
 * Gets the paused execution state
 */
export async function getPausedExecution(
  hitlRequestId: string
): Promise<PausedExecutionState | null> {
  try {
    const [paused] = await db
      .select()
      .from(hitlPausedExecution)
      .where(eq(hitlPausedExecution.hitlRequestId, hitlRequestId))
      .limit(1)

    if (!paused) {
      return null
    }

    return paused.executionState as PausedExecutionState
  } catch (error) {
    logger.error('Failed to get paused execution', { hitlRequestId, error })
    throw error
  }
}

/**
 * Marks paused execution as resumed
 */
export async function markExecutionResumed(hitlRequestId: string, result?: any): Promise<void> {
  try {
    await db
      .update(hitlPausedExecution)
      .set({
        resumedAt: new Date(),
        resumeResult: result,
      })
      .where(eq(hitlPausedExecution.hitlRequestId, hitlRequestId))

    logger.info('Marked execution as resumed', { hitlRequestId })
  } catch (error) {
    logger.error('Failed to mark execution resumed', { hitlRequestId, error })
    throw error
  }
}

/**
 * Processes timed out requests
 */
export async function processTimeouts(): Promise<number> {
  try {
    const now = new Date()

    const result = await db
      .update(hitlRequest)
      .set({
        status: 'timeout',
        responseNote: 'Request timed out',
        respondedAt: now,
      })
      .where(and(eq(hitlRequest.status, 'pending'), lt(hitlRequest.timeoutAt, now)))

    const timedOutCount = (result as any).rowCount || 0

    if (timedOutCount > 0) {
      logger.info(`Processed ${timedOutCount} timed out HITL requests`)
    }

    return timedOutCount
  } catch (error) {
    logger.error('Failed to process timeouts', { error })
    throw error
  }
}

/**
 * Gets HITL request statistics
 */
export async function getRequestStats(workflowId?: string): Promise<{
  pending: number
  approved: number
  rejected: number
  timeout: number
  avgResponseTimeMs: number
}> {
  try {
    const baseWhere = workflowId ? eq(hitlRequest.workflowId, workflowId) : sql`1=1`

    const [stats] = await db
      .select({
        pending: sql`count(*) filter (where ${hitlRequest.status} = 'pending')`,
        approved: sql`count(*) filter (where ${hitlRequest.status} = 'approved')`,
        rejected: sql`count(*) filter (where ${hitlRequest.status} = 'rejected')`,
        timeout: sql`count(*) filter (where ${hitlRequest.status} = 'timeout')`,
        avgResponseTimeMs: sql`avg(extract(epoch from (${hitlRequest.respondedAt} - ${hitlRequest.createdAt})) * 1000) filter (where ${hitlRequest.respondedAt} is not null)`,
      })
      .from(hitlRequest)
      .where(baseWhere)

    return {
      pending: Number(stats.pending) || 0,
      approved: Number(stats.approved) || 0,
      rejected: Number(stats.rejected) || 0,
      timeout: Number(stats.timeout) || 0,
      avgResponseTimeMs: Number(stats.avgResponseTimeMs) || 0,
    }
  } catch (error) {
    logger.error('Failed to get request stats', { workflowId, error })
    throw error
  }
}
