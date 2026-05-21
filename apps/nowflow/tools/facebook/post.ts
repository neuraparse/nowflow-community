import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig } from '../types'
import { FacebookPostParams, FacebookToolResponse } from './types'

const logger = createLogger('FacebookPostTool')

export const facebookPostTool: ToolConfig<FacebookPostParams, FacebookToolResponse> = {
  id: 'facebook_post',
  name: 'Facebook Post',
  description: 'Create posts on Facebook Pages using the Graph API',
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
    message: {
      type: 'string',
      required: false,
      description: 'Post message content',
    },
    link: {
      type: 'string',
      required: false,
      description: 'URL to share in the post',
    },
    imageUrl: {
      type: 'string',
      required: false,
      description: 'Image URL to include in the post',
    },
    published: {
      type: 'boolean',
      required: false,
      description: 'Whether to publish immediately (default: true)',
    },
    scheduledPublishTime: {
      type: 'number',
      required: false,
      description: 'Unix timestamp for scheduled publishing',
    },
  },

  request: {
    url: (params) => {
      if (!params.pageId) {
        throw new Error('Facebook Page ID is required')
      }
      return `https://graph.facebook.com/v21.0/${params.pageId}/feed`
    },
    method: 'POST',
    headers: (params) => {
      if (!params.accessToken) {
        throw new Error('Facebook Access Token is required')
      }
      return {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      }
    },
    body: (params) => {
      const body: any = {}

      if (params.message) {
        body.message = params.message
      }

      if (params.link) {
        body.link = params.link
      }

      if (params.imageUrl) {
        body.url = params.imageUrl
      }

      if (params.published !== undefined) {
        body.published = params.published
      }

      if (params.scheduledPublishTime) {
        body.scheduled_publish_time = params.scheduledPublishTime
        body.published = false
      }

      return body
    },
  },

  transformResponse: async (response) => {
    const data = await response.json()

    if (!response.ok) {
      const errorMessage =
        data.error?.message || `Failed to create Facebook post (HTTP ${response.status})`
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
        data: {
          id: data.id,
          post_id: data.post_id,
        },
      },
      error: undefined,
    }
  },

  transformError: (error) => {
    logger.error('Facebook post tool error:', { error })
    return `Facebook post failed: ${error.message || 'Unknown error occurred'}`
  },
}
