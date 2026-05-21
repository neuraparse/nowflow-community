import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { executeWorkflowFromPayload } from '@/lib/webhooks/utils'
import { db } from '@/db'
import { workflow as workflowTable } from '@/db/schema'
import {
  deleteChannelFromDB,
  loadChannelConfigFromRedis,
  loadChannelsFromDB,
  persistChannelConfig,
  saveChannelToDB,
} from './channel-persistence'
import { GatewayEventEmitter } from './event-emitter'
import { registerRules, routeMessage, type RoutingRule, unregisterRules } from './message-router'
import { checkRateLimit, isDuplicateMessage, markMessageProcessed } from './rate-limiter'
import {
  addMessageToHistory,
  createSession,
  getActiveSessionCount,
  getSession,
  updateSession,
} from './session-manager'
import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  ChannelType,
  GatewayEvent,
  InboundMessage,
  OutboundMessage,
} from './types'

const logger = createLogger('GatewayService')

/**
 * Messaging Gateway Service
 *
 * Central orchestrator for multi-channel messaging. Manages channel adapters,
 * sessions, message routing, rate limiting, and event emission.
 *
 * Uses singleton pattern to maintain a single set of channel connections
 * across the application lifecycle.
 */
class GatewayService {
  private adapters = new Map<ChannelType, ChannelAdapter>()
  private channels = new Map<string, ChannelConfig>()
  private stats = { sent: 0, received: 0 }
  private eventEmitter = new GatewayEventEmitter()

  // ─── Adapter Registry ───────────────────────────────────────────────

  /**
   * Register a channel adapter for a specific channel type.
   * Only one adapter per channel type is supported.
   */
  registerAdapter(adapter: ChannelAdapter): void {
    if (this.adapters.has(adapter.type)) {
      logger.warn('Overwriting existing adapter registration', { type: adapter.type })
    }
    this.adapters.set(adapter.type, adapter)
    logger.info('Channel adapter registered', { type: adapter.type })
  }

  /**
   * Unregister a channel adapter.
   */
  unregisterAdapter(type: ChannelType): void {
    this.adapters.delete(type)
    logger.info('Channel adapter unregistered', { type })
  }

  /**
   * Get a registered adapter by channel type.
   */
  getAdapter(type: ChannelType): ChannelAdapter | undefined {
    return this.adapters.get(type)
  }

  // ─── Channel Lifecycle ──────────────────────────────────────────────

