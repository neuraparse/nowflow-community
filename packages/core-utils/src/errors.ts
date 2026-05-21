/**
 * Canonical error classes for L1 primitives.
 *
 * All errors inherit from `NowFlowError` which carries a stable `code`
 * for machine-readable error handling across layers.
 */

export class NowFlowError extends Error {
  public readonly code: string
  public readonly details?: Record<string, unknown>

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'NowFlowError'
    this.code = code
    this.details = details
    // Maintain prototype chain for `instanceof` across transpilation targets.
    Object.setPrototypeOf(this, new.target.prototype)
  }

  /**
   * Serialize to a plain object for JSON.stringify. `Error.prototype.message`
   * and `name` are non-enumerable, so without this method JSON.stringify(err)
   * would silently drop them. Include them explicitly here.
   */
  toJSON(): { name: string; code: string; message: string; details?: Record<string, unknown> } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    }
  }
}

export class BudgetExhaustedError extends NowFlowError {
  constructor(message = 'Budget exhausted', details?: Record<string, unknown>) {
    super('BUDGET_EXHAUSTED', message, details)
    this.name = 'BudgetExhaustedError'
  }
}

export class ValidationError extends NowFlowError {
  constructor(message = 'Validation failed', details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, details)
    this.name = 'ValidationError'
  }
}

export class AuthError extends NowFlowError {
  constructor(
    message = 'Authentication or authorization failed',
    details?: Record<string, unknown>
  ) {
    super('AUTH_ERROR', message, details)
    this.name = 'AuthError'
  }
}
