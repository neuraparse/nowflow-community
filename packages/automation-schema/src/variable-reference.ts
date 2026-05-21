import { z } from 'zod'

/**
 * L2 variable reference grammar.
 *
 * Three supported reference syntaxes:
 *   1. `<block.field>`          - reference another block's output field
 *   2. `<variable.name>`        - reference a workflow-scoped variable
 *   3. `{{ENV}}`                - reference an environment variable
 *
 * The angle-bracket form supports dotted paths: `<block.response.data.items>`
 */

// Regex for a single `<block.field>` or `<variable.name>` reference.
// Captures: [1] = head segment (block or variable name), [2] = dotted path tail.
export const ANGLE_REFERENCE_REGEX = /<([a-zA-Z_][\w-]*)((?:\.[a-zA-Z_][\w-]*)*)>/

// Same as above but global for scanning a string.
export const ANGLE_REFERENCE_REGEX_GLOBAL = /<([a-zA-Z_][\w-]*)((?:\.[a-zA-Z_][\w-]*)*)>/g

// Regex for a single `{{ENV}}` reference. Captures: [1] = env var name.
export const ENV_REFERENCE_REGEX = /\{\{\s*([A-Z_][A-Z0-9_]*)\s*\}\}/

// Global scan variant.
export const ENV_REFERENCE_REGEX_GLOBAL = /\{\{\s*([A-Z_][A-Z0-9_]*)\s*\}\}/g

// A reserved prefix that marks a reference as a workflow variable instead of a block.
// Usage: `<variable.myVar>`. Anything else in the angle-bracket form resolves as a block.
export const VARIABLE_PREFIX = 'variable'

export type ReferenceKind = 'block' | 'variable' | 'env'

export const ReferenceKindSchema = z.enum(['block', 'variable', 'env'])

export const ParsedReferenceSchema = z.object({
  kind: ReferenceKindSchema,
  /**
   * The full dotted path, split into segments.
   * - For `<block.field.nested>` -> `['block', 'field', 'nested']`
   * - For `<variable.myVar>`     -> `['myVar']`  (the `variable` prefix is stripped)
   * - For `{{MY_ENV}}`           -> `['MY_ENV']`
   */
  path: z.array(z.string()),
  /** The original raw reference string (e.g. `<block.field>` or `{{ENV}}`). */
  raw: z.string(),
})

export type ParsedReference = z.infer<typeof ParsedReferenceSchema>

/**
 * Parse a single reference token.
 *
 * Accepts either an angle-bracket form `<head.tail.tail>` or an env form `{{NAME}}`.
 * Returns null if the input does not match either grammar.
 */
export function parseReference(input: string): ParsedReference | null {
  const trimmed = input.trim()

  // Env form
  const envMatch = trimmed.match(new RegExp(`^${ENV_REFERENCE_REGEX.source}$`))
  if (envMatch) {
    return {
      kind: 'env',
      path: [envMatch[1]],
      raw: trimmed,
    }
  }

  // Angle form
  const angleMatch = trimmed.match(new RegExp(`^${ANGLE_REFERENCE_REGEX.source}$`))
  if (angleMatch) {
    const head = angleMatch[1]
    const tail = angleMatch[2] // starts with '.' if present
    const tailSegments = tail ? tail.slice(1).split('.').filter(Boolean) : []

    if (head === VARIABLE_PREFIX) {
      return {
        kind: 'variable',
        path: tailSegments,
        raw: trimmed,
      }
    }

    return {
      kind: 'block',
      path: [head, ...tailSegments],
      raw: trimmed,
    }
  }

  return null
}

/**
 * Scan a template string for all references of any supported syntax.
 * Returns them in the order they appear in the source string.
 */
export function extractReferences(input: string): ParsedReference[] {
  const refs: ParsedReference[] = []

  for (const match of input.matchAll(ENV_REFERENCE_REGEX_GLOBAL)) {
    refs.push({
      kind: 'env',
      path: [match[1]],
      raw: match[0],
    })
  }

  for (const match of input.matchAll(ANGLE_REFERENCE_REGEX_GLOBAL)) {
    const head = match[1]
    const tail = match[2]
    const tailSegments = tail ? tail.slice(1).split('.').filter(Boolean) : []

    if (head === VARIABLE_PREFIX) {
      refs.push({
        kind: 'variable',
        path: tailSegments,
        raw: match[0],
      })
    } else {
      refs.push({
        kind: 'block',
        path: [head, ...tailSegments],
        raw: match[0],
      })
    }
  }

  return refs
}

/**
 * Zod schema that validates a string is a single well-formed reference.
 * Useful for L2 contract fields that must be pure references (not templates).
 */
export const VariableReferenceStringSchema = z.string().refine((s) => parseReference(s) !== null, {
  message: 'Must be a reference in one of: `<block.field>`, `<variable.name>`, or `{{ENV}}`',
})

export type VariableReferenceString = z.infer<typeof VariableReferenceStringSchema>
