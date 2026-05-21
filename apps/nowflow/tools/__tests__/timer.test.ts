import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { timerTool } from '../timer/tool'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const exec = (params: any) => (timerTool as any).directExecution(params)

describe('timerTool config', () => {
  it('has expected metadata', () => {
    expect(timerTool.id).toBe('timer')
    expect(timerTool.name).toBe('Timer')
    expect(typeof timerTool.directExecution).toBe('function')
  })
})

describe('timerTool directExecution', () => {
  beforeEach(() => {
    // Stub setTimeout to resolve immediately so tests don't actually wait
    vi.stubGlobal('setTimeout', ((fn: () => void) => {
      fn()
      return 0 as any
    }) as any)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('executes a fixed delay and returns content message', async () => {
    const result = await exec({ delayType: 'fixed', duration: 1, unit: 's' })
    expect(result.success).toBe(true)
    expect(result.output.actualDelay).toBeGreaterThan(0)
    expect(result.output.actualDelay).toBeLessThanOrEqual(30 * 1000)
    expect(result.output.content).toMatch(/Waited for/)
  })

  it('clamps delay to 30s max for safety', async () => {
    // 100 seconds requested, should be clamped to 30s
    const result = await exec({ delayType: 'fixed', duration: 100, unit: 's' })
    expect(result.output.actualDelay).toBe(30 * 1000)
  })

  it('supports custom message', async () => {
    const result = await exec({ delayType: 'fixed', duration: 1, unit: 'ms', message: 'Hi' })
    expect(result.output.content).toBe('Hi')
  })

  it('handles until_date in the past (delay clamps to 0)', async () => {
    const result = await exec({
      delayType: 'until_date',
      targetDate: '2000-01-01T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
    expect(result.output.actualDelay).toBe(0)
  })

  it('supports random delay between min and max durations', async () => {
    const result = await exec({
      delayType: 'random',
      duration: 1,
      maxDuration: 2,
      unit: 'ms',
    })
    expect(result.success).toBe(true)
    expect(result.output.actualDelay).toBeGreaterThanOrEqual(0)
  })

  it('converts units correctly: minutes', async () => {
    // Request 1 minute but it will clamp to 30s (safety). Still verifies the path.
    const result = await exec({ delayType: 'fixed', duration: 1, unit: 'm' })
    expect(result.output.actualDelay).toBe(30 * 1000)
    expect(result.output.delayUnit).toBe('m')
  })

  it('defaults to fixed delay when no delayType given', async () => {
    const result = await exec({ duration: 10, unit: 'ms' })
    expect(result.success).toBe(true)
  })

  it('includes ISO start/end timestamps', async () => {
    const result = await exec({ delayType: 'fixed', duration: 1, unit: 'ms' })
    expect(() => new Date(result.output.startTime).toISOString()).not.toThrow()
    expect(() => new Date(result.output.endTime).toISOString()).not.toThrow()
  })
})
