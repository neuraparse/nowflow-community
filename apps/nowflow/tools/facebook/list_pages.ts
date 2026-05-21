import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig } from '../types'

const logger = createLogger('FacebookListPagesTool')

export interface FacebookListPagesParams {
  accessToken: string
}

export interface FacebookPage {
  id: string
  name: string
  category: string
  access_token: string
  tasks: string[]
}

export interface FacebookListPagesResponse {
  success: boolean
  output: {
    pages: FacebookPage[]
  }
  error?: string
}

export const listPagesTool: ToolConfig<FacebookListPagesParams, FacebookListPagesResponse> = {
  id: 'facebook_list_pages',
  name: 'Facebook List Pages',
  description: 'Get list of Facebook Pages user manages',
  version: '1.0.0',

  params: {
    accessToken: {
      type: 'string',
      required: true,
      description: 'Facebook User Access Token',
      requiredForToolCall: true,
    },
  },

  request: {
    url: () => 'https://graph.facebook.com/v21.0/me/accounts',
    method: 'GET',
    headers: (params) => ({
      Authorization: `Bearer ${params.accessToken}`,
    }),
    query: () => ({
      fields: 'id,name,category,access_token,tasks',
    }),
  },

  transformResponse: async (response) => {
    const data = await response.json()

    if (!response.ok) {
      const errorMessage =
        data.error?.message || `Failed to fetch Facebook pages (HTTP ${response.status})`
      logger.error('Facebook API error:', data)
      throw new Error(errorMessage)
    }

    return {
      success: true,
      output: {
        pages: data.data || [],
      },
      error: undefined,
    }
  },

  transformError: (error) => {
    logger.error('Facebook list pages error:', { error })
    return `Failed to fetch Facebook pages: ${error.message || 'Unknown error occurred'}`
  },
}
