/**
 * @vitest-environment jsdom
 *
 * Self-Healing Service Tests
 *
 * Tests for retry strategies, circuit breaker state machine, error analysis,
 * and the self-healing execution pipeline.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  analyzeError,
  CircuitBreaker,
  computeBackoffDelay,
  isRetryableError,
  SelfHealingService,
  suggestFix,
} from '../self-healing-service'
import type { RetryStrategy } from '../self-healing-service'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// ---------------------------------------------------------------------------
// computeBackoffDelay
// ---------------------------------------------------------------------------

describe('computeBackoffDelay', () => {
  const strategy: RetryStrategy = {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterMs: 0,
  }

  it('should calculate exponential backoff for each attempt', () => {
    const d0 = computeBackoffDelay(0, strategy) // 100 * 2^0 = 100
    const d1 = computeBackoffDelay(1, strategy) // 100 * 2^1 = 200
    const d2 = computeBackoffDelay(2, strategy) // 100 * 2^2 = 400

    expect(d0).toBe(100)
    expect(d1).toBe(200)
    expect(d2).toBe(400)
  })

  it('should cap delay at maxDelayMs', () => {
    const delay = computeBackoffDelay(10, strategy) // 100 * 2^10 = 102400, capped to 5000
    expect(delay).toBe(5000)
  })

  it('should add jitter up to jitterMs', () => {
    const withJitter: RetryStrategy = { ...strategy, jitterMs: 200 }
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const delay = computeBackoffDelay(0, withJitter) // 100 + 0.5 * 200 = 200
    expect(delay).toBe(200)

    vi.spyOn(Math, 'random').mockRestore()
  })
})

// ---------------------------------------------------------------------------
// isRetryableError
// ---------------------------------------------------------------------------

describe('isRetryableError', () => {
  it('should treat non-Error values as retryable', () => {
    expect(isRetryableError('some string')).toBe(true)
    expect(isRetryableError(null)).toBe(true)
  })

  it.each([
    'ECONNRESET',
    'ECONNREFUSED',
    'ENOTFOUND',
    'network error',
    'socket hang up',
    'fetch failed',
    'timeout',
    'timed out',
  ])('should treat network/transient error "%s" as retryable', (msg) => {
    expect(isRetryableError(new Error(msg))).toBe(true)
  })

  it.each(['rate limit exceeded', 'too many requests', '429'])(
    'should treat rate-limit error "%s" as retryable',
    (msg) => {
      expect(isRetryableError(new Error(msg))).toBe(true)
    }
  )

  it.each([
    'validation failed',
    'invalid argument',
    'type error in config',
    'syntax error',
    'missing required field',
    'not found',
    'permission denied',
    'unauthorized',
    'forbidden',
  ])('should treat non-retryable error "%s" as not retryable', (msg) => {
    expect(isRetryableError(new Error(msg))).toBe(false)
  })

  it('should check status code on error object', () => {
    const err429 = Object.assign(new Error('request failed'), { status: 429 })
    const err500 = Object.assign(new Error('server error'), { status: 500 })
    const err400 = Object.assign(new Error('bad request'), { status: 400 })

    expect(isRetryableError(err429)).toBe(true)
    expect(isRetryableError(err500)).toBe(true)
    expect(isRetryableError(err400)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CircuitBreaker
// ---------------------------------------------------------------------------

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker

  beforeEach(() => {
    vi.useFakeTimers()
    cb = new CircuitBreaker('test-block', {
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenSuccessThreshold: 2,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should start in CLOSED state', () => {
    expect(cb.getState()).toBe('CLOSED')
    expect(cb.canExecute()).toBe(true)
  })

  it('should transition CLOSED -> OPEN after reaching failure threshold', () => {
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.getState()).toBe('CLOSED')

    cb.recordFailure() // threshold = 3
    expect(cb.getState()).toBe('OPEN')
    expect(cb.canExecute()).toBe(false)
  })

  it('should transition OPEN -> HALF_OPEN after reset timeout', () => {
    // Open the circuit
    cb.recordFailure()
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.getState()).toBe('OPEN')

    // Advance time past the reset timeout
    vi.advanceTimersByTime(1001)
    expect(cb.getState()).toBe('HALF_OPEN')
    expect(cb.canExecute()).toBe(true)
  })

  it('should transition HALF_OPEN -> CLOSED after enough successes', () => {
    // Open then half-open
    cb.recordFailure()
    cb.recordFailure()
    cb.recordFailure()
    vi.advanceTimersByTime(1001)
    expect(cb.getState()).toBe('HALF_OPEN')

    cb.recordSuccess()
    expect(cb.getState()).toBe('HALF_OPEN')

    cb.recordSuccess() // threshold = 2
    expect(cb.getState()).toBe('CLOSED')
  })

  it('should reopen from HALF_OPEN on any failure', () => {
    cb.recordFailure()
    cb.recordFailure()
    cb.recordFailure()
    vi.advanceTimersByTime(1001)
    expect(cb.getState()).toBe('HALF_OPEN')

    cb.recordFailure()
    expect(cb.getState()).toBe('OPEN')
  })

  it('should decrement failure count on success in CLOSED state', () => {
    cb.recordFailure()
    cb.recordFailure()
    cb.recordSuccess() // failureCount 2 -> 1
    cb.recordFailure() // failureCount 1 -> 2
    expect(cb.getState()).toBe('CLOSED') // still below threshold of 3
  })

  it('should reset to initial state', () => {
    cb.recordFailure()
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.getState()).toBe('OPEN')

    cb.reset()
    expect(cb.getState()).toBe('CLOSED')
    expect(cb.getStats().failureCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// SelfHealingService.execute
// ---------------------------------------------------------------------------

describe('SelfHealingService', () => {
  let service: SelfHealingService

  beforeEach(() => {
    vi.useFakeTimers()
    service = new SelfHealingService({ failureThreshold: 3, resetTimeoutMs: 1000 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return result on successful execution', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const res = await service.execute(fn, { blockId: 'b1', blockType: 'api' })

    expect(res.result).toBe('ok')
    expect(res.healed).toBe(false)
    expect(res.action).toBeUndefined()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry and mark healed on transient failure then success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('recovered')

    const promise = service.execute(fn, {
      blockId: 'b1',
      blockType: 'api',
      retry: { maxRetries: 2, baseDelayMs: 10, jitterMs: 0 },
    })

    // Advance past the backoff delay
    await vi.advanceTimersByTimeAsync(50)
    const res = await promise

    expect(res.result).toBe('recovered')
    expect(res.healed).toBe(true)
    expect(res.action).toBe('retry')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should skip block when recovery is "skip"', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('validation failed'))

    const res = await service.execute(fn, {
      blockId: 'b1',
      blockType: 'api',
      recovery: 'skip',
      retry: { maxRetries: 0 },
    })

    expect(res.result).toBeNull()
    expect(res.healed).toBe(true)
    expect(res.action).toBe('skip')
  })

  it('should use fallback value when recovery is "fallback"', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('validation error'))

    const res = await service.execute(fn, {
      blockId: 'b1',
      blockType: 'api',
      recovery: 'fallback',
      fallbackValue: { default: true },
      retry: { maxRetries: 0 },
    })

    expect(res.result).toEqual({ default: true })
    expect(res.healed).toBe(true)
    expect(res.action).toBe('fallback')
  })

  it('should block execution when circuit breaker is open', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('timeout'))
    const opts = {
      blockId: 'b1',
      blockType: 'api',
      recovery: 'skip' as const,
      retry: { maxRetries: 0 },
    }

    // Trip the circuit breaker (threshold = 3)
    await service.execute(fn, opts)
    await service.execute(fn, opts)
    await service.execute(fn, opts)

    const cb = service.getCircuitBreaker('api')
    expect(cb.getState()).toBe('OPEN')

    // Next call should be blocked by the circuit breaker
    fn.mockResolvedValue('should not run')
    const res = await service.execute(fn, opts)
    expect(res.action).toBe('skip')
    expect(res.result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// analyzeError
// ---------------------------------------------------------------------------

describe('analyzeError', () => {
  it('should detect auth errors', () => {
    const result = analyzeError(new Error('unauthorized access'))
    expect(result.category).toBe('auth')
    expect(result.suggestedAction).toBe('alternate_path')
  })

  it('should detect rate limit errors', () => {
    const result = analyzeError(new Error('429 too many requests'))
    expect(result.category).toBe('rate_limit')
    expect(result.suggestedAction).toBe('retry')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('should detect timeout errors', () => {
    const result = analyzeError(new Error('request timed out'))
    expect(result.category).toBe('timeout')
    expect(result.suggestedAction).toBe('retry')
  })

  it('should detect schema errors', () => {
    const result = analyzeError(new Error('validation failed: missing field'))
    expect(result.category).toBe('schema')
    expect(result.suggestedAction).toBe('ai_fix')
  })

  it('should return unknown for unrecognized errors', () => {
    const result = analyzeError(new Error('something completely different'))
    expect(result.category).toBe('unknown')
    expect(result.suggestedAction).toBe('fallback')
    expect(result.confidence).toBeLessThan(0.5)
  })

  it('should handle non-Error values', () => {
    const result = analyzeError('a plain string error')
    expect(result.category).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------
// suggestFix
// ---------------------------------------------------------------------------

describe('suggestFix', () => {
  it('should suggest credential check for auth errors', () => {
    const tip = suggestFix(new Error('401 invalid api key'), 'http_request')
    expect(tip).toContain('http_request')
    expect(tip).toContain('API key')
  })

  it('should suggest delay for rate limit errors', () => {
    const tip = suggestFix(new Error('rate limit exceeded'), 'webhook')
    expect(tip).toContain('webhook')
    expect(tip).toContain('rate limit')
  })

  it('should suggest timeout increase for timeout errors', () => {
    const tip = suggestFix(new Error('request timed out'), 'llm_call')
    expect(tip).toContain('llm_call')
    expect(tip).toContain('timeout')
  })

  it('should suggest schema review for schema errors', () => {
    const tip = suggestFix(new Error('validation failed'), 'transform')
    expect(tip).toContain('transform')
    expect(tip).toContain('schema')
  })

  it('should return generic suggestion for unknown errors', () => {
    const tip = suggestFix(new Error('wat'), 'custom_block')
    expect(tip).toContain('custom_block')
    expect(tip).toContain('unexpected error')
  })
})
