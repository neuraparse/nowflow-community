/**
 * Shared Zod schemas for common fields across agent blocks.
 * These can be used as building blocks or imported into agent-specific overrides.
 *
 * @module executor/validation/schemas/common
 */
import { z } from 'zod'

// ─── Model & Provider ───────────────────────────────────────────────

export const modelSchema = z.string().min(1, 'Model selection is required')

export const apiKeySchema = z.string().min(1, 'API key is required for cloud models')

export const temperatureSchema = z
  .number()
  .min(0, 'Temperature must be >= 0')
  .max(2, 'Temperature must be <= 2')
  .optional()

// ─── Tools ──────────────────────────────────────────────────────────

export const singleToolSchema = z.object({
  type: z.string(),
  title: z.string().optional(),
  schema: z.any().optional(),
  code: z.string().optional(),
  usageControl: z.enum(['auto', 'required', 'none']).optional(),
  operation: z.string().optional(),
  params: z.record(z.string(), z.any()).optional(),
})

export const toolsArraySchema = z.array(singleToolSchema).optional()

// ─── Response Format ────────────────────────────────────────────────

// Response format is validated in tool-validation.ts with custom logic
// since z.union with complex members is fragile in Zod v4
export const responseFormatSchema = z.any().optional()

// ─── Memory Configuration ───────────────────────────────────────────

export const memoryConfigSchema = z
  .object({
    memoryEnabled: z.boolean().optional(),
    memoryLimit: z.any().optional(),
    memoryImportance: z.any().optional(),
    memoryTags: z.string().optional().nullable(),
  })
  .passthrough()

// ─── Knowledge Sources ──────────────────────────────────────────────

export const knowledgeSourcesSchema = z.string().optional()

export const searchMaxResultsSchema = z.any().optional()

export const similarityThresholdSchema = z.any().optional()

// ─── Numeric String Fields ──────────────────────────────────────────

/**
 * Some numeric inputs come as strings from sub-block short-inputs.
 * This schema accepts both and validates the numeric range.
 * Uses z.any() with refine to avoid Zod v4 union issues.
 */
export function numericStringSchema(min: number, max: number, fieldName: string): z.ZodTypeAny {
  return z.any().refine(
    (val) => {
      if (val === undefined || val === null) return true
      if (typeof val === 'string' && val.trim() === '') return true
      const num = Number(val)
      return !isNaN(num) && num >= min && num <= max
    },
    { message: `${fieldName} must be a number between ${min} and ${max}` }
  )
}
