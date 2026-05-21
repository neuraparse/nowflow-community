/**
 * Chat Deployment Type Definitions
 *
 * Comprehensive type definitions for chat deployment customization,
 * configuration, analytics, and tracking.
 */

// ============================================================================
// CUSTOMIZATION TYPES
// ============================================================================

export type ChatPosition = 'bottom-right' | 'bottom-left' | 'center' | 'full-screen'
export type BubbleStyle = 'rounded' | 'sharp' | 'minimal'
export type FontSize = 'small' | 'medium' | 'large'

export interface ChatCustomizations {
  // Colors & Branding
  primaryColor?: string
  secondaryColor?: string
  backgroundColor?: string
  textColor?: string
  logoUrl?: string
  faviconUrl?: string

  // Layout & Design
  chatPosition?: ChatPosition
  bubbleStyle?: BubbleStyle
  fontSize?: FontSize
  fontFamily?: string

  // Messages
  welcomeMessage?: string
  placeholderText?: string
  headerText?: string
  footerText?: string
  emptyStateMessage?: string
  errorMessage?: string

  // Features
  showTimestamps?: boolean
  showTypingIndicator?: boolean
  enableFileUpload?: boolean
  enableVoiceInput?: boolean
  showPoweredBy?: boolean
  enableFeedback?: boolean
  enableCopyMessage?: boolean
  enableDownloadChat?: boolean
}

// ============================================================================
// RESPONSE CONFIGURATION TYPES
// ============================================================================

export type ResponseFormat = 'text' | 'markdown' | 'html' | 'json'
export type ResponseTone = 'professional' | 'friendly' | 'casual' | 'technical'

export interface ResponseConfig {
  // Format & Behavior
  format?: ResponseFormat
  maxLength?: number
  temperature?: number
  streamResponse?: boolean
  showThinking?: boolean
  includeMetadata?: boolean

  // Tone & Style
  tone?: ResponseTone
  language?: string

  // Custom Prompts
  customPromptPrefix?: string
  customPromptSuffix?: string
  systemMessage?: string

  // Output Selection
  defaultOutput?: string
  fallbackMessage?: string
}

// ============================================================================
// OUTPUT CONFIGURATION TYPES
// ============================================================================

export interface OutputConfig {
  blockId: string
  path: string
  label?: string
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface AnalyticsConfig {
  enabled: boolean
  trackUsage?: boolean
  trackUserMessages?: boolean
  retentionDays?: number
  webhookUrl?: string
}

export interface ChatMetrics {
  totalMessages: number
  uniqueUsers: number
  avgResponseTime: number
  errorRate: number
}

export interface ChatAnalytics {
  id: string
  chatId: string
  date: Date
  hour?: number

  // Message metrics
  totalMessages: number
  userMessages: number
  botMessages: number

  // User metrics
  uniqueUsers: number
  newUsers: number
  returningUsers: number

  // Performance metrics
  avgResponseTime: number
  minResponseTime?: number
  maxResponseTime?: number

  // Error tracking
  totalErrors: number
  errorRate: number

  // Engagement metrics
  avgMessagesPerUser: number
  avgSessionDuration: number

  // User satisfaction
  positiveFeedback: number
  negativeFeedback: number
  feedbackRate: number

  // Metadata
  metadata?: Record<string, any>

  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// RATE LIMITING & QUOTAS TYPES
// ============================================================================

export interface RateLimitConfig {
  enabled?: boolean
  requestsPerMinute?: number
  requestsPerHour?: number
  requestsPerDay?: number
}

export interface QuotaConfig {
  enabled?: boolean
  monthlyMessageLimit?: number
  perUserDailyLimit?: number
}

export interface LimitsConfig {
  rateLimit?: RateLimitConfig
  quotas?: QuotaConfig
  ipWhitelist?: string[]
  ipBlacklist?: string[]
}

// ============================================================================
// SESSION & MESSAGE TYPES
// ============================================================================

export interface ChatSession {
  id: string
  chatId: string
  userId?: string
  sessionToken: string
  userEmail?: string
  userIp?: string
  userAgent?: string

  // Session metrics
  messageCount: number
  startedAt: Date
  lastActivityAt: Date
  endedAt?: Date
  duration?: number

  // Feedback
  feedbackRating?: number
  feedbackComment?: string

  // Metadata
  metadata?: Record<string, any>

  createdAt: Date
  updatedAt: Date
}

export interface ChatMessageLog {
  id: string
  sessionId: string

  // Message details
  type: 'user' | 'bot' | 'system'
  content: string
  role: 'user' | 'assistant' | 'system'

  // Response tracking
  responseTime?: number
  blockId?: string
  outputPath?: string

  // Error tracking
  hasError: boolean
  errorMessage?: string
  errorCode?: string

  // Metadata
  metadata?: Record<string, any>

  createdAt: Date
}

// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

export type AuthType = 'public' | 'password' | 'email'

export interface AuthConfig {
  authType: AuthType
  password?: string
  allowedEmails?: string[]
}

// ============================================================================
// MAIN CHAT DEPLOYMENT TYPE
// ============================================================================

export interface ChatDeployment {
  id: string
  workflowId: string
  userId: string
  subdomain: string
  title: string
  description?: string
  isActive: boolean

  // Configuration
  customizations: ChatCustomizations
  responseConfig: ResponseConfig
  outputConfigs: OutputConfig[]
  analytics: AnalyticsConfig
  limits: LimitsConfig

  // Authentication
  authType: AuthType
  password?: string
  allowedEmails?: string[]

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// CHAT CONFIG (Public-facing)
// ============================================================================

export interface ChatConfig {
  id: string
  title: string
  description?: string
  subdomain: string
  customizations: ChatCustomizations
  authType: AuthType
  outputConfigs: OutputConfig[]
  responseConfig?: ResponseConfig
}

// ============================================================================
// FORM TYPES (For UI)
// ============================================================================

export interface ChatDeploymentFormData {
  subdomain: string
  title: string
  description?: string

  // Customizations
  customizations: Partial<ChatCustomizations>

  // Response config
  responseConfig: Partial<ResponseConfig>

  // Output selection
  outputConfigs: OutputConfig[]

  // Authentication
  authType: AuthType
  password?: string
  allowedEmails?: string[]

  // Analytics
  analytics: Partial<AnalyticsConfig>

  // Limits
  limits: Partial<LimitsConfig>
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ChatDeploymentResponse {
  success: boolean
  chat?: ChatDeployment
  url?: string
  error?: string
}

export interface ChatAnalyticsResponse {
  success: boolean
  analytics?: ChatAnalytics[]
  summary?: {
    totalMessages: number
    totalUsers: number
    avgResponseTime: number
    errorRate: number
  }
  error?: string
}

export interface ChatSessionResponse {
  success: boolean
  session?: ChatSession
  messages?: ChatMessageLog[]
  error?: string
}
