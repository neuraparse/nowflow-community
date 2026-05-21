import { MessageSquareIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { parseNumericString } from '../helpers'
import { BlockConfig } from '../types'

interface SendAndWaitResponse extends ToolResponse {
  output: {
    status: string
    response: any
    respondedBy: string | null
    respondedAt: string | null
  }
}

export const SendAndWaitBlock: BlockConfig<SendAndWaitResponse> = {
  type: 'send_and_wait',
  name: 'Send & Wait',
  description: 'Send a message and wait for user response',
  longDescription:
    'Send a message to a user or channel and pause the workflow until a response is received. Useful for collecting freeform input mid-workflow.',
  category: 'blocks',
  bgColor: '#8B5CF6',
  icon: MessageSquareIcon,
  subBlocks: [
    {
      id: 'channel',
      title: 'Channel',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'In-App', id: 'in_app' },
        { label: 'Email', id: 'email' },
        { label: 'Slack', id: 'slack' },
        { label: 'Discord', id: 'discord' },
      ],
    },
    {
      id: 'recipient',
      title: 'Recipient',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Email or channel ID',
    },
    {
      id: 'message',
      title: 'Message',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter the message to send...',
    },
    {
      id: 'timeoutMinutes',
      title: 'Timeout (minutes)',
      type: 'short-input',
      layout: 'half',
      placeholder: '60',
    },
    {
      id: 'onTimeout',
      title: 'On Timeout',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Wait indefinitely', id: 'wait' },
        { label: 'Use Default Response', id: 'default' },
        { label: 'Fail', id: 'fail' },
      ],
    },
    {
      id: 'defaultResponse',
      title: 'Default Response',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Default response if timeout occurs...',
    },
  ],
  tools: {
    access: ['hitl_approval'],
    config: {
      tool: () => 'hitl_approval',
      params: (params: Record<string, any>) => ({
        requestType: 'input',
        title: 'Message & Response Required',
        description: params.message,
        assignedToEmail: params.recipient,
        notificationChannels: [params.channel || 'in_app'],
        timeoutMinutes: parseNumericString(params.timeoutMinutes),
        onTimeout: params.onTimeout === 'default' ? 'approve' : params.onTimeout || 'error',
        metadata: {
          isSendAndWait: true,
          channel: params.channel,
          defaultResponse: params.defaultResponse,
        },
      }),
    },
  },
  inputs: {
    channel: { type: 'string', required: true },
    recipient: { type: 'string', required: false },
    message: { type: 'string', required: true },
    timeoutMinutes: { type: 'number', required: false },
    onTimeout: { type: 'string', required: false },
    defaultResponse: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        status: 'string',
        response: 'any',
        respondedBy: 'string',
        respondedAt: 'string',
      },
    },
  },
}
