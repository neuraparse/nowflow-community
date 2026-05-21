import { ChatBubbleLeftRightIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { parseNumericString } from '../helpers'
import { BlockConfig } from '../types'

interface AgentMessageResponse extends ToolResponse {
  output: {
    messageId: string
    status: 'sent' | 'delivered' | 'read' | 'failed'
    response: any | null
    sentAt: string
    deliveredAt: string | null
    responseReceivedAt: string | null
  }
}

export const AgentMessageBlock: BlockConfig<AgentMessageResponse> = {
  type: 'agent_message',
  name: 'Agent Message',
  description: 'Send messages between agents',
  longDescription:
    'Enables direct communication between agents in a workflow. Supports request-response patterns, broadcasts, and async messaging.',
  category: 'agents',
  bgColor: '#10B981',
  icon: ChatBubbleLeftRightIcon,
  subBlocks: [
    {
      id: 'messageType',
      title: 'Message Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Request', id: 'request' },
        { label: 'Response', id: 'response' },
        { label: 'Broadcast', id: 'broadcast' },
        { label: 'Event', id: 'event' },
      ],
    },
    {
      id: 'targetAgent',
      title: 'Target Agent',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Agent name or ID',
      condition: {
        field: 'messageType',
        value: ['request', 'response'],
      },
    },
    {
      id: 'channel',
      title: 'Channel',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Broadcast channel name',
      condition: {
        field: 'messageType',
        value: ['broadcast', 'event'],
      },
    },
    {
      id: 'content',
      title: 'Message Content',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Message content or JSON data...',
      rows: 4,
    },
    {
      id: 'contentType',
      title: 'Content Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Text', id: 'text' },
        { label: 'JSON', id: 'json' },
        { label: 'Task', id: 'task' },
        { label: 'Result', id: 'result' },
      ],
    },
    {
      id: 'priority',
      title: 'Priority',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Low', id: 'low' },
        { label: 'Normal', id: 'normal' },
        { label: 'High', id: 'high' },
        { label: 'Urgent', id: 'urgent' },
      ],
    },
    {
      id: 'waitForResponse',
      title: 'Wait for Response',
      type: 'switch',
      layout: 'half',
      description: 'Block execution until response received',
      condition: {
        field: 'messageType',
        value: 'request',
      },
    },
    {
      id: 'timeout',
      title: 'Timeout (seconds)',
      type: 'short-input',
      layout: 'half',
      placeholder: '30',
      condition: {
        field: 'waitForResponse',
        value: true,
      },
    },
    {
      id: 'metadata',
      title: 'Metadata',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "correlationId": "...",\n  "tags": []\n}',
      description: 'Additional metadata to include with the message',
    },
  ],
  tools: {
    access: ['agent_message'],
    config: {
      tool: () => 'agent_message',
      params: (params) => ({
        messageType: params.messageType || 'request',
        targetAgent: params.targetAgent,
        channel: params.channel,
        content: params.content,
        contentType: params.contentType || 'text',
        priority: params.priority || 'normal',
        waitForResponse: params.waitForResponse ?? false,
        timeout: parseNumericString(params.timeout) ?? 30,
        metadata: params.metadata ? JSON.parse(params.metadata) : {},
      }),
    },
  },
  inputs: {
    messageType: { type: 'string', required: true },
    targetAgent: { type: 'string', required: false },
    channel: { type: 'string', required: false },
    content: { type: 'string', required: true },
    contentType: { type: 'string', required: false },
    priority: { type: 'string', required: false },
    waitForResponse: { type: 'boolean', required: false },
    timeout: { type: 'number', required: false },
    metadata: { type: 'json', required: false },
  },
  outputs: {
    response: {
      type: {
        messageId: 'string',
        status: 'string',
        response: 'json',
        sentAt: 'string',
        deliveredAt: 'string',
        responseReceivedAt: 'string',
      },
    },
  },
}
