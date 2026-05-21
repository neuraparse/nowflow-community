import { ToolConfig } from '../types'
import { YouTubeChannelInfoParams, YouTubeChannelInfoResponse } from './types'

export const youtubeChannelInfoTool: ToolConfig<
  YouTubeChannelInfoParams,
  YouTubeChannelInfoResponse
> = {
  id: 'youtube_channel_info',
  name: 'YouTube Channel Info',
  description: 'Get detailed information about a YouTube channel including statistics.',
  version: '1.0.0',

  oauth: {
    required: true,
    provider: 'google-youtube',
    additionalScopes: ['https://www.googleapis.com/auth/youtube.readonly'],
  },

  params: {
    accessToken: {
      type: 'string',
      required: true,
      description: 'Access token for YouTube API',
    },
    channelId: {
      type: 'string',
      required: false,
      description: 'YouTube channel ID',
    },
    username: {
      type: 'string',
      required: false,
      description: 'YouTube channel username (alternative to channelId)',
    },
  },
  request: {
    url: (params: YouTubeChannelInfoParams) => {
      let url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails`

      if (params.channelId) {
        url += `&id=${encodeURIComponent(params.channelId)}`
      } else if (params.username) {
        url += `&forUsername=${encodeURIComponent(params.username)}`
      } else {
        throw new Error('Either channelId or username must be provided')
      }

      return url
    },
    method: 'GET',
    headers: (params: YouTubeChannelInfoParams) => ({
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    }),
  },
  transformResponse: async (response: Response): Promise<YouTubeChannelInfoResponse> => {
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error?.message || 'YouTube API error')
    }

    if (!data.items || data.items.length === 0) {
      throw new Error('Channel not found')
    }

    const channel = data.items[0]
    const snippet = channel.snippet || {}
    const statistics = channel.statistics || {}

    return {
      success: true,
      output: {
        id: channel.id,
        title: snippet.title || '',
        description: snippet.description || '',
        customUrl: snippet.customUrl,
        publishedAt: snippet.publishedAt || '',
        thumbnails: {
          default: snippet.thumbnails?.default?.url,
          medium: snippet.thumbnails?.medium?.url,
          high: snippet.thumbnails?.high?.url,
        },
        country: snippet.country,
        viewCount: statistics.viewCount || '0',
        subscriberCount: statistics.subscriberCount || '0',
        videoCount: statistics.videoCount || '0',
        hiddenSubscriberCount: statistics.hiddenSubscriberCount || false,
      },
    }
  },
  transformError: (error: any): string => {
    const message = error.error?.message || error.message || 'Failed to get channel info'
    const code = error.error?.code || error.code
    return code ? `${message} (${code})` : message
  },
}
