import { ToolConfig } from '../types'
import { OutlookMailReadResponse } from './types'

export interface OutlookMailReadParams {
  credential: string
  accessToken?: string
  messageId?: string
  folderId?: string
  top?: string
  unreadOnly?: boolean
}

export const outlook_mail_read: ToolConfig<
  OutlookMailReadParams,
  {
    success: boolean
    output: { message?: OutlookMailReadResponse; messages?: OutlookMailReadResponse[] }
    error?: string
  }
> = {
  id: 'outlook_mail_read',
  name: 'Outlook Mail Read',
  description: 'Read emails from Outlook using Microsoft Graph API',
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
      required: false,
      description: 'Specific message ID to read. If not provided, returns recent messages.',
    },
    folderId: {
      type: 'string',
      required: false,
      description: 'Folder ID (e.g., inbox, sentitems, drafts). Defaults to inbox.',
      default: 'inbox',
    },
    top: {
      type: 'string',
      required: false,
      description: 'Number of messages to return (max 50)',
      default: '10',
    },
    unreadOnly: {
      type: 'boolean',
      required: false,
      description: 'If true, only return unread messages',
      default: false,
    },
  },
  request: {
    url: (params) => {
      if (params.messageId) {
        return `https://graph.microsoft.com/v1.0/me/messages/${params.messageId}`
      }
      const folder = params.folderId || 'inbox'
      return `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages`
    },
    method: 'GET',
    headers: (params) => {
      if (!params.accessToken) throw new Error('Access token is required')
      return {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      }
    },
    query: (params) => {
      if (params.messageId) return {}
      const top = Math.min(parseInt(params.top || '10', 10) || 10, 50)
      const queryParams: Record<string, string> = {
        $top: String(top),
        $select: 'id,subject,from,toRecipients,body,receivedDateTime,hasAttachments,isRead',
        $orderby: 'receivedDateTime desc',
      }

      // Add filter for unread messages if requested
      if (params.unreadOnly) {
        queryParams.$filter = 'isRead eq false'
      }

      return queryParams
    },
  },
  transformResponse: async (response, params) => {
    const data = await response.json()
    if (params?.messageId) {
      return {
        success: true,
        output: { message: data as OutlookMailReadResponse },
        error: undefined,
      }
    }
    return {
      success: true,
      output: { messages: (data.value || []) as OutlookMailReadResponse[] },
      error: undefined,
    }
  },
}
