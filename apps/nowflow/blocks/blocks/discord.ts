import { DiscordIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const DiscordBlock = defineBlock({
  type: 'discord',
  name: 'Discord',
  description: 'Send or list messages in a Discord channel with a Bot token.',
  longDescription:
    'Use Discord Bot token to send messages to a channel or list recent messages. Provide channel ID and choose send/list.',
  category: 'tools',
  bgColor: '#5865F2',
  icon: DiscordIcon,
  subBlocks: [
    { id: 'botToken', title: 'Bot Token', type: 'short-input', layout: 'full', password: true },
    { id: 'channelId', title: 'Channel ID', type: 'short-input', layout: 'full' },
    createOperationDropdown({
      operations: [
        { id: 'send', label: 'Send Message' },
        { id: 'list', label: 'List Messages' },
      ],
    }),
    { id: 'content', title: 'Content', type: 'short-input', layout: 'full' },
    { id: 'tts', title: 'TTS', type: 'short-input', layout: 'half' },
    { id: 'limit', title: 'Limit', type: 'short-input', layout: 'half' },
    { id: 'before', title: 'Before (ID)', type: 'short-input', layout: 'half' },
    { id: 'after', title: 'After (ID)', type: 'short-input', layout: 'half' },
  ],
  tools: {
    access: ['discord_messages'],
    config: {
      tool: () => 'discord_messages',
      params: (params) => {
        const { botToken, channelId, operation, content, tts, limit, before, after } =
          params as Record<string, any>
        const toNum = (v: any) => (typeof v === 'string' ? (v.trim() ? Number(v) : undefined) : v)
        const toBool = (v: any) => (typeof v === 'string' ? v === 'true' : Boolean(v))
        return {
          botToken,
          channelId,
          operation,
          content,
          tts: toBool(tts),
          limit: toNum(limit),
          before,
          after,
        }
      },
    },
  },
  inputs: {
    botToken: { type: 'string', required: true },
    channelId: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    content: { type: 'string', required: false },
    tts: { type: 'string', required: false },
    limit: { type: 'string', required: false },
    before: { type: 'string', required: false },
    after: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
