import { createLogger } from '@/lib/logs/console-logger'
import { withSpan } from '@/lib/observability'
import { BlockOutput } from '@/blocks/types'
import { SerializedBlock } from '@/serializer/types'
import { BlockHandler, ExecutionContext } from '../../types'

const logger = createLogger('ApprovalBlockHandler')

/**
 * Special error class to signal workflow should pause for HITL
 */
export class HITLPauseError extends Error {
  public readonly requestId: string
  public readonly blockId: string
  public readonly status: 'pending'

  constructor(requestId: string, blockId: string) {
    super(`Workflow paused for HITL approval: ${requestId}`)
    this.name = 'HITLPauseError'
    this.requestId = requestId
    this.blockId = blockId
    this.status = 'pending'
  }
}

// Get base URL for API calls
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// Check for existing HITL request via API (any status - pending, approved, or rejected)
async function checkExistingRequest(
  workflowId: string,
  executionId: string,
  blockId: string
): Promise<any | null> {
  try {
    const baseUrl = getBaseUrl()
    // First check for pending requests
    const pendingResponse = await fetch(
      `${baseUrl}/api/hitl/requests?workflowId=${workflowId}&executionId=${executionId}&blockId=${blockId}&status=pending`,
      { method: 'GET' }
    )

    if (pendingResponse.ok) {
      const pendingData = await pendingResponse.json()
      if (pendingData.success && pendingData.data && pendingData.data.length > 0) {
        return pendingData.data[0]
      }
    }

    // Then check for approved requests
    const approvedResponse = await fetch(
      `${baseUrl}/api/hitl/requests?workflowId=${workflowId}&executionId=${executionId}&blockId=${blockId}&status=approved`,
      { method: 'GET' }
    )

    if (approvedResponse.ok) {
      const approvedData = await approvedResponse.json()
      if (approvedData.success && approvedData.data && approvedData.data.length > 0) {
        return approvedData.data[0]
      }
    }

    // Finally check for rejected requests
    const rejectedResponse = await fetch(
      `${baseUrl}/api/hitl/requests?workflowId=${workflowId}&executionId=${executionId}&blockId=${blockId}&status=rejected`,
      { method: 'GET' }
    )

    if (rejectedResponse.ok) {
      const rejectedData = await rejectedResponse.json()
      if (rejectedData.success && rejectedData.data && rejectedData.data.length > 0) {
        return rejectedData.data[0]
      }
    }

    return null
  } catch (error) {
    logger.warn('Failed to check existing request', { error })
    return null
  }
}

// Create HITL request via API
async function createHITLRequestViaAPI(params: {
  workflowId: string
  executionId: string
  blockId: string
  requestType: string
  title: string
  description?: string
  data?: any
  options?: any
  assignedToEmail?: string
  timeoutMinutes?: number
  priority: string
  notificationChannels: string[]
  metadata?: any
}): Promise<{ id: string; status: string }> {
  const baseUrl = getBaseUrl()
  const response = await fetch(`${baseUrl}/api/hitl/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `Failed to create HITL request: ${response.status}`)
  }

  const data = await response.json()
  if (!data.success) {
    throw new Error(data.error || 'Failed to create HITL request')
  }

  return data.data
}

/**
 * Handler for Approval blocks that implements proper HITL pause/resume
 * Uses API calls instead of direct database access (works on client-side)
 */
export class ApprovalBlockHandler implements BlockHandler {
  canHandle(block: SerializedBlock): boolean {
    return block.metadata?.id === 'approval'
  }

  async execute(
    block: SerializedBlock,
    inputs: Record<string, any>,
    context: ExecutionContext
  ): Promise<BlockOutput> {
    return withSpan(
      'executor.handler.approval',
      async () => this.executeInternal(block, inputs, context),
      { blockId: block.id, workflowId: context.workflowId }
    )
  }

  private async executeInternal(
    block: SerializedBlock,
    inputs: Record<string, any>,
    context: ExecutionContext
  ): Promise<BlockOutput> {
    const blockId = block.id
    const executionId = context.executionId || context.workflowId

    logger.info('Executing approval block', {
      blockId,
      workflowId: context.workflowId,
      executionId,
      title: inputs.title,
    })

    try {
      // Check if there's already an existing request for this block via API (any status)
      const existingRequest = await checkExistingRequest(context.workflowId, executionId, blockId)

      if (existingRequest) {
        logger.info('Found existing HITL request', {
          requestId: existingRequest.id,
          status: existingRequest.status,
        })

        // Check if it's been responded to
        if (existingRequest.status === 'pending') {
          // Still waiting for response - throw pause error
          logger.info('HITL request still pending, pausing workflow', {
            requestId: existingRequest.id,
          })
          throw new HITLPauseError(existingRequest.id, blockId)
        }

        // Request has been responded to - return the result
        logger.info('HITL request completed', {
          requestId: existingRequest.id,
          status: existingRequest.status,
        })

        // If rejected, we might want to throw an error or handle differently
        if (existingRequest.status === 'rejected') {
          return {
            response: {
              status: 'rejected',
              response: existingRequest.response,
              responseNote: existingRequest.responseNote,
              respondedBy: existingRequest.respondedBy,
              respondedAt: existingRequest.respondedAt,
              requestId: existingRequest.id,
              error: 'Request was rejected',
            },
          }
        }

        // Approved - continue with success
        return {
          response: {
            status: existingRequest.status,
            response: existingRequest.response,
            responseNote: existingRequest.responseNote,
            respondedBy: existingRequest.respondedBy,
            respondedAt: existingRequest.respondedAt,
            requestId: existingRequest.id,
          },
        }
      }

      // No existing request - create a new HITL request via API
      logger.info('Creating new HITL request via API', {
        blockId,
        workflowId: context.workflowId,
        title: inputs.title,
      })

      const request = await createHITLRequestViaAPI({
        workflowId: context.workflowId,
        executionId,
        blockId,
        requestType: inputs.requestType || 'approval',
        title: inputs.title,
        description: inputs.description,
        data: inputs.data,
        options: inputs.options,
        assignedToEmail: inputs.assignedToEmail,
        timeoutMinutes: inputs.timeoutMinutes ? parseInt(inputs.timeoutMinutes) : undefined,
        priority: inputs.priority || 'normal',
        notificationChannels: inputs.notificationChannels || ['email'],
        metadata: {
          webhookUrl: inputs.webhookUrl,
          onTimeout: inputs.onTimeout || 'error',
          retryCount: inputs.retryCount ? parseInt(inputs.retryCount) : 3,
        },
      })

      logger.info('Created HITL request via API', {
        requestId: request.id,
        blockId,
      })

      // Throw pause error to stop workflow execution
      throw new HITLPauseError(request.id, blockId)
    } catch (error) {
      // Re-throw HITLPauseError - this is expected
      if (error instanceof HITLPauseError) {
        throw error
      }

      // Log and re-throw other errors
      logger.error('Failed to execute approval block', {
        blockId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}
