import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig } from '../types'
import { FacebookPageInfoParams, FacebookToolResponse } from './types'

const logger = createLogger('FacebookPageInfoTool')

export const facebookPageInfoTool: ToolConfig<FacebookPageInfoParams, FacebookToolResponse> = {
  id: 'facebook_page_info',
  name: 'Facebook Page Info',
  description: 'Get information about a Facebook Page',
  version: '1.0.0',

  params: {
    accessToken: {
      type: 'string',
      required: true,
      description: 'Facebook Page Access Token',
      requiredForToolCall: true,
    },
    pageId: {
      type: 'string',
      required: true,
      description: 'Facebook Page ID',
    },
    fields: {
      type: 'string',
      required: false,
      description:
        'Comma-separated list of fields to retrieve (default: id,name,category,about,website,phone,emails,fan_count,instagram_business_account)',
    },
  },

  request: {
    url: (params) => {
      if (!params.pageId) {
        throw new Error('Facebook Page ID is required')
      }

      const fields =
        params.fields ||
        'id,name,category,about,website,phone,emails,fan_count,instagram_business_account{id,username}'
      return `https://graph.facebook.com/v21.0/${params.pageId}?fields=${encodeURIComponent(fields)}`
    },
    method: 'GET',
    headers: (params) => {
      if (!params.accessToken) {
        throw new Error('Facebook Access Token is required')
      }
      return {
        Authorization: `Bearer ${params.accessToken}`,
      }
    },
  },

  transformResponse: async (response) => {
    const data = await response.json()

    if (!response.ok) {
      const errorMessage =
        data.error?.message || `Failed to get Facebook page info (HTTP ${response.status})`
      logger.error('Facebook API error:', data)
      return {
        success: false,
        output: data,
        error: errorMessage,
      }
    }

    return {
      success: true,
      output: {
        success: true,
        data,
      },
      error: undefined,
    }
  },

  transformError: (error) => {
    logger.error('Facebook page info tool error:', { error })
    return `Facebook page info failed: ${error.message || 'Unknown error occurred'}`
  },
}
