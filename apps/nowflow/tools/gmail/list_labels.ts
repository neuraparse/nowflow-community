import { ToolConfig } from '../types'
import { GmailListLabelsParams, GmailToolResponse } from './types'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

export const gmailListLabelsTool: ToolConfig<GmailListLabelsParams, GmailToolResponse> = {
  id: 'gmail_list_labels',
  name: 'Gmail List Labels',
  description: 'List all labels in Gmail',
  version: '1.0.0',

  oauth: {
    required: true,
    provider: 'google-email',
    additionalScopes: ['https://www.googleapis.com/auth/gmail.labels'],
  },

  params: {
    accessToken: {
      type: 'string',
      required: true,
      description: 'Access token for Gmail API',
    },
  },

  request: {
    url: () => `${GMAIL_API_BASE}/labels`,
    method: 'GET',
    headers: (params: GmailListLabelsParams) => ({
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    }),
  },

  transformResponse: async (response) => {
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to list labels')
    }

    const labels = (data.labels || []).map((label: any) => {
      let formattedName = label.name
      if (label.type === 'system') {
        formattedName = label.name.charAt(0).toUpperCase() + label.name.slice(1).toLowerCase()
      }

      return {
        id: label.id,
        name: formattedName,
        type: label.type,
        messagesTotal: label.messagesTotal || 0,
        messagesUnread: label.messagesUnread || 0,
      }
    })

    const summary = labels
      .map(
        (l: any) => `${l.name} (${l.id}) - ${l.messagesTotal} messages, ${l.messagesUnread} unread`
      )
      .join('\n')

    return {
      success: true,
      output: {
        content: `Found ${labels.length} labels:\n\n${summary}`,
        metadata: {
          results: labels,
        },
      },
    }
  },

  transformError: (error) => {
    if (error.error?.message) {
      if (
        error.error.message.includes('invalid authentication credentials') ||
        error.error.message.includes('Invalid Credentials')
      ) {
        return 'Gmail authentication failed. Please reconnect your Gmail account in Settings → Integrations, then try again.'
      }
      return error.error.message
    }
    return error.message || 'An unexpected error occurred while listing labels'
  },
}
