import { createLogger } from '@/lib/logs/console-logger'
import { hasProcessedMessage, markMessageAsProcessed } from '@/lib/redis'
import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  InboundMessage,
  MessageButton,
  OutboundMessage,
} from '../types'

const logger = createLogger('DiscordAdapter')
const DISCORD_API = 'https://discord.com/api/v10'

// Discord interaction types
const INTERACTION_TYPE = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  MODAL_SUBMIT: 5,
} as const

const INTERACTION_RESPONSE_TYPE = {
  PONG: 1,
  CHANNEL_MESSAGE: 4,
  DEFERRED_CHANNEL_MESSAGE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
} as const

// Discord component types
const COMPONENT_TYPE = {
  ACTION_ROW: 1,
  BUTTON: 2,
  SELECT_MENU: 3,
} as const

// Discord button styles
const BUTTON_STYLE = {
  PRIMARY: 1,
  SECONDARY: 2,
  SUCCESS: 3,
  DANGER: 4,
  LINK: 5,
} as const

interface DiscordConnection {
  token: string
  applicationId: string
  publicKey: string
  status: ChannelStatus
  channelConfig: ChannelConfig
}

interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  image?: { url: string }
  thumbnail?: { url: string }
  footer?: { text: string }
  timestamp?: string
}

interface DiscordRateLimitState {
  remaining: number
  resetAt: number
  retryAfter: number
}

const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1000
const MESSAGE_DEDUP_TTL_SECONDS = 300

export class DiscordAdapter implements ChannelAdapter {
  type = 'discord' as const
  private connections = new Map<string, DiscordConnection>()
  private rateLimits = new Map<string, DiscordRateLimitState>()

  async connect(config: ChannelConfig): Promise<void> {
    const { id: channelId } = config
    const { botToken, applicationId, publicKey } = config.credentials

    if (!botToken || !applicationId || !publicKey) {
      throw new Error('Discord adapter requires botToken, applicationId, and publicKey credentials')
    }

    this.connections.set(channelId, {
      token: botToken,
      applicationId,
      publicKey,
      status: 'connecting',
      channelConfig: config,
    })

    try {
      // Verify bot token by calling GET /users/@me
      const response = await this.discordFetch(channelId, '/users/@me', { method: 'GET' })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`Bot token verification failed (${response.status}): ${errorBody}`)
      }

      const botUser = await response.json()
      logger.info(
        `Connected Discord bot: ${botUser.username}#${botUser.discriminator} (${botUser.id})`
      )

