import { ToolConfig } from '../types'
import { GmailToolResponse, GmailTrashParams } from './types'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

export const gmailTrashTool: ToolConfig<GmailTrashParams, GmailToolResponse> = {
  id: 'gmail_trash',
  name: 'Gmail Trash',
  description: 'Move emails to trash or restore from trash in Gmail',
  version: '1.0.0',

  oauth: {
    required: true,
    provider: 'google-email',
    additionalScopes: ['https://www.googleapis.com/auth/gmail.modify'],
  },

  params: {
    accessToken: {
      type: 'string',
      required: true,
      description: 'Access token for Gmail API',
    },
    messageId: {
      type: 'string',
      required: true,
      description: 'ID of the message to trash or untrash',
    },
    untrash: {
      type: 'boolean',
      required: false,
      description: 'Set to true to restore message from trash',
    },
  },

  request: {
    url: (params) => {
      const action = params.untrash ? 'untrash' : 'trash'
      return `${GMAIL_API_BASE}/messages/${params.messageId}/${action}`
    },
    method: 'POST',
    headers: (params: GmailTrashParams) => ({
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    }),
  },

  transformResponse: async (response) => {
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to trash/untrash email')
    }

    const action = data.labelIds?.includes('TRASH') ? 'moved to trash' : 'restored from trash'

    return {
      success: true,
      output: {
        content: `Email successfully ${action}`,
        metadata: {
          id: data.id,
          threadId: data.threadId,
          labelIds: data.labelIds,
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
      if (error.error.message.includes('Not Found')) {
        return 'Message not found. Please check the message ID.'
      }
      return error.error.message
    }
    return error.message || 'An unexpected error occurred while trashing/untrashing email'
  },
}
