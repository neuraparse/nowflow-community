import { ToolResponse } from '../types'

// Search Videos
export interface YouTubeSearchParams {
  accessToken: string
  query: string
  maxResults?: number
  pageToken?: string
}

export interface YouTubeSearchResponse extends ToolResponse {
  output: {
    items: Array<{
      videoId: string
      title: string
      description: string
      thumbnail: string
      channelTitle?: string
      publishedAt?: string
    }>
    totalResults: number
    nextPageToken?: string
  }
}

// Get Video Details
export interface YouTubeVideoDetailsParams {
  accessToken: string
  videoId: string
}

export interface YouTubeVideoDetailsResponse extends ToolResponse {
  output: {
    id: string
    title: string
    description: string
    channelId: string
    channelTitle: string
    publishedAt: string
    thumbnails: {
      default?: string
      medium?: string
      high?: string
      standard?: string
      maxres?: string
    }
    duration: string
    viewCount: string
    likeCount: string
    commentCount: string
    tags?: string[]
    categoryId: string
    liveBroadcastContent: string
    defaultLanguage?: string
    defaultAudioLanguage?: string
  }
}

// Get Video Transcript
export interface YouTubeTranscriptParams {
  videoId: string
  lang?: string
}

export interface YouTubeTranscriptResponse extends ToolResponse {
  output: {
    transcript: Array<{
      text: string
      start: number
      duration: number
    }>
    fullText: string
    language: string
  }
}

// Get Channel Info
export interface YouTubeChannelInfoParams {
  accessToken: string
  channelId?: string
  username?: string
}

export interface YouTubeChannelInfoResponse extends ToolResponse {
  output: {
    id: string
    title: string
    description: string
    customUrl?: string
    publishedAt: string
    thumbnails: {
      default?: string
      medium?: string
      high?: string
    }
    country?: string
    viewCount: string
    subscriberCount: string
    videoCount: string
    hiddenSubscriberCount: boolean
  }
}
