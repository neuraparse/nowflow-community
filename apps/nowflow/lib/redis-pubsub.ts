import Redis from 'ioredis'
import { createLogger } from '@/lib/logs/console-logger'
import { getRedisClient } from '@/lib/redis'

const logger = createLogger('RedisPubSub')

const CHANNEL_PREFIX = 'workflow:updates:'

// Cooldown period after all connection retries fail before trying again
const CONNECTION_RETRY_COOLDOWN = 5000 // 5 seconds

// --- Types ---

export type WorkflowUpdateMessage = {
  workflowId: string
  userId: string
  event: 'execution_completed' | 'execution_failed' | 'workflow_updated'
  timestamp: number
  data?: Record<string, any>
}

type SubscriptionCallback = (message: WorkflowUpdateMessage) => void

// --- Subscriber Singleton ---

let subscriberClient: Redis | null = null
let isSubscriberConnecting = false
let isSubscriberReady = false
let lastConnectionFailure = 0

// Map: channel name -> Set of callback functions
const subscriptions = new Map<string, Set<SubscriptionCallback>>()

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

/**
 * Get or create the dedicated subscriber Redis connection.
 * This is SEPARATE from the main Redis client because ioredis subscriber mode
 * prevents the connection from executing other commands (GET, SET, etc.).
 */
function getSubscriberClient(): Redis | null {
  if (typeof window !== 'undefined') return null

  // Only return existing client if it's ready and connected
  if (subscriberClient && isSubscriberReady) return subscriberClient

  if (isSubscriberConnecting) return null

  try {
    isSubscriberConnecting = true

    // Clean up any existing client that's not ready before creating a new one
    if (subscriberClient && !isSubscriberReady) {
      try {
        logger.debug('Disconnecting old subscriber client before creating new one')
        subscriberClient.disconnect()
      } catch (disconnectError) {
        logger.debug('Error disconnecting old subscriber client', { disconnectError })
      }
      subscriberClient = null
    }

    subscriberClient = new Redis(redisUrl, {
      keepAlive: 1000,
      connectTimeout: 15000,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        // Use exponential backoff with max 10 seconds
        // Never return null to let ioredis handle reconnection automatically
        const baseDelay = Math.min(times * times * 200, 10000)
        const jitter = Math.random() * 200
        logger.debug(
          `Redis Pub/Sub retry attempt ${times}, waiting ${Math.round(baseDelay + jitter)}ms`
        )
        return baseDelay + jitter
      },
      connectionName: 'nowflow-pubsub-subscriber',
      lazyConnect: false, // Changed to false to let ioredis manage connection
      enableReadyCheck: true,
      enableOfflineQueue: false,
    })

    // Capture reference for use in event handlers to avoid null pointer
    // if closePubSubConnection() sets subscriberClient to null before handler fires
    const client = subscriberClient

    // Use 'ready' event instead of 'connect' for pub/sub
    // This ensures connection is fully ready before subscribing
    client.on('ready', () => {
      logger.info('Redis Pub/Sub subscriber ready', {
        connectionName: 'nowflow-pubsub-subscriber',
        activeChannels: subscriptions.size,
        timestamp: new Date().toISOString(),
      })
      isSubscriberReady = true
      isSubscriberConnecting = false
      lastConnectionFailure = 0

      // Re-subscribe to all channels that had active subscriptions
      // This handles reconnection after a Redis restart
      for (const channel of subscriptions.keys()) {
        client.subscribe(channel).catch((err) => {
          logger.error(`Failed to re-subscribe to ${channel}`, { err })
        })
      }
    })

    client.on('error', (err: any) => {
      logger.error('Redis Pub/Sub connection error', {
        error: err,
        code: err?.code,
        message: err?.message,
        syscall: err?.syscall,
        address: err?.address,
      })
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        isSubscriberReady = false
      }
    })

    client.on('close', () => {
      const wasReady = isSubscriberReady
      isSubscriberReady = false
      isSubscriberConnecting = false
      // Only log when an active connection drops, not during initial connection failures
      if (wasReady) {
        logger.warn('Redis Pub/Sub subscriber connection lost, falling back to polling')
      }
      // Set cooldown to prevent immediate recreation
      lastConnectionFailure = Date.now()
    })

    // Handle incoming messages from subscribed channels
    client.on('message', (channel: string, rawMessage: string) => {
      const callbacks = subscriptions.get(channel)
      if (!callbacks || callbacks.size === 0) {
        logger.warn('Received message for channel with no callbacks', { channel })
        return
      }

      try {
        const message: WorkflowUpdateMessage = JSON.parse(rawMessage)
        logger.debug('Redis message received, dispatching to callbacks', {
          channel,
          event: message.event,
          workflowId: message.workflowId,
          callbackCount: callbacks.size,
        })
        for (const cb of callbacks) {
          try {
            cb(message)
          } catch (callbackError) {
            logger.error('Error in subscription callback', { callbackError })
          }
        }
      } catch (parseError) {
        logger.error('Failed to parse Pub/Sub message', { parseError, rawMessage })
      }
    })

    // With lazyConnect: false, ioredis handles connection automatically
    // No need to call connect() manually
    return client
  } catch (error) {
    logger.error('Failed to create subscriber client', { error })
    isSubscriberConnecting = false
    lastConnectionFailure = Date.now()
    return null
  }
}

