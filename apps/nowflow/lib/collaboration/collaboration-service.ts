import Redis from 'ioredis'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('CollaborationService')

const LOCK_TTL = 30 // seconds
const PRESENCE_TTL = 300 // seconds (5 minutes – long enough for heartbeat to refresh)

export interface Collaborator {
  userId: string
  name: string
  avatar?: string
  cursor?: { blockId: string; field?: string }
  joinedAt: number
}

export interface BlockChange {
  blockId: string
  userId: string
  userName: string
  changes: Record<string, unknown>
  timestamp: number
  version: number
}

export interface BlockLock {
  blockId: string
  userId: string
  userName: string
  lockedAt: number
}

export interface ConflictResolution {
  blockId: string
  winnerId: string
  winnerName: string
  loserId: string
  timestamp: number
}

export type CollaborationEvent =
  | { type: 'presence'; data: Collaborator }
  | { type: 'leave'; data: { userId: string } }
  | { type: 'change'; data: BlockChange }
  | {
      type: 'cursor'
      data: {
        userId: string
        name: string
        blockId: string
        field?: string
        position?: { x: number; y: number }
        selectedNodes?: string[]
      }
    }
  | { type: 'lock'; data: BlockLock }
  | { type: 'unlock'; data: { blockId: string; userId: string } }
  | { type: 'conflict'; data: ConflictResolution }

// Channel helpers
function chanChanges(id: string) {
  return `workflow:${id}:changes`
}
function chanPresence(id: string) {
  return `workflow:${id}:presence`
}
function chanLocks(id: string) {
  return `workflow:${id}:locks`
}
function keyPresence(id: string) {
  return `collab:presence:${id}`
}
function keyLock(id: string, blockId: string) {
  return `collab:lock:${id}:${blockId}`
}

export class CollaborationService {
  private pub: Redis
  private sub: Redis
  /** Track how many listeners reference each Redis channel to avoid premature unsubscribe */
  private channelRefCount = new Map<string, number>()
  /** Per-channel handler registry — lets us share a single Redis 'message' listener. */
  private channelHandlers = new Map<string, Set<(channel: string, message: string) => void>>()
  private dispatcherInstalled = false

  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379'
    this.pub = new Redis(url, { maxRetriesPerRequest: 3, connectTimeout: 5000 })
    this.sub = new Redis(url, { maxRetriesPerRequest: 3, connectTimeout: 5000 })

    // Collab subscribers can legitimately outnumber Node's default 10 (one per
    // active workflow session); lift the cap so we don't trigger the leak
    // warning when many users are connected at once.
    this.sub.setMaxListeners(0)

