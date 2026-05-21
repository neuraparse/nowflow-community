import { describe, expect, it } from 'vitest'
import {
  type BlockValidationResult,
  mergeResults,
  type ValidationIssue,
  validResult,
} from '../validation-result'

/**
 * Helper to build a validation issue quickly in tests.
 */
function issue(
  field: string,
  message: string,
  extras: Partial<ValidationIssue> = {}
): ValidationIssue {
  return { field, message, ...extras }
}

describe('validation-result', () => {
  describe('validResult', () => {
    it('should return a passing result with empty error and warning arrays', () => {
      const result = validResult()

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })

    it('should return independent arrays each call (no shared refs)', () => {
      const a = validResult()
      const b = validResult()

      a.errors.push(issue('x', 'y'))

      expect(b.errors).toHaveLength(0)
      expect(a).not.toBe(b)
      expect(a.errors).not.toBe(b.errors)
      expect(a.warnings).not.toBe(b.warnings)
    })

    it('should produce a result matching the BlockValidationResult shape', () => {
      const result: BlockValidationResult = validResult()

      expect(result).toHaveProperty('valid')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
      expect(Array.isArray(result.errors)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
    })
  })

  describe('mergeResults', () => {
    it('should merge zero results into a passing result', () => {
      const merged = mergeResults()

      expect(merged.valid).toBe(true)
      expect(merged.errors).toEqual([])
      expect(merged.warnings).toEqual([])
    })

    it('should merge two passing results into a passing result', () => {
      const merged = mergeResults(validResult(), validResult())

      expect(merged.valid).toBe(true)
      expect(merged.errors).toHaveLength(0)
      expect(merged.warnings).toHaveLength(0)
    })

    it('should aggregate errors from all results', () => {
      const a: BlockValidationResult = {
        valid: false,
        errors: [issue('fieldA', 'A is bad')],
        warnings: [],
      }
      const b: BlockValidationResult = {
        valid: false,
        errors: [issue('fieldB', 'B is bad'), issue('fieldC', 'C is bad')],
        warnings: [],
      }

      const merged = mergeResults(a, b)

      expect(merged.valid).toBe(false)
      expect(merged.errors).toHaveLength(3)
      expect(merged.errors.map((e) => e.field)).toEqual(['fieldA', 'fieldB', 'fieldC'])
    })

    it('should aggregate warnings from all results', () => {
      const a: BlockValidationResult = {
        valid: true,
        errors: [],
        warnings: [issue('f1', 'warn 1')],
      }
      const b: BlockValidationResult = {
        valid: true,
        errors: [],
        warnings: [issue('f2', 'warn 2')],
      }

      const merged = mergeResults(a, b)

      expect(merged.valid).toBe(true)
      expect(merged.warnings).toHaveLength(2)
      expect(merged.warnings.map((w) => w.field)).toEqual(['f1', 'f2'])
    })

    it('should set valid=false when any result has an error', () => {
      const a = validResult()
      const b: BlockValidationResult = {
        valid: false,
        errors: [issue('x', 'bad')],
        warnings: [],
      }

      const merged = mergeResults(a, b)

      expect(merged.valid).toBe(false)
    })

    it('should remain valid when there are only warnings', () => {
      const a: BlockValidationResult = {
        valid: true,
        errors: [],
        warnings: [issue('x', 'soft warn')],
      }

      const merged = mergeResults(a, validResult())

      expect(merged.valid).toBe(true)
      expect(merged.warnings).toHaveLength(1)
      expect(merged.errors).toHaveLength(0)
    })

    it('should preserve order of errors across inputs', () => {
      const r1: BlockValidationResult = {
        valid: false,
        errors: [issue('a', '1'), issue('b', '2')],
        warnings: [],
      }
      const r2: BlockValidationResult = {
        valid: false,
        errors: [issue('c', '3')],
        warnings: [],
      }
      const r3: BlockValidationResult = {
        valid: false,
        errors: [issue('d', '4'), issue('e', '5')],
        warnings: [],
      }

      const merged = mergeResults(r1, r2, r3)

      expect(merged.errors.map((e) => e.field)).toEqual(['a', 'b', 'c', 'd', 'e'])
    })

    it('should preserve issue metadata (code, suggestion)', () => {
      const r: BlockValidationResult = {
        valid: false,
        errors: [
          issue('apiKey', 'required', {
            code: 'custom',
            suggestion: 'Set $OPENAI_API_KEY',
          }),
        ],
        warnings: [],
      }

      const merged = mergeResults(r)

      expect(merged.errors[0].code).toBe('custom')
      expect(merged.errors[0].suggestion).toBe('Set $OPENAI_API_KEY')
    })

    it('should not deduplicate identical issues (aggregation is additive)', () => {
      const sameIssue = issue('x', 'bad')
      const r: BlockValidationResult = {
        valid: false,
        errors: [sameIssue, sameIssue],
        warnings: [],
      }

      const merged = mergeResults(r, r)

      // 2 + 2 = 4, no dedupe
      expect(merged.errors).toHaveLength(4)
    })

    it('should handle mixed errors and warnings across multiple results', () => {
      const a: BlockValidationResult = {
        valid: false,
        errors: [issue('a', 'err')],
        warnings: [issue('aw', 'warn')],
      }
      const b: BlockValidationResult = {
        valid: true,
        errors: [],
        warnings: [issue('bw', 'warn')],
      }
      const c: BlockValidationResult = {
        valid: false,
        errors: [issue('c', 'err')],
        warnings: [],
      }

      const merged = mergeResults(a, b, c)

      expect(merged.valid).toBe(false)
      expect(merged.errors).toHaveLength(2)
      expect(merged.warnings).toHaveLength(2)
      expect(merged.errors.map((e) => e.field)).toEqual(['a', 'c'])
      expect(merged.warnings.map((w) => w.field)).toEqual(['aw', 'bw'])
    })

    it('should be serializable via JSON (no functions/circular refs)', () => {
      const r: BlockValidationResult = {
        valid: false,
        errors: [issue('f', 'm', { code: 'C', suggestion: 'S' })],
        warnings: [issue('g', 'w')],
      }

      const merged = mergeResults(r)
      const json = JSON.stringify(merged)
      const parsed = JSON.parse(json)

      expect(parsed).toEqual({
        valid: false,
        errors: [{ field: 'f', message: 'm', code: 'C', suggestion: 'S' }],
        warnings: [{ field: 'g', message: 'w' }],
      })
    })
  })

  describe('ValidationIssue shape', () => {
    it('should allow minimal issue with only field and message', () => {
      const i: ValidationIssue = { field: 'x', message: 'y' }

      expect(i.field).toBe('x')
      expect(i.message).toBe('y')
      expect(i.code).toBeUndefined()
      expect(i.suggestion).toBeUndefined()
    })

    it('should allow issues with full metadata', () => {
      const i: ValidationIssue = {
        field: 'apiKey',
        message: 'required',
        code: 'too_small',
        suggestion: 'Set the key',
      }

      expect(i.code).toBe('too_small')
      expect(i.suggestion).toBe('Set the key')
    })
  })
})
