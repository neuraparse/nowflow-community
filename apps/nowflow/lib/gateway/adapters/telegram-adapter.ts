import { createLogger } from '@/lib/logs/console-logger'
import { getRedisClient, hasProcessedMessage, markMessageAsProcessed } from '@/lib/redis'
import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  InboundMessage,
  OutboundMessage,
} from '../types'

const logger = createLogger('TelegramAdapter')

// Telegram Bot API base URL
const TELEGRAM_API = 'https://api.telegram.org/bot'

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
  edited_message?: TelegramMessage
}

interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
  photo?: TelegramPhotoSize[]
  document?: TelegramDocument
  audio?: TelegramAudio
  video?: TelegramVideo
  voice?: { file_id: string; duration: number; mime_type?: string; file_size?: number }
  caption?: string
  reply_to_message?: TelegramMessage
}

interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

interface TelegramChat {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  title?: string
  username?: string
  first_name?: string
  last_name?: string
}

interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  data?: string
}

interface TelegramPhotoSize {
  file_id: string
  file_unique_id: string
  width: number
  height: number
  file_size?: number
}

interface TelegramDocument {
  file_id: string
  file_unique_id: string
  file_name?: string
  mime_type?: string
  file_size?: number
}

interface TelegramAudio {
  file_id: string
  file_unique_id: string
  duration: number
  performer?: string
  title?: string
  mime_type?: string
  file_size?: number
}

interface TelegramVideo {
  file_id: string
  file_unique_id: string
  width: number
  height: number
  duration: number
  mime_type?: string
  file_size?: number
}

export class TelegramAdapter implements ChannelAdapter {
  type = 'telegram' as const
  private connections = new Map<
    string,
    { token: string; status: ChannelStatus; webhookUrl?: string }
  >()

  async connect(config: ChannelConfig): Promise<void> {
    const token = config.credentials.botToken
    if (!token) throw new Error('Telegram bot token is required')

    try {
      // Verify token by calling getMe
      const me = await this.apiCall(token, 'getMe')
      if (!me.ok) throw new Error(`Invalid bot token: ${me.description}`)

      // Set webhook if webhookUrl is provided
      if (config.credentials.webhookUrl) {
        const webhookResult = await this.apiCall(token, 'setWebhook', {
          url: config.credentials.webhookUrl,
          allowed_updates: ['message', 'callback_query', 'edited_message'],
          secret_token: config.credentials.webhookSecret || undefined,
        })
        if (!webhookResult.ok)
          throw new Error(`Failed to set webhook: ${webhookResult.description}`)
        logger.info(`Telegram webhook set for bot @${me.result.username}`, { channelId: config.id })
      }

      this.connections.set(config.id, {
        token,
        status: 'connected',
        webhookUrl: config.credentials.webhookUrl,
      })

      logger.info(`Telegram adapter connected for bot @${me.result.username}`, {
        channelId: config.id,
      })
    } catch (error) {
      this.connections.set(config.id, { token, status: 'error' })
      logger.error('Failed to connect Telegram adapter', { channelId: config.id, error })
      throw error
    }
  }

  async disconnect(channelId: string): Promise<void> {
    const conn = this.connections.get(channelId)
    if (!conn) return

    try {
      // Remove webhook
      if (conn.webhookUrl) {
        await this.apiCall(conn.token, 'deleteWebhook')
      }
      this.connections.delete(channelId)
      logger.info('Telegram adapter disconnected', { channelId })
    } catch (error) {
      logger.error('Error disconnecting Telegram adapter', { channelId, error })
      this.connections.delete(channelId)
    }
  }

