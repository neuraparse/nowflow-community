import { NextRequest, NextResponse } from 'next/server'
import { DiscordAdapter, hexToUint8Array } from '@/lib/gateway/adapters/discord-adapter'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('DiscordInteractions')

// Discord interaction types
const INTERACTION_TYPE = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  MODAL_SUBMIT: 5,
} as const

// Discord interaction response types
const INTERACTION_RESPONSE_TYPE = {
  PONG: 1,
  CHANNEL_MESSAGE: 4,
  DEFERRED_CHANNEL_MESSAGE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
} as const

// -------------------------------------------------------------------
//  Ed25519 signature verification via Web Crypto API
// -------------------------------------------------------------------

async function verifyDiscordSignature(
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
    logger.error('Ed25519 signature verification failed:', error)
    return false
  }
}

// -------------------------------------------------------------------
//  Discord interactions route handler
// -------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY

  if (!publicKey) {
    logger.error('DISCORD_PUBLIC_KEY environment variable is not configured')
    return NextResponse.json({ error: 'Discord integration not configured' }, { status: 500 })
  }

  // Read the raw body for signature verification
  const rawBody = await request.text()

  // Extract signature headers
  const signature = request.headers.get('x-signature-ed25519')
  const timestamp = request.headers.get('x-signature-timestamp')

  if (!signature || !timestamp) {
    logger.warn('Missing Discord signature headers')
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 })
  }

  // Verify the request signature
  const isValid = await verifyDiscordSignature(rawBody, signature, timestamp, publicKey)

  if (!isValid) {
    logger.warn('Invalid Discord interaction signature')
    return NextResponse.json({ error: 'Invalid request signature' }, { status: 401 })
  }

  // Parse the interaction body
  let interaction: any
  try {
    interaction = JSON.parse(rawBody)
  } catch {
    logger.error('Failed to parse Discord interaction body')
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Handle PING — Discord sends this to validate the interactions endpoint
  if (interaction.type === INTERACTION_TYPE.PING) {
    logger.info('Responding to Discord PING verification')
    return NextResponse.json({ type: INTERACTION_RESPONSE_TYPE.PONG })
  }

  // Handle APPLICATION_COMMAND interactions
  if (interaction.type === INTERACTION_TYPE.APPLICATION_COMMAND) {
    return handleApplicationCommand(interaction)
  }

  // Handle MESSAGE_COMPONENT interactions (button clicks, select menus)
  if (interaction.type === INTERACTION_TYPE.MESSAGE_COMPONENT) {
    return handleMessageComponent(interaction)
  }

  // Handle MODAL_SUBMIT interactions
  if (interaction.type === INTERACTION_TYPE.MODAL_SUBMIT) {
    return handleModalSubmit(interaction)
  }

  logger.warn(`Unhandled Discord interaction type: ${interaction.type}`)
  return NextResponse.json({ error: 'Unhandled interaction type' }, { status: 400 })
}

// -------------------------------------------------------------------
//  Interaction handlers
// -------------------------------------------------------------------

async function handleApplicationCommand(interaction: any): Promise<NextResponse> {
  const commandName = interaction.data?.name ?? 'unknown'
  const user = interaction.member?.user ?? interaction.user
  const userId = user?.id ?? 'unknown'

  logger.info(`Slash command received: /${commandName} from user ${userId}`)

  try {
    const adapter = new DiscordAdapter()
    const inboundMessage = await adapter.handleWebhook(interaction)

    if (inboundMessage) {
      // Return a deferred response so we can process asynchronously
      // The gateway service will send a follow-up message via the interaction token
      logger.debug(`Routing command /${commandName} to gateway service`, {
        channelId: inboundMessage.channelId,
        senderId: inboundMessage.senderId,
      })

      // Acknowledge with a deferred response — the workflow will follow up
      return NextResponse.json({
        type: INTERACTION_RESPONSE_TYPE.DEFERRED_CHANNEL_MESSAGE,
        data: {
          flags: 0, // No ephemeral flag; visible to the channel
        },
      })
    }

    // If the adapter returned null (e.g. duplicate), still acknowledge
    return NextResponse.json({
      type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE,
      data: {
        content: 'Command received.',
        flags: 64, // Ephemeral
      },
    })
  } catch (error) {
    logger.error(`Error handling slash command /${commandName}:`, error)
    return NextResponse.json({
      type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE,
      data: {
        content: 'An error occurred while processing your command. Please try again later.',
        flags: 64, // Ephemeral
      },
    })
  }
}

async function handleMessageComponent(interaction: any): Promise<NextResponse> {
  const customId = interaction.data?.custom_id ?? ''
  const user = interaction.member?.user ?? interaction.user
  const userId = user?.id ?? 'unknown'

  logger.info(`Component interaction received: ${customId} from user ${userId}`)

  try {
    const adapter = new DiscordAdapter()
    const inboundMessage = await adapter.handleWebhook(interaction)

    if (inboundMessage) {
      logger.debug(`Routing component interaction ${customId} to gateway service`, {
        channelId: inboundMessage.channelId,
        senderId: inboundMessage.senderId,
      })

      // Acknowledge with a deferred update so the user sees a loading state
      return NextResponse.json({
        type: INTERACTION_RESPONSE_TYPE.DEFERRED_UPDATE_MESSAGE,
      })
    }

    return NextResponse.json({
      type: INTERACTION_RESPONSE_TYPE.UPDATE_MESSAGE,
      data: {
        content: 'Interaction received.',
      },
    })
  } catch (error) {
    logger.error(`Error handling component interaction ${customId}:`, error)
    return NextResponse.json({
      type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE,
      data: {
        content: 'An error occurred while processing your interaction. Please try again later.',
        flags: 64,
      },
    })
  }
}

async function handleModalSubmit(interaction: any): Promise<NextResponse> {
  const customId = interaction.data?.custom_id ?? ''
  const user = interaction.member?.user ?? interaction.user
  const userId = user?.id ?? 'unknown'

  logger.info(`Modal submit received: ${customId} from user ${userId}`)

  try {
    const adapter = new DiscordAdapter()
    const inboundMessage = await adapter.handleWebhook(interaction)

    if (inboundMessage) {
      return NextResponse.json({
        type: INTERACTION_RESPONSE_TYPE.DEFERRED_CHANNEL_MESSAGE,
        data: { flags: 64 },
      })
    }

    return NextResponse.json({
      type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE,
      data: {
        content: 'Submission received.',
        flags: 64,
      },
    })
  } catch (error) {
    logger.error(`Error handling modal submit ${customId}:`, error)
    return NextResponse.json({
      type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE,
      data: {
        content: 'An error occurred while processing your submission. Please try again later.',
        flags: 64,
      },
    })
  }
}
