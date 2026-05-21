import { ToolConfig } from '../types'
import { YouTubeVideoDetailsParams, YouTubeVideoDetailsResponse } from './types'

export const youtubeVideoDetailsTool: ToolConfig<
  YouTubeVideoDetailsParams,
  YouTubeVideoDetailsResponse
> = {
  id: 'youtube_video_details',
  name: 'YouTube Video Details',
  description: 'Get detailed information about a YouTube video including statistics and metadata.',
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
    videoId: {
      type: 'string',
      required: true,
      description: 'YouTube video ID',
    },
  },
  request: {
    url: (params: YouTubeVideoDetailsParams) => {
      return `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${encodeURIComponent(params.videoId)}`
    },
    method: 'GET',
    headers: (params: YouTubeVideoDetailsParams) => ({
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    }),
  },
  transformResponse: async (response: Response): Promise<YouTubeVideoDetailsResponse> => {
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error?.message || 'YouTube API error')
    }

    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found')
    }

    const video = data.items[0]
    const snippet = video.snippet || {}
    const statistics = video.statistics || {}
    const contentDetails = video.contentDetails || {}

    return {
      success: true,
      output: {
        id: video.id,
        title: snippet.title || '',
        description: snippet.description || '',
        channelId: snippet.channelId || '',
        channelTitle: snippet.channelTitle || '',
        publishedAt: snippet.publishedAt || '',
        thumbnails: {
          default: snippet.thumbnails?.default?.url,
          medium: snippet.thumbnails?.medium?.url,
          high: snippet.thumbnails?.high?.url,
          standard: snippet.thumbnails?.standard?.url,
          maxres: snippet.thumbnails?.maxres?.url,
        },
        duration: contentDetails.duration || '',
        viewCount: statistics.viewCount || '0',
        likeCount: statistics.likeCount || '0',
        commentCount: statistics.commentCount || '0',
        tags: snippet.tags || [],
        categoryId: snippet.categoryId || '',
        liveBroadcastContent: snippet.liveBroadcastContent || 'none',
        defaultLanguage: snippet.defaultLanguage,
        defaultAudioLanguage: snippet.defaultAudioLanguage,
      },
    }
  },
  transformError: (error: any): string => {
    const message = error.error?.message || error.message || 'Failed to get video details'
    const code = error.error?.code || error.code
    return code ? `${message} (${code})` : message
  },
}
