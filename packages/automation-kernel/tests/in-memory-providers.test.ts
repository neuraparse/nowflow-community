import { describe, expect, it } from 'vitest'
import {
  type BlockHandler,
  HandlerRegistry,
  InMemoryConsoleProvider,
  InMemoryStateProvider,
  SystemClockProvider,
} from '../src/index'

describe('InMemoryStateProvider', () => {
  it('records active, completed, error blocks and metrics; reset clears all', () => {
    const state = new InMemoryStateProvider()

    state.setActiveBlocks(['a', 'b'])
    state.setCompletedBlock('a', { ok: true })
    state.setErrorBlock('b', new Error('boom'))
    state.setBlockMetrics('a', {
      startedAt: 1,
      endedAt: 2,
      durationMs: 1,
    })

    expect(state.activeBlocks).toEqual(['a', 'b'])
    expect(state.completed.get('a')).toEqual({ ok: true })
    expect(state.errors.get('b')?.message).toBe('boom')
    expect(state.metrics.get('a')?.durationMs).toBe(1)

    state.reset()
    expect(state.activeBlocks).toEqual([])
    expect(state.completed.size).toBe(0)
    expect(state.errors.size).toBe(0)
    expect(state.metrics.size).toBe(0)
  })
})

describe('InMemoryConsoleProvider', () => {
  it('appends, updates, and clears entries', () => {
    const console_ = new InMemoryConsoleProvider()
    console_.append({ id: '1', message: 'hello' })
    console_.append({ id: '2', message: 'world' })
    console_.update('1', { message: 'hi' })

    expect(console_.list()).toHaveLength(2)
    expect(console_.list()[0].message).toBe('hi')

    console_.clear()
    expect(console_.list()).toHaveLength(0)
  })
})

describe('SystemClockProvider', () => {
  it('returns monotonic-ish time from Date.now', () => {
    const clock = new SystemClockProvider()
    const t = clock.now()
    expect(typeof t).toBe('number')
    expect(t).toBeGreaterThan(0)
  })

  it('sleep resolves after the requested delay', async () => {
    const clock = new SystemClockProvider()
    const start = clock.now()
    await clock.sleep(5)
    expect(clock.now() - start).toBeGreaterThanOrEqual(4)
  })

  it('sleep rejects when the signal aborts', async () => {
    const clock = new SystemClockProvider()
    const ctrl = new AbortController()
    const p = clock.sleep(1000, ctrl.signal)
    ctrl.abort()
    await expect(p).rejects.toThrow(/Aborted/)
  })
})

describe('HandlerRegistry', () => {
  const makeHandler = (blockType: string): BlockHandler => ({
    blockType,
    async execute() {
      return { blockType }
    },
  })

  it('registers and looks up handlers', () => {
    const reg = new HandlerRegistry()
    reg.register(makeHandler('http'))
    reg.register(makeHandler('agent'))

    expect(reg.lookup('http')?.blockType).toBe('http')
    expect(reg.lookup('agent')?.blockType).toBe('agent')
    expect(reg.lookup('missing')).toBeUndefined()
    expect(reg.list().sort()).toEqual(['agent', 'http'])
  })

  it('throws on duplicate registration', () => {
    const reg = new HandlerRegistry()
    reg.register(makeHandler('http'))
    expect(() => reg.register(makeHandler('http'))).toThrow(/already registered/)
  })
})
