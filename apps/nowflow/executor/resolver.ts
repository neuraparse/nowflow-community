import { createLogger } from '@/lib/logs/console-logger'
import { VariableManager } from '@/lib/variables/variable-manager'
import { SerializedBlock, SerializedWorkflow } from '@/serializer/types'
import { LoopManager } from './loops'
import {
  containsProperEnvVarReference,
  formatValueForCodeContext,
  isApiKeyField,
  needsCodeStringLiteral,
  normalizeBlockName,
  stringifyForCondition,
} from './resolver-helpers'
import { ExecutionContext } from './types'

const logger = createLogger('InputResolver')

/**
 * Resolves input values for blocks by handling references and variable substitution.
 */
export class InputResolver {
  private blockById: Map<string, SerializedBlock>
  private blockByNormalizedName: Map<string, SerializedBlock>

  constructor(
    private workflow: SerializedWorkflow,
    private environmentVariables: Record<string, string>,
    private workflowVariables: Record<string, any> = {},
    private loopManager?: LoopManager
  ) {
    // Create maps for efficient lookups
    this.blockById = new Map(workflow.blocks.map((block) => [block.id, block]))

    // Initialize the normalized name map
    this.blockByNormalizedName = new Map(
      workflow.blocks.map((block) => [
        block.metadata?.name ? normalizeBlockName(block.metadata.name) : block.id,
        block,
      ])
    )

    // Add special handling for the starter block - allow referencing it as "start"
    const starterBlock = workflow.blocks.find((block) => block.metadata?.id === 'starter')
    if (starterBlock) {
      this.blockByNormalizedName.set('start', starterBlock)
      // Also add the normalized actual name if it exists
      if (starterBlock.metadata?.name) {
        this.blockByNormalizedName.set(normalizeBlockName(starterBlock.metadata.name), starterBlock)
      }
    }
  }

