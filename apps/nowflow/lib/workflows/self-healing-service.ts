import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('SelfHealing')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Recovery strategies the self-healing system can apply to a failed block. */
export type RecoveryAction = 'skip' | 'retry' | 'fallback' | 'alternate_path' | 'ai_fix'

/** Configuration for the retry strategy applied to a block execution. */
export interface RetryStrategy {
  /** Maximum number of retry attempts before giving up. */
  maxRetries: number
  /** Base delay in milliseconds for exponential backoff. */
  baseDelayMs: number
  /** Maximum delay cap in milliseconds. */
  maxDelayMs: number
  /** Multiplier applied on each successive retry. */
  backoffMultiplier: number
  /** Maximum random jitter in milliseconds added to each delay. */
  jitterMs: number
}

/** Circuit breaker state machine states. */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

/** Configuration for the circuit breaker. */
export interface CircuitBreakerConfig {
  /** Number of failures before the circuit opens. */
  failureThreshold: number
  /** Time in milliseconds before an open circuit transitions to half-open. */
  resetTimeoutMs: number
  /** Number of successful calls in half-open state to close the circuit. */
  halfOpenSuccessThreshold: number
}

/** Structured suggestion returned by AI error analysis. */
export interface ErrorAnalysisSuggestion {
  category: 'auth' | 'rate_limit' | 'timeout' | 'schema' | 'network' | 'unknown'
  message: string
  suggestedAction: RecoveryAction
  confidence: number // 0-1
  details?: string
}

/** Options for executing a block with self-healing. */
export interface SelfHealingOptions {
  blockId: string
  blockType: string
  retry?: Partial<RetryStrategy>
  recovery?: RecoveryAction
  fallbackValue?: unknown
  onAlternatePath?: (error: Error) => Promise<unknown>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_RETRY: RetryStrategy = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  jitterMs: 200,
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  halfOpenSuccessThreshold: 2,
}

/** Returns true when the error is transient and worth retrying. */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return true

  const msg = error.message.toLowerCase()

  // Validation / programming errors should not be retried
  const nonRetryable = [
    'validation',
    'invalid argument',
    'type error',
    'syntax error',
    'missing required',
    'not found',
    'permission denied',
    'unauthorized',
    'forbidden',
  ]
  if (nonRetryable.some((term) => msg.includes(term))) return false

  // Explicitly retryable signals
  const retryable = [
    'timeout',
    'timed out',
    'econnreset',
    'econnrefused',
    'enotfound',
    'network',
    'socket hang up',
    'rate limit',
    'too many requests',
    '429',
    '502',
    '503',
    '504',
    'fetch failed',
    'abort',
  ]
  if (retryable.some((term) => msg.includes(term))) return true

  // Check for HTTP status codes on the error object
  const status = (error as any).status ?? (error as any).statusCode
  if (typeof status === 'number') {
    return status === 429 || (status >= 500 && status <= 599)
  }

  // Default: treat unknown errors as retryable (fail open)
  return true
}

/** Compute delay for attempt `n` (0-indexed) using exponential backoff + jitter. */
export function computeBackoffDelay(attempt: number, strategy: RetryStrategy): number {
  const exponential = strategy.baseDelayMs * Math.pow(strategy.backoffMultiplier, attempt)
  const capped = Math.min(exponential, strategy.maxDelayMs)
  const jitter = Math.random() * strategy.jitterMs
  return capped + jitter
}

/** Pause execution for the given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

/**
 * Tracks failure/success rates for a single block type and short-circuits
 * execution when the failure rate exceeds the configured threshold.
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private successCount = 0
  private lastFailureTime = 0
  private config: CircuitBreakerConfig

  constructor(
    public readonly blockType: string,
    config?: Partial<CircuitBreakerConfig>
  ) {
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config }
  }

  /** Current state of the circuit. */
  getState(): CircuitState {
    // Automatically transition OPEN -> HALF_OPEN after timeout
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime
      if (elapsed >= this.config.resetTimeoutMs) {
        this.state = 'HALF_OPEN'
        this.successCount = 0
        logger.info(`Circuit for "${this.blockType}" transitioned to HALF_OPEN after timeout`)
      }
    }
    return this.state
  }

  /** Returns true if the circuit currently allows execution. */
  canExecute(): boolean {
    const current = this.getState()
    return current !== 'OPEN'
  }

  /** Record a successful execution. */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++
      if (this.successCount >= this.config.halfOpenSuccessThreshold) {
        this.state = 'CLOSED'
        this.failureCount = 0
        this.successCount = 0
        logger.info(`Circuit for "${this.blockType}" closed after recovery`)
      }
    } else {
      // In CLOSED state, reset failure count on success
      this.failureCount = Math.max(0, this.failureCount - 1)
    }
  }

  /** Record a failed execution. */
  recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open immediately reopens
      this.state = 'OPEN'
      logger.warn(`Circuit for "${this.blockType}" reopened after half-open failure`)
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN'
      logger.warn(`Circuit for "${this.blockType}" opened after ${this.failureCount} failures`)
    }
  }

  /** Reset the circuit breaker to its initial state. */
  reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = 0
  }

  /** Return diagnostic information about the circuit. */
  getStats(): {
    state: CircuitState
    failureCount: number
    successCount: number
    blockType: string
  } {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      blockType: this.blockType,
    }
  }
}

