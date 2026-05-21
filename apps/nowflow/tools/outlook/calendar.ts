import { ToolConfig } from '../types'

interface OutlookCalendarParams {
  accessToken: string
  operation: 'list' | 'get' | 'create' | 'update'
  eventId?: string
  calendarId?: string // default: primary calendar via /me/events
  timeMin?: string
  timeMax?: string
  data?: Record<string, any>
}

export const outlookCalendarTool: ToolConfig<OutlookCalendarParams> = {
  id: 'outlook_calendar_events',
  name: 'Outlook Calendar Events',
  description: 'List, get, create and update Outlook calendar events via Microsoft Graph.',
  version: '1.0.0',
  oauth: {
    required: false,
    provider: 'microsoft-outlook',
    additionalScopes: [
      'https://graph.microsoft.com/Calendars.ReadWrite',
      'https://graph.microsoft.com/User.Read',
    ],
  },
  params: {
    accessToken: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    eventId: { type: 'string', required: false },
    calendarId: { type: 'string', required: false },
    timeMin: { type: 'string', required: false },
    timeMax: { type: 'string', required: false },
    data: { type: 'object', required: false },
  },
  request: {
    url: (p) => {
      const base = 'https://graph.microsoft.com/v1.0'
      const calBase = p.calendarId
        ? `${base}/me/calendars/${encodeURIComponent(p.calendarId)}/events`
        : `${base}/me/events`
      if ((p.operation === 'get' || p.operation === 'update') && p.eventId)
        return `${calBase}/${encodeURIComponent(p.eventId)}`
      if (p.operation === 'list') {
        const u = new URL(calBase)
        if (p.timeMin || p.timeMax) {
          // Use $filter for time range
          const filters: string[] = []
          if (p.timeMin) filters.push(`start/dateTime ge '${p.timeMin}'`)
          if (p.timeMax) filters.push(`end/dateTime le '${p.timeMax}'`)
          if (filters.length) u.searchParams.set('$filter', filters.join(' and '))
          u.searchParams.set('$orderby', 'start/dateTime')
        }
        return u.toString()
      }
      return calBase
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
      Authorization: `Bearer ${p.accessToken}`,
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
        (data as any)?.error?.message ||
        (typeof data === 'string' ? data : 'Outlook request failed')
      return { success: false, output: data as any, error: message }
    }
    return { success: true, output: data as any }
  },
  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'Outlook request failed',
}
