import { ToolConfig } from '../types'
import { extractLinkedInUrn } from './utils'

export interface LinkedInAddCommentParams {
  credential: string
  accessToken?: string
  postUrn: string
  text: string
}

export interface LinkedInCommentResponse {
  id: string
  actor: string
  message: { text: string }
  created: { time: number }
}

export const linkedin_add_comment: ToolConfig<
  LinkedInAddCommentParams,
  { success: boolean; output: { comment: LinkedInCommentResponse }; error?: string }
> = {
  id: 'linkedin_add_comment',
  name: 'LinkedIn Add Comment',
  description: 'Add a comment to a LinkedIn post',
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
    text: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Comment text',
    },
  },
  oauth: {
    required: true,
    provider: 'linkedin',
    additionalScopes: ['openid', 'profile', 'email', 'w_member_social'],
  },
  request: {
    url: (params) => {
      const urn = extractLinkedInUrn(params.postUrn)
      const postUrn = encodeURIComponent(urn)
      return `https://api.linkedin.com/rest/socialActions/${postUrn}/comments`
    },
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
    body: (params) => ({
      message: {
        text: params.text,
      },
    }),
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

      throw new Error(`Failed to add comment: ${response.status} ${errorText}`)
    }
    const comment = (await response.json()) as LinkedInCommentResponse
    return { success: true, output: { comment }, error: undefined }
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
        output: { comment: {} as LinkedInCommentResponse },
        error: 'Access token is required',
      }
    }

    try {
      const urn = extractLinkedInUrn(params.postUrn)
      const postUrn = encodeURIComponent(urn)
      const url = `https://api.linkedin.com/rest/socialActions/${postUrn}/comments`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202601',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          message: {
            text: params.text,
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()

        // Handle Partner API access errors
        if (response.status === 403) {
          if (errorText.includes('partnerApi') || errorText.includes('ACCESS_DENIED')) {
            return {
              success: false,
              output: { comment: {} as LinkedInCommentResponse },
              error:
                'LinkedIn Partner API access required. This feature requires LinkedIn Partner API access which is not available with standard LinkedIn developer accounts. Please use "Share a Post" or "Get Profile Info" features instead.',
            }
          }
        }

        throw new Error(`Failed to add comment: ${response.status} ${errorText}`)
      }

      const comment = (await response.json()) as LinkedInCommentResponse
      return {
        success: true,
        output: { comment },
        error: undefined,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        output: { comment: {} as LinkedInCommentResponse },
        error: message,
      }
    }
  },
}
