/**
 * Tool configuration validation rules.
 * Validates tool definitions and custom function schemas.
 *
 * @module executor/validation/rules/tool-validation
 */
import type { ValidationIssue } from '../validation-result'

/**
 * Validates tool configurations in the inputs.
 * Checks that tools have the required fields and proper structure.
 */
export function validateToolInputs(
  tools: any,
  blockType: string
): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return { errors, warnings }
  }

  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i]
    const prefix = `tools[${i}]`

    if (!tool || typeof tool !== 'object') {
      errors.push({
        field: prefix,
        message: `Tool at index ${i} is not a valid object.`,
      })
      continue
    }

    // All tools need a type
    if (!tool.type) {
      errors.push({
        field: `${prefix}.type`,
        message: `Tool at index ${i} is missing "type" field.`,
        suggestion: 'Each tool must have a type (e.g., "custom-tool" or a block type).',
      })
    }

    // Custom tools have additional requirements
    if (tool.type === 'custom-tool') {
      validateCustomTool(tool, i, errors, warnings)
    }

    // Validate usageControl if present
    if (tool.usageControl && !['auto', 'required', 'none'].includes(tool.usageControl)) {
      warnings.push({
        field: `${prefix}.usageControl`,
        message: `Tool "${tool.title || `index ${i}`}" has invalid usageControl "${tool.usageControl}". Using "auto" as default.`,
        suggestion: 'Valid values: "auto", "required", "none".',
      })
    }
  }

  return { errors, warnings }
}

/**
 * Validates a custom tool definition.
 */
function validateCustomTool(
  tool: any,
  index: number,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const prefix = `tools[${index}]`

  if (!tool.schema) {
    errors.push({
      field: `${prefix}.schema`,
      message: `Custom tool "${tool.title || `index ${index}`}" is missing "schema" definition.`,
      suggestion: 'Define a schema with function name, description, and parameters.',
    })
    return
  }

  const fn = tool.schema?.function
  if (!fn) {
    errors.push({
      field: `${prefix}.schema.function`,
      message: `Custom tool "${tool.title || `index ${index}`}" schema is missing "function" field.`,
      suggestion: 'Add a function definition with name, description, and parameters.',
    })
    return
  }

  if (!fn.name || typeof fn.name !== 'string') {
    errors.push({
      field: `${prefix}.schema.function.name`,
      message: `Custom tool "${tool.title || `index ${index}`}" function is missing "name".`,
    })
  }

  if (!fn.parameters || typeof fn.parameters !== 'object') {
    errors.push({
      field: `${prefix}.schema.function.parameters`,
      message: `Custom tool "${fn.name || `index ${index}`}" function is missing "parameters".`,
      suggestion: 'Parameters should be a JSON Schema object with type, properties, and required.',
    })
  } else {
    // Validate parameters schema structure
    if (fn.parameters.type !== 'object') {
      warnings.push({
        field: `${prefix}.schema.function.parameters.type`,
        message: `Custom tool "${fn.name}" parameters type should be "object".`,
      })
    }
    if (!fn.parameters.properties || typeof fn.parameters.properties !== 'object') {
      warnings.push({
        field: `${prefix}.schema.function.parameters.properties`,
        message: `Custom tool "${fn.name}" parameters should have "properties" defined.`,
      })
    }
  }

  // If tool has code, validate it's non-empty
  if (tool.code !== undefined && typeof tool.code === 'string' && tool.code.trim().length === 0) {
    warnings.push({
      field: `${prefix}.code`,
      message: `Custom tool "${fn?.name || `index ${index}`}" has empty code. It will not execute.`,
      suggestion: 'Add implementation code or remove the tool.',
    })
  }
}

/**
 * Validates responseFormat / JSON Schema for structured output.
 */
export function validateResponseFormat(responseFormat: any): {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
} {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  if (!responseFormat) return { errors, warnings }

  let parsed = responseFormat
  if (typeof responseFormat === 'string') {
    const trimmed = responseFormat.trim()
    if (trimmed.length === 0) return { errors, warnings }

    try {
      parsed = JSON.parse(trimmed)
    } catch {
      errors.push({
        field: 'responseFormat',
        message: 'Response format contains invalid JSON.',
        suggestion: 'Fix the JSON syntax in the response format field.',
      })
      return { errors, warnings }
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    errors.push({
      field: 'responseFormat',
      message: 'Response format must be a JSON object.',
    })
    return { errors, warnings }
  }

  // Check for valid JSON Schema structure
  const schema = parsed.schema || parsed

  if (schema.type && schema.type !== 'object') {
    warnings.push({
      field: 'responseFormat',
      message: `Response format root type is "${schema.type}". Most providers require "object" as the root type.`,
      suggestion: 'Set type to "object" for best compatibility.',
    })
  }

  if (schema.type === 'object' && !schema.properties) {
    warnings.push({
      field: 'responseFormat',
      message: 'Response format has type "object" but no "properties" defined.',
      suggestion: 'Add properties to define the expected response structure.',
    })
  }

  return { errors, warnings }
}
