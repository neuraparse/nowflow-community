import { createLogger } from '@/lib/logs/console-logger'
import { getRedisClient } from '@/lib/redis'
import type { GatewayEvent } from './types'

const logger = createLogger('GatewayEventEmitter')

const GATEWAY_EVENTS_CHANNEL = 'gateway:events'

/**
 * Manages gateway event subscriptions and emission.
 *
 * Supports both specific event type listeners and wildcard ('*') listeners.
 */
export class GatewayEventEmitter {
  private eventListeners = new Map<string, Set<(event: GatewayEvent) => void>>()

  /**
   * Subscribe to gateway events.
   * Returns an unsubscribe function.
   *
   * @param eventType Event type to listen for, or '*' for all events
   * @param listener Callback function
   */
  on(eventType: GatewayEvent['type'] | '*', listener: (event: GatewayEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set())
    }
    this.eventListeners.get(eventType)!.add(listener)

    return () => {
      const listeners = this.eventListeners.get(eventType)
      if (listeners) {
        listeners.delete(listener)
        if (listeners.size === 0) {
          this.eventListeners.delete(eventType)
        }
      }
    }
  }

  /**
   * Emit a gateway event to all registered listeners.
   */
  emitEvent(event: GatewayEvent): void {
    // Notify specific event listeners
    const specificListeners = this.eventListeners.get(event.type)
    if (specificListeners) {
      for (const listener of specificListeners) {
        try {
          listener(event)
        } catch (error) {
          logger.error('Error in gateway event listener', { error, eventType: event.type })
        }
      }
    }

    // Notify wildcard listeners
    const wildcardListeners = this.eventListeners.get('*')
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        try {
          listener(event)
        } catch (error) {
          logger.error('Error in wildcard event listener', { error, eventType: event.type })
        }
      }
    }
  }

  /**
   * Publish a gateway event to Redis for cross-process communication.
   */
  async publishGatewayEvent(type: string, data: Record<string, any>): Promise<void> {
    try {
      const redis = getRedisClient()
      if (!redis) {
        logger.warn('Cannot publish gateway event: Redis unavailable', { type })
        return
      }

      await redis.publish(
        GATEWAY_EVENTS_CHANNEL,
        JSON.stringify({ type, data, timestamp: Date.now() })
      )

      logger.debug('Gateway event published to Redis', { type })
    } catch (error) {
      logger.error('Failed to publish gateway event', { error, type })
    }
  }

  /**
   * Clear all event listeners.
   */
  clear(): void {
    this.eventListeners.clear()
  }
}
