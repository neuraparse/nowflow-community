import { ToolConfig } from '../types'

interface DiscordMessagesParams {
  botToken: string
  channelId: string
  operation: 'send' | 'list'
  content?: string
  tts?: boolean
  limit?: number
  before?: string
  after?: string
}

export const discordMessagesTool: ToolConfig<DiscordMessagesParams> = {
  id: 'discord_messages',
  name: 'Discord Messages',
  description: 'Send or list Discord channel messages using a Bot Token.',
  version: '1.0.0',

  params: {
    botToken: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Discord Bot token',
    },
    channelId: { type: 'string', required: true, description: 'Discord channel ID' },
    operation: { type: 'string', required: true, description: 'send or list' },
    content: { type: 'string', description: 'Message content (for send)' },
    tts: { type: 'boolean', description: 'Text-to-speech (for send)' },
    limit: { type: 'number', description: 'Max messages to list' },
    before: { type: 'string', description: 'List messages before this ID' },
    after: { type: 'string', description: 'List messages after this ID' },
  },

  request: {
    url: (p) => {
      const base = `https://discord.com/api/v10/channels/${encodeURIComponent(p.channelId)}/messages`
      return base
    },
    method: (p) => (p.operation === 'send' ? 'POST' : 'GET'),
    headers: (p) => ({
      'Content-Type': 'application/json',
      Authorization: `Bot ${p.botToken}`,
    }),
    query: (p) => {
      if (p.operation === 'list') {
        const q: Record<string, string> = {}
        if (p.limit) q.limit = String(p.limit)
        if (p.before) q.before = p.before
        if (p.after) q.after = p.after
        return q
      }
      return {}
    },
    body: (p) =>
      (p.operation === 'send'
        ? { content: p.content ?? '', tts: p.tts ?? false }
        : undefined) as any,
  },

  transformResponse: async (response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : await response.text()
    if (!response.ok) {
      const message =
        (data as any)?.message || (typeof data === 'string' ? data : 'Discord request failed')
      return { success: false, output: data as any, error: message }
    }
    return { success: true, output: data as any }
  },

  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'Discord request failed',
}
