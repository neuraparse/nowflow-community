import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChannelConfig, OutboundMessage } from '../../types'
import { DiscordAdapter } from '../discord-adapter'
import { SlackAdapter } from '../slack-adapter'
import { TelegramAdapter } from '../telegram-adapter'
import { WhatsAppAdapter } from '../whatsapp-adapter'

// Mock logger
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Mock Redis
vi.mock('@/lib/redis', () => ({
  getRedisClient: vi.fn(),
  hasProcessedMessage: vi.fn(() => false),
  markMessageAsProcessed: vi.fn(),
}))

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTelegramConfig(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    id: 'tg-channel-1',
    type: 'telegram',
    name: 'Test Telegram',
    status: 'disconnected',
    userId: 'user-1',
    credentials: {
      botToken: 'fake-bot-token',
      webhookUrl: 'https://example.com/webhook/telegram',
      webhookSecret: 'secret123',
    },
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeSlackConfig(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    id: 'slack-channel-1',
    type: 'slack',
    name: 'Test Slack',
    status: 'disconnected',
    userId: 'user-1',
    credentials: {
      botToken: 'slack-bot-token',
      signingSecret: 'slack-signing-secret',
      appId: 'A1234',
    },
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeWhatsAppConfig(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    id: 'wa-channel-1',
    type: 'whatsapp',
    name: 'Test WhatsApp',
    status: 'disconnected',
    userId: 'user-1',
    credentials: {
      accessToken: 'wa-fake-token',
      phoneNumberId: '123456789',
      verifyToken: 'verify-me',
    },
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeDiscordConfig(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    id: 'discord-channel-1',
    type: 'discord',
    name: 'Test Discord',
    status: 'disconnected',
    userId: 'user-1',
    credentials: {
      botToken: 'discord-fake-token',
      applicationId: 'app-123',
      publicKey: 'a'.repeat(64),
    },
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function jsonResponse(data: any, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({
      'x-ratelimit-remaining': '10',
      'x-ratelimit-reset-after': '1',
    }),
    clone: () => jsonResponse(data, status),
  } as unknown as Response
}

// ============================================================================
// TelegramAdapter
// ============================================================================

describe('TelegramAdapter', () => {
  let adapter: TelegramAdapter

  beforeEach(() => {
    adapter = new TelegramAdapter()
    mockFetch.mockReset()
  })

  describe('connect()', () => {
    it('calls getMe API and sets webhook', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ ok: true, result: { id: 111, username: 'testbot' } }))
        .mockResolvedValueOnce(jsonResponse({ ok: true, result: true }))

      await adapter.connect(makeTelegramConfig())

      expect(mockFetch).toHaveBeenCalledTimes(2)
      // First call: getMe
      expect(mockFetch.mock.calls[0][0]).toBe('https://api.telegram.org/botfake-bot-token/getMe')
      // Second call: setWebhook
      expect(mockFetch.mock.calls[1][0]).toBe(
        'https://api.telegram.org/botfake-bot-token/setWebhook'
      )
      const webhookBody = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(webhookBody.url).toBe('https://example.com/webhook/telegram')
      expect(webhookBody.secret_token).toBe('secret123')

      expect(adapter.getStatus('tg-channel-1')).toBe('connected')
    })

    it('throws on invalid token', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: false, description: 'Unauthorized' }))

      await expect(adapter.connect(makeTelegramConfig())).rejects.toThrow('Invalid bot token')
      expect(adapter.getStatus('tg-channel-1')).toBe('error')
    })
  })

  describe('sendMessage()', () => {
    beforeEach(async () => {
      // Connect first
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ ok: true, result: { id: 111, username: 'testbot' } }))
        .mockResolvedValueOnce(jsonResponse({ ok: true, result: true }))
      await adapter.connect(makeTelegramConfig())
      mockFetch.mockReset()
    })

    it('sends text with Markdown parse mode', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, result: { message_id: 42 } }))

      const msg: OutboundMessage = {
        channelId: 'tg-channel-1',
        channelType: 'telegram',
        recipientId: '99999',
        text: 'Hello *bold*',
      }

      const result = await adapter.sendMessage(msg)

      expect(result).toEqual({ success: true, messageId: '42' })
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(sentBody.chat_id).toBe('99999')
      expect(sentBody.text).toBe('Hello *bold*')
      expect(sentBody.parse_mode).toBe('Markdown')
    })

    it('sends media correctly', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, result: { message_id: 43 } }))

      const msg: OutboundMessage = {
        channelId: 'tg-channel-1',
        channelType: 'telegram',
        recipientId: '99999',
        text: '',
        media: [{ type: 'image', url: 'https://example.com/photo.jpg', caption: 'A photo' }],
      }

      const result = await adapter.sendMessage(msg)

      expect(result).toEqual({ success: true })
      expect(mockFetch.mock.calls[0][0]).toContain('sendPhoto')
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(sentBody.photo).toBe('https://example.com/photo.jpg')
      expect(sentBody.caption).toBe('A photo')
    })

    it('attaches inline keyboard for buttons', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, result: { message_id: 44 } }))

      const msg: OutboundMessage = {
        channelId: 'tg-channel-1',
        channelType: 'telegram',
        recipientId: '99999',
        text: 'Pick one',
        buttons: [
          { type: 'callback', text: 'Option A', value: 'a' },
          { type: 'url', text: 'Visit', value: 'https://example.com' },
        ],
      }

      const result = await adapter.sendMessage(msg)

      expect(result.success).toBe(true)
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      const replyMarkup = JSON.parse(sentBody.reply_markup)
      expect(replyMarkup.inline_keyboard).toHaveLength(2)
      expect(replyMarkup.inline_keyboard[0][0]).toEqual({
        text: 'Option A',
        callback_data: 'a',
      })
      expect(replyMarkup.inline_keyboard[1][0]).toEqual({
        text: 'Visit',
        url: 'https://example.com',
      })
    })

    it('returns error when channel is not connected', async () => {
      const msg: OutboundMessage = {
        channelId: 'nonexistent',
        channelType: 'telegram',
        recipientId: '99999',
        text: 'hello',
      }
      const result = await adapter.sendMessage(msg)
      expect(result).toEqual({ success: false, error: 'Channel not connected' })
    })
  })

  describe('handleWebhook()', () => {
    it('parses text messages', async () => {
      const body = {
        update_id: 1,
        message: {
          message_id: 100,
          from: {
            id: 555,
            is_bot: false,
            first_name: 'John',
            last_name: 'Doe',
            username: 'johndoe',
            language_code: 'en',
          },
          chat: { id: 777, type: 'private' as const },
          date: 1700000000,
          text: 'Hello bot',
        },
      }

      const result = await adapter.handleWebhook(body)

      expect(result).not.toBeNull()
      expect(result!.id).toBe('tg_100_777')
      expect(result!.senderId).toBe('555')
      expect(result!.senderName).toBe('John Doe')
      expect(result!.text).toBe('Hello bot')
      expect(result!.channelType).toBe('telegram')
      expect(result!.metadata.chatId).toBe(777)
      expect(result!.metadata.chatType).toBe('private')
      expect(result!.metadata.username).toBe('johndoe')
      expect(result!.timestamp).toEqual(new Date(1700000000 * 1000))
    })

    it('parses callback queries', async () => {
      const body = {
        update_id: 2,
        callback_query: {
          id: 'cbq-1',
          from: { id: 555, is_bot: false, first_name: 'John' },
          message: {
            message_id: 101,
            from: { id: 111, is_bot: true, first_name: 'Bot' },
            chat: { id: 777, type: 'private' as const },
            date: 1700000000,
            text: 'Pick one',
          },
          data: 'option_a',
        },
      }

      const result = await adapter.handleWebhook(body)

      expect(result).not.toBeNull()
      expect(result!.text).toBe('option_a')
      expect(result!.metadata.isCallbackQuery).toBe(true)
      expect(result!.metadata.callbackQueryId).toBe('cbq-1')
    })

    it('parses photo messages', async () => {
      const body = {
        update_id: 3,
        message: {
          message_id: 102,
          from: { id: 555, is_bot: false, first_name: 'John' },
          chat: { id: 777, type: 'private' as const },
          date: 1700000000,
          photo: [
            { file_id: 'small', file_unique_id: 's1', width: 90, height: 90, file_size: 1000 },
            { file_id: 'large', file_unique_id: 's2', width: 800, height: 600, file_size: 50000 },
          ],
          caption: 'My photo',
        },
      }

      const result = await adapter.handleWebhook(body)

      expect(result).not.toBeNull()
      expect(result!.text).toBe('My photo')
      expect(result!.media).toHaveLength(1)
      expect(result!.media![0].type).toBe('image')
      // Should take the largest photo
      expect(result!.media![0].url).toBe('large')
      expect(result!.media![0].size).toBe(50000)
    })

    it('returns null for empty updates', async () => {
      const result = await adapter.handleWebhook({ update_id: 4 })
      expect(result).toBeNull()
    })
  })

  describe('validateCredentials()', () => {
    it('returns true for valid token', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ ok: true, result: { id: 111, username: 'testbot' } })
      )

      const valid = await adapter.validateCredentials({ botToken: 'good-token' })

      expect(valid).toBe(true)
      expect(mockFetch.mock.calls[0][0]).toContain('good-token/getMe')
    })

    it('returns false when API rejects token', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: false, description: 'Unauthorized' }))

      const valid = await adapter.validateCredentials({ botToken: 'bad-token' })
      expect(valid).toBe(false)
    })

    it('returns false when botToken is missing', async () => {
      const valid = await adapter.validateCredentials({})
      expect(valid).toBe(false)
    })
  })

  describe('disconnect()', () => {
    it('calls deleteWebhook', async () => {
      // Connect first
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ ok: true, result: { id: 111, username: 'testbot' } }))
        .mockResolvedValueOnce(jsonResponse({ ok: true, result: true }))
      await adapter.connect(makeTelegramConfig())
      mockFetch.mockReset()

      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, result: true }))

      await adapter.disconnect('tg-channel-1')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch.mock.calls[0][0]).toContain('deleteWebhook')
      expect(adapter.getStatus('tg-channel-1')).toBe('disconnected')
    })
  })

  describe('getStatus()', () => {
    it('returns disconnected for unknown channel', () => {
      expect(adapter.getStatus('unknown')).toBe('disconnected')
    })

    it('returns connected after successful connect', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ ok: true, result: { id: 111, username: 'testbot' } }))
        .mockResolvedValueOnce(jsonResponse({ ok: true, result: true }))
      await adapter.connect(makeTelegramConfig())

      expect(adapter.getStatus('tg-channel-1')).toBe('connected')
    })
  })
})

