// Outlook Mail Send Response
export interface OutlookMailSendResponse {
  success: boolean
  messageId?: string
  message: string
}

// Outlook Mail Read Response
export interface OutlookMailReadResponse {
  id: string
  subject: string
  from: {
    emailAddress: {
      name: string
      address: string
    }
  }
  toRecipients: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  body: {
    contentType: string
    content: string
  }
  receivedDateTime: string
  hasAttachments: boolean
  isRead: boolean
}

// Outlook Mail Search Response
export interface OutlookMailSearchResponse {
  value: OutlookMailReadResponse[]
  '@odata.count'?: number
  '@odata.nextLink'?: string
}

// Outlook Calendar Event Response
export interface OutlookCalendarEventResponse {
  value?: any[]
  id?: string
  subject?: string
  start?: {
    dateTime: string
    timeZone: string
  }
  end?: {
    dateTime: string
    timeZone: string
  }
  [key: string]: any
}