      const connection = this.connections.get(channelId)!
      connection.status = 'connected'
    } catch (error) {
      const connection = this.connections.get(channelId)
      if (connection) {
        connection.status = 'error'
      }
      logger.error(`Failed to connect Discord adapter for channel ${channelId}:`, error)
      throw error
    }
  }

  async disconnect(channelId: string): Promise<void> {
    const connection = this.connections.get(channelId)
    if (!connection) {
      logger.warn(`No active connection found for channel ${channelId}`)
      return
    }

    connection.status = 'disconnected'
    this.connections.delete(channelId)
    this.rateLimits.delete(channelId)
    logger.info(`Disconnected Discord adapter for channel ${channelId}`)
  }

  async sendMessage(
    message: OutboundMessage
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const connection = this.findConnectionForRecipient(message)
    if (!connection) {
      return { success: false, error: 'No active Discord connection found for this channel' }
    }

    try {
      const payload = this.buildMessagePayload(message)
      const response = await this.discordFetchWithRetry(
        message.channelId,
        `/channels/${message.recipientId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      )

      if (!response.ok) {
        const errorBody = await response.text()
        logger.error(`Failed to send Discord message: ${response.status} ${errorBody}`)
        return { success: false, error: `Discord API error (${response.status}): ${errorBody}` }
      }

      const result = await response.json()
      logger.debug(`Sent Discord message ${result.id} to channel ${message.recipientId}`)
      return { success: true, messageId: result.id }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`Error sending Discord message:`, error)
      return { success: false, error: errorMessage }
    }
  }

  async handleWebhook(request: any): Promise<InboundMessage | null> {
    const interaction = request.body ?? request

    // Handle PING (Discord sends this to validate the interactions endpoint)
    if (interaction.type === INTERACTION_TYPE.PING) {
      logger.debug('Received Discord PING interaction')
      return null
    }

    const interactionId = interaction.id
    if (!interactionId) {
      logger.warn('Received Discord interaction without an ID')
      return null
    }

    // Message deduplication
    const dedupKey = `discord:interaction:${interactionId}`
    if (await hasProcessedMessage(dedupKey)) {
      logger.debug(`Skipping duplicate Discord interaction ${interactionId}`)
      return null
    }
    await markMessageAsProcessed(dedupKey, MESSAGE_DEDUP_TTL_SECONDS)

    if (interaction.type === INTERACTION_TYPE.APPLICATION_COMMAND) {
      return this.parseApplicationCommand(interaction)
    }

    if (interaction.type === INTERACTION_TYPE.MESSAGE_COMPONENT) {
      return this.parseMessageComponent(interaction)
    }

    logger.warn(`Unhandled Discord interaction type: ${interaction.type}`)
    return null
  }

  async validateCredentials(credentials: Record<string, string>): Promise<boolean> {
    const { botToken, applicationId, publicKey } = credentials

    if (!botToken || !applicationId || !publicKey) {
      return false
    }

    // Validate publicKey format (should be a hex string of 64 chars = 32 bytes)
    if (!/^[0-9a-fA-F]{64}$/.test(publicKey)) {
      logger.warn('Invalid Discord public key format')
      return false
    }

    try {
      const response = await fetch(`${DISCORD_API}/users/@me`, {
        method: 'GET',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
      })
      return response.ok
    } catch (error) {
      logger.error('Failed to validate Discord credentials:', error)
      return false
    }
  }

  getStatus(channelId: string): ChannelStatus {
    const connection = this.connections.get(channelId)
    return connection?.status ?? 'disconnected'
  }

  // -------------------------------------------------------------------
  //  Signature verification (Ed25519 via Web Crypto API)
  // -------------------------------------------------------------------

  static async verifySignature(
    body: string,
    signature: string,
    timestamp: string,
    publicKey: string
  ): Promise<boolean> {
    try {
      const key = await crypto.subtle.importKey(
        'raw',
        hexToUint8Array(publicKey),
        { name: 'Ed25519' },
        false,
        ['verify']
      )
      const message = new TextEncoder().encode(timestamp + body)
      return await crypto.subtle.verify('Ed25519', key, hexToUint8Array(signature), message)
    } catch (error) {
      logger.error('Discord signature verification error:', error)
      return false
    }
  }

  // -------------------------------------------------------------------
  //  Internal helpers
  // -------------------------------------------------------------------

  private findConnectionForRecipient(message: OutboundMessage): DiscordConnection | undefined {
    // Direct lookup by channelId
    const direct = this.connections.get(message.channelId)
    if (direct) return direct

    // Search across connections for a matching channel
    for (const connection of Array.from(this.connections.values())) {
      if (connection.status === 'connected') {
        return connection
      }
    }
    return undefined
  }

  private buildMessagePayload(message: OutboundMessage): Record<string, any> {
    const payload: Record<string, any> = {}

    // Text content
    if (message.text) {
      payload.content = message.text
    }

    // Embeds from media metadata
    if (message.metadata?.embeds) {
      payload.embeds = message.metadata.embeds as DiscordEmbed[]
    }

    // Media attachments as embeds
    if (message.media?.length) {
      const mediaEmbeds: DiscordEmbed[] = message.media
        .filter((m) => m.type === 'image')
        .map((m) => ({
          image: { url: m.url },
          ...(m.caption ? { description: m.caption } : {}),
        }))

      if (mediaEmbeds.length > 0) {
        payload.embeds = [...(payload.embeds ?? []), ...mediaEmbeds]
      }
    }

    // Buttons as components
    if (message.buttons?.length) {
      payload.components = this.buildComponents(message.buttons)
    }

    return payload
  }

  private buildComponents(buttons: MessageButton[]): Array<Record<string, any>> {
    // Discord requires buttons to be inside action rows (max 5 buttons per row)
    const rows: Array<Record<string, any>> = []
    const chunkedButtons = chunkArray(buttons, 5)

    for (const chunk of chunkedButtons) {
      const row = {
        type: COMPONENT_TYPE.ACTION_ROW,
        components: chunk.map((btn) => {
          if (btn.type === 'url') {
            return {
              type: COMPONENT_TYPE.BUTTON,
              style: BUTTON_STYLE.LINK,
              label: btn.text,
              url: btn.value,
            }
          }
          // callback and reply buttons
          return {
            type: COMPONENT_TYPE.BUTTON,
            style: BUTTON_STYLE.PRIMARY,
            label: btn.text,
            custom_id: btn.value,
          }
        }),
      }
      rows.push(row)
    }

    return rows
  }

  private parseApplicationCommand(interaction: any): InboundMessage {
    const user = interaction.member?.user ?? interaction.user
    const commandName = interaction.data?.name ?? 'unknown'
    const options = interaction.data?.options ?? []

    // Build text from command name and options
    const optionParts = options.map((opt: any) => `${opt.name}=${opt.value}`)
    const text =
      optionParts.length > 0 ? `/${commandName} ${optionParts.join(' ')}` : `/${commandName}`

    return {
      id: interaction.id,
      channelId: interaction.channel_id ?? interaction.channel?.id ?? '',
      channelType: 'discord',
      senderId: user?.id ?? '',
      senderName: user
        ? `${user.username}${user.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : ''}`
        : undefined,
      text,
      metadata: {
        interactionId: interaction.id,
        interactionToken: interaction.token,
        commandName,
        commandOptions: options,
        guildId: interaction.guild_id,
        type: 'application_command',
      },
      timestamp: new Date(
        interaction.id ? Number(BigInt(interaction.id) >> 22n) + 1420070400000 : Date.now()
      ),
    }
  }

  private parseMessageComponent(interaction: any): InboundMessage {
    const user = interaction.member?.user ?? interaction.user
    const customId = interaction.data?.custom_id ?? ''
    const componentType = interaction.data?.component_type

    return {
      id: interaction.id,
      channelId: interaction.channel_id ?? interaction.channel?.id ?? '',
      channelType: 'discord',
      senderId: user?.id ?? '',
      senderName: user
        ? `${user.username}${user.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : ''}`
        : undefined,
      text: customId,
      metadata: {
        interactionId: interaction.id,
        interactionToken: interaction.token,
        customId,
        componentType,
        guildId: interaction.guild_id,
        type: 'message_component',
        // Include values for select menus
        ...(interaction.data?.values ? { values: interaction.data.values } : {}),
      },
      timestamp: new Date(
        interaction.id ? Number(BigInt(interaction.id) >> 22n) + 1420070400000 : Date.now()
      ),
    }
  }

  // -------------------------------------------------------------------
  //  HTTP helpers with rate limiting
  // -------------------------------------------------------------------

  private async discordFetch(
    channelId: string,
    path: string,
    init: RequestInit
  ): Promise<Response> {
    const connection = this.connections.get(channelId)
    const token = connection?.token
    if (!token) {
      throw new Error(`No bot token available for channel ${channelId}`)
    }

    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bot ${token}`)
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    headers.set('User-Agent', 'NowFlow-DiscordAdapter/1.0')

    const url = `${DISCORD_API}${path}`
    const response = await fetch(url, { ...init, headers })

    // Track rate limit headers
    this.updateRateLimitState(channelId, response)

    return response
  }

  private async discordFetchWithRetry(
    channelId: string,
    path: string,
    init: RequestInit
  ): Promise<Response> {
    let lastResponse: Response | undefined

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Check if we are currently rate limited
      const rateLimit = this.rateLimits.get(channelId)
      if (rateLimit && rateLimit.remaining === 0 && Date.now() < rateLimit.resetAt) {
        const waitMs = rateLimit.resetAt - Date.now()
        logger.warn(`Rate limited on channel ${channelId}, waiting ${waitMs}ms`)
        await sleep(waitMs)
      }

      lastResponse = await this.discordFetch(channelId, path, init)

      if (lastResponse.status === 429) {
        const retryAfterHeader = lastResponse.headers.get('retry-after')
        const retryBody = await lastResponse
          .clone()
          .json()
          .catch(() => null)
        const retryAfterMs =
          (retryAfterHeader ? parseFloat(retryAfterHeader) * 1000 : null) ??
          (retryBody?.retry_after ? retryBody.retry_after * 1000 : null) ??
          BASE_RETRY_DELAY_MS * Math.pow(2, attempt)

        logger.warn(
          `Discord rate limit hit (attempt ${attempt + 1}/${MAX_RETRIES}), retrying after ${retryAfterMs}ms`
        )
        await sleep(retryAfterMs)
        continue
      }

      return lastResponse
    }

    // All retries exhausted, return the last response
    return lastResponse!
  }

  private updateRateLimitState(channelId: string, response: Response): void {
    const remaining = response.headers.get('x-ratelimit-remaining')
    const resetAfter = response.headers.get('x-ratelimit-reset-after')

    if (remaining !== null) {
      this.rateLimits.set(channelId, {
        remaining: parseInt(remaining, 10),
        resetAt: resetAfter ? Date.now() + parseFloat(resetAfter) * 1000 : 0,
        retryAfter: resetAfter ? parseFloat(resetAfter) : 0,
      })
    }
  }
}

// -------------------------------------------------------------------
//  Utility functions
// -------------------------------------------------------------------

function hexToUint8Array(hex: string): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(hex.length / 2)
  const arr = new Uint8Array(buffer)
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return arr
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export { hexToUint8Array }