// ---------------------------------------------------------------------------
// AI-Powered Error Analysis
// ---------------------------------------------------------------------------

interface ErrorPattern {
  pattern: RegExp
  category: ErrorAnalysisSuggestion['category']
  message: string
  action: RecoveryAction
  confidence: number
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /unauthorized|401|invalid.*(?:api[_ ]?key|token|credentials)/i,
    category: 'auth',
    message:
      'Authentication failure detected. Verify API keys and credentials are valid and not expired.',
    action: 'alternate_path',
    confidence: 0.9,
  },
  {
    pattern: /forbidden|403|access denied|permission/i,
    category: 'auth',
    message:
      'Authorization failure. The credentials may lack the required permissions for this operation.',
    action: 'alternate_path',
    confidence: 0.85,
  },
  {
    pattern: /rate limit|429|too many requests|throttl/i,
    category: 'rate_limit',
    message: 'Rate limit exceeded. Retry with exponential backoff after a cooldown period.',
    action: 'retry',
    confidence: 0.95,
  },
  {
    pattern: /timeout|timed out|deadline exceeded|econnaborted/i,
    category: 'timeout',
    message:
      'Request timed out. Consider increasing the timeout or breaking the request into smaller chunks.',
    action: 'retry',
    confidence: 0.85,
  },
  {
    pattern:
      /invalid.*schema|validation.*(?:failed|error)|missing.*(?:required|field)|type.*(?:error|mismatch)/i,
    category: 'schema',
    message:
      'Input validation or schema mismatch. Check that the data conforms to the expected format.',
    action: 'ai_fix',
    confidence: 0.8,
  },
  {
    pattern: /econnrefused|econnreset|enotfound|network|socket hang up|dns|fetch failed/i,
    category: 'network',
    message: 'Network connectivity issue. Verify the target service is reachable and retry.',
    action: 'retry',
    confidence: 0.9,
  },
  {
    pattern: /50[0-4]|internal server error|bad gateway|service unavailable|gateway timeout/i,
    category: 'network',
    message:
      'Upstream server error. The target service may be experiencing issues; retry after a delay.',
    action: 'retry',
    confidence: 0.8,
  },
]

/**
 * Analyze an error message and return structured suggestions for resolution.
 * Uses pattern matching against common error categories.
 */
export function analyzeError(error: unknown): ErrorAnalysisSuggestion {
  const message = error instanceof Error ? error.message : String(error)

  for (const entry of ERROR_PATTERNS) {
    if (entry.pattern.test(message)) {
      return {
        category: entry.category,
        message: entry.message,
        suggestedAction: entry.action,
        confidence: entry.confidence,
        details: `Matched pattern for "${entry.category}". Original error: ${message}`,
      }
    }
  }

  return {
    category: 'unknown',
    message: 'Unrecognized error. Consider using a fallback value or skipping this block.',
    suggestedAction: 'fallback',
    confidence: 0.3,
    details: `No known pattern matched. Original error: ${message}`,
  }
}

/**
 * Generate an AI-style fix suggestion for a given error.
 * This uses heuristic pattern matching rather than a live LLM call so it
 * works offline and has zero latency.
 */
export function suggestFix(error: unknown, blockType: string): string {
  const analysis = analyzeError(error)

  const tips: Record<ErrorAnalysisSuggestion['category'], string> = {
    auth: `Check the credentials configured on your "${blockType}" block. Ensure the API key or OAuth token has not expired and has the required scopes.`,
    rate_limit: `The "${blockType}" block is hitting rate limits. Add a delay between calls or reduce the request volume. Consider caching responses where possible.`,
    timeout: `The "${blockType}" block timed out. Increase the timeout setting, optimize the upstream service, or reduce the payload size.`,
    schema: `The input to the "${blockType}" block does not match the expected schema. Verify field names, types, and required properties in the block configuration.`,
    network: `A network error occurred in the "${blockType}" block. Verify the URL, check DNS resolution, and confirm the target service is running.`,
    unknown: `An unexpected error occurred in the "${blockType}" block. Review the full error message and block configuration for issues.`,
  }

  return tips[analysis.category]
}

// ---------------------------------------------------------------------------
// Self-Healing Service
// ---------------------------------------------------------------------------

/**
 * Orchestrates auto-retry, circuit breaking, and error recovery for workflow
 * block execution. Designed to wrap around the core executor's per-block call.
 */
export class SelfHealingService {
  private circuitBreakers = new Map<string, CircuitBreaker>()

