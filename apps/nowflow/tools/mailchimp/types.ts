export interface MailchimpParams {
  apiKey: string
  serverPrefix: string // e.g., 'us1', 'us2', etc.
  operation:
    | 'list_audiences'
    | 'get_audience'
    | 'list_members'
    | 'add_member'
    | 'update_member'
    | 'list_campaigns'
    | 'create_campaign'
    | 'send_campaign'
  // Audience params
  audienceId?: string
  // Member params
  email?: string
  firstName?: string
  lastName?: string
  status?: 'subscribed' | 'unsubscribed' | 'cleaned' | 'pending'
  mergeFields?: Record<string, any>
  tags?: string[]
  // Campaign params
  campaignId?: string
  campaignType?: 'regular' | 'plaintext' | 'absplit' | 'rss' | 'variate'
  campaignTitle?: string
  subjectLine?: string
  fromName?: string
  replyTo?: string
  // Pagination
  count?: number
  offset?: number
}

export interface MailchimpOutput {
  success: boolean
  data?: any
  error?: string
}
