import { ToolConfig } from '../types'
import { LinkedInShareResponse } from './types'

export interface LinkedInShareParams {
  credential: string
  accessToken?: string
  text: string
  visibility?: 'PUBLIC' | 'CONNECTIONS'
}

export const linkedin_share: ToolConfig<
  LinkedInShareParams,
  { success: boolean; output: { result: LinkedInShareResponse }; error?: string }
> = {
  id: 'linkedin_share',
  name: 'LinkedIn Share Post',
  description: 'Share a post on LinkedIn',
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
    text: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'The text content of the post',
    },
    visibility: {
      type: 'string',
      required: false,
      description: 'Post visibility: PUBLIC or CONNECTIONS',
      default: 'PUBLIC',
    },
  },
  oauth: {
    required: true,
    provider: 'linkedin',
    additionalScopes: ['w_member_social'],
  },
  request: {
    url: () => 'https://api.linkedin.com/rest/posts',
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
      // Note: author URN will be resolved server-side via proxy route
      return {
        text: params.text,
        visibility: params.visibility || 'PUBLIC',
      }
    },
  },

  // Server-side execution to handle author URN resolution
  directExecution: async (params) => {
    // Only execute on server-side (not in browser due to CORS)
    if (typeof window !== 'undefined') {
      return undefined // Fall back to proxy route
    }
    if (!params.accessToken) {
      return {
        success: false,
        output: { result: { id: '', success: false, message: 'Access token is required' } },
        error: 'Access token is required',
      }
    }

    try {
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
      // LinkedIn's OIDC sub claim is just the person ID, not a full URN
      const personId = profile.sub
      const authorUrn = personId.startsWith('urn:li:') ? personId : `urn:li:person:${personId}`

      const postData = {
        author: authorUrn,
        commentary: params.text,
        visibility: params.visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }

      const response = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202601',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(postData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to share post: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      return {
        success: true,
        output: {
          result: {
            id: result.id || 'unknown',
            success: true,
            message: 'Post shared successfully on LinkedIn',
          },
        },
        error: undefined,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        output: {
          result: {
            id: '',
            success: false,
            message,
          },
        },
        error: message,
      }
    }
  },
}
