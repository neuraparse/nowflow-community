import { GoogleCalendarIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const GoogleCalendarBlock = defineBlock({
  type: 'google_calendar',
  name: 'Google Calendar',
  description: 'Google Calendar: list/get/insert/update events.',
  longDescription: 'Manage calendar events using Google Calendar API with OAuth authentication.',
  category: 'tools',
  bgColor: '#4285F4',
  icon: GoogleCalendarIcon,
  subBlocks: [
    // Google Calendar Credentials
    createOAuthSubBlock({
      provider: 'google-calendar',
      serviceId: 'google-calendar',
      requiredScopes: ['https://www.googleapis.com/auth/calendar'],
      title: 'Google Calendar Account',
      placeholder: 'Select Google Calendar account',
    }),
    {
      id: 'calendarId',
      title: 'Calendar ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Calendar ID (default: primary)',
    },
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List Events' },
        { id: 'get', label: 'Get Event' },
        { id: 'insert', label: 'Insert Event' },
        { id: 'update', label: 'Update Event' },
      ],
    }),
    {
      id: 'eventId',
      title: 'Event ID',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Event ID (required for get/update)',
      condition: { field: 'operation', value: ['get', 'update'] },
    },
    {
      id: 'timeMin',
      title: 'Time Min (ISO)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Start time (e.g., 2024-01-01T00:00:00Z)',
      condition: { field: 'operation', value: 'list' },
    },
    {
      id: 'timeMax',
      title: 'Time Max (ISO)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'End time (e.g., 2024-12-31T23:59:59Z)',
      condition: { field: 'operation', value: 'list' },
    },
    {
      id: 'data',
      title: 'Event Data (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: 'Event data for insert/update operations',
      condition: { field: 'operation', value: ['insert', 'update'] },
    },
  ],
  tools: {
    access: ['google_calendar_events'],
    config: {
      tool: () => 'google_calendar_events',
      params: (params) => {
        const { credential, calendarId, operation, eventId, timeMin, timeMax, data } =
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
          credential, // Keep credential parameter - executeTool will convert it to accessToken
          calendarId: calendarId || 'primary',
          operation,
          eventId,
          timeMin,
          timeMax,
          data: parseJSON(data),
        }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    calendarId: { type: 'string', required: false },
    operation: { type: 'string', required: true },
    eventId: { type: 'string', required: false },
    timeMin: { type: 'string', required: false },
    timeMax: { type: 'string', required: false },
    data: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
