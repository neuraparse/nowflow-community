import { ToolConfig } from '../types'
import { YouTubeTranscriptParams, YouTubeTranscriptResponse } from './types'

export const youtubeTranscriptTool: ToolConfig<YouTubeTranscriptParams, YouTubeTranscriptResponse> =
  {
    id: 'youtube_transcript',
    name: 'YouTube Transcript',
    description: 'Get transcript/captions from a YouTube video.',
    version: '1.0.0',
    params: {
      videoId: {
        type: 'string',
        required: true,
        description: 'YouTube video ID',
      },
      lang: {
        type: 'string',
        required: false,
        description: 'Language code for transcript (e.g., en, es, fr). Defaults to auto-detect.',
      },
    },
    request: {
      url: (params: YouTubeTranscriptParams) => {
        const baseUrl = '/api/tools/youtube/transcript'
        const searchParams = new URLSearchParams({
          videoId: params.videoId,
          ...(params.lang && { lang: params.lang }),
        })
        return `${baseUrl}?${searchParams.toString()}`
      },
      method: 'GET',
      headers: () => ({
        'Content-Type': 'application/json',
      }),
    },
    transformResponse: async (response: Response): Promise<YouTubeTranscriptResponse> => {
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get transcript')
      }

      return {
        success: true,
        output: {
          transcript: data.transcript || [],
          fullText: data.fullText || '',
          language: data.language || 'unknown',
        },
      }
    },
    transformError: (error: any): string => {
      return error.message || 'Failed to get video transcript'
    },
  }
