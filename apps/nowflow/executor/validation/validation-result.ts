/**
 * Validation result types for block input validation.
 *
 * @module executor/validation/validation-result
 */

export interface ValidationIssue {
  /** The input field that failed validation */
  field: string
  /** Human-readable error/warning message */
  message: string
  /** Zod error code or custom code */
  code?: string
  /** Suggested fix for the issue */
  suggestion?: string
}

export interface BlockValidationResult {
  /** Whether all required validations passed */
  valid: boolean
  /** Critical issues that must be fixed (required fields missing, invalid types) */
  errors: ValidationIssue[]
  /** Non-critical issues (optional fields with invalid values, recommendations) */
  warnings: ValidationIssue[]
}

/**
 * Creates a passing validation result with no issues.
 */
export function validResult(): BlockValidationResult {
  return { valid: true, errors: [], warnings: [] }
}

/**
 * Merges multiple validation results into one.
 */
export function mergeResults(...results: BlockValidationResult[]): BlockValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  for (const result of results) {
    errors.push(...result.errors)
    warnings.push(...result.warnings)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
