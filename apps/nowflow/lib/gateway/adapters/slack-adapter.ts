import { createLogger } from '@/lib/logs/console-logger'
import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  InboundMessage,
  OutboundMessage,
} from '../types'

const logger = createLogger('SlackAdapter')
const SLACK_API = 'https://slack.com/api'

export class SlackAdapter implements ChannelAdapter {
  type = 'slack' as const
  private connections = new Map<
    string,
    {
      botToken: string
      signingSecret: string
      appId: string
      status: ChannelStatus
      teamId?: string
      botUserId?: string
    }
  >()

  async connect(config: ChannelConfig): Promise<void> {
    const { botToken, signingSecret, appId } = config.credentials
    if (!botToken || !signingSecret)
      throw new Error('Slack bot token and signing secret are required')

    try {
      // Verify token via auth.test
      const authResult = await this.slackApi(botToken, 'auth.test')
      if (!authResult.ok) throw new Error(`Slack auth failed: ${authResult.error}`)

      this.connections.set(config.id, {
        botToken,
        signingSecret,
        appId: appId || '',
        status: 'connected',
        teamId: authResult.team_id,
        botUserId: authResult.user_id,
      })

      logger.info(`Slack adapter connected for team ${authResult.team}`, {
        channelId: config.id,
        teamId: authResult.team_id,
      })
    } catch (error) {
      this.connections.set(config.id, {
        botToken,
        signingSecret,
        appId: appId || '',
        status: 'error',
      })
      throw error
    }
  }

  async disconnect(channelId: string): Promise<void> {
    this.connections.delete(channelId)
    logger.info('Slack adapter disconnected', { channelId })
  }

  async sendMessage(
    message: OutboundMessage
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const conn = this.connections.get(message.channelId)
    if (!conn) return { success: false, error: 'Channel not connected' }

    try {
      const blocks: any[] = []

      // Text as section block
      if (message.text) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: message.text },
        })
      }

      // Buttons as actions block
      if (message.buttons && message.buttons.length > 0) {
        blocks.push({
          type: 'actions',
          elements: message.buttons.map((btn, i) => {
            if (btn.type === 'url') {
              return {
                type: 'button',
                text: { type: 'plain_text', text: btn.text },
                url: btn.value,
                action_id: `btn_${i}`,
              }
            }
            return {
              type: 'button',
              text: { type: 'plain_text', text: btn.text },
              value: btn.value,
              action_id: `btn_${i}`,
            }
          }),
        })
      }

      const params: Record<string, any> = {
        channel: message.recipientId,
        text: message.text || '',
      }
      if (blocks.length > 0) params.blocks = blocks

      const result = await this.slackApi(conn.botToken, 'chat.postMessage', params)
      if (!result.ok) return { success: false, error: result.error }
      return { success: true, messageId: result.ts }
    } catch (error: any) {
      logger.error('Failed to send Slack message', {
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
    // Skip bot messages and message_changed events
    if (body.event?.bot_id || body.event?.subtype) return null

    const event = body.event
    if (!event) return null

    // Handle app_mention and message events
    if (event.type === 'app_mention' || event.type === 'message') {
      const media: InboundMessage['media'] = []

      // Handle file attachments
      if (event.files && Array.isArray(event.files)) {
        for (const file of event.files) {
          const typeMap: Record<string, 'image' | 'video' | 'audio' | 'document'> = {
            image: 'image',
            video: 'video',
            audio: 'audio',
          }
          media.push({
            type: typeMap[file.filetype?.split('/')[0]] || 'document',
            url: file.url_private || file.permalink,
            fileName: file.name,
            mimeType: file.mimetype,
            size: file.size,
          })
        }
      }

      return {
        id: `slack_${event.ts}_${event.channel}`,
        channelId: '', // Set by gateway
        channelType: 'slack',
        senderId: event.user || '',
        senderName: undefined, // Resolved later if needed
        text: event.text || '',
        media: media.length > 0 ? media : undefined,
        metadata: {
          teamId: body.team_id,
          channelSlackId: event.channel,
          channelType: event.channel_type,
          threadTs: event.thread_ts,
          ts: event.ts,
          eventType: event.type,
        },
        timestamp: new Date(parseFloat(event.ts) * 1000),
        threadId: event.thread_ts,
      }
    }

    // Handle interactive payloads (button clicks)
    if (body.type === 'block_actions' && body.actions?.[0]) {
      const action = body.actions[0]
      return {
        id: `slack_action_${action.action_id}_${Date.now()}`,
        channelId: '',
        channelType: 'slack',
        senderId: body.user?.id || '',
        senderName: body.user?.name,
        text: action.value || action.selected_option?.value || '',
        metadata: {
          teamId: body.team?.id,
          channelSlackId: body.channel?.id,
          isInteraction: true,
          actionId: action.action_id,
          triggerId: body.trigger_id,
        },
        timestamp: new Date(),
      }
    }

    return null
  }

  async validateCredentials(credentials: Record<string, string>): Promise<boolean> {
    if (!credentials.botToken) return false
    try {
      const result = await this.slackApi(credentials.botToken, 'auth.test')
      return result.ok === true
    } catch {
      return false
    }
  }

  // Verify Slack request signature
  async verifySignature(body: string, signature: string, timestamp: string): Promise<boolean> {
    // Find the connection with signing secret
    for (const [, conn] of this.connections) {
      const basestring = `v0:${timestamp}:${body}`
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(conn.signingSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(basestring))
      const computed =
        'v0=' +
        Array.from(new Uint8Array(sig))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      if (computed === signature) return true
    }
    return false
  }

  // --- Private helpers ---
  private async slackApi(
    token: string,
    method: string,
    params?: Record<string, any>
  ): Promise<any> {
    const response = await fetch(`${SLACK_API}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: params ? JSON.stringify(params) : undefined,
    })
    return response.json()
  }
}
