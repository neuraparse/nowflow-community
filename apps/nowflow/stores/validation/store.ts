/**
 * Pre-run validation store.
 *
 * Holds per-block validation results produced when the user clicks Run.
 * Components subscribe to this store to display error indicators on blocks,
 * field-level error messages in the sidebar, and scroll-to-field behaviour.
 *
 * @module stores/validation/store
 */
import { create } from 'zustand'
import type { BlockValidationResult } from '@/executor/validation'
import type { ValidationActions, ValidationState } from './types'

const initialState: ValidationState = {
  blockValidations: {},
  errorBlockIds: new Set(),
  warningBlockIds: new Set(),
  hasErrors: false,
  highlightedField: null,
}

export const useValidationStore = create<ValidationState & ValidationActions>()((set) => ({
  ...initialState,

  setResults: (results: Record<string, BlockValidationResult>) => {
    const errorBlockIds = new Set<string>()
    const warningBlockIds = new Set<string>()

    for (const [blockId, result] of Object.entries(results)) {
      if (!result.valid) {
        errorBlockIds.add(blockId)
      } else if (result.warnings.length > 0) {
        warningBlockIds.add(blockId)
      }
    }

    // Always write fresh results — no equality check.
    // Live validation is already debounced (200ms), so this runs infrequently.
    // Zustand selectors (Object.is) prevent unnecessary component re-renders.
    set({
      blockValidations: results,
      errorBlockIds,
      warningBlockIds,
      hasErrors: errorBlockIds.size > 0,
    })
  },

  clearAll: () => set(initialState),

  clearBlock: (blockId: string) =>
    set((state) => {
      const remaining = { ...state.blockValidations }
      delete remaining[blockId]
      const errorBlockIds = new Set(state.errorBlockIds)
      const warningBlockIds = new Set(state.warningBlockIds)
      errorBlockIds.delete(blockId)
      warningBlockIds.delete(blockId)

      return {
        blockValidations: remaining,
        errorBlockIds,
        warningBlockIds,
        hasErrors: errorBlockIds.size > 0,
        // Clear highlighted field if it belonged to this block
        highlightedField:
          state.highlightedField?.blockId === blockId ? null : state.highlightedField,
      }
    }),

  clearFieldError: (blockId: string, fieldId: string) =>
    set((state) => {
      const blockResult = state.blockValidations[blockId]
      if (!blockResult) return state

      // Remove errors for this specific field only.
      // Warnings are intentionally preserved — they are advisory and should persist
      // until live-validation confirms the issue is resolved via setResults().
      const newErrors = blockResult.errors?.filter((e) => e.field !== fieldId) ?? []
      const newWarnings = blockResult.warnings ?? []

      // Update the block result
      const updatedResult: BlockValidationResult = {
        ...blockResult,
        errors: newErrors,
        warnings: newWarnings,
        valid: newErrors.length === 0,
      }

      // Update error/warning block sets
      const errorBlockIds = new Set(state.errorBlockIds)
      const warningBlockIds = new Set(state.warningBlockIds)

      if (updatedResult.valid && newWarnings.length === 0) {
        errorBlockIds.delete(blockId)
        warningBlockIds.delete(blockId)
      } else if (updatedResult.valid) {
        errorBlockIds.delete(blockId)
        warningBlockIds.add(blockId)
      } else {
        errorBlockIds.add(blockId)
      }

      return {
        blockValidations: {
          ...state.blockValidations,
          [blockId]: updatedResult,
        },
        errorBlockIds,
        warningBlockIds,
        hasErrors: errorBlockIds.size > 0,
        // Clear highlighted field if it was this field
        highlightedField:
          state.highlightedField?.blockId === blockId && state.highlightedField?.fieldId === fieldId
            ? null
            : state.highlightedField,
      }
    }),

  setHighlightedField: (blockId: string, fieldId: string) =>
    set({ highlightedField: { blockId, fieldId } }),

  clearHighlightedField: () => set({ highlightedField: null }),
}))
