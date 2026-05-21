import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig } from '../types'

const logger = createLogger('InstagramListAccountsTool')

export interface InstagramListAccountsParams {
  accessToken: string
  pageId?: string
}

export interface InstagramBusinessAccount {
  id: string
  username: string
  name: string
  profile_picture_url: string
  followers_count: number
  media_count: number
}

export interface InstagramListAccountsResponse {
  success: boolean
  output: {
    accounts: InstagramBusinessAccount[]
  }
  error?: string
}

export const listAccountsTool: ToolConfig<
  InstagramListAccountsParams,
  InstagramListAccountsResponse
> = {
  id: 'instagram_list_accounts',
  name: 'Instagram List Business Accounts',
  description: 'Get list of Instagram Business Accounts connected to Facebook Pages',
  version: '1.0.0',

  params: {
    accessToken: {
      type: 'string',
      required: true,
      description: 'Facebook User Access Token',
      requiredForToolCall: true,
    },
    pageId: {
      type: 'string',
      required: false,
      description: 'Specific Facebook Page ID to get Instagram account for',
    },
  },

  request: {
    url: (params) => {
      if (params.pageId) {
        return `https://graph.facebook.com/v21.0/${params.pageId}`
      }
      return 'https://graph.facebook.com/v21.0/me/accounts'
    },
    method: 'GET',
    headers: (params) => ({
      Authorization: `Bearer ${params.accessToken}`,
    }),
    query: (params) => {
      if (params.pageId) {
        return {
          fields:
            'instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}',
        }
      }
      return {
        fields:
          'id,name,instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}',
      }
    },
  },

  transformResponse: async (response) => {
    const data = await response.json()

    if (!response.ok) {
      const errorMessage =
        data.error?.message || `Failed to fetch Instagram accounts (HTTP ${response.status})`
      logger.error('Instagram API error:', data)
      throw new Error(errorMessage)
    }

    let accounts: InstagramBusinessAccount[] = []

    if (data.instagram_business_account) {
      // Single page query
      accounts = [data.instagram_business_account]
    } else if (data.data) {
      // Multiple pages query
      accounts = data.data
        .filter((page: any) => page.instagram_business_account)
        .map((page: any) => page.instagram_business_account)
    }

    return {
      success: true,
      output: {
        accounts,
      },
      error: undefined,
    }
  },

  transformError: (error) => {
    logger.error('Instagram list accounts error:', { error })
    return `Failed to fetch Instagram accounts: ${error.message || 'Unknown error occurred'}`
  },
}
