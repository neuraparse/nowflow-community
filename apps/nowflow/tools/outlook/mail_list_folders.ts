import { ToolConfig } from '../types'

export interface OutlookMailListFoldersParams {
  credential: string
  accessToken?: string
  includeHidden?: boolean
}

export interface OutlookMailFolder {
  id: string
  displayName: string
  parentFolderId: string
  childFolderCount: number
  unreadItemCount: number
  totalItemCount: number
  isHidden: boolean
}

export const outlook_mail_list_folders: ToolConfig<
  OutlookMailListFoldersParams,
  {
    success: boolean
    output: { folders: OutlookMailFolder[] }
    error?: string
  }
> = {
  id: 'outlook_mail_list_folders',
  name: 'Outlook Mail List Folders',
  description: 'List all mail folders in Outlook mailbox using Microsoft Graph API',
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
    includeHidden: {
      type: 'boolean',
      required: false,
      description: 'Include hidden folders in the response',
      default: false,
    },
  },
  request: {
    url: () => 'https://graph.microsoft.com/v1.0/me/mailFolders',
    method: 'GET',
    headers: (params) => {
      if (!params.accessToken) throw new Error('Access token is required')
      return {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      }
    },
    query: (params) => {
      const queryParams: Record<string, string> = {
        $select:
          'id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount,isHidden',
      }
      if (params.includeHidden) {
        queryParams.includeHiddenFolders = 'true'
      }
      return queryParams
    },
  },
  transformResponse: async (response) => {
    const data = await response.json()
    return {
      success: true,
      output: { folders: (data.value || []) as OutlookMailFolder[] },
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
      return error.message
    }
    return 'An unexpected error occurred while listing mail folders.'
  },
}
