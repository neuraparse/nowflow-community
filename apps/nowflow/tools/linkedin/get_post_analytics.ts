import { ToolConfig } from '../types'
import { LinkedInPostAnalytics } from './types'

export interface LinkedInGetPostAnalyticsParams {
  credential: string
  accessToken?: string
  postId: string
}

export const linkedin_get_post_analytics: ToolConfig<
  LinkedInGetPostAnalyticsParams,
  { success: boolean; output: { analytics: LinkedInPostAnalytics }; error?: string }
> = {
  id: 'linkedin_get_post_analytics',
  name: 'LinkedIn Get Post Analytics',
  description: 'Get analytics for a specific LinkedIn post',
  version: '1.0.0',

  params: {
    credential: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'OAuth credential ID for LinkedIn',
    },
    accessToken: {
      type: 'string',
      required: false,
      description: 'Access token (resolved from credential)',
    },
    postId: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'LinkedIn post ID or URN',
    },
  },
  oauth: {
    required: true,
    provider: 'linkedin',
    additionalScopes: ['openid', 'profile', 'email', 'r_member_social'],
  },
  request: {
    url: () => 'https://api.linkedin.com/rest/socialMetadata',
    method: 'GET',
    headers: (params) => {
      if (!params.accessToken) {
        throw new Error('Access token is required')
      }
      return {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202601',
        'X-Restli-Protocol-Version': '2.0.0',
      }
    },
    query: (params) => {
      // Ensure postId has the correct URN format
      const postUrn = params.postId.startsWith('urn:li:')
        ? params.postId
        : `urn:li:share:${params.postId}`
      return {
        ids: postUrn,
      }
    },
  },

  transformResponse: async (response) => {
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to get post analytics: ${response.status} ${errorText}`)
    }
    const data = await response.json()

    // Extract analytics from the response
    const postUrn = Object.keys(data.results || {})[0] || ''
    const metadata = data.results?.[postUrn] || {}

    const analytics: LinkedInPostAnalytics = {
      postUrn,
      totalReactions: metadata.totalReactionCount || 0,
      totalComments: metadata.totalCommentCount || 0,
      totalShares: metadata.totalSharedCount || 0,
      totalImpressions: metadata.totalImpressionCount || 0,
      totalReach: metadata.totalReachCount || 0,
      totalEngagements: metadata.totalEngagementCount || 0,
    }

    return { success: true, output: { analytics }, error: undefined }
  },

  directExecution: async (params) => {
    if (!params.accessToken) {
      return {
        success: false,
        output: {
          analytics: {
            postUrn: '',
            totalReactions: 0,
            totalComments: 0,
            totalShares: 0,
            totalImpressions: 0,
            totalReach: 0,
            totalEngagements: 0,
          },
        },
        error: 'Access token is required',
      }
    }

    try {
      // Ensure postId has the correct URN format
      const postUrn = params.postId.startsWith('urn:li:')
        ? params.postId
        : `urn:li:share:${params.postId}`

      const url = new URL('https://api.linkedin.com/rest/socialMetadata')
      url.searchParams.set('ids', postUrn)

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202601',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to get post analytics: ${response.status} ${errorText}`)
      }

      const data = await response.json()

      // Extract analytics from the response
      const resultUrn = Object.keys(data.results || {})[0] || postUrn
      const metadata = data.results?.[resultUrn] || {}

      const analytics: LinkedInPostAnalytics = {
        postUrn: resultUrn,
        totalReactions: metadata.totalReactionCount || 0,
        totalComments: metadata.totalCommentCount || 0,
        totalShares: metadata.totalSharedCount || 0,
        totalImpressions: metadata.totalImpressionCount || 0,
        totalReach: metadata.totalReachCount || 0,
        totalEngagements: metadata.totalEngagementCount || 0,
      }

      return {
        success: true,
        output: { analytics },
        error: undefined,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        output: {
          analytics: {
            postUrn: '',
            totalReactions: 0,
            totalComments: 0,
            totalShares: 0,
            totalImpressions: 0,
            totalReach: 0,
            totalEngagements: 0,
          },
        },
        error: message,
      }
    }
  },
}
