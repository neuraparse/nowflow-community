import { ZapierIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const ZapierBlock = defineBlock({
  type: 'zapier',
  name: 'Zapier',
  description: 'Automate workflows and connect 7,000+ apps',
  longDescription:
    'Integrate with Zapier to trigger workflows, create zaps, and automate tasks across 7,000+ applications. Use webhooks, triggers, and actions to build powerful automation workflows with OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#FF4A00',
  icon: ZapierIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'zapier',
      serviceId: 'zapier',
      requiredScopes: ['zap:write', 'zap:read', 'profile'],
      title: 'Zapier Account',
      placeholder: 'Select Zapier account',
    }),
    createOperationDropdown({
      operations: [
        { id: 'trigger_webhook', label: 'Trigger Webhook' },
        { id: 'create_zap', label: 'Create Zap' },
        { id: 'list_zaps', label: 'List Zaps' },
        { id: 'get_zap', label: 'Get Zap' },
        { id: 'update_zap', label: 'Update Zap' },
        { id: 'delete_zap', label: 'Delete Zap' },
      ],
      defaultValue: 'trigger_webhook',
    }),
    {
      id: 'webhookUrl',
      title: 'Webhook URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'https://hooks.zapier.com/hooks/catch/...',
      condition: { field: 'operation', value: 'trigger_webhook' },
    },
    {
      id: 'payload',
      title: 'Payload (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{"key": "value", "data": "example"}',
      condition: { field: 'operation', value: 'trigger_webhook' },
    },
    {
      id: 'zapId',
      title: 'Zap ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter Zap ID',
      condition: { field: 'operation', value: ['get_zap', 'update_zap', 'delete_zap'] },
    },
    {
      id: 'zapName',
      title: 'Zap Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'My Automation Workflow',
      condition: { field: 'operation', value: ['create_zap', 'update_zap'] },
    },
    {
      id: 'trigger',
      title: 'Trigger Configuration (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{"app": "gmail", "event": "new_email"}',
      condition: { field: 'operation', value: ['create_zap', 'update_zap'] },
    },
    {
      id: 'action',
      title: 'Action Configuration (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{"app": "slack", "action": "send_message"}',
      condition: { field: 'operation', value: ['create_zap', 'update_zap'] },
    },
  ],
  tools: {
    access: ['zapier_api'],
    config: {
      tool: () => 'zapier_api',
      params: (params) => {
        const { credential, payload, trigger, action, ...rest } = params as Record<string, any>

        const parseJSON = (value: any) => {
          if (typeof value === 'string' && value.trim()) {
            try {
              return JSON.parse(value)
            } catch {
              return undefined
            }
          }
          return value
        }

        return {
          credential,
          payload: parseJSON(payload),
          trigger: parseJSON(trigger),
          action: parseJSON(action),
          ...rest,
        }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    webhookUrl: { type: 'string', required: false },
    payload: { type: 'json', required: false },
    zapId: { type: 'string', required: false },
    zapName: { type: 'string', required: false },
    trigger: { type: 'json', required: false },
    action: { type: 'json', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
