/**
 * Exponential-backoff retry utility.
 *
 * Runs `fn` up to `attempts` times. On failure, waits
 * `backoffMs * factor^(attemptIndex)` milliseconds before retrying.
 */

export interface RetryOptions {
  /** Total number of attempts (must be >= 1). */
  attempts: number
  /** Initial backoff delay in milliseconds. */
  backoffMs: number
  /** Multiplier applied to the backoff for each successive retry. */
  factor?: number
  /** Optional predicate to decide whether an error is retryable. */
  shouldRetry?: (err: unknown, attempt: number) => boolean
  /** Optional hook called before each retry. */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { attempts, backoffMs, factor = 2, shouldRetry, onRetry } = options

  if (attempts < 1) {
    throw new Error('retry: `attempts` must be >= 1')
  }

  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const isLast = i === attempts - 1
      if (isLast) break
      if (shouldRetry && !shouldRetry(err, i)) break

      const delay = backoffMs * Math.pow(factor, i)
      if (onRetry) onRetry(err, i, delay)
      await sleep(delay)
    }
  }

  throw lastErr
}
