/**
 * Validation store types for pre-run block validation.
 *
 * @module stores/validation/types
 */
import type { BlockValidationResult } from '@/executor/validation'

export interface ValidationState {
  /** Per-block validation results (only blocks with issues) */
  blockValidations: Record<string, BlockValidationResult>
  /** Blocks with validation errors (blocking execution) */
  errorBlockIds: Set<string>
  /** Blocks with warnings only (non-blocking) */
  warningBlockIds: Set<string>
  /** Whether any block has validation errors */
  hasErrors: boolean
  /** Field to highlight/scroll-to when sidebar opens */
  highlightedField: { blockId: string; fieldId: string } | null
}

export interface ValidationActions {
  /** Set validation results for all blocks */
  setResults: (results: Record<string, BlockValidationResult>) => void
  /** Clear all validation state */
  clearAll: () => void
  /** Clear validation for a specific block (e.g., when user edits a field) */
  clearBlock: (blockId: string) => void
  /** Clear validation errors/warnings for a specific field within a block */
  clearFieldError: (blockId: string, fieldId: string) => void
  /** Set the field to highlight/scroll-to */
  setHighlightedField: (blockId: string, fieldId: string) => void
  /** Clear the highlighted field */
  clearHighlightedField: () => void
}
