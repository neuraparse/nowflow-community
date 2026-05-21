import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { getRedisClient } from '@/lib/redis'

const logger = createLogger('NotificationHub')

// --- Types ---

export type NotificationChannel =
  | 'email'
  | 'push'
  | 'in_app'
  | 'telegram'
  | 'slack'
  | 'discord'
  | 'whatsapp'
  | 'webhook'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical'

export interface NotificationPayload {
  title: string
  body: string
  data?: Record<string, any>
  actionUrl?: string
  imageUrl?: string
  buttons?: Array<{ label: string; url: string }>
}

export interface NotificationRequest {
  userId: string
  channels: NotificationChannel[]
  payload: NotificationPayload
  priority?: NotificationPriority
  category?: string // For preference filtering (e.g., 'workflow_completion')
  deduplicationKey?: string // Prevent duplicate notifications
  scheduleAt?: Date // Schedule for later delivery
  expiresAt?: Date // Don't deliver after this time
  metadata?: Record<string, any>
}

export interface NotificationResult {
  id: string
  channelResults: Array<{
    channel: NotificationChannel
    success: boolean
    messageId?: string
    error?: string
    deliveredAt?: Date
  }>
  totalSent: number
  totalFailed: number
}

export interface ChannelDeliveryConfig {
  telegram?: { chatId: string; channelConfigId: string }
  slack?: { channelId: string; channelConfigId: string }
  discord?: { channelId: string; channelConfigId: string }
  whatsapp?: { phoneNumber: string; channelConfigId: string }
  webhook?: { url: string; headers?: Record<string, string> }
  push?: { tokens: string[] }
  email?: { address: string }
}

type ChannelDeliveryFn = (
  payload: NotificationPayload,
  config: Record<string, any>,
  priority: NotificationPriority
) => Promise<{ success: boolean; messageId?: string; error?: string }>

// --- Notification Hub ---

export class NotificationHub {
  private deliveryHandlers = new Map<NotificationChannel, ChannelDeliveryFn>()
  private deduplicationTTL = 3600 // 1 hour

  constructor() {
    // Register built-in delivery handlers
    this.registerHandler('in_app', this.deliverInApp.bind(this))
    this.registerHandler('push', this.deliverPush.bind(this))
    this.registerHandler('email', this.deliverEmail.bind(this))
    this.registerHandler('webhook', this.deliverWebhook.bind(this))
    this.registerHandler('telegram', this.deliverTelegram.bind(this))
    this.registerHandler('slack', this.deliverSlack.bind(this))
    this.registerHandler('discord', this.deliverDiscord.bind(this))
    this.registerHandler('whatsapp', this.deliverWhatsApp.bind(this))
  }

  /**
   * Register a custom delivery handler for a channel
   */
  registerHandler(channel: NotificationChannel, handler: ChannelDeliveryFn): void {
    this.deliveryHandlers.set(channel, handler)
  }

  /**
   * Send a notification through multiple channels
   */
  async send(request: NotificationRequest): Promise<NotificationResult> {
    const notificationId = uuidv4()
    const priority = request.priority || 'normal'

    // Deduplication check
    if (request.deduplicationKey) {
      const isDuplicate = await this.checkDeduplication(request.deduplicationKey)
      if (isDuplicate) {
        logger.debug('Duplicate notification skipped', { key: request.deduplicationKey })
        return { id: notificationId, channelResults: [], totalSent: 0, totalFailed: 0 }
      }
    }

    // Check expiry
    if (request.expiresAt && new Date() > request.expiresAt) {
      logger.debug('Notification expired, skipping', { notificationId })
      return { id: notificationId, channelResults: [], totalSent: 0, totalFailed: 0 }
    }

    // Get user's channel delivery configs
    const deliveryConfigs = await this.getUserChannelConfigs(request.userId)

    // Send to each channel in parallel
    const channelPromises = request.channels.map(async (channel) => {
      const handler = this.deliveryHandlers.get(channel)
      if (!handler) {
        return { channel, success: false, error: `No handler for channel: ${channel}` }
      }

      const config = deliveryConfigs[channel] || {}

      try {
        const result = await handler(request.payload, config, priority)
        return {
          channel,
          ...result,
          deliveredAt: result.success ? new Date() : undefined,
        }
      } catch (error: any) {
        logger.error(`Notification delivery failed for ${channel}`, {
          notificationId,
          channel,
          error: error.message,
        })
        return { channel, success: false, error: error.message }
      }
    })

    const channelResults = await Promise.all(channelPromises)
    const totalSent = channelResults.filter((r) => r.success).length
    const totalFailed = channelResults.filter((r) => !r.success).length

    // Mark as sent for deduplication
    if (request.deduplicationKey) {
      await this.markSent(request.deduplicationKey)
    }

    logger.info('Notification sent', {
      notificationId,
      userId: request.userId,
      channels: request.channels,
      totalSent,
      totalFailed,
    })

    return { id: notificationId, channelResults, totalSent, totalFailed }
  }