  /**
   * Connect a messaging channel using its adapter.
   *
   * Validates credentials, checks adapter availability, persists the channel
   * configuration in Redis, and establishes the connection.
   */
  async connectChannel(config: ChannelConfig): Promise<{ success: boolean; error?: string }> {
    const adapter = this.adapters.get(config.type)
    if (!adapter) {
      const error = `No adapter registered for channel type: ${config.type}`
      logger.error(error)
      return { success: false, error }
    }

    // Validate credentials before attempting connection
    try {
      const valid = await adapter.validateCredentials(config.credentials)
      if (!valid) {
        const error = 'Invalid channel credentials'
        logger.warn(error, { channelId: config.id, type: config.type })
        return { success: false, error }
      }
    } catch (error) {
      logger.error('Credential validation failed', { error, channelId: config.id })
      return { success: false, error: 'Credential validation error' }
    }

    // Update status to connecting
    const connectingConfig: ChannelConfig = {
      ...config,
      status: 'connecting',
      updatedAt: new Date(),
    }
    this.channels.set(config.id, connectingConfig)
    await persistChannelConfig(connectingConfig)

    try {
      await adapter.connect(config)

      const connectedConfig: ChannelConfig = {
        ...config,
        status: 'connected',
        updatedAt: new Date(),
      }
      this.channels.set(config.id, connectedConfig)
      await persistChannelConfig(connectedConfig)
      await saveChannelToDB(connectedConfig)

      this.eventEmitter.emitEvent({
        type: 'channel_connected',
        channelId: config.id,
        channelType: config.type,
        data: { name: config.name },
        timestamp: new Date(),
      })

      logger.info('Channel connected', {
        channelId: config.id,
        type: config.type,
        name: config.name,
      })
      return { success: true }
    } catch (error) {
      const errorConfig: ChannelConfig = {
        ...config,
        status: 'error',
        updatedAt: new Date(),
      }
      this.channels.set(config.id, errorConfig)
      await persistChannelConfig(errorConfig)
      await saveChannelToDB(errorConfig)

      this.eventEmitter.emitEvent({
        type: 'channel_error',
        channelId: config.id,
        channelType: config.type,
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date(),
      })

      logger.error('Failed to connect channel', { error, channelId: config.id })
      return { success: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  }

  /**
   * Disconnect a channel and clean up its resources.
   */
  async disconnectChannel(channelId: string): Promise<void> {
    const config = this.channels.get(channelId)
    if (!config) {
      logger.warn('Attempted to disconnect unknown channel', { channelId })
      return
    }

    const adapter = this.adapters.get(config.type)
    if (adapter) {
      try {
        await adapter.disconnect(channelId)
      } catch (error) {
        logger.error('Error during channel disconnect', { error, channelId })
      }
    }

    // Update status
    const disconnectedConfig: ChannelConfig = {
      ...config,
      status: 'disconnected',
      updatedAt: new Date(),
    }
    this.channels.set(channelId, disconnectedConfig)
    await persistChannelConfig(disconnectedConfig)
    await deleteChannelFromDB(channelId)

    // Clean up routing rules
    unregisterRules(channelId)

    this.eventEmitter.emitEvent({
      type: 'channel_disconnected',
      channelId,
      channelType: config.type,
      data: { name: config.name },
      timestamp: new Date(),
    })

    logger.info('Channel disconnected', { channelId, type: config.type })
  }

  /**
   * Reconnect a channel by disconnecting and connecting again.
   */
  async reconnectChannel(channelId: string): Promise<{ success: boolean; error?: string }> {
    const config = this.channels.get(channelId)
    if (!config) {
      return { success: false, error: 'Channel not found' }
    }

    logger.info('Reconnecting channel', { channelId, type: config.type })
    await this.disconnectChannel(channelId)

    // Brief delay before reconnecting
    await new Promise((resolve) => setTimeout(resolve, 1000))

    return this.connectChannel(config)
  }

  /**
   * Get the current status of a channel.
   */
  getChannelStatus(channelId: string): ChannelStatus {
    const config = this.channels.get(channelId)
    if (!config) return 'disconnected'

    // Check live status from adapter if available
    const adapter = this.adapters.get(config.type)
    if (adapter) {
      return adapter.getStatus(channelId)
    }

    return config.status
  }

  /**
   * Get configuration for a specific channel.
   */
  getChannelConfig(channelId: string): ChannelConfig | undefined {
    return this.channels.get(channelId)
  }

  /**
   * Get all registered channels, optionally filtered by type.
   */
  getChannels(type?: ChannelType): ChannelConfig[] {
    const all = Array.from(this.channels.values())
    return type ? all.filter((c) => c.type === type) : all
  }

  /**
   * Get a single channel by ID.
   */
  getChannel(channelId: string): ChannelConfig | undefined {
    return this.channels.get(channelId)
  }

  /**
   * Update a channel's name or settings.
   */
  async updateChannel(
    channelId: string,
    updates: { name?: string; settings?: Partial<ChannelConfig['settings']> }
  ): Promise<ChannelConfig | null> {
    const channel = this.channels.get(channelId)
    if (!channel) return null

    if (updates.name) channel.name = updates.name
    if (updates.settings) channel.settings = { ...channel.settings, ...updates.settings }
    channel.updatedAt = new Date()

    this.channels.set(channelId, channel)
    await saveChannelToDB(channel)
    return channel
  }

  /**
   * Get all active sessions for a user.
   */
  async getActiveSessions(userId: string): Promise<any[]> {
    // Collect sessions from all channels belonging to this user
    const userChannels = this.getChannels().filter((c) => c.userId === userId)
    const sessions: any[] = []

    for (const channel of userChannels) {
      const count = await getActiveSessionCount(channel.id)
      if (count > 0) {
        // Return channel-level session summary
        sessions.push({
          id: `session_${channel.id}`,
          channelId: channel.id,
          channelType: channel.type,
          userId,
          senderId: '',
          workflowId: undefined,
          messageHistory: [],
          createdAt: channel.createdAt,
          lastActivityAt: channel.updatedAt,
          expiresAt: new Date(Date.now() + 86400000),
        })
      }
    }

    return sessions
  }

  /**
   * Get gateway status and stats.
   */
  async getStatus(): Promise<{
    channels: { total: number; connected: number; disconnected: number; error: number }
    activeSessions: number
    messageStats: { sent: number; received: number }
  }> {
    const allChannels = this.getChannels()
    let totalSessions = 0

    for (const ch of allChannels) {
      totalSessions += await getActiveSessionCount(ch.id)
    }

    return {
      channels: {
        total: allChannels.length,
        connected: allChannels.filter((c) => c.status === 'connected').length,
        disconnected: allChannels.filter((c) => c.status === 'disconnected').length,
        error: allChannels.filter((c) => c.status === 'error').length,
      },
      activeSessions: totalSessions,
      messageStats: { sent: this.stats.sent, received: this.stats.received },
    }
  }

  /**
   * Validate channel credentials without connecting.
   */
  async validateChannelCredentials(
    type: ChannelType,
    credentials: Record<string, string>
  ): Promise<boolean> {
    const adapter = this.adapters.get(type)
    if (!adapter) return false
    try {
      return await adapter.validateCredentials(credentials)
    } catch {
      return false
    }
  }

  // ─── Message Handling ───────────────────────────────────────────────

  /**
   * Process an inbound message from any channel.
   *
   * This is the main entry point for all incoming messages. It handles:
   * 1. Deduplication (skip already-processed messages)
   * 2. Rate limiting (enforce per-channel rate limits)
   * 3. Session management (create or retrieve session)
   * 4. Message history (append to session)
   * 5. Routing (determine which workflow to trigger)
   * 6. Event emission (notify listeners)
   *
   * @returns Object indicating whether a workflow was triggered
   */
  async handleInboundMessage(
    message: InboundMessage
  ): Promise<{ handled: boolean; workflowId?: string; error?: string }> {
    // 1. Deduplication
    const duplicate = await isDuplicateMessage(message.id)
    if (duplicate) {
      logger.debug('Duplicate message skipped', {
        messageId: message.id,
        channelId: message.channelId,
      })
      return { handled: false, error: 'duplicate' }
    }
    await markMessageProcessed(message.id)
    this.stats.received++

    // 2. Rate limiting
    const channelConfig = this.channels.get(message.channelId)
    if (!channelConfig) {
      logger.warn('Message received for unknown channel', { channelId: message.channelId })
      return { handled: false, error: 'unknown_channel' }
    }

    if (channelConfig.settings.rateLimitPerMinute) {
      const allowed = await checkRateLimit(
        message.channelId,
        channelConfig.settings.rateLimitPerMinute
      )
      if (!allowed) {
        logger.warn('Rate limit exceeded for channel', {
          channelId: message.channelId,
          limit: channelConfig.settings.rateLimitPerMinute,
        })
        return { handled: false, error: 'rate_limited' }
      }
    }

    // 3. Allowed users check
    if (channelConfig.settings.allowedUsers && channelConfig.settings.allowedUsers.length > 0) {
      if (!channelConfig.settings.allowedUsers.includes(message.senderId)) {
        logger.debug('Message from unauthorized sender', {
          channelId: message.channelId,
          senderId: message.senderId,
        })
        return { handled: false, error: 'unauthorized_sender' }
      }
    }

    // 4. Session management
    let session = await getSession(message.channelId, message.senderId)
    if (!session) {
      // Check concurrent session limits
      if (channelConfig.settings.maxConcurrentSessions) {
        const activeCount = await getActiveSessionCount(message.channelId)
        if (activeCount >= channelConfig.settings.maxConcurrentSessions) {
          logger.warn('Max concurrent sessions reached', {
            channelId: message.channelId,
            limit: channelConfig.settings.maxConcurrentSessions,
            active: activeCount,
          })
          return { handled: false, error: 'max_sessions_reached' }
        }
      }

      session = await createSession({
        channelId: message.channelId,
        channelType: message.channelType,
        userId: channelConfig.userId,
        senderId: message.senderId,
        workflowId: channelConfig.settings.triggerWorkflowId,
      })

      this.eventEmitter.emitEvent({
        type: 'session_created',
        channelId: message.channelId,
        channelType: message.channelType,
        data: { sessionId: session.id, senderId: message.senderId },
        timestamp: new Date(),
      })

      // Send welcome message if configured
      if (channelConfig.settings.welcomeMessage && channelConfig.settings.autoReply !== false) {
        await this.sendMessage({
          channelId: message.channelId,
          channelType: message.channelType,
          recipientId: message.senderId,
          text: channelConfig.settings.welcomeMessage,
        }).catch((error) => {
          logger.error('Failed to send welcome message', { error, channelId: message.channelId })
        })
      }
    }

    // 5. Append message to history
    await addMessageToHistory(message.channelId, message.senderId, 'user', message.text)

    // 6. Route message to workflow
    const routeResult = routeMessage(message, channelConfig)

    // Emit message_received event
    this.eventEmitter.emitEvent({
      type: 'message_received',
      channelId: message.channelId,
      channelType: message.channelType,
      data: {
        messageId: message.id,
        senderId: message.senderId,
        senderName: message.senderName,
        textPreview: message.text.substring(0, 100),
        hasMedia: !!message.media?.length,
        routed: routeResult.matched,
        workflowId: routeResult.workflowId,
      },
      timestamp: new Date(),
    })

    if (routeResult.matched && routeResult.workflowId) {
      // Update session with workflow info
      await updateSession(message.channelId, message.senderId, {
        workflowId: routeResult.workflowId,
      })

      this.eventEmitter.emitEvent({
        type: 'workflow_triggered',
        channelId: message.channelId,
        channelType: message.channelType,
        data: {
          workflowId: routeResult.workflowId,
          trigger: routeResult.trigger,
          params: routeResult.params,
          messageId: message.id,
          sessionId: session.id,
        },
        timestamp: new Date(),
      })

      // Publish to Redis for workflow execution service to pick up
      await this.eventEmitter.publishGatewayEvent('workflow_triggered', {
        workflowId: routeResult.workflowId,
        channelId: message.channelId,
        channelType: message.channelType,
        senderId: message.senderId,
        messageId: message.id,
        sessionId: session.id,
        text: message.text,
        media: message.media,
        metadata: message.metadata,
        trigger: routeResult.trigger,
        params: routeResult.params,
      })

      logger.info('Inbound message routed to workflow', {
        channelId: message.channelId,
        messageId: message.id,
        workflowId: routeResult.workflowId,
      })

      // Execute the workflow and optionally send the response back
      const executionResult = await this.executeWorkflow(routeResult.workflowId, message, session)

      if (executionResult?.error) {
        logger.error('Workflow execution failed for gateway message', {
          channelId: message.channelId,
          workflowId: routeResult.workflowId,
          error: executionResult.error,
        })
      }

      return { handled: true, workflowId: routeResult.workflowId }
    }

    logger.debug('Inbound message received but no workflow matched', {
      channelId: message.channelId,
      messageId: message.id,
    })

    return { handled: true }
  }

  /**
   * Execute a workflow triggered by a gateway inbound message.
   *
   * Fetches the workflow from the database, runs it via executeWorkflowFromPayload,
   * stores the execution ID in the session, and sends the response back through
   * the channel adapter if auto-reply is enabled.
   */
  async executeWorkflow(
    workflowId: string,
    message: InboundMessage,
    session: any
  ): Promise<{ success: boolean; error?: string }> {
    const executionId = uuidv4()

    try {
      // Fetch the workflow from the database
      const workflows = await db
        .select()
        .from(workflowTable)
        .where(eq(workflowTable.id, workflowId))
        .limit(1)

      if (workflows.length === 0) {
        logger.error('Workflow not found for gateway execution', { workflowId })
        return { success: false, error: 'workflow_not_found' }
      }

      const foundWorkflow = workflows[0]

      // Build workflow input from the inbound message
      const input = {
        message: message.text,
        senderId: message.senderId,
        senderName: message.senderName,
        channelId: message.channelId,
        channelType: message.channelType,
        messageId: message.id,
        media: message.media,
        metadata: message.metadata,
        sessionId: session.id,
      }

      logger.info('Executing workflow from gateway message', {
        workflowId,
        executionId,
        channelId: message.channelId,
        senderId: message.senderId,
      })

      // Execute the workflow using the shared execution function
      await executeWorkflowFromPayload(foundWorkflow, input, executionId, executionId.slice(0, 8))

      // Store execution ID in the session
      await updateSession(message.channelId, message.senderId, {
        executionId,
      })

      this.eventEmitter.emitEvent({
        type: 'workflow_completed' as any,
        channelId: message.channelId,
        channelType: message.channelType,
        data: {
          workflowId,
          executionId,
          sessionId: session.id,
        },
        timestamp: new Date(),
      })

      logger.info('Gateway workflow execution completed', {
        workflowId,
        executionId,
        channelId: message.channelId,
      })

      return { success: true }
    } catch (error) {
      logger.error('Gateway workflow execution failed', {
        workflowId,
        executionId,
        error: error instanceof Error ? error.message : String(error),
      })
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send an outbound message through the appropriate channel adapter.
   */
  async sendMessage(
    message: OutboundMessage
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const adapter = this.adapters.get(message.channelType)
    if (!adapter) {
      const error = `No adapter for channel type: ${message.channelType}`
      logger.error(error)
      return { success: false, error }
    }

    try {
      const result = await adapter.sendMessage(message)

      if (result.success) {
        this.stats.sent++
        // Record assistant message in session history
        await addMessageToHistory(message.channelId, message.recipientId, 'assistant', message.text)

        this.eventEmitter.emitEvent({
          type: 'message_sent',
          channelId: message.channelId,
          channelType: message.channelType,
          data: {
            recipientId: message.recipientId,
            messageId: result.messageId,
            textPreview: message.text.substring(0, 100),
          },
          timestamp: new Date(),
        })
      }

      return result
    } catch (error) {
      logger.error('Failed to send outbound message', { error, channelId: message.channelId })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Send failed',
      }
    }
  }

  // ─── Routing Rules ──────────────────────────────────────────────────

  /**
   * Set routing rules for a channel.
   */
  setChannelRules(channelId: string, rules: RoutingRule[]): void {
    registerRules(channelId, rules)
  }

  // ─── Event System ──────────────────────────────────────────────────

  /**
   * Subscribe to gateway events.
   * Returns an unsubscribe function.
   *
   * @param eventType Event type to listen for, or '*' for all events
   * @param listener Callback function
   */
  on(eventType: GatewayEvent['type'] | '*', listener: (event: GatewayEvent) => void): () => void {
    return this.eventEmitter.on(eventType, listener)
  }

  // ─── Channel Loading ──────────────────────────────────────────────

  /**
   * Load channels from database on initialization.
   */
  async loadChannelsFromDB(userId?: string): Promise<void> {
    const loaded = await loadChannelsFromDB(userId)
    for (const [id, config] of loaded) {
      this.channels.set(id, config)
    }
  }

  /**
   * Load a channel configuration from Redis.
   */
  async loadChannelConfig(channelId: string): Promise<ChannelConfig | null> {
    const config = await loadChannelConfigFromRedis(channelId)
    if (config) {
      this.channels.set(channelId, config)
    }
    return config ?? this.channels.get(channelId) ?? null
  }

  // ─── Shutdown ───────────────────────────────────────────────────────

  /**
   * Gracefully shut down the gateway service.
   * Disconnects all channels and cleans up resources.
   */
  async shutdown(): Promise<void> {
    logger.info('Gateway service shutting down', { channelCount: this.channels.size })

    const disconnectPromises = Array.from(this.channels.keys()).map((channelId) =>
      this.disconnectChannel(channelId).catch((error) => {
        logger.error('Error disconnecting channel during shutdown', { error, channelId })
      })
    )

    await Promise.all(disconnectPromises)

    this.adapters.clear()
    this.channels.clear()
    this.eventEmitter.clear()

    logger.info('Gateway service shut down complete')
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────

let gatewayInstance: GatewayService | null = null

/**
 * Get the singleton GatewayService instance.
 */
export function getGatewayService(): GatewayService {
  if (!gatewayInstance) {
    gatewayInstance = new GatewayService()
    // Load channels from DB in the background on first initialization
    gatewayInstance.loadChannelsFromDB().catch((error) => {
      logger.warn('Failed to load channels from DB on startup', { error })
    })
    logger.info('Gateway service initialized')
  }
  return gatewayInstance
}

/**
 * Reset the gateway service instance (primarily for testing).
 */
export async function resetGatewayService(): Promise<void> {
  if (gatewayInstance) {
    await gatewayInstance.shutdown()
    gatewayInstance = null
  }
}

export { GatewayService }
