import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig, ToolResponse } from '../types'

const logger = createLogger('HITLApprovalTool')

export interface HITLApprovalParams {
  // Request configuration
  requestType: 'approval' | 'input' | 'review' | 'escalation'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  title: string
  description?: string
  data?: any

  // Assignment
  assignedToEmail?: string

  // Timeout configuration
  timeoutMinutes?: number
  onTimeout?: 'error' | 'approve' | 'reject' | 'retry'
  retryCount?: number

  // Options
  options?: Array<{ label: string; value: string }>

  // Notifications
  notificationChannels?: string[]
  webhookUrl?: string

  // Context (auto-filled by executor)
  workflowId?: string
  executionId?: string
  blockId?: string
}

export interface HITLApprovalResponse extends ToolResponse {
  output: {
    status: 'approved' | 'rejected' | 'pending' | 'timeout'
    response: any
    responseNote: string | null
    respondedBy: string | null
    respondedAt: string | null
    requestId: string
  }
}

export const hitlApprovalTool: ToolConfig<HITLApprovalParams, HITLApprovalResponse> = {
  id: 'hitl_approval',
  name: 'HITL Approval',
  description: 'Create a human-in-the-loop approval request that pauses workflow execution',
  version: '1.0.0',

  params: {
    requestType: {
      type: 'string',
      required: true,
      description: 'Type of HITL request: approval, input, review, or escalation',
    },
    priority: {
      type: 'string',
      required: true,
      description: 'Request priority: low, normal, high, or urgent',
    },
    title: {
      type: 'string',
      required: true,
      description: 'Title of the approval request',
    },
    description: {
      type: 'string',
      required: false,
      description: 'Detailed description of what needs approval',
    },
    data: {
      type: 'json',
      required: false,
      description: 'Additional context data to include with the request',
    },
    assignedToEmail: {
      type: 'string',
      required: false,
      description: 'Email of the person to assign this request to',
    },
    timeoutMinutes: {
      type: 'number',
      required: false,
      description: 'Minutes before the request times out',
    },
    onTimeout: {
      type: 'string',
      required: false,
      default: 'error',
      description: 'Action on timeout: error, approve, reject, or retry',
    },
    retryCount: {
      type: 'number',
      required: false,
      default: 3,
      description: 'Number of retries if onTimeout is retry',
    },
    options: {
      type: 'json',
      required: false,
      description: 'Custom response options',
    },
    notificationChannels: {
      type: 'json',
      required: false,
      default: ['email', 'push'],
      description: 'Notification channels: email, slack, webhook, push',
    },
    webhookUrl: {
      type: 'string',
      required: false,
      description: 'Webhook URL for notifications',
    },
    workflowId: {
      type: 'string',
      required: false,
      description: 'Workflow ID (auto-filled)',
    },
    executionId: {
      type: 'string',
      required: false,
      description: 'Execution ID (auto-filled)',
    },
    blockId: {
      type: 'string',
      required: false,
      description: 'Block ID (auto-filled)',
    },
  },

  request: {
    url: '/api/hitl/requests',
    method: 'POST',
    headers: () => ({
      'Content-Type': 'application/json',
    }),
    body: (params: any) => {
      // Extract context from _context (passed by executor) or direct params
      const context = params._context || {}
      const workflowId = params.workflowId || context.workflowId
      const executionId = params.executionId || context.executionId || workflowId
      const blockId = params.blockId || context.blockId

      return {
        workflowId,
        executionId,
        blockId,
        requestType: params.requestType,
        priority: params.priority,
        title: params.title,
        description: params.description,
        data: params.data,
        assignedToEmail: params.assignedToEmail,
        timeoutMinutes: params.timeoutMinutes,
        onTimeout: params.onTimeout || 'error',
        retryCount: params.retryCount || 3,
        options: params.options,
        notificationChannels: params.notificationChannels || ['email', 'push'],
        metadata: params.webhookUrl ? { webhookUrl: params.webhookUrl } : undefined,
      }
    },
    isInternalRoute: true,
  },

  // Direct execution for HITL
  directExecution: async (params: any) => {
    // Extract context from _context (passed by executor) or direct params
    const context = params._context || {}
    const workflowId = params.workflowId || context.workflowId
    const executionId = params.executionId || context.executionId || workflowId
    const blockId = params.blockId || context.blockId

    logger.info('HITL Approval requested', {
      requestType: params.requestType,
      title: params.title,
      workflowId,
      executionId,
      blockId,
    })

    // Validate required context
    if (!workflowId) {
      throw new Error('workflowId is required for HITL approval')
    }

    // Import dynamically to avoid client-side issues
    const { createHITLRequest, sendNotifications } = await import('@/lib/hitl/hitl-service')

    try {
      // Create the HITL request
      const request = await createHITLRequest({
        workflowId,
        executionId: executionId || workflowId,
        blockId: blockId || 'unknown',
        requestType: params.requestType,
        priority: params.priority,
        title: params.title,
        description: params.description,
        data: params.data,
        assignedToEmail: params.assignedToEmail,
        timeoutMinutes: params.timeoutMinutes,
        options: params.options,
        notificationChannels: params.notificationChannels || ['email', 'push'],
        metadata: params.webhookUrl ? { webhookUrl: params.webhookUrl } : undefined,
      })

      // Send notifications
      try {
        await sendNotifications(request.id)
      } catch (notifyError) {
        logger.warn('Failed to send HITL notifications', {
          requestId: request.id,
          error: notifyError,
        })
      }

      logger.info('HITL request created', { requestId: request.id })

      // Return pending status - the workflow will be paused
      // and the approval handler will poll for response
      return {
        success: true,
        output: {
          status: 'pending' as const,
          response: null,
          responseNote: null,
          respondedBy: null,
          respondedAt: null,
          requestId: request.id,
        },
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error creating HITL request'
      logger.error('Failed to create HITL request', {
        error: errorMessage,
        workflowId,
        executionId,
        blockId,
      })
      throw new Error(errorMessage)
    }
  },

  transformResponse: async (response: Response) => {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HITL API error: ${response.status}`)
    }

    const data = await response.json()

    return {
      success: true,
      output: {
        status: data.data?.status || 'pending',
        response: data.data?.response || null,
        responseNote: data.data?.responseNote || null,
        respondedBy: data.data?.respondedBy || null,
        respondedAt: data.data?.respondedAt || null,
        requestId: data.data?.id || data.data?.requestId,
      },
    }
  },

  transformError: (error) => {
    logger.error('HITL Approval error:', error)
    return `HITL Approval error: ${error instanceof Error ? error.message : String(error)}`
  },
}

export default hitlApprovalTool
