/**
 * Deployment Types - Shared across frontend and backend
 *
 * This file defines the comprehensive deployment configuration for NowFlow workflows,
 * including API Layer and Application Layer.
 */

/**
 * Application Surface Types
 * Defines UI surface modes for community applications.
 */
export type AppSurface = 'chat' | 'portal' | 'console' | 'embedded' | 'form'

/**
 * Deployment Types
 * - api: Only deploy API endpoints
 * - chat: Only deploy Application Layer (formerly chat interface)
 * - both: Deploy both API and Application layers
 */
export type DeploymentType = 'api' | 'chat' | 'both'

/**
 * Deployment Status
 */
export type DeploymentStatus = 'active' | 'inactive' | 'pending' | 'failed'

/**
 * Application Layer Configuration
 * Defines how the user-facing application is built and rendered
 */
export interface AppLayerConfig {
  /** UI Surface type */
  surface?: AppSurface

  /** Custom domain for the application */
  customDomain?: string

  /** Subdomain for the application (e.g., myapp.example.com) */
  subdomain?: string

  /** Application title */
  title?: string

  /** Application description */
  description?: string

  /** Authentication type */
  authType?: 'public' | 'email' | 'password' | 'oauth'

  /** Require authentication to access */
  requireAuth?: boolean

  /** Simple password protection (for password authType) */
  accessPassword?: string

  /** Allowed email domains (for email authType) */
  allowedDomains?: string[]

  /** Theme settings */
  theme?: 'light' | 'dark' | 'auto'

  /** Custom CSS/styling */
  customCss?: string

  /** Brand colors and identity */
  branding?: {
    name?: string
    tagline?: string
    primaryColor?: string
    accentColor?: string
    logoUrl?: string
    faviconUrl?: string
  }

  /** Welcome message for chat surfaces */
  welcomeMessage?: string

  /** Embedding settings for embedded surfaces */
  embedding?: {
    allowedDomains?: string[]
    sandbox?: boolean
    closeButton?: boolean
  }

  /** Form configuration for form surfaces */
  formConfig?: {
    fields: Array<{
      name: string
      label: string
      type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'file'
      required?: boolean
      placeholder?: string
      options?: string[] // for select type
      helpText?: string
    }>
    submitButtonText?: string
    successMessage?: string
    errorMessage?: string
  }
}

/**
 * API Layer Configuration
 * Traditional API deployment settings
 */
export interface APILayerConfig {
  /** API Key ID to use */
  keyId: string

  /** API Key name/label */
  keyName: string

  /** Rate limit (requests per minute) */
  rateLimit: number

  /** Enable CORS */
  cors: boolean

  /** Allowed origins for CORS */
  allowedOrigins?: string[]

  /** Enable webhooks */
  webhooks?: {
    enabled: boolean
    endpoints?: string[]
  }

  /** Custom headers */
  customHeaders?: Record<string, string>
}

/**
 * Legacy Chat Configuration (for backward compatibility)
 * Will be migrated to AppLayerConfig
 */
export interface ChatConfig {
  title: string
  description: string
  subdomain: string
  authType: 'public' | 'email' | 'password'
  theme: 'light' | 'dark' | 'auto'
  customizations?: {
    primaryColor?: string
    secondaryColor?: string
    backgroundColor?: string
    textColor?: string
    logoUrl?: string
    faviconUrl?: string
    welcomeMessage?: string
    placeholderText?: string
    bubbleStyle?: 'rounded' | 'sharp' | 'minimal'
    fontSize?: 'small' | 'medium' | 'large'
    showTimestamps?: boolean
    showTypingIndicator?: boolean
    enableFileUpload?: boolean
    enableVoiceInput?: boolean
    enableFeedback?: boolean
    enableCopyMessage?: boolean
    enableDownloadChat?: boolean
    [key: string]: any
  }
  responseConfig?: {
    showTypingIndicator?: boolean
    enableStreaming?: boolean
  }
  analytics?: {
    enabled?: boolean
  }
  limits?: {
    maxMessagesPerSession?: number
    sessionTimeoutMinutes?: number
  }
  outputBlockId?: string
  outputPath?: string
}

/**
 * Complete Deployment Configuration
 * This is sent from frontend to backend during deployment
 */
export interface DeploymentConfig {
  /** Deployment type */
  type: DeploymentType

  /** Application Layer config (for chat/both deployments) */
  appConfig?: AppLayerConfig

  /** API Layer config (for api/both deployments) */
  apiConfig?: APILayerConfig

  /** Legacy chat config (backward compatibility) */
  chatConfig?: ChatConfig

  /** Skip post-deployment verification (use with caution) */
  skipVerification?: boolean
}

/**
 * Generated Endpoints After Deployment
 */
export interface DeploymentEndpoints {
  /** API endpoints (if deployed) */
  api?: {
    endpoint: string
    apiKey: string
    documentation: string
    health: string
  }

  /** Application endpoints (if deployed) */
  app?: {
    url: string
    embedUrl?: string
    embedCode?: string
    previewUrl?: string
    surface?: AppSurface
  }
}

/**
 * Deployment Record (Database Model)
 */
export interface DeploymentRecord {
  id: string
  workflowId: string
  userId: string
  type: DeploymentType
  status: DeploymentStatus
  config: DeploymentConfig
  endpoints: DeploymentEndpoints
  deployedAt: Date
  undeployedAt?: Date
  createdAt: Date
  updatedAt: Date
}

/**
 * Deployment Result (API Response)
 * Returned to frontend after successful deployment
 */
export interface DeploymentResult {
  success: boolean
  deploymentId: string
  deployment: {
    id: string
    type: DeploymentType
    status: DeploymentStatus
    config: DeploymentConfig
    endpoints: DeploymentEndpoints
    deployedAt: string
  }
  message?: string
  warnings?: string[]
}
