import { ToolConfig } from '../types'
import { extractLinkedInUrn } from './utils'

export interface LinkedInAddReactionParams {
  credential: string
  accessToken?: string
  postUrn: string
  reactionType: 'LIKE' | 'PRAISE' | 'APPRECIATION' | 'EMPATHY' | 'INTEREST' | 'ENTERTAINMENT'
}

export interface LinkedInReactionResponse {
  id: string
  actor: string
  reactionType: string
  created: { time: number }
}

export const linkedin_add_reaction: ToolConfig<
  LinkedInAddReactionParams,
  { success: boolean; output: { reaction: LinkedInReactionResponse }; error?: string }
> = {
  id: 'linkedin_add_reaction',
  name: 'LinkedIn Add Reaction',
  description: 'Add a reaction to a LinkedIn post',
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
    postUrn: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description:
        'LinkedIn post URL or URN (e.g., https://www.linkedin.com/feed/update/urn:li:share:1234567890 or urn:li:share:1234567890)',
    },
    reactionType: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description:
        'Reaction type: LIKE, PRAISE (celebrate), APPRECIATION (support), EMPATHY (love), INTEREST (insightful), ENTERTAINMENT (curious)',
      default: 'LIKE',
    },
  },
  oauth: {
    required: true,
    provider: 'linkedin',
    additionalScopes: ['openid', 'profile', 'email', 'w_member_social'],
  },
  request: {
    url: () => 'https://api.linkedin.com/rest/reactions',
    method: 'POST',
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
    body: (params) => {
      const urn = extractLinkedInUrn(params.postUrn)
      return {
        root: urn,
        reactionType: params.reactionType || 'LIKE',
      }
    },
  },

  transformResponse: async (response) => {
    if (!response.ok) {
      const errorText = await response.text()

      // Handle Partner API access errors
      if (response.status === 403) {
        if (errorText.includes('partnerApi') || errorText.includes('ACCESS_DENIED')) {
          throw new Error(
            `LinkedIn Partner API access required. This feature requires LinkedIn Partner API access which is not available with standard LinkedIn developer accounts. Please use "Share a Post" or "Get Profile Info" features instead.`
          )
        }
      }

      throw new Error(`Failed to add reaction: ${response.status} ${errorText}`)
    }
    const reaction = (await response.json()) as LinkedInReactionResponse
    return { success: true, output: { reaction }, error: undefined }
  },

  // Server-side execution for better performance
  directExecution: async (params) => {
    // Only execute on server-side (not in browser due to CORS)
    if (typeof window !== 'undefined') {
      return undefined // Fall back to proxy route
    }

    if (!params.accessToken) {
      return {
        success: false,
        output: { reaction: {} as LinkedInReactionResponse },
        error: 'Access token is required',
      }
    }

    try {
      const urn = extractLinkedInUrn(params.postUrn)
      const response = await fetch('https://api.linkedin.com/rest/reactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202601',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          root: urn,
          reactionType: params.reactionType || 'LIKE',
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()

        // Handle Partner API access errors
        if (response.status === 403) {
          if (errorText.includes('partnerApi') || errorText.includes('ACCESS_DENIED')) {
            return {
              success: false,
              output: { reaction: {} as LinkedInReactionResponse },
              error:
                'LinkedIn Partner API access required. This feature requires LinkedIn Partner API access which is not available with standard LinkedIn developer accounts. Please use "Share a Post" or "Get Profile Info" features instead.',
            }
          }
        }

        throw new Error(`Failed to add reaction: ${response.status} ${errorText}`)
      }

      const reaction = (await response.json()) as LinkedInReactionResponse
      return {
        success: true,
        output: { reaction },
        error: undefined,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        output: { reaction: {} as LinkedInReactionResponse },
        error: message,
      }
    }
  },
}
