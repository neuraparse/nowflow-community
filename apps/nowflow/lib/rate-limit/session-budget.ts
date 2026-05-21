/**
 * Per-session tool-call and agent-depth budget.
 *
 * Prevents agent chains and AI builders from exhausting
 * user quotas via runaway tool-call loops or deeply nested agent spawns.
 *
 * Phase -1 S6 scaffold. Not yet wired into all builder paths —
 * that happens in a later phase. Keep the public surface stable.
 */

export type BudgetExhaustedError = Error & { code: 'BUDGET_EXHAUSTED' }

const makeBudgetError = (message: string): BudgetExhaustedError => {
  const e = new Error(message) as BudgetExhaustedError
  e.code = 'BUDGET_EXHAUSTED'
  return e
}

export type BudgetSnapshot = {
  toolCalls: number
  agentDepth: number
  maxToolCalls: number
}

/**
 * In-memory session budget. One instance per user turn / request.
 *
 * - `consumeToolCall()` atomically increments the tool-call counter and
 *   throws `BudgetExhaustedError` once `maxToolCalls` is reached.
 * - `enterAgent()` increments nesting depth and returns a disposer the
 *   caller MUST invoke (e.g. in a `finally`) when the agent frame exits.
 */
export class SessionBudget {
  private toolCalls = 0
  private agentDepth = 0

  constructor(
    private readonly maxToolCalls = 20,
    private readonly maxAgentDepth = 3
  ) {}

  consumeToolCall(): void {
    if (this.toolCalls >= this.maxToolCalls) {
      throw makeBudgetError('tool call budget exhausted')
    }
    this.toolCalls++
  }

  enterAgent(): () => void {
    if (this.agentDepth >= this.maxAgentDepth) {
      throw makeBudgetError('agent nesting depth exceeded')
    }
    this.agentDepth++
    let released = false
    return () => {
      if (released) return
      released = true
      this.agentDepth--
    }
  }

  snapshot(): BudgetSnapshot {
    return {
      toolCalls: this.toolCalls,
      agentDepth: this.agentDepth,
      maxToolCalls: this.maxToolCalls,
    }
  }

  remaining(): number {
    return this.maxToolCalls - this.toolCalls
  }
}

/**
 * Redis-backed variant scaffold.
 *
 * Reuses ioredis (already a dependency) so multiple app replicas share a
 * single authoritative budget keyed by session id. Constructor-compatible
 * with `SessionBudget` so callers can swap implementations based on env.
 *
 * TODO(phase-0): wire the actual Redis INCR / EXPIRE calls. For now this
 * class exists only so the public interface is locked in and imports
 * resolve. Do NOT use in production yet — `consumeToolCall` currently
 * delegates to the in-memory counter.
 */
export class RedisSessionBudget {
  private readonly local: SessionBudget

  constructor(
    private readonly sessionId: string,
    // `redis` is typed loosely to avoid a hard ioredis import in this
    // scaffold; the real implementation will accept `Redis` from ioredis.
    private readonly redis: unknown,
    maxToolCalls = 20,
    maxAgentDepth = 3
  ) {
    this.local = new SessionBudget(maxToolCalls, maxAgentDepth)
    void this.sessionId
    void this.redis
  }

  // TODO(phase-0): replace with an atomic Redis INCR on
  // `session-budget:tool-calls:${sessionId}` guarded by a Lua script that
  // checks against maxToolCalls and sets a TTL on first write.
  async consumeToolCall(): Promise<void> {
    this.local.consumeToolCall()
  }

  // TODO(phase-0): replace with Redis INCR on
  // `session-budget:agent-depth:${sessionId}` plus a matching DECR in
  // the returned disposer. Must tolerate crashed callers (TTL).
  async enterAgent(): Promise<() => Promise<void>> {
    const release = this.local.enterAgent()
    return async () => {
      release()
    }
  }

  snapshot(): BudgetSnapshot {
    return this.local.snapshot()
  }

  remaining(): number {
    return this.local.remaining()
  }
}