// ============================================================================
// SlackAdapter
// ============================================================================

describe('SlackAdapter', () => {
  let adapter: SlackAdapter

  beforeEach(() => {
    adapter = new SlackAdapter()
    mockFetch.mockReset()
  })

  describe('connect()', () => {
    it('calls auth.test', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ ok: true, team: 'TestTeam', team_id: 'T123', user_id: 'U456' })
      )

      await adapter.connect(makeSlackConfig())

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch.mock.calls[0][0]).toBe('https://slack.com/api/auth.test')
      const headers = mockFetch.mock.calls[0][1].headers
      expect(headers.Authorization).toBe('Bearer slack-bot-token')
      expect(adapter.getStatus('slack-channel-1')).toBe('connected')
    })

    it('throws when auth.test fails', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: false, error: 'invalid_auth' }))

      await expect(adapter.connect(makeSlackConfig())).rejects.toThrow('Slack auth failed')
      expect(adapter.getStatus('slack-channel-1')).toBe('error')
    })

    it('throws when credentials are missing', async () => {
      await expect(
        adapter.connect(makeSlackConfig({ credentials: { botToken: '', signingSecret: '' } }))
      ).rejects.toThrow('Slack bot token and signing secret are required')
    })
  })

  describe('sendMessage()', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ ok: true, team: 'TestTeam', team_id: 'T123', user_id: 'U456' })
      )
      await adapter.connect(makeSlackConfig())
      mockFetch.mockReset()
    })

    it('sends with Block Kit format', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, ts: '1234567890.123456' }))

      const msg: OutboundMessage = {
        channelId: 'slack-channel-1',
        channelType: 'slack',
        recipientId: 'C999',
        text: 'Hello Slack!',
        buttons: [
          { type: 'callback', text: 'Click me', value: 'action_1' },
          { type: 'url', text: 'Open link', value: 'https://example.com' },
        ],
      }

      const result = await adapter.sendMessage(msg)

      expect(result).toEqual({ success: true, messageId: '1234567890.123456' })
      expect(mockFetch.mock.calls[0][0]).toBe('https://slack.com/api/chat.postMessage')

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(sentBody.channel).toBe('C999')
      expect(sentBody.text).toBe('Hello Slack!')

      // Blocks: section + actions
      expect(sentBody.blocks).toHaveLength(2)
      expect(sentBody.blocks[0].type).toBe('section')
      expect(sentBody.blocks[0].text.type).toBe('mrkdwn')
      expect(sentBody.blocks[0].text.text).toBe('Hello Slack!')

      expect(sentBody.blocks[1].type).toBe('actions')
      expect(sentBody.blocks[1].elements).toHaveLength(2)
      expect(sentBody.blocks[1].elements[0].type).toBe('button')
      expect(sentBody.blocks[1].elements[0].value).toBe('action_1')
      expect(sentBody.blocks[1].elements[1].url).toBe('https://example.com')
    })

    it('returns error when channel is not connected', async () => {
      const result = await adapter.sendMessage({
        channelId: 'nonexistent',
        channelType: 'slack',
        recipientId: 'C999',
        text: 'hello',
      })
      expect(result).toEqual({ success: false, error: 'Channel not connected' })
    })
  })

  describe('handleWebhook()', () => {
    it('parses app_mention events', async () => {
      const body = {
        team_id: 'T123',
        event: {
          type: 'app_mention',
          user: 'U555',
          text: '<@U456> help me',
          channel: 'C888',
          channel_type: 'channel',
          ts: '1700000000.000100',
        },
      }

      const result = await adapter.handleWebhook(body)

      expect(result).not.toBeNull()
      expect(result!.id).toBe('slack_1700000000.000100_C888')
      expect(result!.channelType).toBe('slack')
      expect(result!.senderId).toBe('U555')
      expect(result!.text).toBe('<@U456> help me')
      expect(result!.metadata.teamId).toBe('T123')
      expect(result!.metadata.eventType).toBe('app_mention')
    })

    it('parses block_actions (button clicks) when event field is present', async () => {
      // Note: block_actions payloads from Slack typically lack an `event` field.
      // The current adapter code requires navigating past the `if (!event) return null`
      // guard, so we include a stub event with a type that doesn't match
      // app_mention/message so it falls through to the block_actions branch.
      const body = {
        type: 'block_actions',
        event: { type: 'block_actions' },
        user: { id: 'U555', name: 'john' },
        team: { id: 'T123' },
        channel: { id: 'C888' },
        trigger_id: 'trigger-1',
        actions: [
          {
            action_id: 'btn_0',
            value: 'clicked_value',
          },
        ],
      }

      const result = await adapter.handleWebhook(body)

      expect(result).not.toBeNull()
      expect(result!.senderId).toBe('U555')
      expect(result!.senderName).toBe('john')
      expect(result!.text).toBe('clicked_value')
      expect(result!.metadata.isInteraction).toBe(true)
      expect(result!.metadata.actionId).toBe('btn_0')
      expect(result!.metadata.triggerId).toBe('trigger-1')
    })

    it('returns null for block_actions without event field (known limitation)', async () => {
      // Pure block_actions payloads from Slack do not include an `event` property.
      // The current handler returns null because `body.event` is undefined.
      const body = {
        type: 'block_actions',
        user: { id: 'U555', name: 'john' },
        team: { id: 'T123' },
        channel: { id: 'C888' },
        trigger_id: 'trigger-1',
        actions: [{ action_id: 'btn_0', value: 'clicked_value' }],
      }

      const result = await adapter.handleWebhook(body)
      expect(result).toBeNull()
    })

    it('skips bot messages', async () => {
      const body = {
        event: {
          type: 'message',
          bot_id: 'B123',
          text: 'I am a bot',
          channel: 'C888',
          ts: '1700000000.000200',
        },
      }

      const result = await adapter.handleWebhook(body)
      expect(result).toBeNull()
    })

    it('skips messages with subtypes (e.g. message_changed)', async () => {
      const body = {
        event: {
          type: 'message',
          subtype: 'message_changed',
          channel: 'C888',
          ts: '1700000000.000300',
        },
      }

      const result = await adapter.handleWebhook(body)
      expect(result).toBeNull()
    })

    it('returns null when no event is present', async () => {
      const result = await adapter.handleWebhook({})
      expect(result).toBeNull()
    })
  })

  describe('verifySignature()', () => {
    it('validates HMAC correctly', async () => {
      // Connect to populate the signing secret
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ ok: true, team: 'T', team_id: 'T1', user_id: 'U1' })
      )
      await adapter.connect(makeSlackConfig())
      mockFetch.mockReset()

      const timestamp = '1700000000'
      const body = '{"test": true}'
      const basestring = `v0:${timestamp}:${body}`

      // Compute expected HMAC manually using Web Crypto
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode('slack-signing-secret'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(basestring))
      const expectedSig =
        'v0=' +
        Array.from(new Uint8Array(sig))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')

      const valid = await adapter.verifySignature(body, expectedSig, timestamp)
      expect(valid).toBe(true)
    })

    it('rejects invalid signature', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ ok: true, team: 'T', team_id: 'T1', user_id: 'U1' })
      )
      await adapter.connect(makeSlackConfig())
      mockFetch.mockReset()

      const valid = await adapter.verifySignature('body', 'v0=badsignature', '1700000000')
      expect(valid).toBe(false)
    })
  })
})

