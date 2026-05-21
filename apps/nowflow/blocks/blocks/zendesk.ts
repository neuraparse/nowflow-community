import { ZendeskIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const ZendeskBlock = defineBlock({
  type: 'zendesk',
  name: 'Zendesk',
  description: 'Zendesk Tickets: list/get/create/update.',
  longDescription:
    'Connect to Zendesk Support API to manage tickets. Choose basic or bearer auth and select operation.',
  category: 'tools',
  bgColor: '#03363D',
  icon: ZendeskIcon,
  subBlocks: [
    {
      id: 'subdomain',
      title: 'Subdomain',
      type: 'short-input',
      layout: 'full',
      placeholder: 'yourcompany',
    },
    {
      id: 'authType',
      title: 'Auth Type',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'basic', label: 'Basic' },
        { id: 'bearer', label: 'Bearer' },
      ],
    },
    { id: 'username', title: 'Username', type: 'short-input', layout: 'half' },
    { id: 'password', title: 'Password', type: 'short-input', layout: 'half' },
    { id: 'token', title: 'Token', type: 'short-input', layout: 'full', password: true },
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List Tickets' },
        { id: 'get', label: 'Get Ticket' },
        { id: 'create', label: 'Create Ticket' },
        { id: 'update', label: 'Update Ticket' },
      ],
    }),
    { id: 'ticketId', title: 'Ticket ID', type: 'short-input', layout: 'half' },
    { id: 'data', title: 'Payload (JSON)', type: 'code', layout: 'full', language: 'json' },
  ],
  tools: {
    access: ['zendesk_tickets'],
    config: {
      tool: () => 'zendesk_tickets',
      params: (params) => {
        const { subdomain, authType, username, password, token, operation, ticketId, data } =
          params as Record<string, any>
        const parseJSON = (v: any) => {
          if (typeof v === 'string' && v.trim()) {
            try {
              return JSON.parse(v)
            } catch {
              return undefined
            }
          }
          return v
        }
        return {
          subdomain,
          authType,
          username,
          password,
          token,
          operation,
          ticketId,
          data: parseJSON(data),
        }
      },
    },
  },
  inputs: {
    subdomain: { type: 'string', required: true },
    authType: { type: 'string', required: true },
    username: { type: 'string', required: false },
    password: { type: 'string', required: false },
    token: { type: 'string', required: false },
    operation: { type: 'string', required: true },
    ticketId: { type: 'string', required: false },
    data: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
