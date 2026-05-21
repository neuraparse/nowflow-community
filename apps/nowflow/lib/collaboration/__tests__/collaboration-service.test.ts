/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CollaborationService } from '../collaboration-service'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const mockRedis = {
  hset: vi.fn().mockResolvedValue(1),
  hget: vi.fn().mockResolvedValue(null),
  hgetall: vi.fn().mockResolvedValue({}),
  hdel: vi.fn().mockResolvedValue(1),
  hexists: vi.fn().mockResolvedValue(1),
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  keys: vi.fn().mockResolvedValue([]),
  scan: vi.fn().mockResolvedValue(['0', []]),
  expire: vi.fn().mockResolvedValue(1),
  publish: vi.fn().mockResolvedValue(1),
  subscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  removeListener: vi.fn(),
  setMaxListeners: vi.fn(),
  quit: vi.fn().mockResolvedValue('OK'),
}

vi.mock('ioredis', () => {
  const RedisMock = function () {
    return { ...mockRedis }
  }
  return { default: RedisMock }
})

describe('CollaborationService', () => {
  let service: CollaborationService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new CollaborationService('redis://localhost:6379')
  })

  const user = { id: 'u1', name: 'Alice', avatar: 'a.png' }
  const wfId = 'wf-1'

  describe('joinWorkflow / leaveWorkflow', () => {
    it('stores presence and publishes join event', async () => {
      await service.joinWorkflow(wfId, user)
      const pub = (service as any).pub
      expect(pub.hset).toHaveBeenCalledWith(
        `collab:presence:${wfId}`,
        user.id,
        expect.stringContaining('"userId":"u1"')
      )
      expect(pub.expire).toHaveBeenCalled()
      expect(pub.publish).toHaveBeenCalledWith(
        `workflow:${wfId}:presence`,
        expect.stringContaining('"type":"presence"')
      )
    })

    it('removes presence and publishes leave event', async () => {
      const pub = (service as any).pub
      pub.scan.mockResolvedValue(['0', [`collab:lock:${wfId}:b1`]])
      pub.get.mockResolvedValue(
        JSON.stringify({ blockId: 'b1', userId: 'u1', userName: 'Alice', lockedAt: 1 })
      )

      await service.leaveWorkflow(wfId, 'u1')

      expect(pub.hdel).toHaveBeenCalledWith(`collab:presence:${wfId}`, 'u1')
      expect(pub.del).toHaveBeenCalledWith(`collab:lock:${wfId}:b1`)
      expect(pub.publish).toHaveBeenCalledWith(
        `workflow:${wfId}:locks`,
        expect.stringContaining('"type":"unlock"')
      )
    })
  })

  describe('broadcastChange', () => {
    const change = {
      blockId: 'b1',
      userId: 'u1',
      userName: 'Alice',
      changes: { x: 1 },
      timestamp: 1,
      version: 1,
    }

    it('publishes change when block is not locked', async () => {
      const pub = (service as any).pub
      pub.get.mockResolvedValue(null)
      await service.broadcastChange(wfId, change)
      expect(pub.publish).toHaveBeenCalledWith(
        `workflow:${wfId}:changes`,
        expect.stringContaining('"type":"change"')
      )
    })

    it('resolves conflict when locked by another user', async () => {
      const pub = (service as any).pub
      pub.get.mockResolvedValue(
        JSON.stringify({ blockId: 'b1', userId: 'u2', userName: 'Bob', lockedAt: 1 })
      )
      await service.broadcastChange(wfId, change)
      // conflict event published on changes channel
      expect(pub.publish).toHaveBeenCalledWith(
        `workflow:${wfId}:changes`,
        expect.stringContaining('"type":"conflict"')
      )
    })
  })

  describe('lockBlock / unlockBlock', () => {
    it('acquires lock atomically and returns true', async () => {
      const pub = (service as any).pub
      pub.set.mockResolvedValue('OK')
      const result = await service.lockBlock(wfId, 'b1', user)
      expect(result).toBe(true)
      expect(pub.set).toHaveBeenCalledWith(
        `collab:lock:${wfId}:b1`,
        expect.any(String),
        'EX',
        30,
        'NX'
      )
    })

    it('returns false when block is already locked', async () => {
      const pub = (service as any).pub
      pub.set.mockResolvedValue(null)
      const result = await service.lockBlock(wfId, 'b1', user)
      expect(result).toBe(false)
    })

    it('unlockBlock only allows owner to unlock', async () => {
      const pub = (service as any).pub
      pub.get.mockResolvedValue(
        JSON.stringify({ blockId: 'b1', userId: 'u2', userName: 'Bob', lockedAt: 1 })
      )
      await service.unlockBlock(wfId, 'b1', 'u1')
      expect(pub.del).not.toHaveBeenCalled()
    })
  })

  describe('getActiveCollaborators', () => {
    it('returns parsed collaborators from presence hash', async () => {
      const pub = (service as any).pub
      const collab = { userId: 'u1', name: 'Alice', joinedAt: 1 }
      pub.hgetall.mockResolvedValue({ u1: JSON.stringify(collab) })
      const result = await service.getActiveCollaborators(wfId)
      expect(result).toEqual([collab])
    })
  })

  describe('resolveConflict', () => {
    it('deletes lock and publishes conflict event (last-write-wins)', async () => {
      const pub = (service as any).pub
      const resolution = {
        blockId: 'b1',
        winnerId: 'u1',
        winnerName: 'Alice',
        loserId: 'u2',
        timestamp: 1,
      }
      await service.resolveConflict(wfId, resolution)
      expect(pub.del).toHaveBeenCalledWith(`collab:lock:${wfId}:b1`)
      expect(pub.publish).toHaveBeenCalledWith(
        `workflow:${wfId}:changes`,
        expect.stringContaining('"winnerId":"u1"')
      )
    })
  })
})
