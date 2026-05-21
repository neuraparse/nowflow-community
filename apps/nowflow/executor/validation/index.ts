/**
 * Block input validation public API.
 *
 * Usage:
 *   import { validateBlockInputs } from '@/executor/validation'
 *
 *   const result = validateBlockInputs(block, resolvedInputs)
 *   if (!result.valid) {
 *     // Handle errors
 *   }
 *
 * @module executor/validation
 */
import type { SerializedBlock } from '@/serializer/types'
import { ValidationEngine } from './validation-engine'
import type { BlockValidationResult, ValidationIssue } from './validation-result'

// Singleton engine instance (schemas are cached internally)
const engine = new ValidationEngine()

/**
 * Validates resolved inputs for a block before execution.
 *
 * @param block - The serialized block being executed
 * @param inputs - Resolved input values (after reference/env-var substitution)
 * @returns Validation result with errors (blocking) and warnings (non-blocking)
 */
export function validateBlockInputs(
  block: SerializedBlock,
  inputs: Record<string, any>
): BlockValidationResult {
  return engine.validateInputs(block, inputs)
}

/**
 * Formats validation errors into a single human-readable string.
 * Useful for throwing Error messages.
 */
export function formatValidationErrors(result: BlockValidationResult): string {
  if (result.valid) return ''

  return result.errors
    .map((e) => `[${e.field}] ${e.message}${e.suggestion ? ` (${e.suggestion})` : ''}`)
    .join('; ')
}

// Re-export types
export type { BlockValidationResult, ValidationIssue }
export { ValidationEngine }
