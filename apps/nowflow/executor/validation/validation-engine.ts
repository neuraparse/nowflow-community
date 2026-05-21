/**
 * Core validation engine that orchestrates schema generation,
 * conditional rules, agent overrides, and tool validation.
 *
 * @module executor/validation/validation-engine
 */
import { z } from 'zod'
import { createLogger } from '@/lib/logs/console-logger'
import type { BlockConfig } from '@/blocks/types'
import type { SerializedBlock } from '@/serializer/types'
import { evaluateConditionalRules, getConditionalRules } from './rules/conditional-rules'
import { validateResponseFormat, validateToolInputs } from './rules/tool-validation'
import { generateBlockSchema } from './schema-generator'
import { agentSchemaOverrides } from './schemas/agent-schemas'
import {
  type BlockValidationResult,
  mergeResults,
  type ValidationIssue,
  validResult,
} from './validation-result'

const logger = createLogger('ValidationEngine')

// Cache generated schemas for performance (one per block type)
const schemaCache = new Map<string, z.ZodSchema>()

// Agent block type identifiers
const AGENT_BLOCK_TYPES = new Set([
  'agent',
  'content_creation_agent',
  'customer_service_agent',
  'data_analysis_agent',
  'function_calling_agent',
  'rag_agent',
  'reasoning_agent',
  'sales_agent',
])

/**
 * Main validation engine class.
 * Combines auto-generated schemas, conditional rules, agent overrides,
 * and tool validation into a single validation pass.
 */
export class ValidationEngine {
  private blockRegistry: Record<string, BlockConfig> | null = null

  /**
   * @param registry Optional pre-loaded block registry (for testing or pre-init).
   *                 If not provided, it will be lazily loaded from @/blocks/registry.
   */
  constructor(registry?: Record<string, BlockConfig>) {
    if (registry) {
      this.blockRegistry = registry
    }
  }

  /**
   * Lazily loads the block registry to avoid circular imports.
   */
  private getRegistry(): Record<string, BlockConfig> {
    if (!this.blockRegistry) {
      try {
        // Dynamic import to avoid circular dependency
        const { registry } = require('@/blocks/registry')
        this.blockRegistry = registry
      } catch (error) {
        logger.warn('Could not load block registry for validation', { error })
        this.blockRegistry = {}
      }
    }
    return this.blockRegistry!
  }

  /**
   * Validates resolved inputs against the block's schema and rules.
   * Returns validation result with errors and warnings -- does NOT throw.
   *
   * @param block - The serialized block being executed
   * @param inputs - Resolved input values (after reference substitution)
   * @returns Validation result with errors and warnings
   */
  validateInputs(block: SerializedBlock, inputs: Record<string, any>): BlockValidationResult {
    const blockType = block.metadata?.id || ''
    const blockName = block.metadata?.name || block.id

    if (!blockType) {
      return validResult()
    }

    const registry = this.getRegistry()
    const blockConfig = registry[blockType]

    try {
      // Run all validation phases and merge results
      const results: BlockValidationResult[] = []

      // Phase 1: Auto-generated schema from BlockConfig (requires blockConfig)
      if (blockConfig) {
        results.push(this.runSchemaValidation(blockType, blockConfig, inputs))
      } else {
        logger.debug(`No block config for type "${blockType}", skipping schema validation`)
      }

      // Phase 2: Conditional rules (apiKey for cloud models, etc.)
      results.push(this.runConditionalRules(blockType, inputs))

      // Phase 3: Agent-specific overrides (cross-field validation)
      if (AGENT_BLOCK_TYPES.has(blockType)) {
        results.push(this.runAgentOverrides(blockType, inputs))
      }

      // Phase 4: Tool-specific validation (for blocks with tools)
      if (inputs.tools) {
        results.push(this.runToolValidation(inputs.tools, blockType))
      }

      // Phase 5: Response format validation (for agent blocks)
      if (inputs.responseFormat) {
        results.push(this.runResponseFormatValidation(inputs.responseFormat))
      }

      const merged = mergeResults(...results)

      // Deduplicate: if a conditional rule marks a field as 'optional',
      // remove any auto-generated 'required' errors for that field
      const optionalFields = this.getConditionalOptionalFields(blockType, inputs)
      if (optionalFields.size > 0) {
        merged.errors = merged.errors.filter((e) => !optionalFields.has(e.field))
        merged.valid = merged.errors.length === 0
      }

      // Log validation results
      if (!merged.valid) {
        logger.warn(`Validation failed for block "${blockName}" (${blockType})`, {
          errors: merged.errors.length,
          warnings: merged.warnings.length,
        })
      } else if (merged.warnings.length > 0) {
        logger.debug(`Validation warnings for block "${blockName}" (${blockType})`, {
          warnings: merged.warnings.length,
        })
      }

      return merged
    } catch (error) {
      // Validation itself should never crash execution
      logger.error(`Validation engine error for block "${blockName}"`, { error })
      return validResult()
    }
  }

