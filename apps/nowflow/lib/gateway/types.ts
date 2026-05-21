// Channel types
export type ChannelType =
  | 'telegram'
  | 'whatsapp'
  | 'slack'
  | 'discord'
  | 'webchat'
  | 'voice'
  | 'email'
  | 'webhook'

export type ChannelStatus = 'connected' | 'disconnected' | 'error' | 'connecting'

export interface ChannelConfig {
  id: string
  type: ChannelType
  name: string
  status: ChannelStatus
  userId: string
  workspaceId?: string
  credentials: Record<string, string>
  settings: ChannelSettings
  createdAt: Date
  updatedAt: Date
}

export interface ChannelSettings {
  autoReply?: boolean
  triggerWorkflowId?: string
  allowedUsers?: string[]
  welcomeMessage?: string
  maxConcurrentSessions?: number
  rateLimitPerMinute?: number
  language?: string
}

export interface InboundMessage {
  id: string
  channelId: string
  channelType: ChannelType
  senderId: string
  senderName?: string
  text: string
  media?: MessageMedia[]
  metadata: Record<string, any>
  timestamp: Date
  replyTo?: string
  threadId?: string
}

export interface OutboundMessage {
  channelId: string
  channelType: ChannelType
  recipientId: string
  text: string
  media?: MessageMedia[]
  buttons?: MessageButton[]
  metadata?: Record<string, any>
}

export interface MessageMedia {
  type: 'image' | 'video' | 'audio' | 'document' | 'sticker'
  url: string
  mimeType?: string
  fileName?: string
  size?: number
  caption?: string
}

export interface MessageButton {
  type: 'url' | 'callback' | 'reply'
  text: string
  value: string
}

export interface GatewaySession {
  id: string
  channelId: string
  channelType: ChannelType
  userId: string
  senderId: string
  workflowId?: string
  executionId?: string
  context: Record<string, any>
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>
  createdAt: Date
  lastActivityAt: Date
  expiresAt: Date
}

export interface ChannelAdapter {
  type: ChannelType
  connect(config: ChannelConfig): Promise<void>
  disconnect(channelId: string): Promise<void>
  sendMessage(
    message: OutboundMessage
  ): Promise<{ success: boolean; messageId?: string; error?: string }>
  getStatus(channelId: string): ChannelStatus
  handleWebhook?(request: any): Promise<InboundMessage | null>
  validateCredentials(credentials: Record<string, string>): Promise<boolean>
}

export interface GatewayEvent {
  type:
    | 'message_received'
    | 'message_sent'
    | 'channel_connected'
    | 'channel_disconnected'
    | 'channel_error'
    | 'session_created'
    | 'session_expired'
    | 'workflow_triggered'
  channelId: string
  channelType: ChannelType
  data: Record<string, any>
  timestamp: Date
}