  /**
   * Resolves all inputs for a block based on current context.
   * Handles block references, environment variables, and JSON parsing.
   *
   * @param block - Block to resolve inputs for
   * @param context - Current execution context
   * @returns Resolved input parameters
   */
  resolveInputs(block: SerializedBlock, context: ExecutionContext): Record<string, any> {
    const inputs = { ...block.config.params }
    const result: Record<string, any> = {}

    // Process each input parameter
    for (const [key, value] of Object.entries(inputs)) {
      // Skip null or undefined values
      if (value === null || value === undefined) {
        result[key] = value
        continue
      }

      // *** Add check for Condition Block's 'conditions' key early ***
      const isConditionBlock = block.metadata?.id === 'condition'
      const isConditionsKey = key === 'conditions'

      if (isConditionBlock && isConditionsKey && typeof value === 'string') {
        // Pass the raw string directly without resolving refs or parsing JSON
        result[key] = value
        continue // Skip further processing for this key
      }
      // *** End of early check ***

      // Handle string values that may contain references
      if (typeof value === 'string') {
        const trimmedValue = value.trim()
        const directVariableMatch = trimmedValue.match(/^<variable\.([^>]+)>$/)

        // Check for direct variable reference first
        if (directVariableMatch) {
          const variableName = directVariableMatch[1]
          const variable = this.findVariableByName(variableName)

          if (variable) {
            // Return the typed value directly
            result[key] = this.getTypedVariableValue(variable)
            continue // Skip further processing for this direct reference
          } else {
            logger.warn(
              `Direct variable reference <variable.${variableName}> not found. Treating as literal.`
            )
            result[key] = value // Return original string
            continue
          }
        }

        // If not direct reference, proceed with interpolation + other resolutions
        // First resolve variable references (interpolation)
        const resolvedVars = this.resolveVariableReferences(value, block)

        // Then resolve block references
        // Need to ensure input is string here if resolveVariableReferences returned non-string somehow (shouldn't)
        const resolvedReferences =
          typeof resolvedVars === 'string'
            ? this.resolveBlockReferences(resolvedVars, context, block)
            : resolvedVars // Pass non-string through

        // Check if this is an API key field - needs original context, less reliable here
        // We might need a better way to pass isApiKey context down recursively
        const isApiKey = isApiKeyField(block, value) // Check original value context

        // Then resolve environment variables
        // Need to ensure input is string here
        const resolvedEnv =
          typeof resolvedReferences === 'string'
            ? this.resolveEnvVariables(resolvedReferences, isApiKey)
            : resolvedReferences // Pass non-string through

        // Special handling for different block types
        const isFunctionBlock = block.metadata?.id === 'function'
        const isApiBlock = block.metadata?.id === 'api'

        // For function blocks, we need special handling for code input
        if (isFunctionBlock && key === 'code') {
          result[key] = resolvedEnv
        }
        // For API blocks, handle body input specially
        else if (isApiBlock && key === 'body') {
          // If the final resolved value is a string that looks like JSON, parse it.
          // Otherwise, use the value as is (it might already be an object/array from direct ref).
          if (typeof resolvedEnv === 'string') {
            try {
              if (resolvedEnv.trim().startsWith('{') || resolvedEnv.trim().startsWith('[')) {
                result[key] = JSON.parse(resolvedEnv)
              } else {
                result[key] = resolvedEnv // Keep as string if not JSON-like
              }
            } catch {
              result[key] = resolvedEnv // Keep as string if JSON parsing fails
            }
          } else {
            result[key] = resolvedEnv // Already a non-string type
          }
        }
        // For other inputs, try to convert JSON strings to objects/arrays
        else {
          // If the final resolved value is a string that looks like JSON, parse it.
          if (typeof resolvedEnv === 'string') {
            try {
              if (
                resolvedEnv.trim().length > 0 &&
                (resolvedEnv.trim().startsWith('{') || resolvedEnv.trim().startsWith('['))
              ) {
                result[key] = JSON.parse(resolvedEnv)
              } else {
                // If not JSON-like or empty, keep as string
                result[key] = resolvedEnv
              }
            } catch {
              // If it's not valid JSON, keep it as a string
              result[key] = resolvedEnv
            }
          } else {
            // If resolvedValue is already not a string (due to direct reference), keep its type
            result[key] = resolvedEnv
          }
        }
      }
      // Handle objects and arrays recursively
      else if (typeof value === 'object') {
        // Special handling for table-like arrays (e.g., from API params/headers)
        if (
          Array.isArray(value) &&
          value.every((item) => typeof item === 'object' && item !== null && 'cells' in item)
        ) {
          // Resolve each cell's value within the array
          // Cell values are resolved here and will be extracted by tools/utils.ts transformTable function
          result[key] = value.map((row) => ({
            ...row,
            cells: Object.entries(row.cells).reduce(
              (acc, [cellKey, cellValue]) => {
                if (typeof cellValue === 'string') {
                  const trimmedValue = cellValue.trim()
                  // Check for direct variable reference pattern: <variable.name>
                  const directVariableMatch = trimmedValue.match(/^<variable\.([^>]+)>$/)

                  if (directVariableMatch) {
                    // Direct variable reference - handle with clean variable lookup
                    const variableName = directVariableMatch[1]
                    const variable = this.findVariableByName(variableName)

                    if (variable) {
                      // Use the variable's typed value directly
                      acc[cellKey] = this.getTypedVariableValue(variable)
                    } else {
                      logger.warn(
                        `Variable reference <variable.${variableName}> not found in table cell`
                      )
                      acc[cellKey] = cellValue // Fall back to original string
                    }
                  } else {
                    // Process interpolated variables, block references, and environment variables
                    // The resolveNestedStructure handles all types of resolution in a consistent way
                    acc[cellKey] = this.resolveNestedStructure(cellValue, context, block)
                  }
                } else {
                  // Handle non-string values (objects, arrays, etc.)
                  acc[cellKey] = this.resolveNestedStructure(cellValue, context, block)
                }
                return acc
              },
              {} as Record<string, any>
            ),
          }))
        } else {
          // Use general recursive resolution for other objects/arrays
          result[key] = this.resolveNestedStructure(value, context, block)
        }
      }
      // Pass through other value types
      else {
        result[key] = value
      }
    }

    return result
  }