  async sendMessage(
    message: OutboundMessage
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const conn = this.connections.get(message.channelId)
    if (!conn) return { success: false, error: 'Channel not connected' }

    try {
      // Send text message
      if (message.text) {
        const params: Record<string, any> = {
          chat_id: message.recipientId,
          text: message.text,
          parse_mode: 'Markdown',
        }

        // Add reply markup for buttons
        if (message.buttons && message.buttons.length > 0) {
          const keyboard = message.buttons.map((btn) => {
            if (btn.type === 'url') return [{ text: btn.text, url: btn.value }]
            if (btn.type === 'callback') return [{ text: btn.text, callback_data: btn.value }]
            return [{ text: btn.text }]
          })
          params.reply_markup = JSON.stringify({ inline_keyboard: keyboard })
        }

        const result = await this.apiCall(conn.token, 'sendMessage', params)
        if (!result.ok) return { success: false, error: result.description }
        return { success: true, messageId: String(result.result.message_id) }
      }

      // Send media
      if (message.media && message.media.length > 0) {
        for (const media of message.media) {
          const methodMap: Record<string, string> = {
            image: 'sendPhoto',
            video: 'sendVideo',
            audio: 'sendAudio',
            document: 'sendDocument',
          }
          const method = methodMap[media.type] || 'sendDocument'
          const fieldMap: Record<string, string> = {
            image: 'photo',
            video: 'video',
            audio: 'audio',
            document: 'document',
          }
          const field = fieldMap[media.type] || 'document'

          const result = await this.apiCall(conn.token, method, {
            chat_id: message.recipientId,
            [field]: media.url,
            caption: media.caption || message.text || undefined,
            parse_mode: 'Markdown',
          })
          if (!result.ok) return { success: false, error: result.description }
        }
        return { success: true }
      }

      return { success: false, error: 'No content to send' }
    } catch (error: any) {
      logger.error('Failed to send Telegram message', {
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
    const update = body as TelegramUpdate

    // Handle regular messages
    if (update.message) {
      return this.parseMessage(update.message)
    }

    // Handle callback queries (button presses)
    if (update.callback_query) {
      const cbq = update.callback_query
      // Answer the callback query to remove loading indicator
      // (done externally after processing)
      if (cbq.message) {
        const msg = this.parseMessage(cbq.message)
        if (msg) {
          msg.text = cbq.data || ''
          msg.metadata.isCallbackQuery = true
          msg.metadata.callbackQueryId = cbq.id
        }
        return msg
      }
    }

    return null
  }

  async validateCredentials(credentials: Record<string, string>): Promise<boolean> {
    if (!credentials.botToken) return false
    try {
      const result = await this.apiCall(credentials.botToken, 'getMe')
      return result.ok === true
    } catch {
      return false
    }
  }

  // --- Private helpers ---

  private parseMessage(msg: TelegramMessage): InboundMessage | null {
    if (!msg.from) return null

    const media: InboundMessage['media'] = []

    // Photos - take largest
    if (msg.photo && msg.photo.length > 0) {
      const largest = msg.photo[msg.photo.length - 1]
      media.push({
        type: 'image',
        url: largest.file_id, // Will need to be resolved via getFile
        size: largest.file_size,
      })
    }

    // Document
    if (msg.document) {
      media.push({
        type: 'document',
        url: msg.document.file_id,
        fileName: msg.document.file_name,
        mimeType: msg.document.mime_type,
        size: msg.document.file_size,
      })
    }

    // Audio
    if (msg.audio) {
      media.push({
        type: 'audio',
        url: msg.audio.file_id,
        mimeType: msg.audio.mime_type,
        size: msg.audio.file_size,
      })
    }

    // Video
    if (msg.video) {
      media.push({
        type: 'video',
        url: msg.video.file_id,
        mimeType: msg.video.mime_type,
        size: msg.video.file_size,
      })
    }

    // Voice
    if (msg.voice) {
      media.push({
        type: 'audio',
        url: msg.voice.file_id,
        mimeType: msg.voice.mime_type,
        size: msg.voice.file_size,
      })
    }

    return {
      id: `tg_${msg.message_id}_${msg.chat.id}`,
      channelId: '', // Will be set by gateway
      channelType: 'telegram',
      senderId: String(msg.from.id),
      senderName: [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' '),
      text: msg.text || msg.caption || '',
      media: media.length > 0 ? media : undefined,
      metadata: {
        chatId: msg.chat.id,
        chatType: msg.chat.type,
        chatTitle: msg.chat.title,
        messageId: msg.message_id,
        languageCode: msg.from.language_code,
        username: msg.from.username,
        isBot: msg.from.is_bot,
      },
      timestamp: new Date(msg.date * 1000),
      replyTo: msg.reply_to_message
        ? `tg_${msg.reply_to_message.message_id}_${msg.chat.id}`
        : undefined,
    }
  }

  private async apiCall(token: string, method: string, params?: Record<string, any>): Promise<any> {
    const url = `${TELEGRAM_API}${token}/${method}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : undefined,
    })
    return response.json()
  }

  /**
   * Resolve a Telegram file_id to a download URL
   */
  async getFileUrl(channelId: string, fileId: string): Promise<string | null> {
    const conn = this.connections.get(channelId)
    if (!conn) return null

    try {
      const result = await this.apiCall(conn.token, 'getFile', { file_id: fileId })
      if (!result.ok) return null
      return `https://api.telegram.org/file/bot${conn.token}/${result.result.file_path}`
    } catch {
      return null
    }
  }
}
