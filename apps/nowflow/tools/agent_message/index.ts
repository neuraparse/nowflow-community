import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig, ToolResponse } from '../types'

const logger = createLogger('AgentMessageTool')

export interface AgentMessageParams {
  // Message configuration
  targetAgent: string
  messageType: 'request' | 'response' | 'broadcast' | 'event'
  content: any
  priority?: 'low' | 'normal' | 'high' | 'urgent'

  // Response handling
  waitForResponse?: boolean
  timeout?: number

  // Context
  workflowId?: string
  executionId?: string
  fromAgent?: string
  metadata?: Record<string, any>
}

export interface AgentMessageResponse extends ToolResponse {
  output: {
    messageId: string
    delivered: boolean
    response?: any
    respondedAt?: string
    error?: string
  }
}

export const agentMessageTool: ToolConfig<AgentMessageParams, AgentMessageResponse> = {
  id: 'agent_message',
  name: 'Agent Message',
  description: 'Send messages between agents for inter-agent communication and coordination',
  version: '1.0.0',

  params: {
    targetAgent: {
      type: 'string',
      required: true,
      description: 'Target agent block ID or name to send message to',
    },
    messageType: {
      type: 'string',
      required: true,
      description: 'Type of message: request, response, broadcast, or event',
    },
    content: {
      type: 'object',
      required: true,
      description: 'Message content (any JSON-serializable data)',
    },
    priority: {
      type: 'string',
      required: false,
      default: 'normal',
      description: 'Message priority level',
    },
    waitForResponse: {
      type: 'boolean',
      required: false,
      default: false,
      description: 'Wait for a response from the target agent',
    },
    timeout: {
      type: 'number',
      required: false,
      default: 30000,
      description: 'Timeout in milliseconds when waiting for response',
    },
    workflowId: {
      type: 'string',
      required: false,
      description: 'Workflow ID for message context',
    },
    executionId: {
      type: 'string',
      required: false,
      description: 'Execution ID for message context',
    },
    fromAgent: {
      type: 'string',
      required: false,
      description: 'Sender agent identifier',
    },
    metadata: {
      type: 'object',
      required: false,
      description: 'Additional metadata to attach to the message',
    },
  },

  request: {
    url: '/api/agents/messages',
    method: 'POST',
    headers: () => ({
      'Content-Type': 'application/json',
    }),
    body: (params) => ({
      targetAgent: params.targetAgent,
      messageType: params.messageType,
      content: params.content,
      priority: params.priority || 'normal',
      waitForResponse: params.waitForResponse || false,
      timeout: params.timeout || 30000,
      workflowId: params.workflowId,
      executionId: params.executionId,
      fromAgent: params.fromAgent,
      metadata: params.metadata,
    }),
    isInternalRoute: true,
  },

  // Direct execution for in-process messaging
  directExecution: async (params) => {
    const { v4: uuidv4 } = await import('uuid')
    const messageId = uuidv4()

    logger.debug('Agent message sent', {
      messageId,
      targetAgent: params.targetAgent,
      messageType: params.messageType,
    })

    // For now, return success - actual messaging will be handled by the executor
    return {
      success: true,
      output: {
        messageId,
        delivered: true,
        response: params.waitForResponse ? { acknowledged: true } : undefined,
      },
    }
  },

  transformResponse: async (response: Response) => {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Agent message API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      success: true,
      output: {
        messageId: data.messageId,
        delivered: data.delivered ?? true,
        response: data.response,
        respondedAt: data.respondedAt,
      },
    }
  },

  transformError: (error) => {
    logger.error('Agent message error:', error)
    return `Agent message error: ${error instanceof Error ? error.message : String(error)}`
  },
}

export default agentMessageTool
