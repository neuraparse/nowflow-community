import { ToolConfig } from '../types'

interface InstagramPostMediaParams {
  accessToken: string
  igUserId: string
  caption?: string
  mediaUrl: string
}

export const instagramPostMediaTool: ToolConfig<InstagramPostMediaParams> = {
  id: 'instagram_post_media',
  name: 'Instagram Post Media',
  description: 'Create a media container and publish it to Instagram Business account.',
  version: '1.0.0',

  params: {
    accessToken: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Instagram Graph API access token',
    },
    igUserId: { type: 'string', required: true, description: 'Instagram Business Account user id' },
    caption: { type: 'string', required: false, description: 'Caption to include with the media' },
    mediaUrl: {
      type: 'string',
      required: true,
      description: 'Publicly accessible image or video URL',
    },
  },

  // First request: create media container
  request: {
    url: (p: InstagramPostMediaParams) =>
      `https://graph.facebook.com/v24.0/${encodeURIComponent(p.igUserId)}/media`,
    method: 'POST',
    headers: (p: InstagramPostMediaParams) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p.accessToken}`,
    }),
    body: (p: InstagramPostMediaParams) => ({
      image_url: p.mediaUrl,
      caption: p.caption,
    }),
  },

  // After container creation, publish it
  postProcess: async (result, params, executeTool) => {
    if (!result.success) return result
    const creationId = (result.output?.data?.id ?? result.output?.id) as string | undefined
    if (!creationId) {
      return {
        success: false,
        output: result.output || {},
        error: 'Missing creation_id from Instagram container creation response',
      }
    }

    const publishUrl = `https://graph.facebook.com/v24.0/${encodeURIComponent(
      (params as InstagramPostMediaParams).igUserId
    )}/media_publish`

    const publishResp = await executeTool('http_request', {
      url: publishUrl,
      method: 'POST',
      headers: [
        { id: '1', cells: { Key: 'Content-Type', Value: 'application/json' } },
        {
          id: '2',
          cells: {
            Key: 'Authorization',
            Value: `Bearer ${(params as InstagramPostMediaParams).accessToken}`,
          },
        },
      ],
      body: { creation_id: creationId },
    })

    if (!publishResp.success) return publishResp

    return {
      success: true,
      output: {
        container: result.output?.data || result.output,
        publish: publishResp.output?.data || publishResp.output,
      },
    }
  },

  transformResponse: async (response: Response) => {
    const data = await response.json().catch(async () => ({ raw: await response.text() }))
    return {
      success: response.ok,
      output: data,
      error: response.ok
        ? undefined
        : data?.error?.message || 'Instagram container creation failed',
    }
  },

  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'Instagram request failed',
}
