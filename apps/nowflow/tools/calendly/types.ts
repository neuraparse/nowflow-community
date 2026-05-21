export interface CalendlyParams {
  accessToken: string
  operation:
    | 'list_events'
    | 'get_event'
    | 'list_event_types'
    | 'get_user'
    | 'list_scheduled_events'
    | 'cancel_event'
  // Event params
  eventUuid?: string
  userUri?: string
  organizationUri?: string
  // Filters
  status?: 'active' | 'canceled'
  minStartTime?: string
  maxStartTime?: string
  // Pagination
  count?: number
  pageToken?: string
  // Cancel
  cancelReason?: string
}

export interface CalendlyOutput {
  success: boolean
  data?: any
  error?: string
}