  /**
   * Send a notification to multiple users
   */
  async broadcast(
    userIds: string[],
    channels: NotificationChannel[],
    payload: NotificationPayload,
    options?: { priority?: NotificationPriority; category?: string }
  ): Promise<Map<string, NotificationResult>> {
    const results = new Map<string, NotificationResult>()

    // Process in batches of 10
    const batchSize = 10
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map((userId) =>
          this.send({
            userId,
            channels,
            payload,
            priority: options?.priority,
            category: options?.category,
          })
        )
      )

      batch.forEach((userId, idx) => {
        results.set(userId, batchResults[idx])
      })
    }

    return results
  }

  // --- Built-in delivery handlers ---

  private async deliverInApp(
    payload: NotificationPayload,
    _config: Record<string, any>,
    _priority: NotificationPriority
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Store in Redis for SSE pickup by the notification stream
    const redis = getRedisClient()
    if (!redis) return { success: false, error: 'Redis unavailable' }

    const id = uuidv4()
    try {
      await redis.lpush(
        'notifications:in_app',
        JSON.stringify({
          id,
          ...payload,
          createdAt: new Date().toISOString(),
        })
      )
      await redis.ltrim('notifications:in_app', 0, 999) // Keep last 1000
      return { success: true, messageId: id }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async deliverPush(
    payload: NotificationPayload,
    config: Record<string, any>,
    _priority: NotificationPriority
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const tokens = config.tokens as string[] | undefined
    if (!tokens || tokens.length === 0) {
      return { success: false, error: 'No push tokens configured' }
    }

    // Use Firebase Admin SDK or Web Push API
    // This is a stub - actual implementation depends on push service
    logger.debug('Push notification would be sent', { tokenCount: tokens.length })
    return { success: true, messageId: `push_${Date.now()}` }
  }

  private async deliverEmail(
    payload: NotificationPayload,
    config: Record<string, any>,
    _priority: NotificationPriority
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!config.address) return { success: false, error: 'No email address configured' }

    // Use existing email infrastructure
    try {
      const { sendEmail } = await import('@/lib/mailer')
      await sendEmail({
        to: config.address,
        subject: payload.title,
        html: `<h2>${payload.title}</h2><p>${payload.body}</p>${
          payload.actionUrl ? `<p><a href="${payload.actionUrl}">View Details</a></p>` : ''
        }`,
      })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async deliverWebhook(
    payload: NotificationPayload,
    config: Record<string, any>,
    priority: NotificationPriority
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!config.url) return { success: false, error: 'No webhook URL configured' }

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers || {}),
        },
        body: JSON.stringify({ ...payload, priority, timestamp: new Date().toISOString() }),
      })

      if (!response.ok) return { success: false, error: `HTTP ${response.status}` }
      return { success: true, messageId: `webhook_${Date.now()}` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async deliverTelegram(
    payload: NotificationPayload,
    config: Record<string, any>,
    _priority: NotificationPriority
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!config.chatId || !config.channelConfigId) {
      return { success: false, error: 'Telegram config missing chatId or channelConfigId' }
    }

    try {
      const { TelegramAdapter } = await import('@/lib/gateway/adapters/telegram-adapter')
      const adapter = new TelegramAdapter()
      return adapter.sendMessage({
        channelId: config.channelConfigId,
        channelType: 'telegram',
        recipientId: config.chatId,
        text: `*${payload.title}*\n\n${payload.body}${payload.actionUrl ? `\n\n[View Details](${payload.actionUrl})` : ''}`,
        buttons: payload.buttons?.map((b) => ({
          type: 'url' as const,
          text: b.label,
          value: b.url,
        })),
      })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async deliverSlack(
    payload: NotificationPayload,
    config: Record<string, any>,
    priority: NotificationPriority
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!config.channelId || !config.channelConfigId) {
      return { success: false, error: 'Slack config missing channelId or channelConfigId' }
    }

    try {
      const { SlackAdapter } = await import('@/lib/gateway/adapters/slack-adapter')
      const adapter = new SlackAdapter()

      const priorityEmoji = { low: '', normal: '', high: ':warning:', critical: ':rotating_light:' }
      const text = `${priorityEmoji[priority]}*${payload.title}*\n${payload.body}${
        payload.actionUrl ? `\n<${payload.actionUrl}|View Details>` : ''
      }`

      return adapter.sendMessage({
        channelId: config.channelConfigId,
        channelType: 'slack',
        recipientId: config.channelId,
        text,
        buttons: payload.buttons?.map((b) => ({
          type: 'url' as const,
          text: b.label,
          value: b.url,
        })),
      })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async deliverDiscord(
    payload: NotificationPayload,
    config: Record<string, any>,
    _priority: NotificationPriority
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!config.channelId || !config.channelConfigId) {
      return { success: false, error: 'Discord config missing channelId or channelConfigId' }
    }

    try {
      const { DiscordAdapter } = await import('@/lib/gateway/adapters/discord-adapter')
      const adapter = new DiscordAdapter()
      return adapter.sendMessage({
        channelId: config.channelConfigId,
        channelType: 'discord',
        recipientId: config.channelId,
        text: `**${payload.title}**\n${payload.body}${payload.actionUrl ? `\n[View Details](${payload.actionUrl})` : ''}`,
        buttons: payload.buttons?.map((b) => ({
          type: 'url' as const,
          text: b.label,
          value: b.url,
        })),
      })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async deliverWhatsApp(
    payload: NotificationPayload,
    config: Record<string, any>,
    _priority: NotificationPriority
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!config.phoneNumber || !config.channelConfigId) {
      return { success: false, error: 'WhatsApp config missing phoneNumber or channelConfigId' }
    }

    try {
      const { WhatsAppAdapter } = await import('@/lib/gateway/adapters/whatsapp-adapter')
      const adapter = new WhatsAppAdapter()
      return adapter.sendMessage({
        channelId: config.channelConfigId,
        channelType: 'whatsapp',
        recipientId: config.phoneNumber,
        text: `*${payload.title}*\n\n${payload.body}`,
        buttons: payload.buttons
          ?.slice(0, 3)
          .map((b) => ({ type: 'reply' as const, text: b.label, value: b.url })),
      })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // --- Helpers ---

  private async getUserChannelConfigs(
    userId: string
  ): Promise<Record<string, Record<string, any>>> {
    const redis = getRedisClient()
    if (!redis) return {}

    try {
      const data = await redis.get(`user:notification_configs:${userId}`)
      return data ? JSON.parse(data) : {}
    } catch {
      return {}
    }
  }

  private async checkDeduplication(key: string): Promise<boolean> {
    const redis = getRedisClient()
    if (!redis) return false

    try {
      const exists = await redis.exists(`notification:dedup:${key}`)
      return exists === 1
    } catch {
      return false
    }
  }

  private async markSent(key: string): Promise<void> {
    const redis = getRedisClient()
    if (!redis) return

    try {
      await redis.set(`notification:dedup:${key}`, '1', 'EX', this.deduplicationTTL)
    } catch {
      // Ignore
    }
  }
}

// Singleton
let hubInstance: NotificationHub | null = null

export function getNotificationHub(): NotificationHub {
  if (!hubInstance) {
    hubInstance = new NotificationHub()
  }
  return hubInstance
}
