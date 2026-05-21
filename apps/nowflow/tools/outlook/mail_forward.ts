import { ToolConfig } from '../types'

export interface OutlookMailForwardParams {
  credential: string
  accessToken?: string
  messageId: string
  to: string
  comment?: string
}

export const outlook_mail_forward: ToolConfig<
  OutlookMailForwardParams,
  {
    success: boolean
    output: { message: string }
    error?: string
  }
> = {
  id: 'outlook_mail_forward',
  name: 'Outlook Mail Forward',
  description: 'Forward an email in Outlook using Microsoft Graph API',
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
      description: 'ID of the message to forward',
    },
    to: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Recipient email address (comma-separated for multiple)',
    },
    comment: {
      type: 'string',
      required: false,
      description: 'Optional comment to add when forwarding',
    },
  },
  request: {
    url: (params) => {
      return `https://graph.microsoft.com/v1.0/me/messages/${params.messageId}/forward`
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
      // Parse recipient emails
      const toRecipients = params.to.split(',').map((email) => ({
        emailAddress: { address: email.trim() },
      }))

      const forwardBody: any = {
        toRecipients,
      }

      // Add comment if provided
      if (params.comment) {
        forwardBody.comment = params.comment
      }

      return forwardBody
    },
  },
  transformResponse: async () => {
    // Forward returns 202 Accepted with no content
    return {
      success: true,
      output: { message: 'Email forwarded successfully' },
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
      if (
        error.message.includes('Invalid to header') ||
        error.message.includes('InvalidRecipients')
      ) {
        return 'Invalid recipient email address. Please check the "To" field.'
      }
      return error.message
    }
    return 'An unexpected error occurred while forwarding the email.'
  },
}
