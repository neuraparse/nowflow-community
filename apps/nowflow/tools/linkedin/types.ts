// LinkedIn Share Response
export interface LinkedInShareResponse {
  id: string
  success: boolean
  message: string
}

// LinkedIn Profile Response
export interface LinkedInProfileResponse {
  sub: string
  name: string
  given_name?: string
  family_name?: string
  picture?: string
  locale?: string
  email?: string
  email_verified?: boolean
}

// LinkedIn Post
export interface LinkedInPost {
  id: string
  author: string
  commentary?: string
  visibility: string
  lifecycleState: string
  createdAt: string
  lastModifiedAt: string
}

// LinkedIn Posts Response
export interface LinkedInPostsResponse {
  elements: LinkedInPost[]
  paging?: {
    start: number
    count: number
    total?: number
  }
}

// LinkedIn Post Analytics Response
export interface LinkedInPostAnalytics {
  postUrn: string
  totalReactions: number
  totalComments: number
  totalShares: number
  totalImpressions: number
  totalReach: number
  totalEngagements: number
}
