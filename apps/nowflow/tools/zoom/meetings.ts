import { ToolConfig } from '../types'

interface ZoomMeetingsParams {
  token: string
  operation: 'list' | 'get' | 'create' | 'update'
  meetingId?: string
  type?: 'scheduled' | 'live' | 'upcoming' | 'upcoming_meetings'
  data?: Record<string, any>
}

export const zoomMeetingsTool: ToolConfig<ZoomMeetingsParams> = {
  id: 'zoom_meetings',
  name: 'Zoom Meetings',
  description: 'List, get, create and update Zoom meetings.',
  version: '1.0.0',

  params: {
    token: { type: 'string', required: true, requiredForToolCall: true },
    operation: { type: 'string', required: true },
    meetingId: { type: 'string', required: false },
    type: {
      type: 'string',
      required: false,
      description: 'Filter for list: upcoming/live/scheduled',
    },
    data: { type: 'object', required: false },
  },

  request: {
    url: (p) => {
      const base = 'https://api.zoom.us/v2'
      if (p.operation === 'list') {
        const url = new URL(`${base}/users/me/meetings`)
        if (p.type) url.searchParams.set('type', p.type)
        return url.toString()
      }
      if ((p.operation === 'get' || p.operation === 'update') && p.meetingId) {
        return `${base}/meetings/${encodeURIComponent(p.meetingId)}`
      }
      if (p.operation === 'create') return `${base}/users/me/meetings`
      return `${base}/users/me/meetings`
    },
    method: (p) => {
      switch (p.operation) {
        case 'list':
        case 'get':
          return 'GET'
        case 'create':
          return 'POST'
        case 'update':
          return 'PATCH'
        default:
          return 'GET'
      }
    },
    headers: (p) => ({
      Authorization: `Bearer ${p.token}`,
      'Content-Type': 'application/json',
    }),
    body: (p) =>
      (p.operation === 'create' || p.operation === 'update' ? p.data || {} : undefined) as any,
  },

  transformResponse: async (response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : await response.text()
    if (!response.ok) {
      const message =
        (data as any)?.message || (typeof data === 'string' ? data : 'Zoom request failed')
      return { success: false, output: data as any, error: message }
    }
    return { success: true, output: data as any }
  },
  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'Zoom request failed',
}
