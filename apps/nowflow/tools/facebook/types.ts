export interface FacebookPostParams {
  accessToken: string
  pageId: string
  message?: string
  link?: string
  imageUrl?: string
  published?: boolean
  scheduledPublishTime?: number
}

export interface FacebookPageInfoParams {
  accessToken: string
  pageId: string
  fields?: string
}

export interface FacebookPagePostsParams {
  accessToken: string
  pageId: string
  limit?: number
  fields?: string
}

export interface FacebookToolResponse {
  success: boolean
  data?: any
  error?: string
}

export interface FacebookPageInfo {
  id: string
  name: string
  category: string
  about?: string
  website?: string
  phone?: string
  emails?: string[]
  fan_count?: number
  instagram_business_account?: {
    id: string
    username: string
  }
}

export interface FacebookPost {
  id: string
  message?: string
  story?: string
  created_time: string
  updated_time?: string
  permalink_url?: string
  full_picture?: string
  likes?: {
    summary: {
      total_count: number
    }
  }
  comments?: {
    summary: {
      total_count: number
    }
  }
  shares?: {
    count: number
  }
}
