import { ToolConfig } from '../types'

export interface OutlookMailReplyParams {
  credential: string
  accessToken?: string
  messageId: string
  body: string
  contentType?: string
  replyAll?: boolean
  comment?: string
}

export const outlook_mail_reply: ToolConfig<
  OutlookMailReplyParams,
  {
    success: boolean
    output: { message: string }
    error?: string
  }
> = {
  id: 'outlook_mail_reply',
  name: 'Outlook Mail Reply',
  description: 'Reply to an email in Outlook using Microsoft Graph API',
  version: '1.0.0',
  oauth: {
    required: true,
    provider: 'microsoft-outlook',
    additionalScopes: ['https://graph.microsoft.com/Mail.Send'],
  },
  params: {
    credential: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'OAuth credential ID for Outlook',
    },
    accessToken: {
      type: 'string',
      required: false,
      description: 'Access token (resolved from credential)',
    },
    messageId: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'ID of the message to reply to',
    },
    body: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Reply message body',
    },
    contentType: {
      type: 'string',
      required: false,
      description: 'Content type: HTML or Text',
      default: 'HTML',
    },
    replyAll: {
      type: 'boolean',
      required: false,
      description: 'Reply to all recipients (true) or just the sender (false)',
      default: false,
    },
    comment: {
      type: 'string',
      required: false,
      description: 'Optional comment to add at the beginning of the reply',
    },
  },
  request: {
    url: (params) => {
      const action = params.replyAll ? 'replyAll' : 'reply'
      return `https://graph.microsoft.com/v1.0/me/messages/${params.messageId}/${action}`
    },
    method: 'POST',
    headers: (params) => {
      if (!params.accessToken) throw new Error('Access token is required')
      return {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      }
    },
    body: (params) => {
      const replyBody: any = {
        message: {
          body: {
            contentType: params.contentType || 'HTML',
            content: params.body,
          },
        },
      }

      // Add comment if provided
      if (params.comment) {
        replyBody.comment = params.comment
      }

      return replyBody
    },
  },
  transformResponse: async () => {
    // Reply returns 202 Accepted with no content
    return {
      success: true,
      output: { message: 'Reply sent successfully' },
      error: undefined,
    }
  },
  transformError: (error) => {
    if (error.message) {
      if (
        error.message.includes('invalid authentication credentials') ||
        error.message.includes('InvalidAuthenticationToken')
      ) {
        return 'Outlook authentication failed. Please reconnect your Outlook account in Settings → Integrations.'
      }
      if (error.message.includes('ResourceNotFound') || error.message.includes('not found')) {
        return 'Original message not found. Please check the message ID and try again.'
      }
      return error.message
    }
    return 'An unexpected error occurred while sending the reply.'
  },
}
