// Shared types for NowFlow applications

export interface User {
  id: string
  email: string
  name?: string
  image?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface Workspace {
  id: string
  name: string
  userId: string
  description?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface Workflow {
  id: string
  name: string
  description?: string
  workspaceId: string
  userId: string
  isPublic?: boolean
  status?: 'draft' | 'published' | 'archived'
  createdAt?: Date
  updatedAt?: Date
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  tokens: AuthTokens
}

// API endpoint types
export type ApiEndpoint =
  | '/api/auth/login'
  | '/api/auth/register'
  | '/api/auth/logout'
  | '/api/workspaces'

export {}