  /**
   * Retrieves the correctly typed value of a variable based on its stored type.
   * Uses VariableManager for consistent handling of all variable types.
   */
  private getTypedVariableValue(variable: any): any {
    if (!variable || variable.value === undefined || variable.value === null) {
      return variable?.value // Return null or undefined as is
    }

    try {
      // Use the centralized VariableManager to resolve variable values
      return VariableManager.resolveForExecution(variable.value, variable.type)
    } catch (error) {
      logger.error(`Error processing variable ${variable.name} (type: ${variable.type}):`, error)
      return variable.value // Fallback to original value on error
    }
  }

  /**
   * Formats a typed variable value for interpolation into a string.
   * Uses VariableManager for consistent handling of all variable types.
   */
  private formatValueForInterpolation(
    value: any,
    type: string,
    currentBlock?: SerializedBlock
  ): string {
    try {
      // Determine if this needs special handling for code contexts
      const needsCodeLiteral = needsCodeStringLiteral(currentBlock, String(value))

      // Use the appropriate formatting method based on context
      if (needsCodeLiteral) {
        return VariableManager.formatForCodeContext(value, type as any)
      } else {
        return VariableManager.formatForTemplateInterpolation(value, type as any)
      }
    } catch (error) {
      logger.error(`Error formatting value for interpolation (type: ${type}):`, error)
      // Fallback to simple string conversion
      return String(value)
    }
  }

  /**
   * Resolves workflow variable references in a string (<variable.name>).
   */
  resolveVariableReferences(value: string, currentBlock?: SerializedBlock): string {
    // Added check: If value is not a string, return it directly.
    // This can happen if a prior resolution step (like block reference) returned a non-string.
    if (typeof value !== 'string') {
      return value as any // Cast needed as function technically returns string, but might pass through others
    }

    const variableMatches = value.match(/<variable\.([^>]+)>/g)
    if (!variableMatches) return value

    let resolvedValue = value

    for (const match of variableMatches) {
      const variableName = match.slice('<variable.'.length, -1)

      // Find the variable using our helper method
      const variable = this.findVariableByName(variableName)

      if (variable) {
        // Get the actual typed value
        const typedValue = this.getTypedVariableValue(variable)

        // Format the typed value for string interpolation
        const formattedValue: string = this.formatValueForInterpolation(
          typedValue,
          variable.type,
          currentBlock
        )
        resolvedValue = resolvedValue.replace(match, formattedValue)
      } else {
        // Variable not found - leave the placeholder <variable.name> in the string? Or replace with empty string?
        // For now, let's leave it, which matches previous behavior implicitly.
        logger.warn(
          `Interpolated variable reference <variable.${variableName}> not found. Leaving as literal.`
        )
      }
    }

    return resolvedValue
  }

