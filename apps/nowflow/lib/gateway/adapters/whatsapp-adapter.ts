import { createLogger } from '@/lib/logs/console-logger'
import { hasProcessedMessage, markMessageAsProcessed } from '@/lib/redis'
import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  InboundMessage,
  MessageMedia,
  OutboundMessage,
} from '../types'

const logger = createLogger('WhatsAppAdapter')

const WHATSAPP_API = 'https://graph.facebook.com/v21.0'

interface WhatsAppConnection {
  accessToken: string
  phoneNumberId: string
  verifyToken: string
  businessAccountId?: string
  status: ChannelStatus
}

export class WhatsAppAdapter implements ChannelAdapter {
  type = 'whatsapp' as const
  private connections = new Map<string, WhatsAppConnection>()

  async connect(config: ChannelConfig): Promise<void> {
    const { accessToken, phoneNumberId, verifyToken } = config.credentials
    if (!accessToken || !phoneNumberId) {
      throw new Error('WhatsApp access token and phone number ID are required')
    }

    try {
      // Verify credentials by fetching phone number info from the API
      const response = await fetch(`${WHATSAPP_API}/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await response.json()

      if (data.error) {
        throw new Error(`WhatsApp API error: ${data.error.message}`)
      }

      this.connections.set(config.id, {
        accessToken,
        phoneNumberId,
        verifyToken: verifyToken || '',
        businessAccountId: config.credentials.businessAccountId,
        status: 'connected',
      })

      logger.info('WhatsApp adapter connected', {
        channelId: config.id,
        phoneNumberId,
        displayPhoneNumber: data.display_phone_number,
      })
    } catch (error) {
      this.connections.set(config.id, {
        accessToken,
        phoneNumberId,
        verifyToken: verifyToken || '',
        status: 'error',
      })
      logger.error('Failed to connect WhatsApp adapter', { channelId: config.id, error })
      throw error
    }
  }

  async disconnect(channelId: string): Promise<void> {
    this.connections.delete(channelId)
    logger.info('WhatsApp adapter disconnected', { channelId })
  }

  async sendMessage(
    message: OutboundMessage
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const conn = this.connections.get(message.channelId)
    if (!conn) return { success: false, error: 'Channel not connected' }

    try {
      // Send media messages when media attachments are present
      if (message.media && message.media.length > 0) {
        return this.sendMediaMessage(conn, message)
      }

      // Send interactive button message when buttons are provided
      if (message.buttons && message.buttons.length > 0) {
        return this.sendInteractiveMessage(conn, message)
      }

      // Send plain text message
      if (message.text) {
        return this.sendTextMessage(conn, message)
      }

      return { success: false, error: 'No content to send' }
    } catch (error: any) {
      logger.error('Failed to send WhatsApp message', {
        channelId: message.channelId,
        error: error.message,
      })
      return { success: false, error: error.message }
    }
  }

  getStatus(channelId: string): ChannelStatus {
    return this.connections.get(channelId)?.status || 'disconnected'
  }

  async handleWebhook(body: any): Promise<InboundMessage | null> {
    try {
      const entry = body?.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value

      if (!value?.messages?.[0]) {
        // Status updates (sent, delivered, read) are not user messages
        if (value?.statuses) {
          logger.debug('WhatsApp status update received', { statuses: value.statuses })
        }
        return null
      }

      const msg = value.messages[0]
      const contact = value.contacts?.[0]

      // Deduplicate messages using Redis to prevent double-processing from
      // webhook retries or overlapping deliveries
      const deduplicationKey = `wa:${msg.id}`
      if (await hasProcessedMessage(deduplicationKey)) {
        logger.debug('Skipping duplicate WhatsApp message', { messageId: msg.id })
        return null
      }
      await markMessageAsProcessed(deduplicationKey)

      const media = this.parseMedia(msg)
      const text = this.parseText(msg)

      return {
        id: `wa_${msg.id}`,
        channelId: '', // Set by the gateway message router
        channelType: 'whatsapp',
        senderId: msg.from,
        senderName: contact?.profile?.name || msg.from,
        text,
        media: media.length > 0 ? media : undefined,
        metadata: {
          phoneNumberId: value.metadata?.phone_number_id,
          displayPhoneNumber: value.metadata?.display_phone_number,
          messageType: msg.type,
          timestamp: msg.timestamp,
          waMessageId: msg.id,
          context: msg.context, // Contains reply-to information
        },
        timestamp: new Date(parseInt(msg.timestamp) * 1000),
        replyTo: msg.context?.id,
      }
    } catch (error) {
      logger.error('Failed to parse WhatsApp webhook', { error })
      return null
    }
  }

  async validateCredentials(credentials: Record<string, string>): Promise<boolean> {
    if (!credentials.accessToken || !credentials.phoneNumberId) return false

    try {
      const response = await fetch(`${WHATSAPP_API}/${credentials.phoneNumberId}`, {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      })
      const data = await response.json()
      return !data.error
    } catch {
      return false
    }
  }

  /**
   * Resolve a WhatsApp media ID to a downloadable URL.
   * Media IDs received in webhooks must be exchanged for a URL before downloading.
   */
  async getMediaUrl(channelId: string, mediaId: string): Promise<string | null> {
    const conn = this.connections.get(channelId)
    if (!conn) return null

    try {
      const response = await fetch(`${WHATSAPP_API}/${mediaId}`, {
        headers: { Authorization: `Bearer ${conn.accessToken}` },
      })
      const data = await response.json()
      return data.url || null
    } catch {
      return null
    }
  }

  /**
   * Send a read receipt for a message, showing the sender blue check marks.
   */
  async markAsRead(channelId: string, messageId: string): Promise<void> {
    const conn = this.connections.get(channelId)
    if (!conn) return

    try {
      await this.apiCall(conn, 'messages', {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      })
    } catch (error) {
      logger.warn('Failed to mark WhatsApp message as read', { channelId, messageId, error })
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private parseMedia(msg: any): MessageMedia[] {
    const media: MessageMedia[] = []

    if (msg.type === 'image' && msg.image) {
      media.push({
        type: 'image',
        url: msg.image.id,
        mimeType: msg.image.mime_type,
        caption: msg.image.caption,
      })
    }

    if (msg.type === 'video' && msg.video) {
      media.push({
        type: 'video',
        url: msg.video.id,
        mimeType: msg.video.mime_type,
        caption: msg.video.caption,
      })
    }

    if (msg.type === 'audio' && msg.audio) {
      media.push({
        type: 'audio',
        url: msg.audio.id,
        mimeType: msg.audio.mime_type,
      })
    }

    if (msg.type === 'document' && msg.document) {
      media.push({
        type: 'document',
        url: msg.document.id,
        mimeType: msg.document.mime_type,
        fileName: msg.document.filename,
      })
    }

    if (msg.type === 'sticker' && msg.sticker) {
      media.push({
        type: 'sticker',
        url: msg.sticker.id,
        mimeType: msg.sticker.mime_type,
      })
    }

    return media
  }

  private parseText(msg: any): string {
    switch (msg.type) {
      case 'text':
        return msg.text?.body || ''

      case 'interactive':
        if (msg.interactive?.type === 'button_reply') {
          return msg.interactive.button_reply?.title || ''
        }
        if (msg.interactive?.type === 'list_reply') {
          return msg.interactive.list_reply?.title || ''
        }
        return ''

      case 'image':
      case 'video':
        return msg[msg.type]?.caption || ''

      case 'location':
        return `Location: ${msg.location?.latitude}, ${msg.location?.longitude}`

      case 'contacts':
        return `Contact shared: ${msg.contacts?.[0]?.name?.formatted_name || 'Unknown'}`

      default:
        return ''
    }
  }

  private async sendTextMessage(
    conn: WhatsAppConnection,
    message: OutboundMessage
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const payload = {
      messaging_product: 'whatsapp',
      to: message.recipientId,
      type: 'text',
      text: { body: message.text },
    }

    const result = await this.apiCall(conn, 'messages', payload)
    if (result.error) return { success: false, error: result.error.message }
    return { success: true, messageId: result.messages?.[0]?.id }
  }

  private async sendInteractiveMessage(
    conn: WhatsAppConnection,
    message: OutboundMessage
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // WhatsApp interactive buttons are limited to 3 buttons with 20-char titles
    const buttons = (message.buttons || []).slice(0, 3).map((btn, i) => ({
      type: 'reply' as const,
      reply: {
        id: btn.value || `btn_${i}`,
        title: btn.text.slice(0, 20),
      },
    }))

    const payload = {
      messaging_product: 'whatsapp',
      to: message.recipientId,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: message.text },
        action: { buttons },
      },
    }

    const result = await this.apiCall(conn, 'messages', payload)
    if (result.error) return { success: false, error: result.error.message }
    return { success: true, messageId: result.messages?.[0]?.id }
  }

  private async sendMediaMessage(
    conn: WhatsAppConnection,
    message: OutboundMessage
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const mediaTypeMap: Record<string, string> = {
      image: 'image',
      video: 'video',
      audio: 'audio',
      document: 'document',
      sticker: 'sticker',
    }

    for (const media of message.media!) {
      const waType = mediaTypeMap[media.type] || 'document'

      const mediaPayload: Record<string, any> = {
        link: media.url,
      }

      // Stickers and audio do not support captions in the WhatsApp API
      if (waType !== 'sticker' && waType !== 'audio') {
        mediaPayload.caption = media.caption || message.text
      }

      if (media.fileName) {
        mediaPayload.filename = media.fileName
      }

      const payload = {
        messaging_product: 'whatsapp',
        to: message.recipientId,
        type: waType,
        [waType]: mediaPayload,
      }

      const result = await this.apiCall(conn, 'messages', payload)
      if (result.error) return { success: false, error: result.error.message }
    }

    return { success: true }
  }

  private async apiCall(
    conn: Pick<WhatsAppConnection, 'accessToken' | 'phoneNumberId'>,
    endpoint: string,
    payload: any
  ): Promise<any> {
    const response = await fetch(`${WHATSAPP_API}/${conn.phoneNumberId}/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    return response.json()
  }
}
