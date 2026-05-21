/**
 * Generates Zod schemas from BlockConfig definitions.
 * Converts ParamConfig types and SubBlockConfig validation rules into Zod schemas
 * so that every block automatically gets input validation from its definition.
 *
 * @module executor/validation/schema-generator
 */
import { z } from 'zod'
import type { BlockConfig, ParamConfig, SubBlockConfig, ValidationRule } from '@/blocks/types'

/**
 * Maps a ParamConfig type string to a base Zod schema.
 */
function paramTypeToZod(type: ParamConfig['type']): z.ZodTypeAny {
  switch (type) {
    case 'string':
      return z.string()
    case 'number':
      return z.number()
    case 'boolean':
      return z.boolean()
    case 'json':
      // JSON fields can be string (pre-parse), object, or array - accept any
      return z.any()
    default:
      return z.any()
  }
}

/**
 * Applies a ValidationRule from SubBlockConfig to a Zod schema.
 */
function applyValidationRule(schema: z.ZodTypeAny, rule: ValidationRule): z.ZodTypeAny {
  // Pattern validation (only for strings)
  if (rule.pattern && schema instanceof z.ZodString) {
    schema = (schema as z.ZodString).regex(rule.pattern, 'Invalid format')
  }

  // Min/max for numbers
  if (rule.min !== undefined && schema instanceof z.ZodNumber) {
    schema = (schema as z.ZodNumber).min(rule.min)
  }
  if (rule.max !== undefined && schema instanceof z.ZodNumber) {
    schema = (schema as z.ZodNumber).max(rule.max)
  }

  // MinLength/maxLength for strings
  if (rule.minLength !== undefined && schema instanceof z.ZodString) {
    schema = (schema as z.ZodString).min(rule.minLength)
  }
  if (rule.maxLength !== undefined && schema instanceof z.ZodString) {
    schema = (schema as z.ZodString).max(rule.maxLength)
  }

  // Custom validation function
  if (rule.custom) {
    const customFn = rule.custom
    schema = schema.refine(
      (val: any) => {
        const result = customFn(val)
        return result === true
      },
      { message: 'Custom validation failed' }
    )
  }

  return schema
}

/**
 * Applies sub-block type-specific constraints to the schema.
 * For example, sliders have min/max, dropdowns have enum options.
 */
function applySubBlockConstraints(
  schema: z.ZodTypeAny,
  subBlock: SubBlockConfig,
  paramType: ParamConfig['type']
): z.ZodTypeAny {
  switch (subBlock.type) {
    case 'slider': {
      // Sliders may produce string values from the UI — coerce to number before validating.
      // Preprocess null/undefined/empty-string to undefined before z.coerce.number() runs,
      // because z.coerce.number() eagerly converts null→0 and undefined→NaN.
      // The inner .optional() accepts the undefined; the outer .optional().nullable()
      // (applied in generateBlockSchema for non-required fields) adds further leniency.
      let numSchema = z.coerce.number()
      if (subBlock.min !== undefined) numSchema = numSchema.min(subBlock.min)
      if (subBlock.max !== undefined) numSchema = numSchema.max(subBlock.max)
      if (subBlock.integer) numSchema = numSchema.int()
      return z.preprocess(
        (val) => (val === null || val === undefined || val === '' ? undefined : val),
        numSchema.optional()
      )
    }

    case 'dropdown': {
      // If options are static (not a function), validate against them
      if (subBlock.options && !isFunction(subBlock.options)) {
        const optionValues = extractOptionValues(subBlock.options as any[])
        if (optionValues.length > 0) {
          // Use enum for string options, or union for mixed types
          const allStrings = optionValues.every((v) => typeof v === 'string')
          if (allStrings && optionValues.length >= 2) {
            // Also accept empty string: represents "not selected yet" (UI shows first option as visual default)
            return z.union([z.enum(optionValues as [string, string, ...string[]]), z.literal('')])
          }
        }
      }
      // Dynamic options (function) - just validate as the param type
      return schema
    }

    case 'code': {
      // Code editors should produce non-empty strings when required
      return z.string()
    }

    case 'switch':
    case 'checkbox': {
      // Switch/checkbox values may come as strings ("true"/"false") from the UI — preprocess to boolean.
      // Handle null/undefined/empty-string (hidden conditional fields or unset toggles)
      // by converting to undefined. The inner .optional() accepts undefined;
      // the outer .optional().nullable() (from generateBlockSchema) adds further leniency.
      return z.preprocess((val) => {
        if (val === null || val === undefined || val === '') return undefined
        if (typeof val === 'string') {
          if (val === 'true') return true
          if (val === 'false') return false
        }
        return val
      }, z.boolean().optional())
    }

    default:
      return schema
  }
}

/**
 * Checks if a value is a function (for dynamic dropdown options).
 */
function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

/**
 * Extracts option values from dropdown options array.
 */
function extractOptionValues(options: any[]): (string | number | boolean)[] {
  return options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return opt.id ?? opt.value ?? opt.label
    }
    return opt
  })
}

/**
 * Generates a Zod schema for a block based on its BlockConfig definition.
 * Reads inputs (ParamConfig) and subBlocks (SubBlockConfig) to build a complete schema.
 */
export function generateBlockSchema(blockConfig: BlockConfig): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [inputId, paramConfig] of Object.entries(blockConfig.inputs)) {
    // Start with the base type schema
    let fieldSchema = paramTypeToZod(paramConfig.type)

    // Find matching sub-block to apply constraints and validation rules
    const subBlock = blockConfig.subBlocks.find((sb) => sb.id === inputId)

    // Hidden sub-blocks are internal/computed fields — never require user input regardless of required flag
    if (subBlock?.hidden) {
      shape[inputId] = fieldSchema.optional().nullable()
      continue
    }

    if (subBlock) {
      // Apply sub-block type-specific constraints (slider range, dropdown enum, etc.)
      fieldSchema = applySubBlockConstraints(fieldSchema, subBlock, paramConfig.type)

      // Apply explicit validation rules if defined
      if (subBlock.validation) {
        fieldSchema = applyValidationRule(fieldSchema, subBlock.validation)
      }
    }

    // Handle required vs optional
    if (paramConfig.required) {
      // For required string fields, also validate non-empty
      if (paramConfig.type === 'string' && fieldSchema instanceof z.ZodString) {
        fieldSchema = (fieldSchema as z.ZodString).min(1, `${inputId} is required`)
      }
    } else {
      // Optional fields accept undefined, null, or empty string
      fieldSchema = fieldSchema.optional().nullable()
    }

    shape[inputId] = fieldSchema
  }

  return z.object(shape).passthrough()
}
