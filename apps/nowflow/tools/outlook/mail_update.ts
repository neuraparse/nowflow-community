import { ToolConfig } from '../types'

export interface OutlookMailUpdateParams {
  credential: string
  accessToken?: string
  messageId: string
  operation: 'markRead' | 'markUnread' | 'move' | 'delete'
  destinationFolderId?: string // Required for 'move' operation
}

export const outlook_mail_update: ToolConfig<
  OutlookMailUpdateParams,
  {
    success: boolean
    output: { message: string; data?: any }
    error?: string
  }
> = {
  id: 'outlook_mail_update',
  name: 'Outlook Mail Update',
  description:
    'Update email status (mark as read/unread, move, delete) in Outlook using Microsoft Graph API',
  version: '1.0.0',
  oauth: {
    required: true,
    provider: 'microsoft-outlook',
    additionalScopes: ['https://graph.microsoft.com/Mail.ReadWrite'],
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
      description: 'ID of the message to update',
    },
    operation: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Operation to perform: markRead, markUnread, move, or delete',
    },
    destinationFolderId: {
      type: 'string',
      required: false,
      description: 'Destination folder ID (required for move operation)',
    },
  },
  request: {
    url: (params) => {
      const baseUrl = `https://graph.microsoft.com/v1.0/me/messages/${params.messageId}`
      if (params.operation === 'move') {
        return `${baseUrl}/move`
      }
      return baseUrl
    },
    method: (params) => {
      if (params.operation === 'delete') {
        return 'DELETE'
      }
      if (params.operation === 'move') {
        return 'POST'
      }
      return 'PATCH'
    },
    headers: (params) => {
      if (!params.accessToken) throw new Error('Access token is required')
      return {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      }
    },
    body: (params) => {
      switch (params.operation) {
        case 'markRead':
          return { isRead: true }
        case 'markUnread':
          return { isRead: false }
        case 'move':
          if (!params.destinationFolderId) {
            throw new Error('destinationFolderId is required for move operation')
          }
          return { destinationId: params.destinationFolderId }
        case 'delete':
          return undefined // DELETE requests don't need a body
        default:
          throw new Error(`Invalid operation: ${params.operation}`)
      }
    },
  },
  transformResponse: async (response, params) => {
    // DELETE returns 204 No Content
    if (params?.operation === 'delete') {
      return {
        success: true,
        output: { message: 'Email deleted successfully' },
        error: undefined,
      }
    }

    // For move operation, return the moved message data
    if (params?.operation === 'move') {
      const data = await response.json()
      return {
        success: true,
        output: { message: 'Email moved successfully', data },
        error: undefined,
      }
    }

    // For mark operations
    const data = await response.json()
    const operationMessage =
      params?.operation === 'markRead' ? 'Email marked as read' : 'Email marked as unread'
    return {
      success: true,
      output: { message: operationMessage, data },
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
        return 'Email or folder not found. Please check the message ID and try again.'
      }
      return error.message
    }
    return 'An unexpected error occurred while updating the email.'
  },
}
