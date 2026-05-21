import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig } from '../types'
import { CalendlyOutput, CalendlyParams } from './types'

const logger = createLogger('Calendly Events Tool')

export const calendlyEventsTool: ToolConfig<CalendlyParams, CalendlyOutput> = {
  id: 'calendly_events',
  name: 'Calendly Events',
  description: 'Manage Calendly events, event types, and scheduled meetings using Calendly API v2.',
  version: '1.0.0',

  params: {
    accessToken: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Calendly Personal Access Token or OAuth token',
    },
    operation: {
      type: 'string',
      required: true,
      description: 'Operation to perform',
    },
    eventUuid: {
      type: 'string',
      required: false,
      description: 'Event UUID for get/cancel operations',
    },
    userUri: {
      type: 'string',
      required: false,
      description: 'User URI (e.g., https://api.calendly.com/users/...)',
    },
    organizationUri: {
      type: 'string',
      required: false,
      description: 'Organization URI',
    },
    status: {
      type: 'string',
      required: false,
      description: 'Filter by status: active or canceled',
    },
    minStartTime: {
      type: 'string',
      required: false,
      description: 'Filter events starting after this time (ISO 8601)',
    },
    maxStartTime: {
      type: 'string',
      required: false,
      description: 'Filter events starting before this time (ISO 8601)',
    },
    count: {
      type: 'number',
      required: false,
      description: 'Number of results per page (default: 20, max: 100)',
    },
    pageToken: {
      type: 'string',
      required: false,
      description: 'Token for pagination',
    },
    cancelReason: {
      type: 'string',
      required: false,
      description: 'Reason for canceling the event',
    },
  },

  request: {
    url: (params) => {
      const baseUrl = 'https://api.calendly.com'
      switch (params.operation) {
        case 'get_user':
          return `${baseUrl}/users/me`
        case 'get_event':
          return `${baseUrl}/scheduled_events/${params.eventUuid}`
        case 'list_event_types':
          return `${baseUrl}/event_types`
        case 'list_scheduled_events':
        case 'list_events':
          return `${baseUrl}/scheduled_events`
        case 'cancel_event':
          return `${baseUrl}/scheduled_events/${params.eventUuid}/cancellation`
        default:
          return `${baseUrl}/users/me`
      }
    },
    method: (params) => {
      return params.operation === 'cancel_event' ? 'POST' : 'GET'
    },
    headers: (params) => ({
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    }),
    body: (params) => {
      if (params.operation === 'cancel_event') {
        return {
          reason: params.cancelReason || 'Canceled via API',
        }
      }
      return {}
    },
    query: (params) => {
      const query: Record<string, string> = {}

      if (params.operation === 'list_scheduled_events' || params.operation === 'list_events') {
        if (params.userUri) query.user = params.userUri
        if (params.organizationUri) query.organization = params.organizationUri
        if (params.status) query.status = params.status
        if (params.minStartTime) query.min_start_time = params.minStartTime
        if (params.maxStartTime) query.max_start_time = params.maxStartTime
        if (params.count) query.count = params.count.toString()
        if (params.pageToken) query.page_token = params.pageToken
      }

      if (params.operation === 'list_event_types') {
        if (params.userUri) query.user = params.userUri
        if (params.organizationUri) query.organization = params.organizationUri
      }

      return query
    },
  },

  transformResponse: async (response) => {
    const data = await response.json()
    if (!response.ok) {
      logger.error('Calendly API error:', data)
      throw new Error(data.message || `Calendly API error: ${response.status}`)
    }
    return { success: true, data }
  },

  transformError: (error) => {
    logger.error('Calendly tool error:', error)
    return `Calendly operation failed: ${error.message || 'Unknown error'}`
  },
}