  /**
   * Phase 1: Run auto-generated Zod schema validation.
   */
  private runSchemaValidation(
    blockType: string,
    blockConfig: BlockConfig,
    inputs: Record<string, any>
  ): BlockValidationResult {
    const schema = this.getOrCreateSchema(blockType, blockConfig)
    const result = schema.safeParse(inputs)

    if (result.success) {
      return validResult()
    }

    const errors: ValidationIssue[] = []
    const warnings: ValidationIssue[] = []

    for (const issue of result.error.issues) {
      const field = issue.path.join('.')
      const isRequired = this.isRequiredField(blockConfig, field)

      const validationIssue: ValidationIssue = {
        field,
        message: issue.message,
        code: issue.code,
      }

      if (isRequired) {
        errors.push(validationIssue)
      } else {
        warnings.push(validationIssue)
      }
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  /**
   * Phase 2: Run conditional rules.
   */
  private runConditionalRules(
    blockType: string,
    inputs: Record<string, any>
  ): BlockValidationResult {
    const { errors, warnings } = evaluateConditionalRules(blockType, inputs)
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Phase 3: Run agent-specific overrides.
   */
  private runAgentOverrides(blockType: string, inputs: Record<string, any>): BlockValidationResult {
    const override = agentSchemaOverrides[blockType]
    if (!override) return validResult()

    const { errors, warnings } = override(inputs)
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Phase 4: Run tool validation.
   */
  private runToolValidation(tools: any, blockType: string): BlockValidationResult {
    const { errors, warnings } = validateToolInputs(tools, blockType)
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Phase 5: Run response format validation.
   */
  private runResponseFormatValidation(responseFormat: any): BlockValidationResult {
    const { errors, warnings } = validateResponseFormat(responseFormat)
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Gets fields that conditional rules mark as 'optional' for the current inputs.
   * Used to remove auto-generated required errors for conditionally optional fields.
   */
  private getConditionalOptionalFields(
    blockType: string,
    inputs: Record<string, any>
  ): Set<string> {
    const rules = getConditionalRules(blockType)
    const optionalFields = new Set<string>()

    for (const rule of rules) {
      if (rule.rule === 'optional' && rule.condition(inputs)) {
        optionalFields.add(rule.field)
      }
    }

    return optionalFields
  }

  /**
   * Gets or creates a cached Zod schema for a block type.
   */
  private getOrCreateSchema(blockType: string, blockConfig: BlockConfig): z.ZodSchema {
    const cached = schemaCache.get(blockType)
    if (cached) return cached

    const schema = generateBlockSchema(blockConfig)
    schemaCache.set(blockType, schema)
    return schema
  }

  /**
   * Checks if a field is required in the block config.
   */
  private isRequiredField(blockConfig: BlockConfig, field: string): boolean {
    const paramConfig = blockConfig.inputs[field]
    return paramConfig?.required === true
  }
}
