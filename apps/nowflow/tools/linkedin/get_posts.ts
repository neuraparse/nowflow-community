import { ToolConfig } from '../types'
import { LinkedInPostsResponse } from './types'

export interface LinkedInGetPostsParams {
  credential: string
  accessToken?: string
  count?: number
}

export const linkedin_get_posts: ToolConfig<
  LinkedInGetPostsParams,
  { success: boolean; output: { posts: LinkedInPostsResponse }; error?: string }
> = {
  id: 'linkedin_get_posts',
  name: 'LinkedIn Get Posts',
  description: 'Get your LinkedIn posts',
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
    count: {
      type: 'number',
      required: false,
      description: 'Number of posts to retrieve (default: 10, max: 50)',
      default: 10,
    },
  },
  oauth: {
    required: true,
    provider: 'linkedin',
    additionalScopes: ['openid', 'profile', 'email', 'r_member_social'],
  },
  request: {
    url: () => 'https://api.linkedin.com/rest/posts',
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
      const count = params.count || 10
      return {
        count: Math.min(count, 50).toString(),
        start: '0',
        q: 'author',
        author: 'urn:li:person:CURRENT',
      }
    },
  },

  transformResponse: async (response) => {
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to get LinkedIn posts: ${response.status} ${errorText}`)
    }
    const posts = (await response.json()) as LinkedInPostsResponse
    return { success: true, output: { posts }, error: undefined }
  },

  directExecution: async (params) => {
    if (!params.accessToken) {
      return {
        success: false,
        output: { posts: { elements: [] } },
        error: 'Access token is required',
      }
    }

    try {
      // First get user profile to get the person URN
      const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text()
        throw new Error(`Failed to get user profile: ${profileResponse.status} ${errorText}`)
      }

      const profile = await profileResponse.json()
      const personId = profile.sub
      const authorUrn = personId.startsWith('urn:li:') ? personId : `urn:li:person:${personId}`

      const count = params.count || 10
      const url = new URL('https://api.linkedin.com/rest/posts')
      url.searchParams.set('q', 'author')
      url.searchParams.set('author', authorUrn)
      url.searchParams.set('count', Math.min(count, 50).toString())
      url.searchParams.set('start', '0')

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
        throw new Error(`Failed to get posts: ${response.status} ${errorText}`)
      }

      const posts = (await response.json()) as LinkedInPostsResponse
      return {
        success: true,
        output: { posts },
        error: undefined,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        output: { posts: { elements: [] } },
        error: message,
      }
    }
  },
}
