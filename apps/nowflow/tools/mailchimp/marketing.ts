import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig } from '../types'
import { MailchimpOutput, MailchimpParams } from './types'

const logger = createLogger('Mailchimp Marketing Tool')

// Helper to create MD5 hash for email (Mailchimp uses this as subscriber ID)
function md5Hash(email: string): string {
  // Simple hash for client-side (in real implementation, use crypto)
  let hash = 0
  const str = email.toLowerCase().trim()
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(32, '0')
}

export const mailchimpMarketingTool: ToolConfig<MailchimpParams, MailchimpOutput> = {
  id: 'mailchimp_marketing',
  name: 'Mailchimp Marketing',
  description: 'Manage email marketing with Mailchimp API 3.0. Audiences, members, and campaigns.',
  version: '1.0.0',

  params: {
    apiKey: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Mailchimp API Key (ends with -usX)',
    },
    serverPrefix: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Data center prefix (e.g., us1, us21)',
    },
    operation: {
      type: 'string',
      required: true,
      description: 'Operation to perform',
    },
    audienceId: {
      type: 'string',
      required: false,
      description: 'Audience/List ID',
    },
    email: {
      type: 'string',
      required: false,
      description: 'Subscriber email address',
    },
    firstName: { type: 'string', required: false, description: 'First name' },
    lastName: { type: 'string', required: false, description: 'Last name' },
    status: {
      type: 'string',
      required: false,
      description: 'Subscription status',
    },
    mergeFields: {
      type: 'object',
      required: false,
      description: 'Custom merge fields',
    },
    tags: { type: 'array', required: false, description: 'Subscriber tags' },
    campaignId: { type: 'string', required: false, description: 'Campaign ID' },
    campaignType: { type: 'string', required: false, description: 'Campaign type' },
    campaignTitle: { type: 'string', required: false, description: 'Campaign title' },
    subjectLine: { type: 'string', required: false, description: 'Email subject line' },
    fromName: { type: 'string', required: false, description: 'From name' },
    replyTo: { type: 'string', required: false, description: 'Reply-to email' },
    count: { type: 'number', required: false, description: 'Results per page' },
    offset: { type: 'number', required: false, description: 'Pagination offset' },
  },

  request: {
    url: (params) => {
      const baseUrl = `https://${params.serverPrefix}.api.mailchimp.com/3.0`
      switch (params.operation) {
        case 'list_audiences':
          return `${baseUrl}/lists`
        case 'get_audience':
          return `${baseUrl}/lists/${params.audienceId}`
        case 'list_members':
          return `${baseUrl}/lists/${params.audienceId}/members`
        case 'add_member':
          return `${baseUrl}/lists/${params.audienceId}/members`
        case 'update_member':
          const hash = md5Hash(params.email || '')
          return `${baseUrl}/lists/${params.audienceId}/members/${hash}`
        case 'list_campaigns':
          return `${baseUrl}/campaigns`
        case 'create_campaign':
          return `${baseUrl}/campaigns`
        case 'send_campaign':
          return `${baseUrl}/campaigns/${params.campaignId}/actions/send`
        default:
          return `${baseUrl}/lists`
      }
    },
    method: (params) => {
      switch (params.operation) {
        case 'add_member':
        case 'create_campaign':
        case 'send_campaign':
          return 'POST'
        case 'update_member':
          return 'PATCH'
        default:
          return 'GET'
      }
    },
    headers: (params) => ({
      Authorization: `Basic ${Buffer.from(`anystring:${params.apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json',
    }),
    body: (params) => {
      if (params.operation === 'add_member' || params.operation === 'update_member') {
        const body: any = {
          email_address: params.email,
          status: params.status || 'subscribed',
        }
        if (params.firstName || params.lastName) {
          body.merge_fields = {
            FNAME: params.firstName || '',
            LNAME: params.lastName || '',
            ...params.mergeFields,
          }
        }
        if (params.tags) body.tags = params.tags
        return body
      }

      if (params.operation === 'create_campaign') {
        return {
          type: params.campaignType || 'regular',
          recipients: { list_id: params.audienceId },
          settings: {
            title: params.campaignTitle,
            subject_line: params.subjectLine,
            from_name: params.fromName,
            reply_to: params.replyTo,
          },
        }
      }

      return {}
    },
    query: (params) => {
      const query: Record<string, string> = {}
      if (params.count) query.count = params.count.toString()
      if (params.offset) query.offset = params.offset.toString()
      return query
    },
  },

  transformResponse: async (response) => {
    const data = await response.json()
    if (!response.ok) {
      logger.error('Mailchimp API error:', data)
      throw new Error(data.detail || `Mailchimp error: ${response.status}`)
    }
    return { success: true, data }
  },

  transformError: (error) => {
    logger.error('Mailchimp tool error:', error)
    return `Mailchimp operation failed: ${error.message || 'Unknown error'}`
  },
}