    this.pub.on('error', (err) => logger.error('Redis pub error', { err }))
    this.sub.on('error', (err) => logger.error('Redis sub error', { err }))
  }

  /** Install a single Redis 'message' listener that fans out to per-channel handlers. */
  private ensureDispatcher() {
    if (this.dispatcherInstalled) return
    this.dispatcherInstalled = true
    this.sub.on('message', (channel: string, message: string) => {
      const handlers = this.channelHandlers.get(channel)
      if (!handlers || handlers.size === 0) return
      for (const h of handlers) {
        try {
          h(channel, message)
        } catch (err) {
          logger.error('Collaboration handler error', { err, channel })
        }
      }
    })
  }

  async joinWorkflow(
    workflowId: string,
    user: { id: string; name: string; avatar?: string }
  ): Promise<void> {
    const collaborator: Collaborator = {
      userId: user.id,
      name: user.name,
      avatar: user.avatar,
      joinedAt: Date.now(),
    }

    // Store in presence hash with TTL
    await this.pub.hset(keyPresence(workflowId), user.id, JSON.stringify(collaborator))
    await this.pub.expire(keyPresence(workflowId), PRESENCE_TTL)

    // Broadcast join
    const event: CollaborationEvent = { type: 'presence', data: collaborator }
    await this.pub.publish(chanPresence(workflowId), JSON.stringify(event))
    logger.info('User joined workflow', { workflowId, userId: user.id })
  }

  async leaveWorkflow(workflowId: string, userId: string): Promise<void> {
    await this.pub.hdel(keyPresence(workflowId), userId)

    // Release any locks held by this user (use SCAN instead of KEYS to avoid blocking Redis)
    const locks: string[] = []
    let cursor = '0'
    do {
      const [nextCursor, keys] = await this.pub.scan(
        cursor,
        'MATCH',
        `collab:lock:${workflowId}:*`,
        'COUNT',
        100
      )
      cursor = nextCursor
      locks.push(...keys)
    } while (cursor !== '0')
    for (const lockKey of locks) {
      const value = await this.pub.get(lockKey)
      if (value) {
        const lock = JSON.parse(value) as BlockLock
        if (lock.userId === userId) {
          await this.pub.del(lockKey)
          const unlockEvent: CollaborationEvent = {
            type: 'unlock',
            data: { blockId: lock.blockId, userId },
          }
          await this.pub.publish(chanLocks(workflowId), JSON.stringify(unlockEvent))
        }
      }
    }

    const event: CollaborationEvent = { type: 'leave', data: { userId } }
    await this.pub.publish(chanPresence(workflowId), JSON.stringify(event))
    logger.info('User left workflow', { workflowId, userId })
  }

  async broadcastChange(workflowId: string, change: BlockChange): Promise<void> {
    // Check for lock conflicts
    const lockValue = await this.pub.get(keyLock(workflowId, change.blockId))
    if (lockValue) {
      const lock = JSON.parse(lockValue) as BlockLock
      if (lock.userId !== change.userId) {
        // Conflict: block is locked by someone else, apply last-write-wins
        await this.resolveConflict(workflowId, {
          blockId: change.blockId,
          winnerId: change.userId,
          winnerName: change.userName,
          loserId: lock.userId,
          timestamp: Date.now(),
        })
      }
    }

    const event: CollaborationEvent = { type: 'change', data: change }
    await this.pub.publish(chanChanges(workflowId), JSON.stringify(event))
  }

  async broadcastCursor(
    workflowId: string,
    user: { id: string; name: string },
    cursor: {
      blockId: string
      field?: string
      position?: { x: number; y: number }
      selectedNodes?: string[]
    }
  ): Promise<void> {
    // Update cursor in presence
    const raw = await this.pub.hget(keyPresence(workflowId), user.id)
    if (raw) {
      const collaborator = JSON.parse(raw) as Collaborator
      collaborator.cursor = { blockId: cursor.blockId, field: cursor.field }
      await this.pub.hset(keyPresence(workflowId), user.id, JSON.stringify(collaborator))
      await this.pub.expire(keyPresence(workflowId), PRESENCE_TTL)
    }

    const event: CollaborationEvent = {
      type: 'cursor',
      data: {
        userId: user.id,
        name: user.name,
        blockId: cursor.blockId,
        field: cursor.field,
        position: cursor.position,
        selectedNodes: cursor.selectedNodes,
      },
    }
    await this.pub.publish(chanPresence(workflowId), JSON.stringify(event))
  }

  /** Refresh the presence TTL for a workflow. Call periodically (e.g. on heartbeat). */
  async refreshPresence(workflowId: string, userId: string): Promise<void> {
    try {
      const exists = await this.pub.hexists(keyPresence(workflowId), userId)
      if (exists) {
        await this.pub.expire(keyPresence(workflowId), PRESENCE_TTL)
      }
    } catch (err) {
      logger.error('Failed to refresh presence TTL', { err, workflowId, userId })
    }
  }

  async getActiveCollaborators(workflowId: string): Promise<Collaborator[]> {
    const all = await this.pub.hgetall(keyPresence(workflowId))
    return Object.values(all).map((v) => JSON.parse(v) as Collaborator)
  }

  async lockBlock(
    workflowId: string,
    blockId: string,
    user: { id: string; name: string }
  ): Promise<boolean> {
    const lockKey = keyLock(workflowId, blockId)
    const lock: BlockLock = { blockId, userId: user.id, userName: user.name, lockedAt: Date.now() }

    // Atomic set-if-not-exists
    const result = await this.pub.set(lockKey, JSON.stringify(lock), 'EX', LOCK_TTL, 'NX')
    if (result !== 'OK') {
      logger.debug('Block already locked', { workflowId, blockId })
      return false
    }

    const event: CollaborationEvent = { type: 'lock', data: lock }
    await this.pub.publish(chanLocks(workflowId), JSON.stringify(event))
    return true
  }

  async unlockBlock(workflowId: string, blockId: string, userId: string): Promise<void> {
    const lockKey = keyLock(workflowId, blockId)
    const raw = await this.pub.get(lockKey)
    if (raw) {
      const lock = JSON.parse(raw) as BlockLock
      if (lock.userId !== userId) {
        logger.warn('Unlock attempt by non-owner', { workflowId, blockId, userId })
        return
      }
    }

    await this.pub.del(lockKey)
    const event: CollaborationEvent = { type: 'unlock', data: { blockId, userId } }
    await this.pub.publish(chanLocks(workflowId), JSON.stringify(event))
  }

  async resolveConflict(workflowId: string, resolution: ConflictResolution): Promise<void> {
    // Last-write-wins: release the old lock and notify both parties
    await this.pub.del(keyLock(workflowId, resolution.blockId))

    const event: CollaborationEvent = { type: 'conflict', data: resolution }
    await this.pub.publish(chanChanges(workflowId), JSON.stringify(event))
    logger.info('Conflict resolved (last-write-wins)', {
      workflowId,
      blockId: resolution.blockId,
      winner: resolution.winnerId,
    })
  }

  /** Subscribe to all collaboration channels for a workflow. Returns unsubscribe fn. */
  subscribe(workflowId: string, onEvent: (event: CollaborationEvent) => void): () => void {
    const channelList = [chanChanges(workflowId), chanPresence(workflowId), chanLocks(workflowId)]

    const handler = (_channel: string, message: string) => {
      try {
        onEvent(JSON.parse(message) as CollaborationEvent)
      } catch (err) {
        logger.error('Failed to parse collaboration event', { err })
      }
    }

    // Register handler per channel and bump ref counts
    this.ensureDispatcher()
    for (const ch of channelList) {
      const count = this.channelRefCount.get(ch) || 0
      this.channelRefCount.set(ch, count + 1)
      let handlers = this.channelHandlers.get(ch)
      if (!handlers) {
        handlers = new Set()
        this.channelHandlers.set(ch, handlers)
      }
      handlers.add(handler)
    }

    this.sub.subscribe(...channelList).catch((err) => logger.error('Subscribe failed', { err }))

    return () => {
      const toUnsub: string[] = []
      for (const ch of channelList) {
        const handlers = this.channelHandlers.get(ch)
        if (handlers) {
          handlers.delete(handler)
          if (handlers.size === 0) this.channelHandlers.delete(ch)
        }
        const count = (this.channelRefCount.get(ch) || 1) - 1
        if (count <= 0) {
          this.channelRefCount.delete(ch)
          toUnsub.push(ch)
        } else {
          this.channelRefCount.set(ch, count)
        }
      }
      if (toUnsub.length > 0) {
        this.sub.unsubscribe(...toUnsub).catch(() => {})
      }
    }
  }

  async destroy(): Promise<void> {
    await Promise.all([this.pub.quit(), this.sub.quit()]).catch(() => {})
  }
}

// Singleton for server-side usage
let instance: CollaborationService | null = null

export function getCollaborationService(): CollaborationService {
  if (!instance) {
    instance = new CollaborationService()
  }
  return instance
}
