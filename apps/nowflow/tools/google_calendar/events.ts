import { ToolConfig } from '../types'

interface GoogleCalendarEventsParams {
  credential?: string // OAuth credential ID (preferred)
  accessToken?: string // Direct access token (legacy support)
  calendarId: string
  operation: 'list' | 'get' | 'insert' | 'update'
  eventId?: string
  timeMin?: string
  timeMax?: string
  data?: Record<string, any>
}

export const googleCalendarEventsTool: ToolConfig<GoogleCalendarEventsParams> = {
  id: 'google_calendar_events',
  name: 'Google Calendar Events',
  description: 'List, get, insert and update Google Calendar events',
  version: '1.0.0',
  oauth: {
    required: true,
    provider: 'google-calendar',
    additionalScopes: ['https://www.googleapis.com/auth/calendar'],
  },
  params: {
    credential: {
      type: 'string',
      required: false,
      description:
        'OAuth credential ID for Google Calendar access (will be auto-converted to accessToken)',
    },
    accessToken: {
      type: 'string',
      required: true,
      description:
        'Access token for Google Calendar API (auto-resolved from credential by executeTool)',
    },
    calendarId: {
      type: 'string',
      required: true,
      description: 'Calendar ID (use "primary" for main calendar)',
    },
    operation: {
      type: 'string',
      required: true,
      description: 'Operation to perform: list, get, insert, or update',
    },
    eventId: {
      type: 'string',
      required: false,
      description: 'Event ID (required for get and update operations)',
    },
    timeMin: {
      type: 'string',
      required: false,
      description: 'ISO 8601 timestamp for minimum time (for list operation)',
    },
    timeMax: {
      type: 'string',
      required: false,
      description: 'ISO 8601 timestamp for maximum time (for list operation)',
    },
    data: {
      type: 'object',
      required: false,
      description: 'Event data for insert/update operations',
    },
  },
  request: {
    url: (p) => {
      const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(p.calendarId)}/events`
      if (p.operation === 'get' && p.eventId) return `${base}/${encodeURIComponent(p.eventId)}`
      if (p.operation === 'update' && p.eventId) return `${base}/${encodeURIComponent(p.eventId)}`
      if (p.operation === 'list') {
        const url = new URL(base)
        if (p.timeMin) url.searchParams.set('timeMin', p.timeMin)
        if (p.timeMax) url.searchParams.set('timeMax', p.timeMax)
        url.searchParams.set('singleEvents', 'true')
        url.searchParams.set('orderBy', 'startTime')
        return url.toString()
      }
      return base
    },
    method: (p) => {
      switch (p.operation) {
        case 'list':
        case 'get':
          return 'GET'
        case 'insert':
          return 'POST'
        case 'update':
          return 'PUT'
        default:
          return 'GET'
      }
    },
    headers: (p) => {
      // Use accessToken (which is auto-resolved from credential by the OAuth system)
      const token = p.accessToken
      if (!token) {
        throw new Error('Access token is required. Please connect your Google Calendar account.')
      }
      return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    },
    body: (p) =>
      (p.operation === 'insert' || p.operation === 'update' ? p.data || {} : undefined) as any,
  },
  transformResponse: async (response, params) => {
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : await response.text()

    console.log('[Google Calendar] Response:', {
      status: response.status,
      ok: response.ok,
      operation: params?.operation,
      calendarId: params?.calendarId,
      hasData: !!data,
      dataPreview: typeof data === 'object' ? JSON.stringify(data).substring(0, 200) : data,
    })

    if (!response.ok) {
      const errorDetails = (data as any)?.error || {}
      const message =
        errorDetails.message || (typeof data === 'string' ? data : 'Calendar request failed')

      console.error('[Google Calendar] API error:', {
        status: response.status,
        message,
        code: errorDetails.code,
        errors: errorDetails.errors,
        fullError: data,
      })

      return {
        success: false,
        output: data as any,
        error: `${message} (Status: ${response.status})`,
      }
    }

    return { success: true, output: data as any }
  },
  transformError: (error) => {
    console.error('[Google Calendar] Error details:', error)

    // Handle Google API error format
    if (error?.error?.message) {
      const errorMessage = error.error.message
      if (
        errorMessage.includes('invalid authentication credentials') ||
        errorMessage.includes('Invalid Credentials')
      ) {
        return 'Google Calendar authentication failed. Please reconnect your Google Calendar account in Settings → Integrations, then try again.'
      }
      if (errorMessage.includes('quota')) {
        return 'Google Calendar API quota exceeded. Please try again later.'
      }
      return errorMessage
    }

    // Handle other error formats
    if (error?.message) {
      if (
        error.message.includes('invalid authentication credentials') ||
        error.message.includes('Invalid Credentials')
      ) {
        return 'Google Calendar authentication failed. Please reconnect your Google Calendar account in Settings → Integrations, then try again.'
      }
      return error.message
    }

    return typeof error === 'string' ? error : 'Calendar request failed'
  },
}