// ============================================================================
// WhatsAppAdapter
// ============================================================================

describe('WhatsAppAdapter', () => {
  let adapter: WhatsAppAdapter

  beforeEach(() => {
    adapter = new WhatsAppAdapter()
    mockFetch.mockReset()
  })

  describe('connect()', () => {
    it('verifies phone number', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ id: '123456789', display_phone_number: '+1 555 0100' })
      )

      await adapter.connect(makeWhatsAppConfig())

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch.mock.calls[0][0]).toBe('https://graph.facebook.com/v21.0/123456789')
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer wa-fake-token')
      expect(adapter.getStatus('wa-channel-1')).toBe('connected')
    })

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ error: { message: 'Invalid token' } }))

      await expect(adapter.connect(makeWhatsAppConfig())).rejects.toThrow(
        'WhatsApp API error: Invalid token'
      )
      expect(adapter.getStatus('wa-channel-1')).toBe('error')
    })

    it('throws when credentials are missing', async () => {
      await expect(
        adapter.connect(makeWhatsAppConfig({ credentials: { accessToken: '', phoneNumberId: '' } }))
      ).rejects.toThrow('WhatsApp access token and phone number ID are required')
    })
  })

  describe('sendMessage()', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ id: '123456789', display_phone_number: '+1 555 0100' })
      )
      await adapter.connect(makeWhatsAppConfig())
      mockFetch.mockReset()
    })

    it('sends text message', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ messages: [{ id: 'wamid.abc123' }] }))

      const msg: OutboundMessage = {
        channelId: 'wa-channel-1',
        channelType: 'whatsapp',
        recipientId: '+15550200',
        text: 'Hello from WhatsApp!',
      }

      const result = await adapter.sendMessage(msg)

      expect(result).toEqual({ success: true, messageId: 'wamid.abc123' })
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(sentBody.messaging_product).toBe('whatsapp')
      expect(sentBody.to).toBe('+15550200')
      expect(sentBody.type).toBe('text')
      expect(sentBody.text.body).toBe('Hello from WhatsApp!')
    })

    it('sends interactive buttons', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ messages: [{ id: 'wamid.btn123' }] }))

      const msg: OutboundMessage = {
        channelId: 'wa-channel-1',
        channelType: 'whatsapp',
        recipientId: '+15550200',
        text: 'Choose an option:',
        buttons: [
          { type: 'reply', text: 'Yes', value: 'yes' },
          { type: 'reply', text: 'No', value: 'no' },
        ],
      }

      const result = await adapter.sendMessage(msg)

      expect(result).toEqual({ success: true, messageId: 'wamid.btn123' })
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(sentBody.type).toBe('interactive')
      expect(sentBody.interactive.type).toBe('button')
      expect(sentBody.interactive.body.text).toBe('Choose an option:')
      expect(sentBody.interactive.action.buttons).toHaveLength(2)
      expect(sentBody.interactive.action.buttons[0].reply.id).toBe('yes')
      expect(sentBody.interactive.action.buttons[0].reply.title).toBe('Yes')
    })

    it('sends media message', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ messages: [{ id: 'wamid.img123' }] }))

      const msg: OutboundMessage = {
        channelId: 'wa-channel-1',
        channelType: 'whatsapp',
        recipientId: '+15550200',
        text: '',
        media: [
          {
            type: 'image',
            url: 'https://example.com/image.jpg',
            caption: 'Look at this',
          },
        ],
      }

      const result = await adapter.sendMessage(msg)

      expect(result).toEqual({ success: true })
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(sentBody.type).toBe('image')
      expect(sentBody.image.link).toBe('https://example.com/image.jpg')
      expect(sentBody.image.caption).toBe('Look at this')
    })
  })

  describe('handleWebhook()', () => {
    it('parses text messages', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: {
                    phone_number_id: '123456789',
                    display_phone_number: '+1 555 0100',
                  },
                  contacts: [{ profile: { name: 'Jane Doe' } }],
                  messages: [
                    {
                      id: 'wamid.incoming1',
                      from: '+15550200',
                      timestamp: '1700000000',
                      type: 'text',
                      text: { body: 'Hi there!' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const result = await adapter.handleWebhook(body)

      expect(result).not.toBeNull()
      expect(result!.id).toBe('wa_wamid.incoming1')
      expect(result!.channelType).toBe('whatsapp')
      expect(result!.senderId).toBe('+15550200')
      expect(result!.senderName).toBe('Jane Doe')
      expect(result!.text).toBe('Hi there!')
      expect(result!.metadata.phoneNumberId).toBe('123456789')
      expect(result!.timestamp).toEqual(new Date(1700000000 * 1000))
    })

    it('parses interactive replies (button_reply)', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: '123456789' },
                  contacts: [{ profile: { name: 'Jane' } }],
                  messages: [
                    {
                      id: 'wamid.interactive1',
                      from: '+15550200',
                      timestamp: '1700000000',
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: { id: 'yes', title: 'Yes' },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const result = await adapter.handleWebhook(body)

      expect(result).not.toBeNull()
      expect(result!.text).toBe('Yes')
      expect(result!.metadata.messageType).toBe('interactive')
    })

    it('handles status updates gracefully', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: 'wamid.status1',
                      status: 'delivered',
                      recipient_id: '+15550200',
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const result = await adapter.handleWebhook(body)
      expect(result).toBeNull()
    })

    it('returns null for empty body', async () => {
      const result = await adapter.handleWebhook({})
      expect(result).toBeNull()
    })
  })

  describe('markAsRead()', () => {
    it('sends read receipt', async () => {
      // Connect first
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ id: '123456789', display_phone_number: '+1 555 0100' })
      )
      await adapter.connect(makeWhatsAppConfig())
      mockFetch.mockReset()

      mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }))

      await adapter.markAsRead('wa-channel-1', 'wamid.abc123')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch.mock.calls[0][0]).toBe('https://graph.facebook.com/v21.0/123456789/messages')
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(sentBody.messaging_product).toBe('whatsapp')
      expect(sentBody.status).toBe('read')
      expect(sentBody.message_id).toBe('wamid.abc123')
    })

    it('does nothing when channel is not connected', async () => {
      await adapter.markAsRead('nonexistent', 'wamid.abc123')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})

