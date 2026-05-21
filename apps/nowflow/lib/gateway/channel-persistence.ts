import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { getRedisClient } from '@/lib/redis'
import { db } from '@/db'
import { gatewayChannel } from '@/db/schema'
import type { ChannelConfig, ChannelStatus, ChannelType } from './types'

const logger = createLogger('GatewayChannelPersistence')

// Redis key prefix
const CHANNEL_CONFIG_PREFIX = 'gateway:channel:'

/**
 * Persist channel configuration to Redis.
 */
export async function persistChannelConfig(config: ChannelConfig): Promise<void> {
  try {
    const redis = getRedisClient()
    if (!redis) return

    const key = `${CHANNEL_CONFIG_PREFIX}${config.id}`
    await redis.set(
      key,
      JSON.stringify(config, (k, v) => (v instanceof Date ? v.toISOString() : v))
    )
  } catch (error) {
    logger.error('Failed to persist channel config', { error, channelId: config.id })
  }
}

/**
 * Load a channel configuration from Redis.
 */
export async function loadChannelConfigFromRedis(channelId: string): Promise<ChannelConfig | null> {
  try {
    const redis = getRedisClient()
    if (!redis) return null

    const key = `${CHANNEL_CONFIG_PREFIX}${channelId}`
    const raw = await redis.get(key)
    if (!raw) return null

    const config = JSON.parse(raw, (k, v) => {
      if (typeof v === 'string' && (k === 'createdAt' || k === 'updatedAt')) {
        return new Date(v)
      }
      return v
    }) as ChannelConfig

    return config
  } catch (error) {
    logger.error('Failed to load channel config', { error, channelId })
    return null
  }
}

/**
 * Save channel to database.
 */
export async function saveChannelToDB(config: ChannelConfig): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(gatewayChannel)
      .where(eq(gatewayChannel.id, config.id))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(gatewayChannel)
        .set({
          status: config.status,
          settings: config.settings,
          name: config.name,
          updatedAt: new Date(),
        })
        .where(eq(gatewayChannel.id, config.id))
    } else {
      await db.insert(gatewayChannel).values({
        id: config.id,
        type: config.type,
        name: config.name,
        status: config.status,
        userId: config.userId,
        workspaceId: config.workspaceId,
        credentials: config.credentials,
        settings: config.settings,
      })
    }
  } catch (error) {
    logger.warn('Failed to save channel to DB', { error })
  }
}

/**
 * Delete channel from database.
 */
export async function deleteChannelFromDB(channelId: string): Promise<void> {
  try {
    await db.delete(gatewayChannel).where(eq(gatewayChannel.id, channelId))
  } catch (error) {
    logger.warn('Failed to delete channel from DB', { error })
  }
}

/**
 * Load channels from database.
 * Returns a Map of channel ID to ChannelConfig.
 */
export async function loadChannelsFromDB(userId?: string): Promise<Map<string, ChannelConfig>> {
  const channelMap = new Map<string, ChannelConfig>()

  try {
    let channels
    if (userId) {
      channels = await db.select().from(gatewayChannel).where(eq(gatewayChannel.userId, userId))
    } else {
      channels = await db.select().from(gatewayChannel)
    }

    for (const ch of channels) {
      channelMap.set(ch.id, {
        id: ch.id,
        type: ch.type as ChannelType,
        name: ch.name,
        status: (ch.status as ChannelStatus) || 'disconnected',
        userId: ch.userId,
        workspaceId: ch.workspaceId || undefined,
        credentials: (ch.credentials as Record<string, string>) || {},
        settings: (ch.settings as any) || {},
        createdAt: ch.createdAt,
        updatedAt: ch.updatedAt,
      })
    }
    logger.info(`Loaded ${channels.length} channels from database`)
  } catch (error) {
    logger.warn('Failed to load channels from DB, using in-memory only', { error })
  }

  return channelMap
}
