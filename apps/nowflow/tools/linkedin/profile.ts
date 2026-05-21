import { ToolConfig } from '../types'
import { LinkedInProfileResponse } from './types'

export interface LinkedInProfileParams {
  credential: string
  accessToken?: string
}

export const linkedin_profile: ToolConfig<
  LinkedInProfileParams,
  { success: boolean; output: { profile: LinkedInProfileResponse }; error?: string }
> = {
  id: 'linkedin_profile',
  name: 'LinkedIn Get Profile',
  description: 'Get LinkedIn user profile information',
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
  },
  oauth: {
    required: true,
    provider: 'linkedin',
    additionalScopes: ['openid', 'profile', 'email'],
  },
  request: {
    url: () => 'https://api.linkedin.com/v2/userinfo',
    method: 'GET',
    headers: (params) => {
      if (!params.accessToken) {
        throw new Error('Access token is required')
      }
      return {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      }
    },
  },

  transformResponse: async (response) => {
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to get LinkedIn profile: ${response.status} ${errorText}`)
    }
    const profile = (await response.json()) as LinkedInProfileResponse
    return { success: true, output: { profile }, error: undefined }
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
        output: { profile: {} as LinkedInProfileResponse },
        error: 'Access token is required',
      }
    }

    try {
      const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to get user profile: ${response.status} ${errorText}`)
      }

      const profile = (await response.json()) as LinkedInProfileResponse
      return {
        success: true,
        output: { profile },
        error: undefined,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        output: { profile: {} as LinkedInProfileResponse },
        error: message,
      }
    }
  },
}
