import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig } from '../types'
import { FacebookPagePostsParams, FacebookToolResponse } from './types'

const logger = createLogger('FacebookPagePostsTool')

export const facebookPagePostsTool: ToolConfig<FacebookPagePostsParams, FacebookToolResponse> = {
  id: 'facebook_page_posts',
  name: 'Facebook Page Posts',
  description: 'Get posts from a Facebook Page',
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
    limit: {
      type: 'number',
      required: false,
      description: 'Number of posts to retrieve (default: 25, max: 100)',
    },
    fields: {
      type: 'string',
      required: false,
      description:
        'Comma-separated list of fields to retrieve (default: id,message,story,created_time,updated_time,permalink_url,full_picture,likes.summary(total_count),comments.summary(total_count),shares)',
    },
  },

  request: {
    url: (params) => {
      if (!params.pageId) {
        throw new Error('Facebook Page ID is required')
      }

      const fields =
        params.fields ||
        'id,message,story,created_time,updated_time,permalink_url,full_picture,likes.summary(total_count),comments.summary(total_count),shares'
      const limit = Math.min(params.limit || 25, 100)

      return `https://graph.facebook.com/v21.0/${params.pageId}/posts?fields=${encodeURIComponent(fields)}&limit=${limit}`
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
        data.error?.message || `Failed to get Facebook page posts (HTTP ${response.status})`
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
        data: data.data || [],
        paging: data.paging,
      },
      error: undefined,
    }
  },

  transformError: (error) => {
    logger.error('Facebook page posts tool error:', { error })
    return `Facebook page posts failed: ${error.message || 'Unknown error occurred'}`
  },
}