// --- Public API ---

/**
 * Publish a workflow update to the user's channel.
 * Uses the MAIN Redis client (not the subscriber).
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function publishWorkflowUpdate(
  workflowId: string,
  userId: string,
  event: WorkflowUpdateMessage['event'],
  data?: Record<string, any>
): Promise<void> {
  try {
    const redis = getRedisClient()
    if (!redis) {
      logger.warn('Cannot publish workflow update: Redis client not available', {
        workflowId,
        userId,
        event,
      })
      return
    }

    const channel = `${CHANNEL_PREFIX}${userId}`
    const message: WorkflowUpdateMessage = {
      workflowId,
      userId,
      event,
      timestamp: Date.now(),
      data,
    }

    const subscriberCount = await redis.publish(channel, JSON.stringify(message))
    logger.debug(`Published ${event} to ${subscriberCount} subscriber(s)`, {
      workflowId,
      channel,
      subscriberCount,
      event,
    })
  } catch (error) {
    // NEVER let publish errors affect the caller
    logger.error('Failed to publish workflow update', {
      error,
      workflowId,
      userId,
      event,
    })
  }
}

/**
 * Subscribe to workflow updates for a specific user.
 * Returns an unsubscribe function that MUST be called on stream cleanup.
 */
export function subscribeToUserWorkflows(
  userId: string,
  callback: SubscriptionCallback
): () => void {
  const channel = `${CHANNEL_PREFIX}${userId}`
  const sub = getSubscriberClient()

  // Register the callback regardless of Redis availability
  // If Redis reconnects, the 'connect' handler will re-subscribe
  if (!subscriptions.has(channel)) {
    subscriptions.set(channel, new Set())
  }
  subscriptions.get(channel)!.add(callback)

  // Subscribe to Redis channel if connected (Redis SUBSCRIBE is idempotent)
  if (sub && isSubscriberReady) {
    sub.subscribe(channel).catch((err) => {
      logger.warn('Subscribe error:', err)
    })
  }

  // Return unsubscribe function
  return () => {
    const callbacks = subscriptions.get(channel)
    if (callbacks) {
      callbacks.delete(callback)

      // If no more callbacks for this channel, unsubscribe from Redis
      if (callbacks.size === 0) {
        subscriptions.delete(channel)
        if (subscriberClient && isSubscriberReady) {
          subscriberClient.unsubscribe(channel).catch((err) => {
            logger.debug(`Failed to unsubscribe from ${channel}`, { err })
          })
        }
      }
    }
  }
}

/**
 * Check if Redis Pub/Sub subscriber is currently connected and ready.
 * Used by SSE endpoint to decide polling interval.
 */
export function isPubSubReady(): boolean {
  return isSubscriberReady
}

/**
 * Get current connection status for debugging/monitoring.
 */
export function getPubSubConnectionStatus() {
  return {
    isReady: isSubscriberReady,
    isConnecting: isSubscriberConnecting,
    activeSubscriptions: subscriptions.size,
    lastFailureAge: lastConnectionFailure ? Date.now() - lastConnectionFailure : null,
    clientExists: subscriberClient !== null,
  }
}

/**
 * No need for manual reconnection loop anymore.
 * ioredis handles reconnection automatically with retryStrategy.
 */

/**
 * Gracefully close the subscriber connection.
 * Call during application shutdown.
 */
export async function closePubSubConnection(): Promise<void> {
  if (subscriberClient) {
    try {
      await subscriberClient.quit()
    } catch (error) {
      logger.error('Error closing subscriber connection', { error })
    } finally {
      subscriberClient = null
      isSubscriberReady = false
      isSubscriberConnecting = false
      subscriptions.clear()
    }
  }
}