  /**
   * Resolves block references in a string (<blockId.property> or <blockName.property>).
   * Handles inactive paths, missing blocks, and formats values appropriately.
   */
  resolveBlockReferences(
    value: string,
    context: ExecutionContext,
    currentBlock: SerializedBlock
  ): string {
    // Skip resolution for API block body content that looks like XML
    if (
      currentBlock.metadata?.id === 'api' &&
      typeof value === 'string' &&
      // Check if this looks like XML content
      (value.includes('<?xml') || value.includes('xmlns:') || value.includes('</')) &&
      value.includes('<') &&
      value.includes('>')
    ) {
      return value
    }

    const blockMatches = value.match(/<([^>]+)>/g)
    if (!blockMatches) return value

    // If we're in an API block body, check each match to see if it looks like XML rather than a reference
    if (
      currentBlock.metadata?.id === 'api' &&
      blockMatches.some((match) => {
        const innerContent = match.slice(1, -1)
        // Patterns that suggest this is XML, not a block reference:
        return (
          innerContent.includes(':') || // namespaces like soap:Envelope
          innerContent.includes('=') || // attributes like xmlns="http://..."
          innerContent.includes(' ') || // any space indicates attributes
          innerContent.includes('/') || // self-closing tags
          innerContent.includes('<') ||
          innerContent.includes('>') // nested XML tags
        )
      })
    ) {
      return value // Likely XML content, return unchanged
    }

    let resolvedValue = value

    // Check if we're in a template literal for function blocks
    const isInTemplateLiteral =
      currentBlock.metadata?.id === 'function' &&
      (/\${[^}]*</.test(value) || /<[^>]*}}\$/.test(value))

    for (const match of blockMatches) {
      // Skip variables - they've already been processed
      if (match.startsWith('<variable.')) {
        continue
      }

      const path = match.slice(1, -1)
      const [blockRef, ...pathParts] = path.split('.')

      // Skip XML-like tags (check for XML characteristics)
      if (
        blockRef.includes(':') ||
        blockRef.includes(' ') ||
        blockRef.includes('=') ||
        blockRef.includes('/')
      ) {
        continue
      }

      // Special case for "start" references
      if (blockRef.toLowerCase() === 'start') {
        // Find the starter block
        const starterBlock = this.workflow.blocks.find((block) => block.metadata?.id === 'starter')
        if (starterBlock) {
          const blockState = context.blockStates.get(starterBlock.id)
          if (blockState) {
            // Navigate through the path parts
            let replacementValue: any = blockState.output

            for (const part of pathParts) {
              if (!replacementValue || typeof replacementValue !== 'object') {
                logger.warn(
                  `[resolveBlockReferences] Invalid path "${part}" - replacementValue is not an object:`,
                  replacementValue
                )
                throw new Error(`Invalid path "${part}" in "${path}" for starter block.`)
              }

              replacementValue = replacementValue[part]

              if (replacementValue === undefined) {
                logger.warn(
                  `[resolveBlockReferences] No value found at path "${part}" in starter block.`
                )
                throw new Error(`No value found at path "${path}" in starter block.`)
              }
            }

            // Format the value based on block type and path
            let formattedValue: string

            // Special handling for all blocks referencing starter input
            if (blockRef.toLowerCase() === 'start' && pathParts.join('.').includes('input')) {
              const blockType = currentBlock.metadata?.id

              // Format based on which block is consuming this value
              if (typeof replacementValue === 'object' && replacementValue !== null) {
                // For function blocks, preserve the object structure for code usage
                if (blockType === 'function') {
                  formattedValue = JSON.stringify(replacementValue)
                }
                // For API blocks, handle body special case
                else if (blockType === 'api') {
                  formattedValue = JSON.stringify(replacementValue)
                }
                // For condition blocks, ensure proper formatting
                else if (blockType === 'condition') {
                  formattedValue = stringifyForCondition(replacementValue)
                }
                // For all other blocks, stringify objects
                else {
                  formattedValue = JSON.stringify(replacementValue)
                }
              } else {
                // For primitive values
                formattedValue = String(replacementValue)
              }
            } else {
              // Standard handling for non-input references
              // Special handling for agent/LLM response objects
              if (
                typeof replacementValue === 'object' &&
                replacementValue !== null &&
                'content' in replacementValue &&
                typeof replacementValue.content === 'string' &&
                ('model' in replacementValue || 'tokens' in replacementValue)
              ) {
                formattedValue = replacementValue.content
              } else {
                formattedValue =
                  typeof replacementValue === 'object'
                    ? JSON.stringify(replacementValue)
                    : String(replacementValue)
              }
            }

            resolvedValue = resolvedValue.replace(match, formattedValue)
            continue
          }
        }
      }

      // Special case for "loop" references - allows accessing loop properties
      if (blockRef.toLowerCase() === 'loop') {
        // Find which loop this block belongs to
        let containingLoopId: string | undefined

        for (const [loopId, loop] of Object.entries(context.workflow?.loops || {})) {
          if (loop.nodes.includes(currentBlock.id)) {
            containingLoopId = loopId
            break
          }
        }

        if (containingLoopId) {
          const loop = context.workflow?.loops[containingLoopId]
          const loopType = loop?.loopType || 'for'

          // Handle each loop property
          if (pathParts[0] === 'currentItem') {
            // Get the items to iterate over
            const items = this.getLoopItems(loop, context)

            // Get the correct index using the LoopManager
            const index = this.loopManager
              ? this.loopManager.getLoopIndex(containingLoopId, currentBlock.id, context)
              : context.loopIterations.get(containingLoopId) || 0

            // Get the current item directly from the items array at the current index
            if (Array.isArray(items) && index >= 0 && index < items.length) {
              const currentItem = items[index]

              // Format the value based on type
              if (currentItem !== undefined) {
                if (typeof currentItem !== 'object' || currentItem === null) {
                  // Format primitive values properly for code contexts
                  resolvedValue = resolvedValue.replace(
                    match,
                    formatValueForCodeContext(currentItem, currentBlock, isInTemplateLiteral)
                  )
                } else if (
                  Array.isArray(currentItem) &&
                  currentItem.length === 2 &&
                  typeof currentItem[0] === 'string'
                ) {
                  // Handle [key, value] pair from Object.entries()
                  if (pathParts.length > 1) {
                    if (pathParts[1] === 'key') {
                      resolvedValue = resolvedValue.replace(
                        match,
                        formatValueForCodeContext(currentItem[0], currentBlock, isInTemplateLiteral)
                      )
                    } else if (pathParts[1] === 'value') {
                      resolvedValue = resolvedValue.replace(
                        match,
                        formatValueForCodeContext(currentItem[1], currentBlock, isInTemplateLiteral)
                      )
                    }
                  } else {
                    // Default to stringifying the whole item
                    resolvedValue = resolvedValue.replace(match, JSON.stringify(currentItem))
                  }
                } else {
                  // Navigate path if provided for objects
                  if (pathParts.length > 1) {
                    let itemValue = currentItem
                    for (let i = 1; i < pathParts.length; i++) {
                      if (!itemValue || typeof itemValue !== 'object') {
                        throw new Error(
                          `Invalid path "${pathParts[i]}" in loop item reference "${path}"`
                        )
                      }
                      itemValue = itemValue[pathParts[i]]
                      if (itemValue === undefined) {
                        throw new Error(`No value found at path "${path}" in loop item`)
                      }
                    }

                    // Use the formatter helper method
                    resolvedValue = resolvedValue.replace(
                      match,
                      formatValueForCodeContext(itemValue, currentBlock, isInTemplateLiteral)
                    )
                  } else {
                    // Return the whole item as JSON
                    resolvedValue = resolvedValue.replace(match, JSON.stringify(currentItem))
                  }
                }
              }

              continue
            }
          } else if (pathParts[0] === 'items' && loopType === 'forEach') {
            // Get all items in the forEach loop
            const items = this.getLoopItems(loop, context)

            if (items) {
              // Format the items using our helper
              resolvedValue = resolvedValue.replace(
                match,
                formatValueForCodeContext(items, currentBlock, isInTemplateLiteral)
              )
              continue
            }
          } else if (pathParts[0] === 'index') {
            // Use the LoopManager to get the correct index
            const index = this.loopManager
              ? this.loopManager.getLoopIndex(containingLoopId, currentBlock.id, context)
              : context.loopIterations.get(containingLoopId) || 0

            // For function blocks, we don't need to quote numbers, but use the formatter for consistency
            resolvedValue = resolvedValue.replace(
              match,
              formatValueForCodeContext(index, currentBlock, isInTemplateLiteral)
            )
            continue
          }
        }
      }

      // Standard block reference resolution
      let sourceBlock = this.blockById.get(blockRef)
      if (!sourceBlock) {
        // Try to find by normalized name (case-insensitive, whitespace removed)
        const normalizedRef = normalizeBlockName(blockRef)
        sourceBlock = this.blockByNormalizedName.get(normalizedRef)
      }

      if (!sourceBlock) {
        // Fallback: aggressive normalization (strip all non-alphanumeric) for backward compatibility
        const aggressiveRef = blockRef.toLowerCase().replace(/[^a-z0-9]/g, '')
        for (const [, block] of this.blockByNormalizedName) {
          const aggressiveName = (block.metadata?.name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
          if (aggressiveName === aggressiveRef) {
            sourceBlock = block
            break
          }
        }
      }

      if (!sourceBlock) {
        // Try to find by exact name match (case sensitive)
        sourceBlock = this.workflow.blocks.find((block) => block.metadata?.name === blockRef)
      }

      if (!sourceBlock) {
        // Block reference not found — log warning and replace with empty string
        // instead of crashing the entire workflow execution
        const availableBlockNames = Array.from(this.blockByNormalizedName.keys()).join(', ')
        logger.warn(
          `Block reference "${blockRef}" was not found. ` +
            `Available block names: ${availableBlockNames}. ` +
            `The reference will be replaced with an empty value.`
        )
        resolvedValue = resolvedValue.replace(match, '')
        continue
      }

      if (sourceBlock.enabled === false) {
        throw new Error(
          `Block "${sourceBlock.metadata?.name || sourceBlock.id}" is disabled, and block "${currentBlock.metadata?.name || currentBlock.id}" depends on it.`
        )
      }

      const isInActivePath = context.activeExecutionPath.has(sourceBlock.id)

      if (!isInActivePath) {
        resolvedValue = resolvedValue.replace(match, '')
        continue
      }

      const blockState = context.blockStates.get(sourceBlock.id)

      if (!blockState) {
        // Check if the source block has been executed
        if (!context.executedBlocks.has(sourceBlock.id)) {
          // Check if the source block is in the current execution path (potential circular dependency)
          if (context.activeExecutionPath.has(sourceBlock.id)) {
            throw new Error(
              `Circular dependency detected: Block "${currentBlock.metadata?.name || currentBlock.id}" depends on block "${sourceBlock.metadata?.name || sourceBlock.id}" which is in the current execution path.`
            )
          }
        }

        // If the block is in a loop, return empty string
        const isInLoop = Object.values(this.workflow.loops || {}).some((loop) =>
          loop.nodes.includes(sourceBlock.id)
        )

        if (isInLoop) {
          resolvedValue = resolvedValue.replace(match, '')
          continue
        }

        // If the block hasn't been executed and isn't in the active path,
        // it means it's in an inactive branch - return empty string
        if (!context.activeExecutionPath.has(sourceBlock.id)) {
          resolvedValue = resolvedValue.replace(match, '')
          continue
        }

        throw new Error(
          `No state found for block "${sourceBlock.metadata?.name || sourceBlock.id}" (ID: ${sourceBlock.id}).`
        )
      }

      let replacementValue: any = blockState.output

      // Validate that the block state has proper output
      if (!replacementValue) {
        throw new Error(
          `Block "${sourceBlock.metadata?.name || sourceBlock.id}" has no output data available.`
        )
      }

      // Handle path navigation
      if (pathParts.length === 0) {
        // No path specified - return the entire output
        // Keep replacementValue as is (full block output)
      } else {
        // Path specified - navigate to the specific field
        // Don't assume response wrapper exists, work with actual structure
      }

      for (const part of pathParts) {
        if (!replacementValue || typeof replacementValue !== 'object') {
          throw new Error(
            `Invalid path "${part}" in "${path}" for block "${sourceBlock.metadata?.name || sourceBlock.id}". Current value is ${typeof replacementValue}: ${JSON.stringify(replacementValue)?.substring(0, 100)}...`
          )
        }

        const previousValue = replacementValue
        replacementValue = replacementValue[part]

        if (replacementValue === undefined) {
          const availableKeys = Object.keys(previousValue)
          throw new Error(
            `No value found at path "${path}" in block "${sourceBlock.metadata?.name || sourceBlock.id}". Available keys: [${availableKeys.join(', ')}]`
          )
        }
      }

      let formattedValue: string

      if (currentBlock.metadata?.id === 'condition') {
        formattedValue = stringifyForCondition(replacementValue)
      } else if (
        typeof replacementValue === 'string' &&
        needsCodeStringLiteral(currentBlock, value)
      ) {
        // Check if we're in a template literal
        const isInTemplateLiteral =
          currentBlock.metadata?.id === 'function' &&
          (/\${[^}]*</.test(value) || /<[^>]*}\$/.test(value))

        // For code blocks, use our formatter
        formattedValue = formatValueForCodeContext(
          replacementValue,
          currentBlock,
          isInTemplateLiteral
        )
      } else {
        // Special handling for agent/LLM response objects
        // If the replacement value is an object with a 'content' field (typical for agent blocks),
        // and the user is referencing the entire response object, use the content field
        if (
          typeof replacementValue === 'object' &&
          replacementValue !== null &&
          'content' in replacementValue &&
          typeof replacementValue.content === 'string' &&
          // Check if this is a complete response object (has typical agent response fields)
          ('model' in replacementValue || 'tokens' in replacementValue)
        ) {
          // Use the content field for text-based outputs
          formattedValue = replacementValue.content
        } else {
          // Standard formatting
          formattedValue =
            typeof replacementValue === 'object'
              ? JSON.stringify(replacementValue)
              : String(replacementValue)
        }
      }

      resolvedValue = resolvedValue.replace(match, formattedValue)
    }

    return resolvedValue
  }

  /**
   * Resolves environment variables in any value ({{ENV_VAR}}).
   * Only processes environment variables in apiKey fields or when explicitly needed.
   */
  resolveEnvVariables(value: any, isApiKey: boolean = false): any {
    if (typeof value === 'string') {
      // Only process environment variables if:
      // 1. This is an API key field
      // 2. String is a complete environment variable reference ({{ENV_VAR}})
      // 3. String contains environment variable references in proper contexts (auth headers, URLs)
      const isExplicitEnvVar = value.trim().startsWith('{{') && value.trim().endsWith('}}')
      const hasProperEnvVarReferences = containsProperEnvVarReference(value)

      if (isApiKey || isExplicitEnvVar || hasProperEnvVarReferences) {
        const envMatches = value.match(/\{\{([^}]+)\}\}/g)
        if (envMatches) {
          let resolvedValue = value
          for (const match of envMatches) {
            const envKey = match.slice(2, -2)
            const envValue = this.environmentVariables[envKey]

            if (envValue === undefined) {
              throw new Error(`Environment variable "${envKey}" was not found.`)
            }

            resolvedValue = resolvedValue.replace(match, envValue)
          }
          return resolvedValue
        }
      }
      return value
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolveEnvVariables(item, isApiKey))
    }

    if (value && typeof value === 'object') {
      return Object.entries(value).reduce(
        (acc, [k, v]) => ({
          ...acc,
          [k]: this.resolveEnvVariables(v, k.toLowerCase() === 'apikey'),
        }),
        {}
      )
    }

    return value
  }

  /**
   * Resolves references and environment variables in any nested structure (object or array).
   */
  private resolveNestedStructure(
    value: any,
    context: ExecutionContext,
    currentBlock: SerializedBlock
  ): any {
    // Handle null or undefined
    if (value === null || value === undefined) {
      return value
    }

    // Handle strings
    if (typeof value === 'string') {
      // First resolve variable references
      const resolvedVars = this.resolveVariableReferences(value, currentBlock)

      // Then resolve block references
      const resolvedReferences = this.resolveBlockReferences(resolvedVars, context, currentBlock)

      // Check if this is an API key field
      const isApiKey = isApiKeyField(currentBlock, value)

      // Then resolve environment variables with the API key flag
      return this.resolveEnvVariables(resolvedReferences, isApiKey)
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item) => this.resolveNestedStructure(item, context, currentBlock))
    }

    // Handle objects
    if (typeof value === 'object') {
      const result: Record<string, any> = {}
      for (const [k, v] of Object.entries(value)) {
        const isApiKey = k.toLowerCase() === 'apikey'
        result[k] = this.resolveNestedStructure(v, context, currentBlock)
      }
      return result
    }

    // Return primitives as is
    return value
  }

  /**
   * Helper method to find a variable by its name.
   * Handles normalization of names (removing spaces) for consistent matching.
   */
  private findVariableByName(variableName: string): any | undefined {
    const foundVariable = Object.entries(this.workflowVariables).find(
      ([_, variable]) => (variable.name || '').replace(/\s+/g, '') === variableName
    )

    return foundVariable ? foundVariable[1] : undefined
  }

  /**
   * Gets the items for a forEach loop.
   */
  private getLoopItems(loop: any, context: ExecutionContext): any[] | Record<string, any> | null {
    if (!loop) return null

    // If items are already available as an array or object, return them directly
    if (loop.forEachItems) {
      if (
        Array.isArray(loop.forEachItems) ||
        (typeof loop.forEachItems === 'object' && loop.forEachItems !== null)
      ) {
        return loop.forEachItems
      }

      // If it's a string, try to evaluate it (could be an expression or JSON)
      if (typeof loop.forEachItems === 'string') {
        try {
          // Check if it's valid JSON
          const trimmedExpression = loop.forEachItems.trim()
          if (trimmedExpression.startsWith('[') || trimmedExpression.startsWith('{')) {
            try {
              // Try to parse as JSON first
              // Handle both JSON format (double quotes) and JS format (single quotes)
              const normalizedExpression = trimmedExpression
                .replace(/'/g, '"') // Replace all single quotes with double quotes
                .replace(/(\w+):/g, '"$1":') // Convert property names to double-quoted strings
                .replace(/,\s*]/g, ']') // Remove trailing commas before closing brackets
                .replace(/,\s*}/g, '}') // Remove trailing commas before closing braces

              return JSON.parse(normalizedExpression)
            } catch (jsonError) {
              logger.error('Error parsing JSON for loop:', jsonError)
              // If JSON parsing fails, continue with expression evaluation
            }
          }

          // If not valid JSON or JSON parsing failed, try to evaluate as an expression
          if (trimmedExpression && !trimmedExpression.startsWith('//')) {
            const result = new Function('context', `return ${loop.forEachItems}`)(context)
            if (Array.isArray(result) || (typeof result === 'object' && result !== null)) {
              return result
            }
          }
        } catch (e) {
          logger.error('Error evaluating forEach items:', e)
        }
      }
    }

    // As a fallback, look for the most recent array or object in any block's output
    // This is less reliable but might help in some cases
    for (const [blockId, blockState] of context.blockStates.entries()) {
      const output = blockState.output
      if (output) {
        for (const [key, value] of Object.entries(output)) {
          if (Array.isArray(value) && value.length > 0) {
            return value
          } else if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) {
            return value
          }
        }
      }
    }

    // Default to empty array if no valid items found
    return []
  }
}
