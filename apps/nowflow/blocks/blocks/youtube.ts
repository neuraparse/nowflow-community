import { YouTubeIcon } from '@/components/icons'
import { YouTubeSearchResponse } from '@/tools/youtube/types'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

const youtubeCredential = createOAuthSubBlock({
  provider: 'google-youtube',
  serviceId: 'google-youtube',
  requiredScopes: ['https://www.googleapis.com/auth/youtube.readonly'],
  title: 'YouTube Account',
  placeholder: 'Select YouTube account',
})

export const YouTubeBlock = defineBlock<YouTubeSearchResponse>({
  type: 'youtube',
  name: 'YouTube',
  description: 'Search videos, get details, transcripts, and channel info',
  longDescription:
    'Comprehensive YouTube integration: search for videos, get detailed video information and statistics, extract transcripts/captions, and retrieve channel information using the YouTube Data API v3.',
  category: 'tools',
  bgColor: '#FF0000',
  icon: YouTubeIcon,
  subBlocks: [
    createOperationDropdown({
      operations: [
        { id: 'search', label: 'Search Videos' },
        { id: 'video_details', label: 'Get Video Details' },
        { id: 'transcript', label: 'Get Video Transcript' },
        { id: 'channel_info', label: 'Get Channel Info' },
      ],
    }),
    // YouTube Account (OAuth) - required for all operations except transcript
    {
      ...youtubeCredential,
      condition: { field: 'operation', value: 'search' },
    },
    {
      ...youtubeCredential,
      condition: { field: 'operation', value: 'video_details' },
    },
    {
      ...youtubeCredential,
      condition: { field: 'operation', value: 'channel_info' },
    },
    // Search operation fields
    {
      id: 'query',
      title: 'Search Query',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter search query (e.g., "AI tutorials")',
      condition: { field: 'operation', value: 'search' },
    },
    {
      id: 'maxResults',
      title: 'Max Results',
      type: 'slider',
      layout: 'half',
      min: 1,
      max: 50,
      condition: { field: 'operation', value: 'search' },
    },
    // Video Details operation fields
    {
      id: 'videoId',
      title: 'Video ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter YouTube video ID (e.g., dQw4w9WgXcQ)',
      condition: { field: 'operation', value: 'video_details' },
    },
    // Transcript operation fields
    {
      id: 'videoId',
      title: 'Video ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter YouTube video ID (e.g., dQw4w9WgXcQ)',
      condition: { field: 'operation', value: 'transcript' },
    },
    {
      id: 'lang',
      title: 'Language (Optional)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'e.g., en, es, fr (auto-detect if empty)',
      condition: { field: 'operation', value: 'transcript' },
    },
    // Channel Info operation fields
    {
      id: 'channelId',
      title: 'Channel ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter YouTube channel ID (e.g., UCuAXFkgsw1L7xaCfnd5JJOw)',
      condition: { field: 'operation', value: 'channel_info' },
    },
    {
      id: 'username',
      title: 'Or Username',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter channel username (alternative to channel ID)',
      condition: {
        field: 'operation',
        value: 'channel_info',
        and: { field: 'channelId', value: '' },
      },
    },
  ],
  tools: {
    access: [
      'youtube_search',
      'youtube_video_details',
      'youtube_transcript',
      'youtube_channel_info',
    ],
    config: {
      tool: (params) => {
        switch (params.operation) {
          case 'search':
            return 'youtube_search'
          case 'video_details':
            return 'youtube_video_details'
          case 'transcript':
            return 'youtube_transcript'
          case 'channel_info':
            return 'youtube_channel_info'
          default:
            return 'youtube_search'
        }
      },
      params: (params) => {
        const rest = { ...params }
        delete rest.operation
        return rest
      },
    },
  },
  inputs: {
    operation: { type: 'string', required: true },
    credential: { type: 'string', required: false },
    query: { type: 'string', required: false },
    maxResults: { type: 'number', required: false },
    videoId: { type: 'string', required: false },
    lang: { type: 'string', required: false },
    channelId: { type: 'string', required: false },
    username: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: 'json',
    },
  },
})
