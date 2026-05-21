import { CheckCircleIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { parseNumericString } from '../helpers'
import { BlockConfig } from '../types'

interface ApprovalResponse extends ToolResponse {
  output: {
    status: 'approved' | 'rejected' | 'pending' | 'timeout'
    response: any
    responseNote: string | null
    respondedBy: string | null
    respondedAt: string | null
    requestId: string
  }
}

export const ApprovalBlock: BlockConfig<ApprovalResponse> = {
  type: 'approval',
  name: 'Approval',
  description: 'Pause workflow for human approval or input',
  longDescription:
    'Creates a human-in-the-loop checkpoint that pauses workflow execution until a human approves, rejects, or provides input. Supports multiple approval types, timeouts, and escalation rules.',
  category: 'blocks',
  bgColor: '#F59E0B',
  icon: CheckCircleIcon,
  subBlocks: [
    {
      id: 'requestType',
      title: 'Request Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Approval', id: 'approval' },
        { label: 'Input Required', id: 'input' },
        { label: 'Review', id: 'review' },
        { label: 'Escalation', id: 'escalation' },
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
      id: 'title',
      title: 'Request Title',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter a clear title for this approval request',
    },
    {
      id: 'description',
      title: 'Description',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Describe what needs to be approved or reviewed...',
      rows: 3,
    },
    {
      id: 'data',
      title: 'Context Data',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "key": "value"\n}',
      description: 'JSON data to include with the request for context',
    },
    {
      id: 'assignedToEmail',
      title: 'Assign To (Email)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'approver@company.com',
      description: 'Optional: Email of the person to assign this request to',
    },
    {
      id: 'timeoutMinutes',
      title: 'Timeout (minutes)',
      type: 'short-input',
      layout: 'half',
      placeholder: '60',
      description: 'Optional: Auto-timeout after this many minutes',
    },
    {
      id: 'options',
      title: 'Custom Options',
      type: 'table',
      layout: 'full',
      columns: ['Label', 'Value'],
      description: 'Optional: Define custom response options',
      condition: {
        field: 'requestType',
        value: ['approval', 'input'],
      },
    },
    {
      id: 'notificationChannels',
      title: 'Notification Channels',
      type: 'checkbox-list',
      layout: 'full',
      options: [
        { label: 'Email', id: 'email' },
        { label: 'Slack', id: 'slack' },
        { label: 'Webhook', id: 'webhook' },
      ],
    },
    {
      id: 'webhookUrl',
      title: 'Webhook URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'https://your-webhook.com/notify',
      condition: {
        field: 'notificationChannels',
        value: ['webhook'],
      },
    },
    {
      id: 'onTimeout',
      title: 'On Timeout',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Continue with error', id: 'error' },
        { label: 'Auto-approve', id: 'approve' },
        { label: 'Auto-reject', id: 'reject' },
        { label: 'Retry', id: 'retry' },
      ],
    },
    {
      id: 'retryCount',
      title: 'Max Retries',
      type: 'short-input',
      layout: 'half',
      placeholder: '3',
      condition: {
        field: 'onTimeout',
        value: 'retry',
      },
    },
  ],
  tools: {
    access: ['hitl_approval'],
    config: {
      tool: () => 'hitl_approval',
      params: (params) => ({
        requestType: params.requestType || 'approval',
        priority: params.priority || 'normal',
        title: params.title,
        description: params.description,
        data: params.data ? JSON.parse(params.data) : undefined,
        assignedToEmail: params.assignedToEmail,
        timeoutMinutes: parseNumericString(params.timeoutMinutes),
        options: params.options,
        notificationChannels: params.notificationChannels || ['email'],
        webhookUrl: params.webhookUrl,
        onTimeout: params.onTimeout || 'error',
        retryCount: parseNumericString(params.retryCount) ?? 3,
      }),
    },
  },
  inputs: {
    requestType: { type: 'string', required: true },
    priority: { type: 'string', required: false },
    title: { type: 'string', required: true },
    description: { type: 'string', required: false },
    data: { type: 'json', required: false },
    assignedToEmail: { type: 'string', required: false },
    timeoutMinutes: { type: 'number', required: false },
    options: { type: 'json', required: false },
    notificationChannels: { type: 'json', required: false },
    webhookUrl: { type: 'string', required: false },
    onTimeout: { type: 'string', required: false },
    retryCount: { type: 'number', required: false },
  },
  outputs: {
    response: {
      type: {
        status: 'string',
        response: 'json',
        responseNote: 'string',
        respondedBy: 'string',
        respondedAt: 'string',
        requestId: 'string',
      },
    },
  },
}