// ============================================================================
// DiscordAdapter
// ============================================================================

describe('DiscordAdapter', () => {
  let adapter: DiscordAdapter

  beforeEach(() => {
    adapter = new DiscordAdapter()
    mockFetch.mockReset()
  })

  describe('connect()', () => {
    it('verifies bot token via /users/@me', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ id: 'bot-123', username: 'TestBot', discriminator: '1234' })
      )

      await adapter.connect(makeDiscordConfig())

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch.mock.calls[0][0]).toBe('https://discord.com/api/v10/users/@me')
      // Check authorization header
      const headers = new Headers(mockFetch.mock.calls[0][1].headers)
      expect(headers.get('Authorization')).toBe('Bot discord-fake-token')
      expect(adapter.getStatus('discord-channel-1')).toBe('connected')
    })

    it('throws when bot token verification fails', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))

      await expect(adapter.connect(makeDiscordConfig())).rejects.toThrow(
        'Bot token verification failed'
      )
      expect(adapter.getStatus('discord-channel-1')).toBe('error')
    })

    it('throws when credentials are missing', async () => {
      await expect(
        adapter.connect(
          makeDiscordConfig({
            credentials: { botToken: '', applicationId: '', publicKey: '' },
          })
        )
      ).rejects.toThrow('Discord adapter requires botToken, applicationId, and publicKey')
    })
  })

  describe('sendMessage()', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ id: 'bot-123', username: 'TestBot', discriminator: '1234' })
      )
      await adapter.connect(makeDiscordConfig())
      mockFetch.mockReset()
    })

    it('sends text message', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: 'msg-1' }))

      const msg: OutboundMessage = {
        channelId: 'discord-channel-1',
        channelType: 'discord',
        recipientId: 'discord-ch-999',
        text: 'Hello Discord!',
      }

      const result = await adapter.sendMessage(msg)

      expect(result).toEqual({ success: true, messageId: 'msg-1' })
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://discord.com/api/v10/channels/discord-ch-999/messages'
      )
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(sentBody.content).toBe('Hello Discord!')
    })

    it('sends with embeds and components', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: 'msg-2' }))

      const msg: OutboundMessage = {
        channelId: 'discord-channel-1',
        channelType: 'discord',
        recipientId: 'discord-ch-999',
        text: 'Check this out',
        media: [{ type: 'image', url: 'https://example.com/image.png', caption: 'A picture' }],
        buttons: [
          { type: 'callback', text: 'Accept', value: 'accept_action' },
          { type: 'url', text: 'Website', value: 'https://example.com' },
        ],
      }

      const result = await adapter.sendMessage(msg)

      expect(result).toEqual({ success: true, messageId: 'msg-2' })
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(sentBody.content).toBe('Check this out')

      // Embeds from media
      expect(sentBody.embeds).toHaveLength(1)
      expect(sentBody.embeds[0].image.url).toBe('https://example.com/image.png')
      expect(sentBody.embeds[0].description).toBe('A picture')

      // Components (buttons in action rows)
      expect(sentBody.components).toHaveLength(1)
      expect(sentBody.components[0].type).toBe(1) // ACTION_ROW
      expect(sentBody.components[0].components).toHaveLength(2)
      // Callback button
      expect(sentBody.components[0].components[0].type).toBe(2) // BUTTON
      expect(sentBody.components[0].components[0].style).toBe(1) // PRIMARY
      expect(sentBody.components[0].components[0].label).toBe('Accept')
      expect(sentBody.components[0].components[0].custom_id).toBe('accept_action')
      // URL button
      expect(sentBody.components[0].components[1].type).toBe(2) // BUTTON
      expect(sentBody.components[0].components[1].style).toBe(5) // LINK
      expect(sentBody.components[0].components[1].url).toBe('https://example.com')
    })

    it('returns error when no connection found', async () => {
      // Create fresh adapter with no connections
      const freshAdapter = new DiscordAdapter()
      const result = await freshAdapter.sendMessage({
        channelId: 'nonexistent',
        channelType: 'discord',
        recipientId: 'ch-1',
        text: 'hello',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('No active Discord connection')
    })
  })

  describe('handleWebhook()', () => {
    it('returns null for PING interactions', async () => {
      const result = await adapter.handleWebhook({ type: 1 }) // PING
      expect(result).toBeNull()
    })

    it('parses slash commands (APPLICATION_COMMAND)', async () => {
      const interaction = {
        id: '900000000000000000',
        type: 2, // APPLICATION_COMMAND
        token: 'interaction-token',
        channel_id: 'ch-100',
        guild_id: 'guild-1',
        member: {
          user: { id: 'user-1', username: 'testuser', discriminator: '0' },
        },
        data: {
          name: 'ask',
          options: [{ name: 'question', value: 'How are you?' }],
        },
      }

      const result = await adapter.handleWebhook(interaction)

      expect(result).not.toBeNull()
      expect(result!.id).toBe('900000000000000000')
      expect(result!.channelType).toBe('discord')
      expect(result!.senderId).toBe('user-1')
      expect(result!.senderName).toBe('testuser')
      expect(result!.text).toBe('/ask question=How are you?')
      expect(result!.metadata.commandName).toBe('ask')
      expect(result!.metadata.type).toBe('application_command')
      expect(result!.metadata.interactionToken).toBe('interaction-token')
      expect(result!.metadata.guildId).toBe('guild-1')
    })

    it('parses message component interactions (button clicks)', async () => {
      const interaction = {
        id: '900000000000000001',
        type: 3, // MESSAGE_COMPONENT
        token: 'component-token',
        channel_id: 'ch-100',
        guild_id: 'guild-1',
        member: {
          user: { id: 'user-2', username: 'clicker', discriminator: '5678' },
        },
        data: {
          custom_id: 'accept_action',
          component_type: 2, // BUTTON
        },
      }

      const result = await adapter.handleWebhook(interaction)

      expect(result).not.toBeNull()
      expect(result!.text).toBe('accept_action')
      expect(result!.metadata.customId).toBe('accept_action')
      expect(result!.metadata.componentType).toBe(2)
      expect(result!.metadata.type).toBe('message_component')
      expect(result!.senderName).toBe('clicker#5678')
    })

    it('returns null for interactions without an ID', async () => {
      const result = await adapter.handleWebhook({ type: 2 })
      expect(result).toBeNull()
    })
  })

  describe('verifySignature()', () => {
    it('validates Ed25519 correctly (returns false for invalid signature)', async () => {
      // We test that an obviously bad signature is rejected.
      // Full Ed25519 signing requires a private key, so we only test the negative case here
      // to confirm the verification pipeline runs without crashing.
      const result = await DiscordAdapter.verifySignature(
        '{"type":1}',
        'ab'.repeat(32), // 64 hex chars = 32 bytes, but wrong signature
        '1700000000',
        'a'.repeat(64) // public key
      )

      // It should either be false or throw depending on runtime Ed25519 support.
      // In test environments without Ed25519, it should return false due to the catch.
      expect(result).toBe(false)
    })
  })

  describe('getStatus()', () => {
    it('returns disconnected for unknown channel', () => {
      expect(adapter.getStatus('unknown')).toBe('disconnected')
    })

    it('returns connected after successful connect', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ id: 'bot-123', username: 'TestBot', discriminator: '1234' })
      )
      await adapter.connect(makeDiscordConfig())
      expect(adapter.getStatus('discord-channel-1')).toBe('connected')
    })
  })

  describe('disconnect()', () => {
    it('removes connection and resets status', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ id: 'bot-123', username: 'TestBot', discriminator: '1234' })
      )
      await adapter.connect(makeDiscordConfig())

      await adapter.disconnect('discord-channel-1')

      expect(adapter.getStatus('discord-channel-1')).toBe('disconnected')
    })
  })
})
