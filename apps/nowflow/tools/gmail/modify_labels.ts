import { ToolConfig } from '../types'
import { GmailModifyLabelsParams, GmailToolResponse } from './types'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

export const gmailModifyLabelsTool: ToolConfig<GmailModifyLabelsParams, GmailToolResponse> = {
  id: 'gmail_modify_labels',
  name: 'Gmail Modify Labels',
  description: 'Add or remove labels from a Gmail message (including mark as read/unread)',
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
      description: 'ID of the message to modify',
    },
    addLabelIds: {
      type: 'string',
      required: false,
      description: 'Comma-separated label IDs to add (e.g., STARRED,IMPORTANT,UNREAD)',
    },
    removeLabelIds: {
      type: 'string',
      required: false,
      description: 'Comma-separated label IDs to remove (e.g., UNREAD,INBOX)',
    },
  },

  request: {
    url: (params) => `${GMAIL_API_BASE}/messages/${params.messageId}/modify`,
    method: 'POST',
    headers: (params: GmailModifyLabelsParams) => ({
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    }),
    body: (params: GmailModifyLabelsParams) => {
      const addLabelIds = params.addLabelIds
        ? params.addLabelIds
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        : []
      const removeLabelIds = params.removeLabelIds
        ? params.removeLabelIds
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        : []

      return {
        addLabelIds,
        removeLabelIds,
      }
    },
  },

  transformResponse: async (response) => {
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to modify labels')
    }

    return {
      success: true,
      output: {
        content: 'Labels modified successfully',
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
      if (error.error.message.includes('Invalid label')) {
        return 'Invalid label ID. Use "List Labels" operation to see available labels.'
      }
      return error.error.message
    }
    return error.message || 'An unexpected error occurred while modifying labels'
  },
}
