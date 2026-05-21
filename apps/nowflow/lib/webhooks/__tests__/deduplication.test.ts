import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  generateRequestHash,
  normalizeBody,
  processGenericDeduplication,
  processWhatsAppDeduplication,
} from '../deduplication'

const { hasProcessedMessageMock, markMessageAsProcessedMock } = vi.hoisted(() => ({
  hasProcessedMessageMock: vi.fn(),
  markMessageAsProcessedMock: vi.fn(),
}))

vi.mock('@/lib/redis', () => ({
  hasProcessedMessage: hasProcessedMessageMock,
  markMessageAsProcessed: markMessageAsProcessedMock,
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('next/server', () => {
  class MockNextResponse {
    status: number
    body: string
    constructor(body: string, init?: { status?: number }) {
      this.body = body
      this.status = init?.status ?? 200
    }
  }
  return { NextResponse: MockNextResponse }
})

beforeEach(() => {
  hasProcessedMessageMock.mockReset()
  markMessageAsProcessedMock.mockReset()
})

describe('normalizeBody', () => {
  it('returns primitives untouched', () => {
    expect(normalizeBody(null)).toBe(null)
    expect(normalizeBody(undefined)).toBe(undefined)
    expect(normalizeBody(42)).toBe(42)
    expect(normalizeBody('abc')).toBe('abc')
  })

  it('strips volatile fields at the top level', () => {
    const result = normalizeBody({
      id: 'keep',
      timestamp: 1234,
      nonce: 'abc',
      event_id: 'x',
      event_time: 't',
      random: 'r',
    })
    expect(result).toEqual({ id: 'keep' })
  })

  it('strips volatile fields case-insensitively', () => {
    const result = normalizeBody({ TimeStamp: 1, NONCE: 'x', keep: 'yes' })
    expect(result).toEqual({ keep: 'yes' })
  })

  it('recursively normalizes nested objects', () => {
    const result = normalizeBody({
      outer: { timestamp: 1, inner: { nonce: 'x', value: 'y' } },
      keep: true,
    })
    expect(result).toEqual({ outer: { inner: { value: 'y' } }, keep: true })
  })

  it('normalizes arrays of objects', () => {
    const result = normalizeBody([
      { timestamp: 1, a: 1 },
      { nonce: 'x', b: 2 },
    ])
    expect(result).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('does not mutate the original object', () => {
    const input = { timestamp: 1, keep: 'yes' }
    normalizeBody(input)
    expect(input.timestamp).toBe(1)
  })
})

describe('generateRequestHash', () => {
  it('produces deterministic hashes for equal inputs', async () => {
    const a = await generateRequestHash('/p', { a: 1, b: 2 })
    const b = await generateRequestHash('/p', { a: 1, b: 2 })
    expect(a).toBe(b)
    expect(a).toMatch(/^request:\/p:/)
  })

  it('ignores volatile fields via normalizeBody', async () => {
    const a = await generateRequestHash('/p', { a: 1, timestamp: 111 })
    const b = await generateRequestHash('/p', { a: 1, timestamp: 222 })
    expect(a).toBe(b)
  })

  it('produces different hashes for different paths', async () => {
    const a = await generateRequestHash('/p1', { x: 1 })
    const b = await generateRequestHash('/p2', { x: 1 })
    expect(a).not.toBe(b)
  })

  it('produces different hashes for different bodies', async () => {
    const a = await generateRequestHash('/p', { x: 1 })
    const b = await generateRequestHash('/p', { x: 2 })
    expect(a).not.toBe(b)
  })
})

describe('processWhatsAppDeduplication', () => {
  it('returns null when messages array is empty', async () => {
    const res = await processWhatsAppDeduplication('req-1', [])
    expect(res).toBeNull()
    expect(hasProcessedMessageMock).not.toHaveBeenCalled()
  })

  it('returns null when first message has no id', async () => {
    const res = await processWhatsAppDeduplication('req-1', [{}])
    expect(res).toBeNull()
    expect(hasProcessedMessageMock).not.toHaveBeenCalled()
  })

  it('returns 200 Duplicate when message already processed', async () => {
    hasProcessedMessageMock.mockResolvedValueOnce(true)
    const res = await processWhatsAppDeduplication('req-1', [{ id: 'm1' }])
    expect(res).not.toBeNull()
    expect((res as any).status).toBe(200)
    expect((res as any).body).toBe('Duplicate message')
    expect(markMessageAsProcessedMock).not.toHaveBeenCalled()
  })

  it('marks message as processed and returns null when new', async () => {
    hasProcessedMessageMock.mockResolvedValueOnce(false)
    const res = await processWhatsAppDeduplication('req-1', [{ id: 'm1' }])
    expect(res).toBeNull()
    expect(markMessageAsProcessedMock).toHaveBeenCalledWith('whatsapp:msg:m1', 60 * 60 * 24)
  })

  it('swallows errors and continues', async () => {
    hasProcessedMessageMock.mockRejectedValueOnce(new Error('redis down'))
    const res = await processWhatsAppDeduplication('req-1', [{ id: 'm1' }])
    expect(res).toBeNull()
  })
})

describe('processGenericDeduplication', () => {
  it('returns 200 Duplicate when hash already processed', async () => {
    hasProcessedMessageMock.mockResolvedValueOnce(true)
    const res = await processGenericDeduplication('req-1', '/p', { a: 1 })
    expect(res).not.toBeNull()
    expect((res as any).status).toBe(200)
    expect((res as any).body).toBe('Duplicate request')
  })

  it('marks hash as processed and returns null when new', async () => {
    hasProcessedMessageMock.mockResolvedValueOnce(false)
    const res = await processGenericDeduplication('req-1', '/p', { a: 1 })
    expect(res).toBeNull()
    expect(markMessageAsProcessedMock).toHaveBeenCalledTimes(1)
    const firstArg = markMessageAsProcessedMock.mock.calls[0][0] as string
    expect(firstArg.startsWith('generic:')).toBe(true)
  })

  it('returns null when redis throws', async () => {
    hasProcessedMessageMock.mockRejectedValueOnce(new Error('boom'))
    const res = await processGenericDeduplication('req-1', '/p', { a: 1 })
    expect(res).toBeNull()
  })
})