  constructor(private defaultCircuitConfig?: Partial<CircuitBreakerConfig>) {}

  /**
   * Retrieve or create the circuit breaker for a given block type.
   */
  getCircuitBreaker(blockType: string): CircuitBreaker {
    let cb = this.circuitBreakers.get(blockType)
    if (!cb) {
      cb = new CircuitBreaker(blockType, this.defaultCircuitConfig)
      this.circuitBreakers.set(blockType, cb)
    }
    return cb
  }

  /**
   * Execute an async operation with self-healing protection.
   *
   * The method applies the following pipeline:
   * 1. Check circuit breaker — if open, apply recovery action immediately.
   * 2. Attempt execution with auto-retry and exponential backoff.
   * 3. On exhausted retries, apply the configured recovery strategy.
   */
  async execute<T>(
    fn: () => Promise<T>,
    options: SelfHealingOptions
  ): Promise<{ result: T | null; healed: boolean; action?: RecoveryAction; error?: Error }> {
    const { blockId, blockType, recovery = 'retry' } = options
    const retryConfig: RetryStrategy = { ...DEFAULT_RETRY, ...options.retry }
    const cb = this.getCircuitBreaker(blockType)

    // --- Circuit breaker check ---
    if (!cb.canExecute()) {
      logger.warn(
        `Circuit open for block type "${blockType}", applying recovery for block ${blockId}`
      )
      return this.applyRecovery(
        null,
        new Error(`Circuit open for block type "${blockType}"`),
        options
      )
    }

    // --- Retry loop ---
    let lastError: Error | undefined
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const result = await fn()
        cb.recordSuccess()
        return { result, healed: attempt > 0, action: attempt > 0 ? 'retry' : undefined }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        // Non-retryable errors skip straight to recovery
        if (!isRetryableError(lastError)) {
          logger.info(
            `Non-retryable error on block ${blockId} (${blockType}): ${lastError.message}`
          )
          cb.recordFailure()
          break
        }

        if (attempt < retryConfig.maxRetries) {
          const delay = computeBackoffDelay(attempt, retryConfig)
          logger.info(
            `Retrying block ${blockId} (${blockType}) — attempt ${attempt + 1}/${retryConfig.maxRetries}, backoff ${Math.round(delay)}ms`
          )
          await sleep(delay)
        } else {
          cb.recordFailure()
          logger.warn(
            `All ${retryConfig.maxRetries} retries exhausted for block ${blockId} (${blockType})`
          )
        }
      }
    }

    // --- Recovery ---
    return this.applyRecovery(null, lastError!, options)
  }

  /**
   * Apply the configured recovery strategy after all retries are exhausted
   * or the circuit breaker is open.
   */
  private async applyRecovery<T>(
    _result: T | null,
    error: Error,
    options: SelfHealingOptions
  ): Promise<{ result: T | null; healed: boolean; action: RecoveryAction; error?: Error }> {
    const { blockId, blockType, recovery = 'retry' } = options

    switch (recovery) {
      case 'skip':
        logger.info(`Skipping failed block ${blockId} (${blockType})`)
        return { result: null, healed: true, action: 'skip' }

      case 'fallback':
        logger.info(`Using fallback value for block ${blockId} (${blockType})`)
        return {
          result: (options.fallbackValue ?? null) as T | null,
          healed: true,
          action: 'fallback',
        }

      case 'alternate_path':
        if (options.onAlternatePath) {
          logger.info(`Routing block ${blockId} (${blockType}) to alternate path`)
          try {
            const altResult = await options.onAlternatePath(error)
            return { result: altResult as T, healed: true, action: 'alternate_path' }
          } catch (altError) {
            logger.error(`Alternate path also failed for block ${blockId}:`, altError)
            return { result: null, healed: false, action: 'alternate_path', error }
          }
        }
        return { result: null, healed: false, action: 'alternate_path', error }

      case 'ai_fix': {
        const suggestion = analyzeError(error)
        const fix = suggestFix(error, blockType)
        logger.info(
          `AI analysis for block ${blockId} (${blockType}): [${suggestion.category}] ${fix}`
        )
        // AI fix provides diagnostic info but cannot auto-resolve; return the error
        return { result: null, healed: false, action: 'ai_fix', error }
      }

      case 'retry':
      default:
        // Retries already exhausted — nothing more to do
        return { result: null, healed: false, action: 'retry', error }
    }
  }

  /** Reset the circuit breaker for a specific block type. */
  resetCircuit(blockType: string): void {
    this.circuitBreakers.get(blockType)?.reset()
  }

  /** Reset all circuit breakers. */
  resetAll(): void {
    this.circuitBreakers.forEach((cb) => cb.reset())
  }

  /** Return diagnostic stats for all tracked circuit breakers. */
  getStats(): Record<string, ReturnType<CircuitBreaker['getStats']>> {
    const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {}
    this.circuitBreakers.forEach((cb, type) => {
      stats[type] = cb.getStats()
    })
    return stats
  }
}
