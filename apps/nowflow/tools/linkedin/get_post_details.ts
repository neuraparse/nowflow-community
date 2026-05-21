import { ToolConfig } from '../types'
import { extractLinkedInUrn } from './utils'

export interface LinkedInGetPostDetailsParams {
  credential: string
  accessToken?: string
  postUrn: string
}

export interface LinkedInPostDetails {
  id: string
  author: string
  commentary?: string
  content?: {
    article?: {
      title?: string
      description?: string
      source?: string
    }
    media?: {
      title?: string
      id?: string
    }
  }
  lifecycleState?: string
  visibility?: string
  distribution?: {
    feedDistribution?: string
  }
  created?: {
    time?: number
  }
  lastModified?: {
    time?: number
  }
}

export const linkedin_get_post_details: ToolConfig<
  LinkedInGetPostDetailsParams,
  { success: boolean; output: { post: LinkedInPostDetails }; error?: string }
> = {
  id: 'linkedin_get_post_details',
  name: 'LinkedIn Get Post Details',
  description: 'Get details about a LinkedIn post',
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
  },
  oauth: {
    required: true,
    provider: 'linkedin',
    additionalScopes: ['openid', 'profile', 'email', 'w_member_social'],
  },
  request: {
    url: (params) => {
      let urn = extractLinkedInUrn(params.postUrn)
      // Convert share URN to ugcPost URN if needed for legacy API
      if (urn.includes('urn:li:share:')) {
        urn = urn.replace('urn:li:share:', 'urn:li:ugcPost:')
      }
      const encodedUrn = encodeURIComponent(urn)
      return `https://api.linkedin.com/v2/ugcPosts/${encodedUrn}`
    },
    method: 'GET',
    headers: (params) => {
      if (!params.accessToken) {
        throw new Error('Access token is required')
      }
      return {
        Authorization: `Bearer ${params.accessToken}`,
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

      throw new Error(`Failed to get post details: ${response.status} ${errorText}`)
    }
    const post = (await response.json()) as LinkedInPostDetails
    return { success: true, output: { post }, error: undefined }
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
        output: { post: {} as LinkedInPostDetails },
        error: 'Access token is required',
      }
    }

    try {
      let urn = extractLinkedInUrn(params.postUrn)
      // Convert share URN to ugcPost URN if needed for legacy API
      if (urn.includes('urn:li:share:')) {
        urn = urn.replace('urn:li:share:', 'urn:li:ugcPost:')
      }
      const encodedUrn = encodeURIComponent(urn)
      const url = `https://api.linkedin.com/v2/ugcPosts/${encodedUrn}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()

        // Handle Partner API access errors
        if (response.status === 403) {
          if (errorText.includes('partnerApi') || errorText.includes('ACCESS_DENIED')) {
            return {
              success: false,
              output: { post: {} as LinkedInPostDetails },
              error:
                'LinkedIn Partner API access required. This feature requires LinkedIn Partner API access which is not available with standard LinkedIn developer accounts. Please use "Share a Post" or "Get Profile Info" features instead.',
            }
          }
        }

        throw new Error(`Failed to get post details: ${response.status} ${errorText}`)
      }

      const post = (await response.json()) as LinkedInPostDetails
      return {
        success: true,
        output: { post },
        error: undefined,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        output: { post: {} as LinkedInPostDetails },
        error: message,
      }
    }
  },
}
