import { beforeEach, describe, expect, it } from 'vitest'
import { useValidationStore } from '@/stores/validation/store'
import type { BlockValidationResult } from '@/executor/validation'

const makeResult = (overrides: Partial<BlockValidationResult> = {}): BlockValidationResult => ({
  valid: true,
  errors: [],
  warnings: [],
  ...overrides,
})

describe('useValidationStore', () => {
  beforeEach(() => {
    // Merge-reset so action functions are preserved on the store.
    useValidationStore.setState({
      blockValidations: {},
      errorBlockIds: new Set<string>(),
      warningBlockIds: new Set<string>(),
      hasErrors: false,
      highlightedField: null,
    })
  })

  describe('initial state', () => {
    it('starts with empty validations and no highlighted field', () => {
      const state = useValidationStore.getState()
      expect(state.blockValidations).toEqual({})
      expect(state.errorBlockIds.size).toBe(0)
      expect(state.warningBlockIds.size).toBe(0)
      expect(state.hasErrors).toBe(false)
      expect(state.highlightedField).toBeNull()
    })
  })

  describe('setResults', () => {
    it('records blocks with errors into errorBlockIds and sets hasErrors', () => {
      const results: Record<string, BlockValidationResult> = {
        'block-a': makeResult({
          valid: false,
          errors: [{ field: 'apiKey', message: 'Required' }],
        }),
        'block-b': makeResult({ valid: true }),
      }

      useValidationStore.getState().setResults(results)
      const state = useValidationStore.getState()

      expect(state.blockValidations).toEqual(results)
      expect(state.errorBlockIds.has('block-a')).toBe(true)
      expect(state.errorBlockIds.has('block-b')).toBe(false)
      expect(state.warningBlockIds.size).toBe(0)
      expect(state.hasErrors).toBe(true)
    })

    it('records warning-only blocks into warningBlockIds without setting hasErrors', () => {
      const results: Record<string, BlockValidationResult> = {
        'block-a': makeResult({
          valid: true,
          warnings: [{ field: 'model', message: 'Using deprecated model' }],
        }),
      }

      useValidationStore.getState().setResults(results)
      const state = useValidationStore.getState()

      expect(state.errorBlockIds.size).toBe(0)
      expect(state.warningBlockIds.has('block-a')).toBe(true)
      expect(state.hasErrors).toBe(false)
    })

    it('prefers errors over warnings when a block has both', () => {
      const results: Record<string, BlockValidationResult> = {
        'block-a': makeResult({
          valid: false,
          errors: [{ field: 'apiKey', message: 'Required' }],
          warnings: [{ field: 'model', message: 'Deprecated' }],
        }),
      }

      useValidationStore.getState().setResults(results)
      const state = useValidationStore.getState()

      expect(state.errorBlockIds.has('block-a')).toBe(true)
      expect(state.warningBlockIds.has('block-a')).toBe(false)
      expect(state.hasErrors).toBe(true)
    })

    it('replaces prior results when called again', () => {
      useValidationStore.getState().setResults({
        'block-a': makeResult({ valid: false, errors: [{ field: 'f', message: 'm' }] }),
      })

      useValidationStore.getState().setResults({
        'block-b': makeResult({
          valid: true,
          warnings: [{ field: 'w', message: 'warn' }],
        }),
      })
      const state = useValidationStore.getState()

      expect(state.blockValidations['block-a']).toBeUndefined()
      expect(state.errorBlockIds.has('block-a')).toBe(false)
      expect(state.warningBlockIds.has('block-b')).toBe(true)
      expect(state.hasErrors).toBe(false)
    })

    it('handles an empty results object', () => {
      useValidationStore.getState().setResults({})
      const state = useValidationStore.getState()
      expect(state.blockValidations).toEqual({})
      expect(state.errorBlockIds.size).toBe(0)
      expect(state.warningBlockIds.size).toBe(0)
      expect(state.hasErrors).toBe(false)
    })
  })

  describe('clearAll', () => {
    it('resets every slice of state to initial values', () => {
      useValidationStore.getState().setResults({
        'block-a': makeResult({ valid: false, errors: [{ field: 'f', message: 'm' }] }),
      })
      useValidationStore.getState().setHighlightedField('block-a', 'f')

      useValidationStore.getState().clearAll()
      const state = useValidationStore.getState()

      expect(state.blockValidations).toEqual({})
      expect(state.errorBlockIds.size).toBe(0)
      expect(state.warningBlockIds.size).toBe(0)
      expect(state.hasErrors).toBe(false)
      expect(state.highlightedField).toBeNull()
    })
  })

  describe('clearBlock', () => {
    it('removes a block from validations, error set, and warning set', () => {
      useValidationStore.getState().setResults({
        'block-a': makeResult({ valid: false, errors: [{ field: 'f', message: 'm' }] }),
        'block-b': makeResult({
          valid: true,
          warnings: [{ field: 'w', message: 'warn' }],
        }),
      })

      useValidationStore.getState().clearBlock('block-a')
      const state = useValidationStore.getState()

      expect(state.blockValidations['block-a']).toBeUndefined()
      expect(state.blockValidations['block-b']).toBeDefined()
      expect(state.errorBlockIds.has('block-a')).toBe(false)
      expect(state.warningBlockIds.has('block-b')).toBe(true)
      expect(state.hasErrors).toBe(false)
    })

    it('clears highlighted field if it belonged to the removed block', () => {
      useValidationStore.getState().setResults({
        'block-a': makeResult({ valid: false, errors: [{ field: 'f', message: 'm' }] }),
      })
      useValidationStore.getState().setHighlightedField('block-a', 'f')

      useValidationStore.getState().clearBlock('block-a')
      expect(useValidationStore.getState().highlightedField).toBeNull()
    })

    it('preserves highlighted field if it belongs to a different block', () => {
      useValidationStore.getState().setResults({
        'block-a': makeResult({ valid: false, errors: [{ field: 'f', message: 'm' }] }),
        'block-b': makeResult({ valid: false, errors: [{ field: 'g', message: 'n' }] }),
      })
      useValidationStore.getState().setHighlightedField('block-b', 'g')

      useValidationStore.getState().clearBlock('block-a')
      expect(useValidationStore.getState().highlightedField).toEqual({
        blockId: 'block-b',
        fieldId: 'g',
      })
    })

    it('is a no-op for an unknown block id', () => {
      useValidationStore.getState().setResults({
        'block-a': makeResult({ valid: false, errors: [{ field: 'f', message: 'm' }] }),
      })

      useValidationStore.getState().clearBlock('ghost')
      const state = useValidationStore.getState()

      expect(state.blockValidations['block-a']).toBeDefined()
      expect(state.errorBlockIds.has('block-a')).toBe(true)
      expect(state.hasErrors).toBe(true)
    })
  })

  describe('clearFieldError', () => {
    it('returns unchanged state when the block has no result', () => {
      const prev = useValidationStore.getState()
      useValidationStore.getState().clearFieldError('missing', 'any')
      const next = useValidationStore.getState()
      expect(next.blockValidations).toBe(prev.blockValidations)
      expect(next.errorBlockIds).toBe(prev.errorBlockIds)
    })

    it('removes only the targeted field error and keeps other errors', () => {
      useValidationStore.getState().setResults({
        'block-a': makeResult({
          valid: false,
          errors: [
            { field: 'apiKey', message: 'Required' },
            { field: 'model', message: 'Required' },
          ],
        }),
      })

      useValidationStore.getState().clearFieldError('block-a', 'apiKey')
      const state = useValidationStore.getState()
      const result = state.blockValidations['block-a']

      expect(result.errors).toEqual([{ field: 'model', message: 'Required' }])
      expect(result.valid).toBe(false)
      expect(state.errorBlockIds.has('block-a')).toBe(true)
      expect(state.hasErrors).toBe(true)
    })

    it('marks block valid and removes it from error set when last error clears', () => {
      useValidationStore.getState().setResults({
        'block-a': makeResult({
          valid: false,
          errors: [{ field: 'apiKey', message: 'Required' }],
        }),
      })

      useValidationStore.getState().clearFieldError('block-a', 'apiKey')
      const state = useValidationStore.getState()

      expect(state.blockValidations['block-a'].valid).toBe(true)
      expect(state.errorBlockIds.has('block-a')).toBe(false)
      expect(state.warningBlockIds.has('block-a')).toBe(false)
      expect(state.hasErrors).toBe(false)
    })

    it('moves block to warning set when errors clear but warnings remain', () => {
      useValidationStore.getState().setResults({
        'block-a': makeResult({
          valid: false,
          errors: [{ field: 'apiKey', message: 'Required' }],
          warnings: [{ field: 'model', message: 'Deprecated' }],
        }),
      })

      useValidationStore.getState().clearFieldError('block-a', 'apiKey')
      const state = useValidationStore.getState()

      expect(state.blockValidations['block-a'].valid).toBe(true)
      expect(state.errorBlockIds.has('block-a')).toBe(false)
      expect(state.warningBlockIds.has('block-a')).toBe(true)
      expect(state.hasErrors).toBe(false)
    })

    it('clears highlighted field only when it matches blockId + fieldId', () => {
      useValidationStore.getState().setResults({
        'block-a': makeResult({
          valid: false,
          errors: [
            { field: 'apiKey', message: 'Required' },
            { field: 'model', message: 'Required' },
          ],
        }),
      })
      useValidationStore.getState().setHighlightedField('block-a', 'apiKey')

      useValidationStore.getState().clearFieldError('block-a', 'model')
      expect(useValidationStore.getState().highlightedField).toEqual({
        blockId: 'block-a',
        fieldId: 'apiKey',
      })

      useValidationStore.getState().clearFieldError('block-a', 'apiKey')
      expect(useValidationStore.getState().highlightedField).toBeNull()
    })

    it('tolerates missing errors/warnings arrays on the block result', () => {
      useValidationStore.setState({
        blockValidations: {
          'block-a': { valid: false } as unknown as BlockValidationResult,
        },
        errorBlockIds: new Set(['block-a']),
        warningBlockIds: new Set(),
        hasErrors: true,
        highlightedField: null,
      })

      useValidationStore.getState().clearFieldError('block-a', 'anything')
      const state = useValidationStore.getState()

      expect(state.blockValidations['block-a'].errors).toEqual([])
      expect(state.blockValidations['block-a'].warnings).toEqual([])
      expect(state.blockValidations['block-a'].valid).toBe(true)
      expect(state.errorBlockIds.has('block-a')).toBe(false)
      expect(state.hasErrors).toBe(false)
    })
  })

  describe('highlighted field', () => {
    it('setHighlightedField stores the blockId/fieldId pair', () => {
      useValidationStore.getState().setHighlightedField('block-a', 'model')
      expect(useValidationStore.getState().highlightedField).toEqual({
        blockId: 'block-a',
        fieldId: 'model',
      })
    })

    it('setHighlightedField overwrites the previous highlight', () => {
      useValidationStore.getState().setHighlightedField('block-a', 'model')
      useValidationStore.getState().setHighlightedField('block-b', 'apiKey')
      expect(useValidationStore.getState().highlightedField).toEqual({
        blockId: 'block-b',
        fieldId: 'apiKey',
      })
    })

    it('clearHighlightedField resets to null', () => {
      useValidationStore.getState().setHighlightedField('block-a', 'model')
      useValidationStore.getState().clearHighlightedField()
      expect(useValidationStore.getState().highlightedField).toBeNull()
    })
  })
})
