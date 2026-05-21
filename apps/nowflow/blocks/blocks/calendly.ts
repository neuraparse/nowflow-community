import { CalendlyIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const CalendlyBlock = defineBlock({
  type: 'calendly',
  name: 'Calendly',
  description: 'Manage Calendly events and scheduled meetings.',
  longDescription:
    'Connect to Calendly API v2 to list event types, scheduled events, get user info, and cancel events.',
  category: 'tools',
  bgColor: '#006BFF',
  icon: CalendlyIcon,
  subBlocks: [
    {
      id: 'accessToken',
      title: 'Access Token',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Personal Access Token or OAuth token',
      password: true,
    },
    createOperationDropdown({
      operations: [
        { id: 'get_user', label: 'Get Current User' },
        { id: 'list_event_types', label: 'List Event Types' },
        { id: 'list_scheduled_events', label: 'List Scheduled Events' },
        { id: 'get_event', label: 'Get Event Details' },
        { id: 'cancel_event', label: 'Cancel Event' },
      ],
    }),
    {
      id: 'userUri',
      title: 'User URI',
      type: 'short-input',
      layout: 'full',
      placeholder: 'https://api.calendly.com/users/...',
      condition: {
        field: 'operation',
        value: ['list_event_types', 'list_scheduled_events'],
      },
    },
    {
      id: 'eventUuid',
      title: 'Event UUID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Event UUID',
      condition: { field: 'operation', value: ['get_event', 'cancel_event'] },
    },
    {
      id: 'status',
      title: 'Status Filter',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'All', id: '' },
        { label: 'Active', id: 'active' },
        { label: 'Canceled', id: 'canceled' },
      ],
      condition: { field: 'operation', value: 'list_scheduled_events' },
    },
    {
      id: 'count',
      title: 'Limit',
      type: 'short-input',
      layout: 'half',
      placeholder: '20',
      condition: { field: 'operation', value: 'list_scheduled_events' },
    },
    {
      id: 'minStartTime',
      title: 'Start After',
      type: 'short-input',
      layout: 'half',
      placeholder: '2025-01-01T00:00:00Z',
      condition: { field: 'operation', value: 'list_scheduled_events' },
    },
    {
      id: 'maxStartTime',
      title: 'Start Before',
      type: 'short-input',
      layout: 'half',
      placeholder: '2025-12-31T23:59:59Z',
      condition: { field: 'operation', value: 'list_scheduled_events' },
    },
    {
      id: 'cancelReason',
      title: 'Cancel Reason',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Reason for cancellation...',
      condition: { field: 'operation', value: 'cancel_event' },
    },
  ],
  tools: {
    access: ['calendly_events'],
    config: {
      tool: () => 'calendly_events',
    },
  },
  inputs: {
    operation: { type: 'string', required: true },
    accessToken: { type: 'string', required: true },
    userUri: { type: 'string', required: false },
    eventUuid: { type: 'string', required: false },
    status: { type: 'string', required: false },
    count: { type: 'number', required: false },
    minStartTime: { type: 'string', required: false },
    maxStartTime: { type: 'string', required: false },
    cancelReason: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        success: 'boolean',
        data: 'any',
      },
    },
  },
})
