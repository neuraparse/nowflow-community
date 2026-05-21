import { UserCheckIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { parseNumericString } from '../helpers'
import { BlockConfig } from '../types'

interface HumanAgentResponse extends ToolResponse {
  output: {
    status: string
    response: any
    responseNote: string | null
    respondedBy: string | null
    respondedAt: string | null
    requestId: string
  }
}

export const HumanAgentBlock: BlockConfig<HumanAgentResponse> = {
  type: 'human_agent',
  name: 'Human Agent',
  description: 'Add a human as an agent in your workflow',
  longDescription:
    'Integrates a human operator as a first-class agent in AI workflow orchestration. The human receives tasks via notification channels and provides responses that feed into the workflow.',
  category: 'agents',
  bgColor: '#F59E0B',
  icon: UserCheckIcon,
  subBlocks: [
    {
      id: 'agentProfileId',
      title: 'Human Agent Profile',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Agent profile ID (optional)',
    },
    {
      id: 'agentName',
      title: 'Agent Name',
      type: 'short-input',
      layout: 'half',
      placeholder: 'e.g. Quality Reviewer',
    },
    {
      id: 'agentRole',
      title: 'Role',
      type: 'short-input',
      layout: 'half',
      placeholder: 'e.g. Senior Editor',
    },
    {
      id: 'taskDescription',
      title: 'Task Description',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Describe what the human agent should do...',
    },
    {
      id: 'assignedToEmail',
      title: 'Assign To (Email)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'human@company.com',
    },
    {
      id: 'notificationChannels',
      title: 'Notification Channels',
      type: 'checkbox-list',
      layout: 'full',
      options: [
        { label: 'In-App', id: 'in_app' },
        { label: 'Email', id: 'email' },
        { label: 'Slack', id: 'slack' },
        { label: 'Discord', id: 'discord' },
      ],
    },
    {
      id: 'expectedResponseFormat',
      title: 'Expected Response Format',
      type: 'code',
      layout: 'full',
      placeholder: '{\n  "decision": "string",\n  "reasoning": "string"\n}',
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
        { label: 'Skip (continue)', id: 'skip' },
        { label: 'Escalate', id: 'escalate' },
        { label: 'Fail', id: 'fail' },
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
      id: 'contextData',
      title: 'Context Data',
      type: 'code',
      layout: 'full',
      placeholder: '{\n  "key": "value"\n}',
    },
  ],
  tools: {
    access: ['hitl_approval'],
    config: {
      tool: () => 'hitl_approval',
      params: (params: Record<string, any>) => ({
        requestType: 'input',
        priority: params.priority || 'normal',
        title: `[Human Agent: ${params.agentName || 'Unnamed'}] ${(params.taskDescription || 'Task').slice(0, 100)}`,
        description: params.taskDescription,
        data: params.contextData ? JSON.parse(params.contextData) : undefined,
        assignedToEmail: params.assignedToEmail,
        timeoutMinutes: parseNumericString(params.timeoutMinutes),
        notificationChannels: params.notificationChannels || ['email', 'in_app'],
        onTimeout:
          params.onTimeout === 'skip'
            ? 'approve'
            : params.onTimeout === 'escalate'
              ? 'retry'
              : params.onTimeout || 'error',
        options: params.expectedResponseFormat
          ? JSON.parse(params.expectedResponseFormat)
          : undefined,
        metadata: {
          isHumanAgent: true,
          agentName: params.agentName,
          agentRole: params.agentRole,
          agentProfileId: params.agentProfileId,
        },
      }),
    },
  },
  inputs: {
    agentProfileId: { type: 'string', required: false },
    agentName: { type: 'string', required: true },
    agentRole: { type: 'string', required: false },
    taskDescription: { type: 'string', required: true },
    assignedToEmail: { type: 'string', required: false },
    notificationChannels: { type: 'json', required: false },
    expectedResponseFormat: { type: 'json', required: false },
    timeoutMinutes: { type: 'number', required: false },
    onTimeout: { type: 'string', required: false },
    priority: { type: 'string', required: false },
    contextData: { type: 'json', required: false },
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
