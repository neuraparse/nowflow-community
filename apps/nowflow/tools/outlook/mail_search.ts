import { ToolConfig } from '../types'
import { OutlookMailSearchResponse } from './types'

export interface OutlookMailSearchParams {
  credential: string
  accessToken?: string
  searchQuery: string
  folder?: string
  top?: string
}

export const outlook_mail_search: ToolConfig<
  OutlookMailSearchParams,
  { success: boolean; output: { results: OutlookMailSearchResponse }; error?: string }
> = {
  id: 'outlook_mail_search',
  name: 'Outlook Mail Search',
  description: 'Search emails in Outlook using Microsoft Graph API',
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
    searchQuery: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Search query (e.g., "from:sender@example.com subject:important")',
    },
    folder: {
      type: 'string',
      required: false,
      description: 'Folder to search in (e.g., inbox, sentitems). Defaults to all folders.',
    },
    top: {
      type: 'string',
      required: false,
      description: 'Number of results to return (max 50)',
      default: '10',
    },
  },
  request: {
    url: (params) => {
      if (params.folder) {
        return `https://graph.microsoft.com/v1.0/me/mailFolders/${params.folder}/messages`
      }
      return 'https://graph.microsoft.com/v1.0/me/messages'
    },
    method: 'GET',
    headers: (params) => {
      if (!params.accessToken) throw new Error('Access token is required')
      return {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
        ConsistencyLevel: 'eventual',
      }
    },
    query: (params) => {
      const top = Math.min(parseInt(params.top || '10', 10) || 10, 50)
      return {
        $search: `"${params.searchQuery}"`,
        $top: String(top),
        $select: 'id,subject,from,toRecipients,body,receivedDateTime,hasAttachments,isRead',
        $orderby: 'receivedDateTime desc',
      }
    },
  },
  transformResponse: async (response) => {
    const data = (await response.json()) as OutlookMailSearchResponse
    return { success: true, output: { results: data }, error: undefined }
  },
}
